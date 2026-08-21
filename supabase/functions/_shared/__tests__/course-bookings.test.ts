import { describe, expect, it } from 'vitest';

import {
  bookingUpdateFor,
  coursePaymentFacts,
  outstandingCents,
  type BookingRow,
  type StripeCourseSessionLike,
} from '../course-bookings.ts';

const USER = 'd0000000-0000-0000-0000-000000000001';
const BOOKING = 'b0000000-0000-0000-0000-000000000001';

function session(overrides: Partial<StripeCourseSessionLike> = {}): StripeCourseSessionLike {
  return {
    id: 'cs_test_kurs',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 20000,
    payment_intent: 'pi_test_1',
    client_reference_id: USER,
    metadata: { booking_id: BOOKING, payment_kind: 'course_deposit', user_id: USER },
    ...overrides,
  };
}

function booking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: BOOKING,
    user_id: USER,
    status: 'reserved',
    amount_total_cents: 40000,
    amount_paid_cents: 0,
    deposit_cents: 20000,
    stripe_checkout_session_id: null,
    ...overrides,
  };
}

describe('coursePaymentFacts', () => {
  it('liest Buchung, Konto und Betrag aus den eigenen Metadaten', () => {
    const facts = coursePaymentFacts(session());

    expect(facts).toEqual({
      bookingId: BOOKING,
      userId: USER,
      kind: 'course_deposit',
      amountCents: 20000,
      paymentIntentId: 'pi_test_1',
      checkoutSessionId: 'cs_test_kurs',
    });
  });

  // Die Abgrenzung, auf der T20 steht: ein Abo-Checkout darf hier nicht
  // haengenbleiben, sonst wuerde der Kurszweig eine Zahlung verarbeiten, die
  // ihn nichts angeht.
  it('laesst eine Abo-Sitzung unangetastet', () => {
    expect(coursePaymentFacts(session({ metadata: {} }))).toBeNull();
    expect(coursePaymentFacts(session({ metadata: null }))).toBeNull();
  });

  it('erkennt eine unbekannte Zahlungsart nicht als Kurszahlung', () => {
    expect(coursePaymentFacts(session({ metadata: { payment_kind: 'irgendwas' } }))).toBeNull();
  });

  // Halb gesetzte eigene Metadaten sind ein Fehler bei uns, kein Sonderfall.
  it('wirft, wenn die Kennzeichnung da ist, die Buchung aber fehlt', () => {
    expect(() => coursePaymentFacts(session({ metadata: { payment_kind: 'course_full' } }))).toThrow(
      /booking_id/,
    );
  });

  it('wirft ohne client_reference_id - geraten wird die Zuordnung nie', () => {
    expect(() => coursePaymentFacts(session({ client_reference_id: null }))).toThrow(
      /client_reference_id/,
    );
  });

  it('wirft ohne Betrag', () => {
    expect(() => coursePaymentFacts(session({ amount_total: null }))).toThrow(/Betrag/);
  });

  it('nimmt den payment_intent auch als ausgepacktes Objekt', () => {
    expect(coursePaymentFacts(session({ payment_intent: { id: 'pi_test_2' } }))?.paymentIntentId).toBe(
      'pi_test_2',
    );
  });
});

describe('bookingUpdateFor', () => {
  it('macht aus der Reservierung eine bestaetigte Buchung', () => {
    const update = bookingUpdateFor(booking(), coursePaymentFacts(session())!);

    expect(update).toMatchObject({
      status: 'confirmed',
      amount_paid_cents: 20000,
      reserved_until: null,
      stripe_checkout_session_id: 'cs_test_kurs',
      stripe_payment_intent_id: 'pi_test_1',
    });
  });

  // Stripe liefert Ereignisse mehrfach aus. Ohne diese Pruefung stuenden nach
  // der zweiten Zustellung 400 EUR bezahlt, wo 200 geflossen sind.
  it('addiert dieselbe Sitzung kein zweites Mal', () => {
    const bereitsBestaetigt = booking({
      status: 'confirmed',
      amount_paid_cents: 20000,
      stripe_checkout_session_id: 'cs_test_kurs',
    });

    expect(bookingUpdateFor(bereitsBestaetigt, coursePaymentFacts(session())!)).toBeNull();
  });

  it('bucht den Restbetrag auf eine bestaetigte Buchung nach', () => {
    const bestaetigt = booking({
      status: 'confirmed',
      amount_paid_cents: 20000,
      stripe_checkout_session_id: 'cs_test_kurs',
    });

    const rest = coursePaymentFacts(
      session({
        id: 'cs_test_rest',
        amount_total: 20000,
        metadata: { booking_id: BOOKING, payment_kind: 'course_balance' },
      }),
    )!;

    expect(bookingUpdateFor(bestaetigt, rest)).toMatchObject({ amount_paid_cents: 40000 });
    expect(bookingUpdateFor(bestaetigt, rest)).toHaveProperty('balance_paid_at');
  });

  // Der eine Fehler, der einen Fremden auf die Teilnehmerliste setzen wuerde.
  it('wirft, wenn die Buchung einem anderen Konto gehoert', () => {
    expect(() =>
      bookingUpdateFor(booking({ user_id: 'd0000000-0000-0000-0000-00000000ffff' }), coursePaymentFacts(session())!),
    ).toThrow(/gehoert nicht/);
  });

  it('wirft bei einer Zahlung auf eine stornierte Buchung', () => {
    expect(() => bookingUpdateFor(booking({ status: 'canceled' }), coursePaymentFacts(session())!)).toThrow(
      /storniert/,
    );
  });
});

describe('outstandingCents', () => {
  it('nennt den offenen Restbetrag nach der Anzahlung', () => {
    expect(outstandingCents({ amount_total_cents: 40000, amount_paid_cents: 20000 })).toBe(20000);
  });

  it('ist bei Vollzahlung null', () => {
    expect(outstandingCents({ amount_total_cents: 40000, amount_paid_cents: 40000 })).toBe(0);
  });

  it('wird nie negativ', () => {
    expect(outstandingCents({ amount_total_cents: 40000, amount_paid_cents: 45000 })).toBe(0);
  });
});
