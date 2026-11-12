// Kontoloeschung: laufende Abos bei Stripe beenden - rein, ohne Netz, ohne Deno.
//
// WARUM ES DAS GIBT (Review 11.11.2026, S1)
// -----------------------------------------
// delete-account hat bis dahin nur auth.admin.deleteUser() aufgerufen. Die
// Zeile in public.subscriptions verschwand per Kaskade - das Abo bei Stripe
// lief weiter und wurde weiter abgebucht. Kuendigen konnte der Kunde es nicht
// mehr: das Kundenportal verlangt eine Anmeldung, und das Konto war weg.
// SAD §5.3 verlangt an dieser Stelle seit jeher zuerst die Kuendigung.
//
// Die Regel jetzt: ERST bei Stripe beenden, DANN loeschen. Laesst sich ein Abo
// nicht beenden, wird das Konto NICHT geloescht - lieber ein Konto, das noch
// da ist und von dem aus man kuendigen kann, als eine Abbuchung ohne Konto.
//
// Wie stripe-events.ts importiert diese Datei keine Stripe-Typen und beschreibt
// nur, was sie braucht. Damit laeuft sie unter Vitest.

export type SubscriptionForDeletion = {
  stripe_subscription_id: string | null;
  status: string;
};

/**
 * Welche Abos muessen vor dem Loeschen bei Stripe beendet werden?
 *
 * Alles, was nicht schon zu Ende ist. Bewusst weit gefasst: auch past_due und
 * incomplete - dort versucht Stripe weiter abzubuchen. Ein Abo, das bei Stripe
 * laengst beendet ist, schadet in dieser Liste nicht (siehe endSubscription),
 * ein vergessenes laufendes sehr wohl.
 */
export function subscriptionsToCancel(rows: SubscriptionForDeletion[]): string[] {
  const ids = rows
    .filter((row) => row.status !== 'canceled' && row.status !== 'expired')
    .map((row) => row.stripe_subscription_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  return [...new Set(ids)];
}

/** Stripe kennt das Objekt nicht (mehr): code resource_missing bzw. Status 404. */
export function isStripeResourceMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; statusCode?: unknown };
  return candidate.code === 'resource_missing' || candidate.statusCode === 404;
}

/** Der Ausschnitt von stripe.subscriptions, den das Beenden braucht. */
export type StripeSubscriptionsApi = {
  cancel: (id: string) => Promise<unknown>;
  retrieve: (id: string) => Promise<{ status: string }>;
};

/** Stripes Zustaende, in denen nichts mehr abgebucht wird. */
const ENDED_AT_STRIPE = ['canceled', 'incomplete_expired'];

/**
 * Ein Abo sofort beenden - nicht zum Periodenende (SAD §5.3). true heisst: bei
 * Stripe wird sicher nichts mehr abgebucht.
 *
 * Scheitert die Kuendigung, wird nachgesehen, statt zu raten: ist das Abo bei
 * Stripe unbekannt oder schon beendet, ist das Ziel erreicht. Alles andere -
 * Netzfehler, Ratenlimit, falscher Schluessel - ist false, und der Aufrufer
 * loescht dann das Konto nicht.
 */
export async function endSubscription(api: StripeSubscriptionsApi, id: string): Promise<boolean> {
  try {
    await api.cancel(id);
    return true;
  } catch (cancelError) {
    if (isStripeResourceMissing(cancelError)) return true;

    try {
      const current = await api.retrieve(id);
      return ENDED_AT_STRIPE.includes(current.status);
    } catch (retrieveError) {
      return isStripeResourceMissing(retrieveError);
    }
  }
}
