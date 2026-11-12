// Der Stripe-Webhook - die einzige Stelle, die Abos schreibt.
//
// ACHTUNG BEI AENDERUNGEN: hier scheitert ein Fehler nicht laut. Er schaltet
// still frei oder still nicht frei (CLAUDE.md, Aufgabenteilung). Die vier
// Regeln, die nicht verhandelbar sind - SAD §4.3:
//
//   1. SIGNATUR GEGEN DEN ROHTEXT. req.text(), niemals req.json(): schon ein
//      neu serialisiertes Leerzeichen bricht die HMAC-Pruefung. Und
//      constructEventAsync, weil die synchrone Variante im Deno-Runtime nicht
//      laeuft.
//   2. KEIN JWT. Stripe schickt keins. Die Echtheit kommt ausschliesslich aus
//      der Signatur - deshalb steht verify_jwt = false in config.toml. Faellt
//      Regel 1, faellt damit alles.
//   3. IDEMPOTENZ ZUERST. Stripe liefert Ereignisse mehrfach aus.
//   4. IMMER SCHNELL ANTWORTEN. Fehler -> 500, damit Stripe es erneut
//      versucht. Niemals stumm schlucken und 200 melden.
//
// Die Zuordnung zum Konto kommt nie aus der E-Mail-Adresse, sondern aus
// client_reference_id bzw. metadata.user_id (SAD §4.3 Punkt 5). Das steckt in
// _shared/stripe-events.ts und ist dort getestet.
//
// ZWEI ZWEIGE, EINE TRENNLINIE (T20)
// ----------------------------------
// Seit es Kursbuchungen gibt, kommen hier zwei Sorten Zahlung an. Die
// Trennlinie ist metadata.payment_kind, gesetzt von create-course-checkout:
//
//   gesetzt      -> Kurszweig. Beruehrt public.course_bookings, sonst nichts.
//   nicht gesetzt -> Abozweig. Beruehrt public.subscriptions, sonst nichts.
//
// Die Zusicherung, auf der T20 steht: eine Kursbuchung erzeugt unter keinen
// Umstaenden eine Zeile in subscriptions und verschafft niemandem Plus. Sie
// haelt an genau dieser Stelle - und in 011_course_bookings.test.sql steht der
// Test dazu.
//
// DRITTER ZWEIG: ONLINEKURSE (V1.2, seit 03.11.2026)
// --------------------------------------------------
//   payment_kind = 'online_course' -> Onlinekurszweig. Schreibt genau eine
//   Zeile in public.course_access, sonst nichts - kein Abo, kein Plus, keine
//   Kursbuchung. Er kommt zuerst dran; seine Kennzeichnung ist eindeutig.
//   Idempotent ueber stripe_checkout_session_id (unique): eine zweite
//   Zustellung derselben Zahlung legt keinen zweiten Zugang an.

import { createClient } from 'jsr:@supabase/supabase-js@2.118.0';
import Stripe from 'npm:stripe@18.5.0';

