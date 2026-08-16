// Stripe-Ereignisse auf unsere Zeilen abbilden - rein, ohne Netz, ohne Deno.
//
// WARUM DIESE DATEI KEINE STRIPE-TYPEN IMPORTIERT
// -----------------------------------------------
// Sie beschreibt nur die Felder, die wir tatsaechlich lesen. Das hat zwei
// Gruende: sie laeuft damit unter Vitest (Node), wo "npm:stripe" nicht
// aufloest, und sie ueberlebt einen Versionssprung des SDK, solange die
// gelesenen Felder gleich bleiben. Was wir nicht lesen, kann auch nicht
// brechen.
//
// DIE WICHTIGSTE REGEL DIESER DATEI
// ---------------------------------
// Die Zuordnung zum Nutzer kommt NIE aus der E-Mail-Adresse (SAD §4.3 Punkt 5).
// Verbindlich ist client_reference_id der Checkout-Session bzw.
// metadata.user_id des Abos. Fehlt beides, wird geworfen - lieber 500 und ein
// Stripe-Retry als eine falsche Zuordnung, die niemandem auffaellt.

import type { SubscriptionPlan, SubscriptionStatus } from './entitlement.ts';

// ---------- Die Felder, die wir von Stripe lesen ----------

type StripePrice = { recurring?: { interval?: string | null } | null } | null;

type StripeSubscriptionItem = {
  price?: StripePrice;
  // Seit API-Version 2025-03-31 stehen die Periodengrenzen am Item, nicht mehr
  // am Abo. Beides wird gelesen, siehe periodEndFromSubscription().
  current_period_end?: number | null;
};

export type StripeSubscriptionLike = {
  id: string;
  status: string;
  customer?: string | { id?: string | null } | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: number | null;
  current_period_end?: number | null;
  items?: { data?: StripeSubscriptionItem[] | null } | null;
  metadata?: Record<string, string> | null;
};

export type StripeCheckoutSessionLike = {
  id: string;
  client_reference_id?: string | null;
  /**
   * Steht hier nur, damit sichtbar ist, dass es das Feld gibt und dass es
   * nirgends gelesen wird (SAD §4.3 Punkt 5). Wer die Zuordnung eines Tages
   * "schnell ueber die E-Mail" loesen will, stolpert hoffentlich hierueber.
   */
  customer_email?: string | null;
  customer?: string | { id?: string | null } | null;
  subscription?: string | { id?: string | null } | null;
  customer_details?: { address?: { country?: string | null } | null } | null;
};

export type StripeInvoiceLike = {
  subscription?: string | { id?: string | null } | null;
  parent?: {
    subscription_details?: { subscription?: string | { id?: string | null } | null } | null;
  } | null;
  lines?: {
    data?: { subscription?: string | { id?: string | null } | null }[] | null;
  } | null;
};

/** Die Zeile, wie sie in public.subscriptions landet. */
export type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  stripe_checkout_session_id?: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  country?: string;
};

// ---------- Welche Ereignisse uns angehen ----------

/** SAD §4.3 Punkt 6. Alles andere wird quittiert und ignoriert. */
export const RELEVANT_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

export function isRelevantEvent(type: string): boolean {
  return (RELEVANT_EVENTS as readonly string[]).includes(type);
}

// ---------- Kleinkram ----------

/** Stripe liefert Verweise mal als ID, mal als ausgepacktes Objekt. */
function idOf(reference: string | { id?: string | null } | null | undefined): string | null {
  if (typeof reference === 'string') return reference || null;
  return reference?.id ?? null;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

// ---------- Abbildungen ----------

/**
 * Stripes Statuswerte auf unser Enum.
 *
 * Der Vorgabewert ist mit Absicht 'expired' und nicht 'active': ein Status, den
 * wir nicht kennen - weil Stripe einen neuen eingefuehrt hat - darf niemals
 * Zugriff gewaehren. Ein faelschlich gesperrter Nutzer meldet sich; ein
 * faelschlich freigeschalteter nicht.
 *
 * 'unpaid' und 'paused' landen auf 'past_due': beides heisst "zahlt gerade
 * nicht", und past_due gewaehrt laut entitlement.ts keinen Zugriff.
 */
export function statusFromStripe(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'expired';
  }
}

/**
 * Monat oder Jahr - abgelesen am Abrechnungsintervall, nicht an einer
 * konfigurierten Price-ID. Damit muss beim Anlegen eines neuen Preises im
 * Stripe-Dashboard nichts nachgezogen werden, und ein vertippter Umgebungswert
 * kann hier nichts verfaelschen. V1 kennt nur diese zwei Modelle (SAD §4.6).
 */
