// Kursbuchungen aus Stripe-Ereignissen - rein, ohne Netz, ohne Deno.
//
// WARUM DAS NICHT IN stripe-events.ts STEHT
// -----------------------------------------
// Ein Kurs ist eine Einmalzahlung, ein Abo eine wiederkehrende. Die beiden
// teilen sich zwar den Webhook, aber keine einzige Regel: kein Periodenende,
// kein Plan, kein Entitlement. Zusammengelegt waere jede Funktion voller
// "wenn Abo ... sonst Kurs". Getrennt ist an jeder Stelle klar, worum es geht -
// und die wichtigste Zusicherung von T20 laesst sich ueberhaupt erst
// aufschreiben: eine Kursbuchung fasst public.subscriptions nicht an.
//
// DIE ZUORDNUNG KOMMT AUS UNSEREN EIGENEN METADATEN
// -------------------------------------------------
// metadata.booking_id setzen wir beim Anlegen der Checkout-Sitzung, genau wie
// client_reference_id. Beides kommt unveraendert zurueck. Eine E-Mail-Adresse
// wird auch hier nirgends zur Zuordnung benutzt (SAD §4.3 Punkt 5).

/** Wofuer eine Zahlung steht. Steht so in den Metadaten der Sitzung. */
export type CoursePaymentKind = 'course_deposit' | 'course_full' | 'course_balance';

const PAYMENT_KINDS: readonly string[] = ['course_deposit', 'course_full', 'course_balance'];

export type StripeCourseSessionLike = {
  id: string;
  mode?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  payment_intent?: string | { id?: string | null } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

/** Was eine Kurszahlung ueber sich sagt. */
export type CoursePaymentFacts = {
  bookingId: string;
  userId: string;
  kind: CoursePaymentKind;
  amountCents: number;
  paymentIntentId: string | null;
  checkoutSessionId: string;
};

/** Die Buchung, so wie sie in der Datenbank steht - nur die gelesenen Felder. */
export type BookingRow = {
  id: string;
  user_id: string;
  status: 'reserved' | 'confirmed' | 'canceled' | 'expired';
  amount_total_cents: number;
  amount_paid_cents: number;
  deposit_cents: number | null;
  stripe_checkout_session_id: string | null;
};

function idOf(reference: string | { id?: string | null } | null | undefined): string | null {
  if (typeof reference === 'string') return reference || null;
  return reference?.id ?? null;
}

/**
 * Ist das eine Kurszahlung? null heisst: nein, geht diesen Zweig nichts an.
 *
 * Fehlt bei einer als Kurszahlung gekennzeichneten Sitzung die booking_id,
 * wird geworfen statt geraten. Das ist unsere eigene Kennzeichnung; fehlt sie
 * halb, stimmt etwas an der Stelle nicht, die sie setzt - und dann ist ein
 * lautes Scheitern das Richtige.
 */
export function coursePaymentFacts(session: StripeCourseSessionLike): CoursePaymentFacts | null {
  const kind = session.metadata?.payment_kind;
  const bookingId = session.metadata?.booking_id;

  if (!kind && !bookingId) return null;
  if (!kind || !PAYMENT_KINDS.includes(kind)) return null;

  if (!bookingId) {
    throw new Error(`Sitzung ${session.id} ist als ${kind} gekennzeichnet, hat aber keine booking_id`);
  }

  const userId = session.client_reference_id;
  if (!userId) {
    throw new Error(`Sitzung ${session.id} traegt keine client_reference_id`);
  }

  const amount = session.amount_total;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Sitzung ${session.id} nennt keinen Betrag`);
  }

  return {
    bookingId,
    userId,
    kind: kind as CoursePaymentKind,
    amountCents: amount,
    paymentIntentId: idOf(session.payment_intent),
    checkoutSessionId: session.id,
  };
}

/**
 * Was sich an der Buchung aendert. null heisst: nichts zu tun.
 *
 * DIE IDEMPOTENZ STECKT HIER, nicht nur im Ereignisregister. Stripe liefert
 * mehrfach aus, und ein zweiter Durchlauf derselben Zahlung darf den bezahlten
 * Betrag nicht ein zweites Mal addieren. Erkennungsmerkmal ist die Sitzung:
 * dieselbe Sitzung auf einer bereits bestaetigten Buchung ist ein Wiedergaenger.
 *
 * Wirft, wenn die Buchung einem anderen Konto gehoert. Dass das nie vorkommen
 * sollte, ist kein Grund, es nicht zu pruefen - es waere der eine Fehler, der
 * einen Fremden auf die Teilnehmerliste setzt.
 */
export function bookingUpdateFor(
  booking: BookingRow,
  facts: CoursePaymentFacts,
): Record<string, unknown> | null {
  if (booking.user_id !== facts.userId) {
    throw new Error(`Buchung ${booking.id} gehoert nicht zu Konto ${facts.userId}`);
  }

  if (booking.status === 'canceled') {
    throw new Error(`Buchung ${booking.id} ist storniert, die Zahlung gehoert von Hand geprueft`);
  }

  const now = new Date().toISOString();

  if (facts.kind === 'course_balance') {
    // Der Restbetrag kommt ueber einen Zahlungslink, nicht ueber den Checkout.
    // Er bestaetigt nichts, er zahlt nur nach.
    if (booking.stripe_checkout_session_id === facts.checkoutSessionId) return null;

    return {
      amount_paid_cents: booking.amount_paid_cents + facts.amountCents,
      balance_paid_at: now,
    };
  }

  // Anzahlung oder Vollzahlung: das ist der Moment, in dem aus der
  // Reservierung eine Buchung wird (§ 11 AGB).
  if (booking.status === 'confirmed' && booking.stripe_checkout_session_id === facts.checkoutSessionId) {
    return null;
  }

  return {
    status: 'confirmed',
    amount_paid_cents: booking.amount_paid_cents + facts.amountCents,
    confirmed_at: now,
    reserved_until: null,
    stripe_checkout_session_id: facts.checkoutSessionId,
    ...(facts.paymentIntentId ? { stripe_payment_intent_id: facts.paymentIntentId } : {}),
  };
}

/**
 * Was von einer Buchung noch offen ist. Ist das groesser als null, wartet ein
 * Restbetrag - eingesammelt wird er von Hand (docs/KURSBUCHUNG.md).
 */
export function outstandingCents(booking: Pick<BookingRow, 'amount_total_cents' | 'amount_paid_cents'>): number {
  return Math.max(booking.amount_total_cents - booking.amount_paid_cents, 0);
}
