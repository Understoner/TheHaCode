import { describe, expect, it } from 'vitest';

import {
  courseAccessRowFor,
  onlineCoursePaymentFacts,
  onlineCoursePrice,
  type StripeOnlineCourseSessionLike,
} from '../online-courses.ts';

const USER = 'd0000000-0000-0000-0000-000000000001';
const COURSE = 'c0000000-0000-0000-0000-000000000001';

function session(overrides: Partial<StripeOnlineCourseSessionLike> = {}): StripeOnlineCourseSessionLike {
  return {
    id: 'cs_test_online',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 7565,
    client_reference_id: USER,
    metadata: { payment_kind: 'online_course', course_id: COURSE, user_id: USER },
    ...overrides,
  };
}

describe('onlineCoursePrice', () => {
  it('verlangt ohne Plus den Listenpreis', () => {
    expect(onlineCoursePrice(8900, false)).toEqual({ amountCents: 8900, discountCents: 0 });
  });

  it('gibt Plus-Kunden 15 % Rabatt', () => {
    expect(onlineCoursePrice(8900, true)).toEqual({ amountCents: 7565, discountCents: 1335 });
  });

  it('rundet auf ganze Cent', () => {
    // 999 * 0,85 = 849,15
    expect(onlineCoursePrice(999, true)).toEqual({ amountCents: 849, discountCents: 150 });
  });

  it('verlangt nie 0 EUR, wenn der Preis kaputt ist', () => {
    expect(() => onlineCoursePrice(0, false)).toThrow();
    expect(() => onlineCoursePrice(-100, true)).toThrow();
    expect(() => onlineCoursePrice(12.5, false)).toThrow();
  });
});

describe('onlineCoursePaymentFacts', () => {
  it('erkennt einen Onlinekurs-Kauf', () => {
    expect(onlineCoursePaymentFacts(session())).toEqual({
      userId: USER,
      courseId: COURSE,
      amountCents: 7565,
      checkoutSessionId: 'cs_test_online',
    });
  });

  it('laesst Abos und Kursbuchungen in Ruhe', () => {
    expect(onlineCoursePaymentFacts(session({ metadata: {} }))).toBeNull();
    expect(
      onlineCoursePaymentFacts(session({ metadata: { payment_kind: 'course_full', booking_id: 'b1' } })),
    ).toBeNull();
  });

  it('wirft bei halber Kennzeichnung statt zu raten', () => {
    expect(() => onlineCoursePaymentFacts(session({ client_reference_id: null }))).toThrow(/Konto/);
    expect(() =>
      onlineCoursePaymentFacts(session({ metadata: { payment_kind: 'online_course', user_id: USER } })),
    ).toThrow(/Kurs/);
    expect(() => onlineCoursePaymentFacts(session({ amount_total: 0 }))).toThrow(/Betrag/);
  });

  it('nimmt keine Sitzung mit zwei verschiedenen Konten an', () => {
    expect(() =>
      onlineCoursePaymentFacts(
        session({ metadata: { payment_kind: 'online_course', course_id: COURSE, user_id: 'jemand-anderes' } }),
      ),
    ).toThrow(/zwei/);
  });
});

describe('courseAccessRowFor', () => {
  it('gibt ein Jahr ab Zahlung', () => {
    const facts = onlineCoursePaymentFacts(session())!;
    const row = courseAccessRowFor(facts, 365, new Date('2026-11-03T12:00:00Z'));
    expect(row).toEqual({
      user_id: USER,
      course_id: COURSE,
      source: 'stripe',
      purchased_at: '2026-11-03T12:00:00.000Z',
      expires_at: '2027-11-03T12:00:00.000Z',
      amount_paid_cents: 7565,
      stripe_checkout_session_id: 'cs_test_online',
    });
  });

  it('lehnt eine unbrauchbare Laufzeit ab', () => {
    const facts = onlineCoursePaymentFacts(session())!;
    expect(() => courseAccessRowFor(facts, 0, new Date())).toThrow();
  });
});