import {
  bookingUpdateFor,
  coursePaymentFacts,
  type BookingRow,
  type StripeCourseSessionLike,
} from '../_shared/course-bookings.ts';
import { courseAccessRowFor, onlineCoursePaymentFacts } from '../_shared/online-courses.ts';
import { isStripeResourceMissing } from '../_shared/account-deletion.ts';
import {
  checkoutFacts,
  isMissingAccountError,
  isRelevantEvent,
  mapSubscription,
  subscriptionIdFromInvoice,
  type StripeSubscriptionLike,
  type SubscriptionRow,
} from '../_shared/stripe-events.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  if (!url || !serviceRoleKey || !stripeKey || !webhookSecret) {
    console.error('stripe-webhook ist nicht vollstaendig konfiguriert');
    // 500, nicht 200: eine fehlende Konfiguration ist ein Ausfall, kein
    // erledigtes Ereignis. Stripe versucht es erneut, und in der Zwischenzeit
    // faellt es im Stripe-Dashboard als fehlgeschlagen auf.
    return new Response('not configured', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  // ---------- Regel 1: Signatur gegen den Rohtext ----------
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    // 400 und kein Retry: eine ungueltige Signatur wird beim zehnten Versuch
    // nicht gueltiger. Wer immer das war, hat hier nichts verloren.
    console.error('Signatur ungueltig', error instanceof Error ? error.message : error);
    return new Response('invalid signature', { status: 400 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- Regel 3: Idempotenz ----------
  // ignoreDuplicates entspricht "on conflict do nothing": kommt keine Zeile
  // zurueck, kannten wir das Ereignis schon.
  const { data: inserted, error: insertError } = await admin
    .from('stripe_events')
    .upsert(
      { id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    .select('id');

  if (insertError) {
    console.error('Ereignis konnte nicht vermerkt werden', insertError.message);
    return new Response('event log failed', { status: 500 });
  }

  if (!inserted || inserted.length === 0) {
    // Schon dagewesen - aber wurde es auch fertig verarbeitet? Ein frueherer
    // Versuch kann nach dem Vermerk abgebrochen sein. Nur ein gesetztes
    // processed_at heisst "erledigt"; sonst wird erneut verarbeitet. Das ist
    // gefahrlos, weil unten ein Upsert steht und kein Insert.
    const { data: known } = await admin
      .from('stripe_events')
      .select('processed_at')
      .eq('id', event.id)
      .maybeSingle();

    if (known?.processed_at) {
      return new Response('already processed', { status: 200 });
    }
  }

  if (!isRelevantEvent(event.type)) {
    await markProcessed(admin, event.id);
    return new Response('ignored', { status: 200 });
  }

  try {
    // Erst die Onlinekurse, dann der Kurszweig. Jeder meldet, ob das Ereignis
    // ihm gehoert; nur wenn keiner, ist der Abozweig ueberhaupt gefragt.
    const handledAsCourse =
      (await handleOnlineCourseEvent(admin, event)) || (await handleCourseEvent(admin, event));

    const row = handledAsCourse ? null : await rowForEvent(stripe, event);

    if (row) {
      // Upsert auf stripe_subscription_id: dasselbe Abo kommt ueber Anlage,
      // Aenderung, Rechnung und Kuendigung immer wieder vorbei. Nicht
      // uebergebene Spalten - etwa country bei Folgeereignissen - bleiben
      // dabei unangetastet.
      const { error: upsertError } = await admin
        .from('subscriptions')
        .upsert(row, { onConflict: 'stripe_subscription_id' });

      if (upsertError) {
        // Das Konto zu diesem Abo gibt es nicht mehr (Review 11.11.2026, S1).
        // Wiederholen hilft nicht - also vermerken und quittieren, statt
        // Stripe drei Tage lang mit 500 zu antworten. Das ist KEIN stummes
        // Schlucken (Regel 4): die Zeile unten ist der Auftrag, im
        // Stripe-Dashboard nachzusehen. Steht dort ein Abo, das noch laeuft,
        // wird jemand ohne Konto abgebucht und es gehoert von Hand beendet.
        if (isMissingAccountError(upsertError)) {
          console.error(
            `Ereignis ${event.id} (${event.type}): Abo ${row.stripe_subscription_id} gehoert zu keinem ` +
              `Konto mehr, Status bei Stripe: ${row.status}. Laeuft es noch, im Stripe-Dashboard beenden.`,
          );
          await markProcessed(admin, event.id);
          return new Response('no account', { status: 200 });
        }

        throw new Error(`Abo nicht gespeichert: ${upsertError.message}`);
      }
    }

    await markProcessed(admin, event.id);
    return new Response('ok', { status: 200 });
  } catch (error) {
    // ---------- Regel 4 ----------
    // processed_at bleibt ungesetzt, Stripe versucht es erneut, und der
    // naechste Anlauf faengt oben wieder an.
    console.error(
      `Ereignis ${event.id} (${event.type}) fehlgeschlagen`,
      error instanceof Error ? error.message : error,
    );
    return new Response('handler failed', { status: 500 });
  }
});

async function markProcessed(
  admin: ReturnType<typeof createClient>,
  eventId: string,
): Promise<void> {
  const { error } = await admin
    .from('stripe_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', eventId);

  // Bewusst kein Abbruch: die Arbeit ist getan, nur der Haken fehlt. Beim
  // naechsten Zustellversuch laeuft dieselbe Verarbeitung noch einmal - der
  // Upsert macht das gefahrlos. Ein 500 an dieser Stelle wuerde Stripe dagegen
  // einen echten Fehlschlag melden, den es nicht gab.
  if (error) console.error('processed_at nicht gesetzt', error.message);
}

/**
 * Der Onlinekurszweig. true heisst: das Ereignis war ein Onlinekurs-Kauf und
 * ist erledigt. Schreibt nur public.course_access.
 */
async function handleOnlineCourseEvent(
  admin: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<boolean> {
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded' &&
    event.type !== 'checkout.session.expired'
  ) {
    return false;
  }

  const session = event.data.object as unknown as Stripe.Checkout.Session;
  const facts = onlineCoursePaymentFacts({
    id: session.id,
    mode: session.mode,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    client_reference_id: session.client_reference_id,
    metadata: (session.metadata ?? null) as Record<string, string> | null,
  });
  if (!facts) return false;

  // Verfallen: es wurde nichts reserviert, also ist nichts freizugeben.
  if (event.type === 'checkout.session.expired') return true;

  // Wie beim Kurszweig: erst mit payment_status = 'paid' freischalten.
  if (session.payment_status !== 'paid') {
    console.warn(`Onlinekurs-Sitzung ${facts.checkoutSessionId} ist noch nicht bezahlt (${session.payment_status})`);
    return true;
  }

  // Die Laufzeit steht am Kurs, nicht in den Metadaten.
  const { data: course, error: courseError } = await admin
    .from('online_courses')
    .select('id, access_days')
    .eq('id', facts.courseId)
    .maybeSingle();
  if (courseError) throw new Error(`Onlinekurs nicht gelesen: ${courseError.message}`);
  if (!course) throw new Error(`Onlinekurs ${facts.courseId} gibt es nicht`);

  // Ab dem Zeitpunkt des Ereignisses, nicht ab der Verarbeitung: liefert
  // Stripe nach einem Ausfall erst Tage spaeter erneut aus, verschiebt das
  // nicht das Ende des Zugangs.
  const paidAt = new Date(event.created * 1000);
  const row = courseAccessRowFor(facts, (course as { access_days: number }).access_days, paidAt);

  const { error: writeError } = await admin
    .from('course_access')
    .upsert(row, { onConflict: 'stripe_checkout_session_id', ignoreDuplicates: true });
  if (writeError) throw new Error(`Zugang nicht gespeichert: ${writeError.message}`);

  return true;
}

/**
 * Der Kurszweig. true heisst: das Ereignis war eine Kurszahlung und ist
 * erledigt - der Abozweig bleibt aussen vor.
 *
 * Alles, was hier wirft, landet oben im 500er-Zweig: Stripe liefert erneut,
 * processed_at bleibt ungesetzt. Das ist bei einer Zahlung genau richtig -
 * lieber ein sichtbar fehlgeschlagenes Ereignis im Stripe-Dashboard als eine
 * stumm verschluckte Buchung.
 */
async function handleCourseEvent(
  admin: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<boolean> {
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded' &&
    event.type !== 'checkout.session.expired'
  ) {
    return false;
  }

  const session = event.data.object as unknown as StripeCourseSessionLike;
  const facts = coursePaymentFacts(session);
  if (!facts) return false; // kein Kurs - das war der Abozweig

  // Eine verfallene Sitzung gibt den Platz zurueck. Ohne das bliebe er bis zum
  // Ende der Haltezeit blockiert, obwohl feststeht, dass niemand mehr zahlt.
  //
  // NUR DIE AKTUELLE SITZUNG (Review 11.11.2026, S4). Wer den Checkout ein
  // zweites Mal oeffnet, bekommt eine neue Sitzung zur selben Buchung, und die
  // alte verfaellt. Deren Verfallsereignis darf die gerade erneuerte
  // Reservierung nicht freigeben - sonst steht der Kunde auf der neuen
  // Bezahlseite, waehrend sein Platz ein zweites Mal verkauft wird. Deshalb
  // zaehlt das Ereignis nur, wenn es zur Sitzung gehoert, die an der Buchung
  // vermerkt ist. create-course-checkout vermerkt die neue Sitzung, BEVOR es
  // die alte beendet.
  if (event.type === 'checkout.session.expired') {
    const { error } = await admin
      .from('course_bookings')
      .update({ status: 'expired', reserved_until: null })
      .eq('id', facts.bookingId)
      .eq('status', 'reserved')
      .eq('stripe_checkout_session_id', facts.checkoutSessionId);

    if (error) throw new Error(`Reservierung nicht freigegeben: ${error.message}`);
    return true;
  }

  // Bei nachgelagerten Zahlungsarten meldet Stripe die abgeschlossene Sitzung,
  // bevor das Geld da ist. Bestaetigt wird erst mit payment_status = 'paid';
  // das kommt dann als async_payment_succeeded noch einmal vorbei.
  if (session.payment_status !== 'paid') {
    console.warn(`Sitzung ${facts.checkoutSessionId} ist noch nicht bezahlt (${session.payment_status})`);
    return true;
  }

  const { data: booking, error: readError } = await admin
    .from('course_bookings')
    .select('id, user_id, guest_email, status, amount_total_cents, amount_paid_cents, deposit_cents, stripe_checkout_session_id')
    .eq('id', facts.bookingId)
    .maybeSingle();

  if (readError) throw new Error(`Buchung nicht gelesen: ${readError.message}`);
  if (!booking) throw new Error(`Buchung ${facts.bookingId} gibt es nicht`);

  const update = bookingUpdateFor(booking as unknown as BookingRow, facts);
  if (!update) return true; // schon verbucht

  // Bezahlt, nachdem die Reservierung schon verfallen war - etwa bei einer
  // nachgelagerten Zahlungsart, deren Geld erst nach der Haltezeit eingeht.
  // Der Platz galt in der Zwischenzeit als frei; die Buchung wird trotzdem
  // bestaetigt (wer bezahlt hat, steht auf der Liste), aber OHNE erneute
  // Platzpruefung. Das ist der offene Rest von Review S4: bis es dafuer eine
  // Datenbankfunktion mit Sperre gibt, sagt wenigstens das Log, dass hier
  // jemand von Hand nachzaehlen muss.
  if ((booking as unknown as BookingRow).status === 'expired' && update.status === 'confirmed') {
    console.error(
      `Buchung ${facts.bookingId} wurde nach Ablauf der Reservierung bezahlt - ` +
        'Teilnehmerzahl des Kurses von Hand pruefen (moegliche Ueberbuchung).',
    );
  }

  const { error: writeError } = await admin
    .from('course_bookings')
    .update(update)
    .eq('id', facts.bookingId);

  if (writeError) throw new Error(`Buchung nicht bestaetigt: ${writeError.message}`);

  return true;
}

/**
 * Welche Abo-Zeile folgt aus diesem Ereignis? null heisst: nichts zu tun.
 *
 * In JEDEM Fall wird das Abo bei Stripe nachgeschlagen, statt aus dem Ereignis
 * zusammengesetzt zu werden. Die Session kennt weder Periodenende noch
 * Abrechnungsintervall, eine Rechnung nennt nur die Abo-ID - und bei den
 * subscription-Ereignissen kann der mitgelieferte Stand veraltet sein, weil
 * Stripe keine Reihenfolge zusichert (Review S3). Eine Abbildung statt vier,
 * und immer der Stand von jetzt.
 */
async function rowForEvent(stripe: Stripe, event: Stripe.Event): Promise<SubscriptionRow | null> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const facts = checkoutFacts(event.data.object as Stripe.Checkout.Session);
      if (!facts.subscriptionId) return null; // kein Abo - geht uns nichts an

      const sub = await stripe.subscriptions.retrieve(facts.subscriptionId);
      return mapSubscription(asSubscription(sub), {
        // Verbindlich, weil selbst gesetzt (SAD §4.3 Punkt 5).
        userId: facts.userId,
        checkoutSessionId: facts.checkoutSessionId,
        // Das Kaeuferland gibt es nur hier (SAD §4.5).
        country: facts.country,
      });
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      // AUCH HIER NACHSCHLAGEN (Review 11.11.2026, S3). Bis dahin wurde der
      // Stand aus dem Ereignis uebernommen. Stripe sichert aber keine
      // Reihenfolge zu und wiederholt bis zu drei Tage lang: ein verspaetetes
      // "updated" mit past_due ueberschrieb dann ein laengst bezahltes Abo,
      // und der zahlende Kunde blieb gesperrt, bis das naechste Ereignis kam.
      // Mit dem aktuellen Stand von Stripe ist die Reihenfolge gleichgueltig.
      // Ein beendetes Abo bleibt bei Stripe abrufbar (status = 'canceled').
      const fromEvent = asSubscription(event.data.object);
      return mapSubscription(await currentSubscription(stripe, fromEvent));
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subscriptionId = subscriptionIdFromInvoice(event.data.object as Stripe.Invoice);
      if (!subscriptionId) return null; // Rechnung ohne Abo

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return mapSubscription(asSubscription(sub));
    }

    default:
      return null;
  }
}

