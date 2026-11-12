// Was Plus kostet - gefragt bei Stripe, nicht bei uns (T17).
//
// WARUM DAS EINE FUNKTION IST UND KEINE ZEILE IN common.json
// -----------------------------------------------------------
// Ein Preis, der auf der Seite steht, und ein Preis, der abgebucht wird, sind
// zwei verschiedene Dinge, sobald sie an zwei Orten gepflegt werden. Wer im
// Stripe-Dashboard den Betrag aendert und die Uebersetzungsdatei vergisst, hat
// eine Preisseite, die luegt - und zwar so lange, bis sich ein Kunde
// beschwert. Hier gibt es nur einen Ort: die Price-ID in den Function Secrets,
// dieselbe, mit der create-checkout abrechnet.
//
// WAS HIER NICHT PASSIERT
// -----------------------
// Keine Anmeldung, keine Datenbank, kein Nutzerbezug. Die Funktion beantwortet
// eine oeffentliche Frage mit einer oeffentlichen Antwort: was kostet das.
// Sie braucht trotzdem kein verify_jwt = false, weil supabase-js den anon-Key
// als Authorization mitschickt und das Gateway den als gueltiges JWT annimmt.
// Der stripe-webhook bleibt damit die einzige Funktion ohne JWT-Pruefung.
//
// Faellt sie aus, zeigt die Preisseite keine Betraege und sagt das auch - der
// Kaufweg selbst haengt nicht an ihr.

import Stripe from 'npm:stripe@18.5.0';

import { json, preflight } from '../_shared/http.ts';

type PlanKey = 'monthly' | 'yearly';

export type PlanPrice = {
  plan: PlanKey;
  /** Betrag in Cent, wie Stripe ihn fuehrt. */
  amountCents: number;
  currency: string;
  /** 'month' | 'year', abgelesen am Preis statt geraten. */
  interval: string | null;
};

// EINE ANTWORT FUER ZEHN MINUTEN MERKEN (Review 11.11.2026, E3)
// -----------------------------------------------------------
// Die Funktion ist ohne Anmeldung aufrufbar und hat bis dahin bei JEDEM Aufruf
// zwei Preise bei Stripe geholt. Ein Skript mit dem oeffentlichen Schluessel
// konnte so das Ratenlimit des Stripe-Kontos belasten - desselben Kontos, an
// dem der Checkout haengt. Preise aendern sich im Jahr vielleicht einmal;
// zehn Minuten Verzoegerung nach einer Aenderung im Dashboard schaden
// niemandem. Abgerechnet wird ohnehin nie nach dieser Antwort, sondern nach
// der Price-ID in create-checkout.
//
// Der Speicher lebt, solange die Instanz der Funktion warm ist. Eine kalte
// Instanz fragt einmal neu - das ist gewollt und begrenzt die Last trotzdem
// auf einen Bruchteil.
const CACHE_MS = 10 * 60 * 1000;
let cached: { prices: PlanPrice[]; at: number } | null = null;

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  const options = preflight(request);
  if (options) return options;

  if (request.method !== 'POST' && request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const priceIds: Record<PlanKey, string | undefined> = {
    monthly: Deno.env.get('STRIPE_PRICE_MONTHLY'),
    yearly: Deno.env.get('STRIPE_PRICE_YEARLY'),
  };

  if (!stripeKey || !priceIds.monthly || !priceIds.yearly) {
    console.error('get-prices ist nicht vollstaendig konfiguriert');
    return json({ error: 'not_configured' }, 500, origin);
  }

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return json({ prices: cached.prices }, 200, origin);
  }

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const plans: PlanKey[] = ['monthly', 'yearly'];
    const prices = await Promise.all(
      plans.map(async (plan): Promise<PlanPrice> => {
        const price = await stripe.prices.retrieve(priceIds[plan]!);

        if (typeof price.unit_amount !== 'number') {
          // Gestaffelte Preise haben keinen einzelnen Betrag. V1 kennt nur die
          // zwei einfachen Modelle (SAD §4.6); waere hier eines gestaffelt,
          // waere die Anzeige geraten statt abgelesen.
          throw new Error(`Preis ${priceIds[plan]} nennt keinen Einzelbetrag`);
        }

        return {
          plan,
          amountCents: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
        };
      }),
    );

    // Nur eine gelungene Antwort wird gemerkt - ein Fehler nie.
    cached = { prices, at: Date.now() };

    return json({ prices }, 200, origin);
  } catch (error) {
    console.error('Preise nicht abrufbar', error instanceof Error ? error.message : error);
    return json({ error: 'lookup_failed' }, 502, origin);
  }
});
