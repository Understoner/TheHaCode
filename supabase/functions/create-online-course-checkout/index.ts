// Einen Onlinekurs kaufen: die Zahlung bei Stripe bestellen (V1.2, SAD §11.2).
//
// WAS DIESE FUNKTION ENTSCHEIDET - UND WAS NICHT
// -----------------------------------------------
// Sie schaltet NICHTS frei. Das tut allein der Webhook, wenn Stripe die
// Zahlung meldet (course_access, nur service_role). Hier wird der Preis
// bestimmt und eine bezahlbare Seite bestellt.
//
// DER PREIS ENTSTEHT NUR HIER
// ---------------------------
// Der Client schickt nur den Slug. Preis und Plus-Rabatt (15 %) kommen aus
// der Datenbank: price_cents am Kurs und has_plus_access() fuer das
// anrufende Konto - abgefragt mit SEINEM Token, nicht mit dem
// service_role-Schluessel, sonst antwortete die Funktion fuer niemanden.
// Kein Stripe-Gutschein im Dashboard: der Preis steht ohnehin am Kurs
// (wie bei den Praesenzkursen), und eine zweite Stelle waere eine zweite
// Wahrheit.
//
// NUR MIT KONTO (Entscheidung 03.11.2026)
// ---------------------------------------
// Ohne Konto gibt es keinen Fortschritt, also auch keinen Kauf. Anders als bei
// den Praesenzkursen gibt es keine Gastbuchung.
//
// RUECKTRITTSRECHT (§ 18 Abs. 1 Z 11 FAGG)
// ----------------------------------------
// Wie beim Abo (create-checkout) sammelt Stripe die Zustimmung zu den AGB ein,
// und derselbe Haken enthaelt das ausdrueckliche Verlangen des sofortigen
// Beginns samt Kenntnis, dass das Ruecktrittsrecht erlischt. Der Wortlaut
// steht hier (Git-Historie = Nachweis der Fassung). Dieselbe Bestaetigung
// steht in der Beschreibung der Zahlung und damit auf dem Beleg.

import { createClient } from 'jsr:@supabase/supabase-js@2.118.0';
import Stripe from 'npm:stripe@18.5.0';

import { json, preflight } from '../_shared/http.ts';
import { ONLINE_COURSE_KIND, onlineCoursePrice, PLUS_DISCOUNT_PERCENT } from '../_shared/online-courses.ts';

type CheckoutRequest = { courseSlug?: unknown };

/** Stripe verlangt mindestens 30 Minuten. */
const SESSION_MINUTES = 30;

const tosHinweis = (appUrl: string) =>
  `Mit dem Haken stimmst du den [AGB](${appUrl}/agb) zu. Du verlangst ` +
  'zugleich ausdrücklich, dass wir den Onlinekurs sofort freischalten, und ' +
  'nimmst zur Kenntnis, dass dein Rücktrittsrecht damit erlischt, sobald der ' +
  'Zugang freigeschaltet ist (§ 18 Abs. 1 Z 11 FAGG).';

const belegHinweis = (title: string, days: number) =>
  `Onlinekurs „${title}“, Zugang ${days} Tage ab Kauf, keine automatische ` +
  'Verlängerung. Sofortige Freischaltung verlangt; das Rücktrittsrecht ' +
  'erlischt damit (§ 18 Abs. 1 Z 11 FAGG).';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  const options = preflight(request);
  if (options) return options;

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const appUrl = Deno.env.get('APP_URL');

  if (!url || !anonKey || !serviceRoleKey || !stripeKey || !appUrl) {
    console.error('create-online-course-checkout ist nicht vollstaendig konfiguriert');
    return json({ error: 'not_configured' }, 500, origin);
  }

  // ---------- 1. Wer ruft an? Antwort von Supabase, nie aus der Anfrage. ----------
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return json({ error: 'login_required' }, 401, origin);

  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return json({ error: 'bad_request' }, 400, origin);
  }
  const courseSlug = body.courseSlug;
  if (typeof courseSlug !== 'string' || courseSlug.length === 0) {
    return json({ error: 'bad_request' }, 400, origin);
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- 2. Kurs und Preis ----------
  const { data: course, error: courseError } = await adminClient
    .from('online_courses')
    .select('id, slug, title, access, price_cents, access_days, is_published')
    .eq('slug', courseSlug)
    .maybeSingle();

  if (courseError) {
    console.error('Onlinekurs konnte nicht gelesen werden', courseError.message);
    return json({ error: 'lookup_failed' }, 500, origin);
  }
  if (!course || !course.is_published || course.access !== 'paid' || !course.price_cents) {
    return json({ error: 'not_purchasable' }, 409, origin);
  }

  // Wer den Kurs gerade offen hat, kauft ihn nicht ein zweites Mal. Nach
  // Ablauf ist ein erneuter Kauf erlaubt (Entscheidung 03.11.2026).
  const { data: active, error: activeError } = await adminClient
    .from('course_access')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  if (activeError) {
    console.error('Bestehender Zugang nicht pruefbar', activeError.message);
    return json({ error: 'lookup_failed' }, 500, origin);
  }
  if (active && active.length > 0) return json({ error: 'already_owned' }, 409, origin);

  // Plus mit dem Token des Kaeufers - has_plus_access() kennt nur auth.uid().
  const { data: hasPlus, error: plusError } = await userClient.rpc('has_plus_access');
  if (plusError) {
    // Lieber abbrechen als zum falschen Preis verkaufen - in beide Richtungen.
    console.error('Plus nicht pruefbar', plusError.message);
    return json({ error: 'lookup_failed' }, 500, origin);
  }

  const price = onlineCoursePrice(course.price_cents, hasPlus === true);

  // ---------- 3. Bei Stripe bestellen ----------
  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
  const metadata = {
    payment_kind: ONLINE_COURSE_KIND,
    course_id: course.id,
    course_slug: course.slug,
    user_id: user.id,
    plus_discount: price.discountCents > 0 ? String(PLUS_DISCOUNT_PERCENT) : '0',
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'de',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: price.amountCents,
            product_data: {
              name: `Onlinekurs: ${course.title}`,
              description:
                price.discountCents > 0
                  ? `Plus-Preis (${PLUS_DISCOUNT_PERCENT} % Rabatt). Zugang ${course.access_days} Tage ab Kauf.`
                  : `Zugang ${course.access_days} Tage ab Kauf.`,
            },
          },
        },
      ],
      client_reference_id: user.id,
      metadata,
      payment_intent_data: {
        metadata,
        description: belegHinweis(course.title, course.access_days),
      },
      customer_email: user.email ?? undefined,
      consent_collection: { terms_of_service: 'required' },
      custom_text: { terms_of_service_acceptance: { message: tosHinweis(appUrl) } },
      // Kleinunternehmerregelung (SAD §4.5): keine Steuerberechnung.
      automatic_tax: { enabled: false },
      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      success_url: `${appUrl}/onlinekurse/${encodeURIComponent(course.slug)}?kauf=erfolg`,
      cancel_url: `${appUrl}/onlinekurse/${encodeURIComponent(course.slug)}?kauf=abgebrochen`,
    });

    if (!session.url) throw new Error('Stripe lieferte keine Checkout-Adresse');
    return json({ url: session.url }, 200, origin);
  } catch (error) {
    console.error('Onlinekurs-Checkout fehlgeschlagen', error instanceof Error ? error.message : error);
    return json({ error: 'checkout_failed' }, 502, origin);
  }
});
