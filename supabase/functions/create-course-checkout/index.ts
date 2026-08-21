// Einen Kursplatz reservieren und die Zahlung bei Stripe bestellen (T20).
//
// WAS DIESE FUNKTION ENTSCHEIDET - UND WAS NICHT
// -----------------------------------------------
// Sie entscheidet NICHT, ob jemand am Kurs teilnimmt. Das tut allein der
// Webhook, wenn Stripe die Zahlung meldet. Hier wird ein Platz gehalten und
// eine bezahlbare Seite bestellt. Faellt diese Funktion aus, kann niemand
// buchen - aber niemand verliert einen bezahlten Platz.
//
// DER UNTERSCHIED ZU create-checkout
// ----------------------------------
//   mode: 'payment' statt 'subscription' - ein Kurs ist eine Einmalzahlung.
//   Kein Blick in public.subscriptions: "hat schon ein Abo" ist fuer einen
//   Workshop ohne Bedeutung, und ein Abonnent bekommt keinen Kurs geschenkt.
//   Dafuer der Platz: er wird VOR der Zahlung gehalten, sonst verkaufen wir
//   denselben zweimal.
//
// DIE REIHENFOLGE IST DIE GANZE MIETE
// -----------------------------------
//   1. Wer ruft an?            - Antwort von Supabase, nie aus der Anfrage.
//   2. Platz reservieren       - in der Datenbank, unter Sperre (Migration 0011).
//   3. Erst dann zu Stripe     - mit der Buchungs-ID in den Metadaten.
// Andersherum - erst zahlen, dann zaehlen - waere die Ueberbuchung eingebaut.
//
// Scheitert Schritt 3, wird die Reservierung sofort wieder freigegeben. Sonst
// blockierte ein Stripe-Ausfall den Platz bis zum Ablauf der Haltezeit.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';

import { json, preflight } from '../_shared/http.ts';

type CourseCheckoutRequest = { courseSlug?: unknown; agbAccepted?: unknown };

/** So lange haelt die Datenbank den Platz ... */
const HOLD_MINUTES = 40;
/** ... und so lange ist die Stripe-Sitzung gueltig. Stripe verlangt
 *  mindestens 30 Minuten; die Reservierung ueberlebt die Sitzung bewusst,
 *  damit nicht die Sperre ablaeuft, waehrend jemand noch bezahlt. */
const SESSION_MINUTES = 32;

