// Kundenportal bei Stripe oeffnen (SAD §4.6, Backlog T17).
//
// Dort kuendigt, reaktiviert und aendert der Nutzer sein Abo, sieht seine
// Rechnungen und tauscht die Zahlungsart. Nichts davon bauen wir selbst - was
// dort passiert, kommt als Ereignis ueber den Webhook zurueck.
//
// Wie in create-checkout gilt: diese Funktion entscheidet nichts ueber
// Zugriff. Sie schlaegt die Stripe-Kundennummer in unserer eigenen Tabelle
// nach - und zwar zu der ID, die der Zugangstoken nennt, nie zu einer aus dem
// Anfragekoerper. Ohne diese Trennung koennte jeder Angemeldete das
// Rechnungsportal eines fremden Kunden oeffnen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';

import { json, preflight } from '../_shared/http.ts';

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
    console.error('create-portal ist nicht vollstaendig konfiguriert');
    return json({ error: 'not_configured' }, 500, origin);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401, origin);

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Die juengste Kundennummer zu genau dieser Nutzer-ID. Wer nie gekauft hat,
  // hat keine - und im Portal auch nichts zu sehen.
  const { data: rows, error: lookupError } = await adminClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userData.user.id)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error('Kundennummer nicht lesbar', lookupError.message);
    return json({ error: 'lookup_failed' }, 500, origin);
  }

  const customerId = rows?.[0]?.stripe_customer_id;
  if (!customerId) return json({ error: 'no_customer' }, 404, origin);

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      locale: 'de',
      return_url: `${appUrl}/konto`,
    });

    return json({ url: session.url }, 200, origin);
  } catch (error) {
    const meldung = error instanceof Error ? error.message : String(error);
    console.error('Portal fehlgeschlagen', meldung);

    // Der mit Abstand haeufigste Grund, und einer, den man nur im
    // Stripe-Dashboard behebt: das Kundenportal ist im jeweiligen Modus nie
    // eingerichtet worden. Test- und Live-Modus zaehlen dabei getrennt.
    // Ohne diese Unterscheidung meldet die App "hat nicht geklappt, versuch es
    // noch einmal" - und ein zweiter Versuch aendert daran nie etwas.
    if (/no configuration|default configuration/i.test(meldung)) {
      return json({ error: 'portal_not_configured' }, 502, origin);
    }

    return json({ error: 'portal_failed' }, 502, origin);
  }
});