export function planFromSubscription(sub: StripeSubscriptionLike): SubscriptionPlan {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'yearly' : 'monthly';
}

/**
 * Das Periodenende - die Angabe, an der der Zugriff haengt.
 *
 * Stripe hat sie mit API-Version 2025-03-31 vom Abo auf die Positionen
 * verschoben. Beide Orte werden gelesen, damit weder eine aeltere noch eine
 * neuere API-Version des Kontos die Funktion bricht. Fehlt sie an beiden,
 * wird geworfen: eine Zeile ohne Periodenende koennte die Datenbank gar nicht
 * aufnehmen (not null), und ein geratener Wert waere hier das Schlimmste.
 */
export function periodEndFromSubscription(sub: StripeSubscriptionLike): string {
  const end = isoFromUnix(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end);
  if (!end) {
    throw new Error(`Abo ${sub.id} hat kein current_period_end`);
  }
  return end;
}

/**
 * Die Nutzer-ID eines Abos. Sie steht in metadata.user_id, gesetzt beim
 * Anlegen der Checkout-Session (subscription_data.metadata). Fehlt sie, ist
 * das Abo nicht zuzuordnen - dann wird geworfen statt geraten.
 */
export function userIdFromSubscription(sub: StripeSubscriptionLike): string {
  const userId = sub.metadata?.user_id;
  if (!userId) {
    throw new Error(`Abo ${sub.id} traegt keine metadata.user_id`);
  }
  return userId;
}

/**
 * Die Nutzer-ID einer Checkout-Session: ausschliesslich aus
 * client_reference_id (SAD §4.3 Punkt 5). customer_email steht direkt daneben
 * und wird bewusst nicht angesehen - eine Adresse kann jemand anders
 * eintragen, die client_reference_id setzen wir selbst.
 */
export function userIdFromCheckoutSession(session: StripeCheckoutSessionLike): string {
  const userId = session.client_reference_id;
  if (!userId) {
    throw new Error(`Checkout-Session ${session.id} traegt keine client_reference_id`);
  }
  return userId;
}

/** Was aus einer abgeschlossenen Checkout-Session zu holen ist. */
export function checkoutFacts(session: StripeCheckoutSessionLike): {
  userId: string;
  checkoutSessionId: string;
  subscriptionId: string | null;
  country: string | null;
} {
  return {
    userId: userIdFromCheckoutSession(session),
    checkoutSessionId: session.id,
    subscriptionId: idOf(session.subscription),
    country: session.customer_details?.address?.country ?? null,
  };
}

/**
 * Das Abo zu einer Rechnung. Stripe hat das Feld ueber die Jahre dreimal
 * umgehaengt - direkt auf der Rechnung, unter parent.subscription_details, und
 * an der einzelnen Position. Alle drei werden gelesen; findet sich keins,
 * betrifft die Rechnung kein Abo und geht uns nichts an.
 */
export function subscriptionIdFromInvoice(invoice: StripeInvoiceLike): string | null {
  return (
    idOf(invoice.subscription) ??
    idOf(invoice.parent?.subscription_details?.subscription) ??
    idOf(invoice.lines?.data?.[0]?.subscription)
  );
}

/**
 * Ein Stripe-Abo als Zeile fuer public.subscriptions.
 *
 * userId und country sind optional ueberschreibbar, weil beide nur an der
 * Checkout-Session haengen: die Nutzer-ID als client_reference_id, das Land
 * unter customer_details. Wird country nicht mitgegeben, fehlt der Schluessel
 * im Ergebnis - und ein Upsert laesst den bereits gespeicherten Wert dann in
 * Ruhe, statt ihn bei jedem Folge-Ereignis auf null zu setzen.
 */
export function mapSubscription(
  sub: StripeSubscriptionLike,
  extra: { userId?: string; checkoutSessionId?: string; country?: string | null } = {},
): SubscriptionRow {
  const row: SubscriptionRow = {
    user_id: extra.userId ?? userIdFromSubscription(sub),
    stripe_customer_id: idOf(sub.customer),
    stripe_subscription_id: sub.id,
    plan: planFromSubscription(sub),
    status: statusFromStripe(sub.status),
    current_period_end: periodEndFromSubscription(sub),
    cancel_at_period_end: sub.cancel_at_period_end === true,
    canceled_at: isoFromUnix(sub.canceled_at),
  };

  if (extra.checkoutSessionId) row.stripe_checkout_session_id = extra.checkoutSessionId;
  if (extra.country) row.country = extra.country;

  return row;
}
