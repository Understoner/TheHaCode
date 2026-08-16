// Checkout-Sitzung bei Stripe anlegen (SAD §4.2, §4.6).
//
// WAS DIESE FUNKTION ENTSCHEIDET - UND WAS NICHT
// -----------------------------------------------
// Sie entscheidet NICHT, ob jemand Zugriff bekommt. Das tut allein der Webhook
// ueber public.subscriptions und der Trigger aus Migration 0010. Hier wird nur
// eine bezahlbare Seite bei Stripe bestellt und deren Adresse zurueckgegeben.
// Faellt diese Funktion aus, kann niemand kaufen - aber niemand verliert
// Zugriff, und niemand bekommt welchen.
//
// Die beiden Clients sind wie in delete-account getrennt:
//
//   userClient  - traegt NUR den mitgeschickten Zugangstoken. Er beantwortet
//                 die einzige Frage, die zaehlt: wer ruft hier an?
//   adminClient - traegt service_role und liest die bestehenden Abos. Er
//                 bekommt IMMER die ID aus der Antwort des userClient, nie
//                 eine ID aus dem Anfragekoerper.
//
// Die so ermittelte ID geht als client_reference_id an Stripe und kommt von
// dort im Webhook zurueck. Das ist die einzige Bruecke zwischen Zahlung und
// Konto (SAD §4.3 Punkt 5) - eine E-Mail-Adresse wird nirgends dafuer benutzt.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';

import { hasActiveSubscription, type SubRow } from '../_shared/entitlement.ts';
import { json, preflight } from '../_shared/http.ts';

type CheckoutRequest = { plan?: unknown };

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
  const prices: Record<string, string | undefined> = {
    monthly: Deno.env.get('STRIPE_PRICE_MONTHLY'),
    yearly: Deno.env.get('STRIPE_PRICE_YEARLY'),
  };

  if (!url || !anonKey || !serviceRoleKey || !stripeKey || !appUrl) {
    console.error('create-checkout ist nicht vollstaendig konfiguriert');
    return json({ error: 'not_configured' }, 500, origin);
  }

  // 1. Wer ruft an? Die Antwort kommt von Supabase, nicht aus der Anfrage.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401, origin);
  const user = userData.user;

  // 2. Welches Modell? Nur die beiden aus SAD §4.6, alles andere ist ein
  //    Tippfehler oder ein Versuch.
  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return json({ error: 'bad_request' }, 400, origin);
  }

  const plan = body.plan;
  if (plan !== 'monthly' && plan !== 'yearly') {
    return json({ error: 'unknown_plan' }, 400, origin);
  }

  const priceId = prices[plan];
  if (!priceId) {
    console.error(`Kein Preis fuer ${plan} hinterlegt`);
    return json({ error: 'not_configured' }, 500, origin);
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Laeuft schon eins? Ohne diese Pruefung koennte jemand versehentlich ein
  //    zweites Abo bezahlen - Stripe haette nichts dagegen, und die Rueckabwicklung
  //    waere Handarbeit. Die Antwort ist bewusst dieselbe Fachregel wie im
  //    Trigger aus 0010, hier nur frueher gestellt.
  const { data: existing, error: existingError } = await adminClient
    .from('subscriptions')
    .select('plan, status, current_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (existingError) {
    console.error('Abos konnten nicht gelesen werden', existingError.message);
    return json({ error: 'lookup_failed' }, 500, origin);
  }

  const rows = existing ?? [];
  if (hasActiveSubscription(rows as SubRow[])) {
    return json({ error: 'already_subscribed' }, 409, origin);
  }

  // Der Kunde bei Stripe, falls es ihn schon gibt - etwa nach einer Kuendigung.
  // Sonst legt Stripe beim Checkout selbst einen an. Wir suchen ihn bewusst in
  // unserer eigenen Tabelle statt ueber die Stripe-Suche: was wir gespeichert
  // haben, ist das, was wir diesem Konto zugeordnet haben.
  const customerId = rows.map((row) => row.stripe_customer_id).find(Boolean) ?? undefined;

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      locale: 'de',
      line_items: [{ price: priceId, quantity: 1 }],

      // Die Bruecke zwischen Zahlung und Konto - an zwei Stellen, weil sie an
      // zwei Stellen zurueckkommt: client_reference_id steht in
      // checkout.session.completed, die Metadaten am Abo stehen in jedem
      // spaeteren customer.subscription.*.
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id } },

      ...(customerId ? { customer: customerId } : { customer_email: user.email }),

      // Rabattcodes fuer Bestandskunden: ein Parameter, angelegt werden sie im
      // Stripe-Dashboard (SAD §4.6).
      allow_promotion_codes: true,

      // Kleinunternehmerregelung (SAD §4.5): keine Steuerberechnung. Der
      // Bruttopreis und tax_behavior = inclusive haengen am Preis im
      // Dashboard, nicht hier - deshalb steht hier nur die Abschaltung.
      automatic_tax: { enabled: false },

      success_url: `${appUrl}/konto?checkout=erfolg`,
      cancel_url: `${appUrl}/konto?checkout=abgebrochen`,
    });

    if (!session.url) {
      console.error('Stripe lieferte keine Checkout-Adresse');
      return json({ error: 'checkout_failed' }, 502, origin);
    }

    return json({ url: session.url }, 200, origin);
  } catch (error) {
    // Technische Einzelheiten gehen an das Log, nicht an den Client
    // (CLAUDE.md: Fehlermeldungen ohne Technikjargon).
    console.error('Checkout fehlgeschlagen', error instanceof Error ? error.message : error);
    return json({ error: 'checkout_failed' }, 502, origin);
  }
});
