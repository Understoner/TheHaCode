// Die reinen Regeln rund um Plus - ohne React, ohne Netz.

import type { PlanKey, PlanPrice, Subscription } from '@/features/plus/usePlus';

/** Betrag in Cent als oesterreichischer Preis. */
export function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Ein Datum, wie es auf einer Kontoseite steht. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'long' }).format(new Date(iso));
}

/**
 * Wie viel der Jahrestarif gegenueber zwoelf Monaten spart - in vollen
 * Prozent, abgerundet. null, wenn sich das nicht sagen laesst.
 *
 * Abgerundet und nicht gerundet: bei einer Ersparnis von 16,7 % ist "16 %"
 * belegbar und "17 %" geschoent. Bei Werbeaussagen ueber Geld ist die
 * unguenstigere Rundung die richtige.
 */
export function yearlySavingPercent(prices: PlanPrice[]): number | null {
  const monthly = prices.find((price) => price.plan === 'monthly');
  const yearly = prices.find((price) => price.plan === 'yearly');
  if (!monthly || !yearly) return null;

  const twelveMonths = monthly.amountCents * 12;
  if (twelveMonths <= 0 || yearly.amountCents >= twelveMonths) return null;

  return Math.floor(((twelveMonths - yearly.amountCents) / twelveMonths) * 100);
}

export type SubscriptionView =
  | { state: 'none' }
  | { state: 'active'; plan: PlanKey; until: string; cancelAtPeriodEnd: boolean }
  | { state: 'ending'; plan: PlanKey; until: string }
  | { state: 'problem'; plan: PlanKey; status: string }
  | { state: 'ended'; plan: PlanKey; until: string };

/**
 * Was dem Nutzer ueber sein Abo zu sagen ist.
 *
 * Fuenf Zustaende statt eines rohen Stripe-Status, weil sie zu fuenf
 * verschiedenen Saetzen fuehren - und weil "past_due" niemandem etwas sagt.
 * Die Zugriffsfrage beantwortet das hier ausdruecklich NICHT; die haengt an
 * has_plus_access() in der Datenbank.
 */
export function subscriptionView(sub: Subscription | null | undefined): SubscriptionView {
  if (!sub) return { state: 'none' };

  const plan = sub.plan as PlanKey;
  const until = sub.current_period_end;
  const laufend = new Date(until).getTime() > Date.now();

  if (sub.status === 'active' || sub.status === 'trialing') {
    if (!laufend) return { state: 'ended', plan, until };
    return sub.cancel_at_period_end
      ? { state: 'ending', plan, until }
      : { state: 'active', plan, until, cancelAtPeriodEnd: false };
  }

  if (sub.status === 'canceled' || sub.status === 'expired') {
    return { state: 'ended', plan, until };
  }

  // past_due, incomplete: es stimmt etwas mit der Zahlung nicht. Der Nutzer
  // kann das selbst im Kundenportal in Ordnung bringen.
  return { state: 'problem', plan, status: sub.status };
}