/**
 * Der aktuelle Stand eines Abos bei Stripe. Kennt Stripe es nicht mehr - das
 * kommt nur bei geloeschten Testdaten vor -, bleibt der Stand aus dem
 * Ereignis: besser als ein Ereignis, das drei Tage lang scheitert. Jeder
 * andere Fehler wirft und fuehrt zu 500 und einem neuen Versuch (Regel 4).
 */
async function currentSubscription(
  stripe: Stripe,
  fromEvent: StripeSubscriptionLike,
): Promise<StripeSubscriptionLike> {
  try {
    return asSubscription(await stripe.subscriptions.retrieve(fromEvent.id));
  } catch (error) {
    if (isStripeResourceMissing(error)) return fromEvent;
    throw error;
  }
}

/**
 * Stripe hat die Periodengrenzen mit API-Version 2025-03-31 vom Abo auf die
 * Positionen verschoben; je nach SDK- und Kontoversion kennt der Typ mal das
 * eine Feld, mal das andere. StripeSubscriptionLike liest beide (siehe
 * periodEndFromSubscription) - deshalb hier eine Umdeutung statt eines
 * Feldzugriffs, den der Typ gerade nicht hergibt. Fehlen beide Felder
 * tatsaechlich, wirft mapSubscription; geraten wird nichts.
 */
function asSubscription(sub: unknown): StripeSubscriptionLike {
  return sub as StripeSubscriptionLike;
}
