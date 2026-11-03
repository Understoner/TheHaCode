// Onlinekurse aus Stripe-Sicht - rein, ohne Netz, ohne Deno (V1.2, SAD §11.2).
//
// Ein Onlinekurs ist eine Einmalzahlung wie eine Kursbuchung, teilt mit ihr
// aber keine Regel: kein Platz, keine Anzahlung, kein Gast. Am Ende steht
// eine Zeile in public.course_access und sonst nichts - insbesondere nie eine
// Zeile in public.subscriptions und nie Plus.
//
// Kennzeichen ist metadata.payment_kind = 'online_course', gesetzt von
// create-online-course-checkout. Zugeordnet wird ueber client_reference_id
// (das Konto) und metadata.course_id - nie ueber die E-Mail-Adresse
// (SAD §4.3 Punkt 5).

export const ONLINE_COURSE_KIND = 'online_course';

/** Rabatt fuer Plus-Kunden auf Einzelkauf-Kurse (Entscheidung 03.11.2026). */
export const PLUS_DISCOUNT_PERCENT = 15;

export type OnlineCoursePrice = {
  /** Was Stripe einzieht, in Cent. */
  amountCents: number;
  /** Davon abgezogener Plus-Rabatt, in Cent (0 ohne Plus). */
  discountCents: number;
};

/**
 * Der Preis, den jemand zahlt. Gerundet auf ganze Cent, kaufmaennisch.
 * Wirft bei einem unbrauchbaren Listenpreis statt 0 EUR zu verlangen.
 */
export function onlineCoursePrice(listPriceCents: number, hasPlus: boolean): OnlineCoursePrice {
  if (!Number.isInteger(listPriceCents) || listPriceCents <= 0) {
    throw new Error(`Ungueltiger Kurspreis: ${listPriceCents}`);
  }
  if (!hasPlus) return { amountCents: listPriceCents, discountCents: 0 };

  const amountCents = Math.round((listPriceCents * (100 - PLUS_DISCOUNT_PERCENT)) / 100);
  return { amountCents, discountCents: listPriceCents - amountCents };
}

export type StripeOnlineCourseSessionLike = {
  id: string;
  mode?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  client_reference_id?: string | null;
  created?: number | null;
  metadata?: Record<string, string> | null;
};

export type OnlineCoursePaymentFacts = {
  userId: string;
  courseId: string;
  amountCents: number;
  checkoutSessionId: string;
};

/**
 * Ist das ein Onlinekurs-Kauf? null heisst: nein, geht diesen Zweig nichts an.
 * Ist die Sitzung als Onlinekurs gekennzeichnet, aber unvollstaendig, wird
 * geworfen - das ist unsere eigene Kennzeichnung, und eine halbe ist ein
 * Fehler, den man sehen soll (Stripe liefert dann erneut).
 */
export function onlineCoursePaymentFacts(
  session: StripeOnlineCourseSessionLike,
): OnlineCoursePaymentFacts | null {
  if (session.metadata?.payment_kind !== ONLINE_COURSE_KIND) return null;

  const userId = session.client_reference_id || null;
  const courseId = session.metadata?.course_id || null;
  if (!userId) throw new Error(`Sitzung ${session.id} (Onlinekurs) nennt kein Konto`);
  if (!courseId) throw new Error(`Sitzung ${session.id} (Onlinekurs) nennt keinen Kurs`);

  // Die Gegenprobe: das Konto steht zweimal in der Sitzung, und beide
  // Angaben setzen wir selbst. Widersprechen sie sich, wird nichts geraten.
  const metaUser = session.metadata?.user_id;
  if (metaUser && metaUser !== userId) {
    throw new Error(`Sitzung ${session.id} nennt zwei verschiedene Konten`);
  }

  const amount = session.amount_total;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Sitzung ${session.id} nennt keinen Betrag`);
  }

  return { userId, courseId, amountCents: amount, checkoutSessionId: session.id };
}

export type CourseAccessRow = {
  user_id: string;
  course_id: string;
  source: 'stripe';
  purchased_at: string;
  expires_at: string;
  amount_paid_cents: number;
  stripe_checkout_session_id: string;
};

/**
 * Die Zeile fuer public.course_access. Die Laufzeit kommt aus dem Kurs in
 * der Datenbank (access_days), nicht aus den Metadaten - die koennten aus
 * einer Zeit stammen, in der der Kurs anders eingestellt war, und vor allem
 * sind sie nicht die Quelle der Wahrheit.
 */
export function courseAccessRowFor(
  facts: OnlineCoursePaymentFacts,
  accessDays: number,
  paidAt: Date,
): CourseAccessRow {
  if (!Number.isInteger(accessDays) || accessDays < 1) {
    throw new Error(`Ungueltige Laufzeit: ${accessDays}`);
  }
  const expires = new Date(paidAt.getTime() + accessDays * 24 * 60 * 60 * 1000);
  return {
    user_id: facts.userId,
    course_id: facts.courseId,
    source: 'stripe',
    purchased_at: paidAt.toISOString(),
    expires_at: expires.toISOString(),
    amount_paid_cents: facts.amountCents,
    stripe_checkout_session_id: facts.checkoutSessionId,
  };
}
