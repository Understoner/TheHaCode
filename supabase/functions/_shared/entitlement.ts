// Die Zugriffsfrage als reine Funktion (SAD §8.2).
//
// WARUM ES DAS ZWEIMAL GIBT
// -------------------------
// Die verbindliche Antwort gibt die Datenbank: der Trigger
// sync_profile_entitlement aus Migration 0010 rechnet dasselbe in SQL und
// schreibt das Ergebnis nach profiles.has_active_subscription, und RLS fragt
// ausschliesslich has_plus_access(). Diese Datei entscheidet nichts, was den
// Zugriff angeht - sie beantwortet in create-checkout die Frage "hat der schon
// eins?", bevor jemand ein zweites Abo bezahlt.
//
// Sie ist trotzdem als reine Funktion geschnitten: ohne Stripe, ohne Datenbank,
// ohne Deno. Damit laeuft sie unter Vitest, und die Regeln, nach denen ein Abo
// zaehlt, stehen einmal lesbar da statt nur in einem SQL-Aggregat.
//
// ACHTUNG: bleibt die Regel hier und in 0010 nicht dieselbe, faellt das
// niemandem auf - es gibt keinen Test, der beide gegeneinander haelt. Wer eine
// aendert, aendert die andere mit.

export type SubscriptionPlan = 'monthly' | 'yearly';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'expired';

export type SubRow = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string;
};

/**
 * Bewusst streng: past_due gewaehrt keinen Zugriff.
 *
 * Und bewusst mit Periodenpruefung: ein Abo mit status = 'active', dessen
 * Periode abgelaufen ist, zaehlt nicht. Das ist kein theoretischer Fall,
 * sondern der Schutz gegen ein ausgebliebenes Stripe-Event.
 */
export function hasActiveSubscription(subs: SubRow[], now: Date = new Date()): boolean {
  return subs.some(
    (s) =>
      (s.status === 'active' || s.status === 'trialing') &&
      new Date(s.current_period_end) > now,
  );
}
