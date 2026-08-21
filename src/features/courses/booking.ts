// Die reinen Regeln der Kursbuchung - ohne React, ohne Netz, damit sie
// einzeln pruefbar sind.

/** Was die Edge Function create-course-checkout an Absagen kennt. */
export type BookingErrorCode =
  | 'sold_out'
  | 'already_booked'
  | 'not_bookable'
  | 'agb_required'
  | 'unauthorized'
  | 'unknown';

/**
 * Die Absage von create-course-checkout auf einen unserer Codes bringen.
 *
 * Alles, was wir nicht kennen, wird 'unknown' - und 'unknown' bekommt eine
 * Meldung mit Handlungsoption (CLAUDE.md: deutsch, ohne Technikjargon, immer
 * mit Handlungsoption). Ein durchgereichter englischer Stripe- oder
 * PostgREST-Text waere beides nicht.
 */
export function bookingErrorCode(error: unknown): BookingErrorCode {
  const known: BookingErrorCode[] = [
    'sold_out',
    'already_booked',
    'not_bookable',
    'agb_required',
    'unauthorized',
  ];

  const raw = extractErrorKey(error);
  return known.find((code) => code === raw) ?? 'unknown';
}

function extractErrorKey(error: unknown): string | null {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return null;

  const candidate = error as { error?: unknown; message?: unknown };
  if (typeof candidate.error === 'string') return candidate.error;

  // supabase-js verpackt den Antwortkoerper nicht, wenn der Status ein Fehler
  // ist - dort steht der Text dann in message.
  if (typeof candidate.message === 'string') {
    const match = candidate.message.match(/"error"\s*:\s*"([a-z_]+)"/);
    if (match) return match[1];
    return candidate.message;
  }

  return null;
}

/** Cent als Preis, wie ihn ein oesterreichischer Betrag ausschaut. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/**
 * Wie ein Kurs gerade dasteht.
 *
 * 'ausgebucht' entsteht nur bei einer gepflegten Teilnehmerzahl; ohne
 * capacity meldet course_seats() null, und dann gibt es keine Grenze.
 */
export type CourseAvailability = {
  seatsLeft: number | null;
  soldOut: boolean;
  /** Ab hier lohnt der Hinweis "nur noch wenige Plaetze". */
  scarce: boolean;
};

export const SCARCE_FROM = 3;

export function availabilityOf(seatsLeft: number | null | undefined): CourseAvailability {
  if (seatsLeft === null || seatsLeft === undefined) {
    return { seatsLeft: null, soldOut: false, scarce: false };
  }

  return {
    seatsLeft,
    soldOut: seatsLeft <= 0,
    scarce: seatsLeft > 0 && seatsLeft <= SCARCE_FROM,
  };
}
