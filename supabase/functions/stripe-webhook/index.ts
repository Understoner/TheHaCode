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

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';

import {
  checkoutFacts,
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
    const row = await rowForEvent(stripe, event);

    if (row) {
      // Upsert auf stripe_subscription_id: dasselbe Abo kommt ueber Anlage,
      // Aenderung, Rechnung und Kuendigung immer wieder vorbei. Nicht
      // uebergebene Spalten - etwa country bei Folgeereignissen - bleiben
      // dabei unangetastet.
      const { error: upsertError } = await admin
        .from('subscriptions')
        .upsert(row, { onConflict: 'stripe_subscription_id' });

      if (upsertError) throw new Error(`Abo nicht gespeichert: ${upsertError.message}`);
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
 * Welche Abo-Zeile folgt aus diesem Ereignis? null heisst: nichts zu tun.
 *
 * Bei checkout.session.completed und den Rechnungsereignissen wird das Abo bei
 * Stripe nachgeschlagen, statt aus dem Ereignis zusammengesetzt zu werden. Die
 * Session kennt weder Periodenende noch Abrechnungsintervall, und eine
 * Rechnung nennt nur die Abo-ID. Ein Nachschlagen liefert in beiden Faellen
 * denselben vollstaendigen Stand wie bei den subscription-Ereignissen - eine
 * Abbildung statt vier.
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
      // Das Ereignis IST das Abo - kein Nachschlagen noetig. Bei deleted
      // liefert Stripe status = 'canceled' mit.
      return mapSubscription(asSubscription(event.data.object));
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
