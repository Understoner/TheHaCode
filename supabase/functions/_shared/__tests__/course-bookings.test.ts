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
const GAST = 'gerda@example.at';

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

/** Eine Sitzung, wie sie eine Gastbuchung erzeugt: kein Konto, dafuer eine Adresse. */
function gastSession(overrides: Partial<StripeCourseSessionLike> = {}): StripeCourseSessionLike {
  return session({
    client_reference_id: null,
    metadata: { booking_id: BOOKING, payment_kind: 'course_full', guest_email: GAST },
    ...overrides,
  });
}

function booking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: BOOKING,
    user_id: USER,
    guest_email: null,
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
      guestEmail: null,
      kind: 'course_deposit',
      amountCents: 20000,
      paymentIntentId: 'pi_test_1',
      checkoutSessionId: 'cs_test_kurs',
    });
  });

  it('liest bei einer Gastbuchung die Adresse statt eines Kontos', () => {
    const facts = coursePaymentFacts(gastSession());

    expect(facts?.userId).toBeNull();
    expect(facts?.guestEmail).toBe(GAST);
  });

  // Klein und ohne Leerzeichen - genau so liegt die Adresse in der Datenbank
  // (Migration 0015). Sonst faende der Vergleich unten seine eigene Buchung nicht.
  it('vergleicht Adressen unabhaengig von Schreibweise und Leerzeichen', () => {
    const facts = coursePaymentFacts(
      gastSession({ metadata: { booking_id: BOOKING, payment_kind: 'course_full', guest_email: '  Gerda@Example.AT ' } }),
    );

    expect(facts?.guestEmail).toBe(GAST);
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

  it('wirft ohne Konto und ohne Gastadresse - geraten wird die Zuordnung nie', () => {
    expect(() => coursePaymentFacts(session({ client_reference_id: null }))).toThrow(
      /weder ein Konto noch eine Gastadresse/,
    );
  });

  // Eine Sitzung, die beides nennt, ist widerspruechlich: sie koennte zu einer
  // Kontobuchung gehoeren oder zu einer Gastbuchung. Raten waere hier die
  // teuerste aller Loesungen.
  it('wirft, wenn eine Sitzung Konto und Gastadresse zugleich nennt', () => {
    expect(() =>
      coursePaymentFacts(
        session({ metadata: { booking_id: BOOKING, payment_kind: 'course_full', guest_email: GAST } }),
      ),
    ).toThrow(/zugleich/);
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

  // ---------- Gastbuchungen ----------
  it('bestaetigt eine Gastbuchung wie jede andere', () => {
    const gast = booking({ user_id: null, guest_email: GAST, deposit_cents: null, amount_total_cents: 20000 });

    expect(bookingUpdateFor(gast, coursePaymentFacts(gastSession())!)).toMatchObject({
      status: 'confirmed',
      amount_paid_cents: 20000,
    });
  });

  // Dieselbe Schranke wie oben, nur fuer die andere Art von Bucher: eine
  // Gastzahlung darf keine fremde Gastbuchung bestaetigen.
  it('wirft, wenn die Gastbuchung zu einer anderen Adresse gehoert', () => {
    const fremd = booking({ user_id: null, guest_email: 'jemand.anderer@example.at' });

    expect(() => bookingUpdateFor(fremd, coursePaymentFacts(gastSession())!)).toThrow(/gehoert nicht/);
  });

  // Und sie darf erst recht keine Kontobuchung bestaetigen - sonst koennte
  // jemand mit einer eigenen Zahlung den Platz eines Kontos uebernehmen.
  it('wirft, wenn eine Gastzahlung auf eine Kontobuchung trifft', () => {
    expect(() => bookingUpdateFor(booking(), coursePaymentFacts(gastSession())!)).toThrow(/Konto/);
  });

  it('wirft, wenn eine Kontozahlung auf eine Gastbuchung trifft', () => {
    const gast = booking({ user_id: null, guest_email: GAST });

    expect(() => bookingUpdateFor(gast, coursePaymentFacts(session())!)).toThrow(/gehoert nicht/);
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