/** Die Fehlercodes aus reserve_course_seat() (Migration 0011). */
const RESERVATION_ERRORS: Record<string, { error: string; status: number }> = {
  PT001: { error: 'not_bookable', status: 409 },
  PT002: { error: 'sold_out', status: 409 },
  PT003: { error: 'already_booked', status: 409 },
  PT004: { error: 'agb_required', status: 400 },
};

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  const options = preflight(request);
  if (options) return options;

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const appUrl = Deno.env.get('APP_URL');

  if (!url || !anonKey || !serviceRoleKey || !stripeKey || !appUrl) {
    console.error('create-course-checkout ist nicht vollstaendig konfiguriert');
    return json({ error: 'not_configured' }, 500, origin);
  }

  // ---------- 1. Wer ruft an? ----------
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401, origin);
  const user = userData.user;

  let body: CourseCheckoutRequest;
  try {
    body = (await request.json()) as CourseCheckoutRequest;
  } catch {
    return json({ error: 'bad_request' }, 400, origin);
  }

  const courseSlug = body.courseSlug;
  if (typeof courseSlug !== 'string' || courseSlug.length === 0) {
    return json({ error: 'bad_request' }, 400, origin);
  }

  // § 11 AGB: die Anmeldung wird mit der Bestaetigung verbindlich, und dafuer
  // muessen die AGB einbezogen sein. Die Datenbank prueft es noch einmal
  // (PT004) - hier steht es, damit der Nutzer eine verstaendliche Antwort
  // bekommt statt eines Datenbankfehlers.
  if (body.agbAccepted !== true) {
    return json({ error: 'agb_required' }, 400, origin);
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: course, error: courseError } = await adminClient
    .from('courses')
    .select('id, slug, title, price_cents, deposit_cents, starts_at, location, booking_enabled')
    .eq('slug', courseSlug)
    .maybeSingle();

  if (courseError) {
    console.error('Kurs konnte nicht gelesen werden', courseError.message);
    return json({ error: 'lookup_failed' }, 500, origin);
  }

  if (!course || !course.booking_enabled) {
    return json({ error: 'not_bookable' }, 409, origin);
  }

  // ---------- 2. Den Platz halten ----------
  const { data: booking, error: reserveError } = await adminClient.rpc('reserve_course_seat', {
    p_course_id: course.id,
    p_user_id: user.id,
    p_agb_accepted: true,
  });

  if (reserveError) {
    const known = RESERVATION_ERRORS[reserveError.code ?? ''];
    if (known) return json({ error: known.error }, known.status, origin);

    console.error('Reservierung fehlgeschlagen', reserveError.code, reserveError.message);
    return json({ error: 'reservation_failed' }, 500, origin);
  }

  if (!booking) {
    console.error('Reservierung lieferte keine Buchung');
    return json({ error: 'reservation_failed' }, 500, origin);
  }

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  // Eine aeltere Sitzung derselben Buchung verfaellt - sonst haette jemand,
  // der zurueck geht und neu bucht, zwei bezahlbare Seiten fuer einen Platz.
  if (booking.stripe_checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(booking.stripe_checkout_session_id);
    } catch (error) {
      // Sie kann laengst abgelaufen oder bezahlt sein; beides ist kein Grund,
      // die neue Buchung scheitern zu lassen.
      console.warn(
        'Alte Checkout-Sitzung liess sich nicht beenden',
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Anzahlung oder alles? Entschieden hat das die Datenbank (§ 11 AGB, siehe
  // Migration 0011) - hier wird das Ergebnis nur noch abgelesen.
  const isDeposit = typeof booking.deposit_cents === 'number' && booking.deposit_cents > 0;
  const amountNow = isDeposit ? booking.deposit_cents : booking.amount_total_cents;
  const outstanding = booking.amount_total_cents - amountNow;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'de',

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amountNow,
            // Preise stehen am Kurs in der Datenbank, nicht als Price im
            // Stripe-Dashboard: sonst muesste die Redaktion jeden Kurs an zwei
            // Stellen pflegen, und ein vergessener Schritt waere ein falscher
            // Preis (SAD §2.4 - Redaktion laeuft im Studio).
            product_data: {
              name: course.title,
              description: isDeposit
                ? `Anzahlung - Restbetrag ${(outstanding / 100).toFixed(2)} EUR, faellig vier Wochen vor Beginn`
                : undefined,
            },
          },
        },
      ],

      // Die Bruecke zwischen Zahlung und Buchung. client_reference_id sagt, wer
      // zahlt; booking_id sagt, wofuer. Beides kommt im Webhook zurueck.
      client_reference_id: user.id,
      metadata: {
        booking_id: booking.id,
        user_id: user.id,
        course_slug: course.slug,
        payment_kind: isDeposit ? 'course_deposit' : 'course_full',
      },
      payment_intent_data: {
        metadata: { booking_id: booking.id, user_id: user.id },
      },

      customer_email: user.email,

      // Kleinunternehmerregelung (SAD §4.5): keine Steuerberechnung.
      automatic_tax: { enabled: false },

      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,

      success_url: `${appUrl}/kurse?buchung=erfolg&kurs=${encodeURIComponent(course.slug)}`,
      cancel_url: `${appUrl}/kurse?buchung=abgebrochen&kurs=${encodeURIComponent(course.slug)}`,
    });

    if (!session.url) {
      throw new Error('Stripe lieferte keine Checkout-Adresse');
    }

    const { error: updateError } = await adminClient
      .from('course_bookings')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', booking.id);

    if (updateError) {
      // Die Sitzung steht schon; sie traegt die booking_id in den Metadaten,
      // der Webhook findet die Buchung also auch ohne diese Spalte. Deshalb
      // kein Abbruch - nur ein Eintrag im Log.
      console.error('Sitzungs-ID nicht an der Buchung vermerkt', updateError.message);
    }

    return json({ url: session.url }, 200, origin);
  } catch (error) {
    // Der Platz gehoert wieder in den Verkauf. Ohne das haelt ein
    // Stripe-Ausfall ihn 40 Minuten lang besetzt.
    const { error: releaseError } = await adminClient
      .from('course_bookings')
      .update({ status: 'expired', reserved_until: null })
      .eq('id', booking.id)
      .eq('status', 'reserved');

    if (releaseError) {
      console.error('Reservierung liess sich nicht freigeben', releaseError.message);
    }

    console.error('Kurs-Checkout fehlgeschlagen', error instanceof Error ? error.message : error);
    return json({ error: 'checkout_failed' }, 502, origin);
  }
});
