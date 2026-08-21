import { describe, expect, it } from 'vitest';

import { availabilityOf, bookingErrorCode, formatPrice, SCARCE_FROM } from './booking';

describe('bookingErrorCode', () => {
  it('erkennt die Absagen der Edge Function', () => {
    expect(bookingErrorCode({ error: 'sold_out' })).toBe('sold_out');
    expect(bookingErrorCode({ error: 'already_booked' })).toBe('already_booked');
    expect(bookingErrorCode({ error: 'agb_required' })).toBe('agb_required');
  });

  // supabase-js verpackt den Antwortkoerper bei Fehlerstatus nicht - dann steht
  // das JSON als Text in message.
  it('findet den Code auch im Text einer FunctionsHttpError-Meldung', () => {
    expect(bookingErrorCode({ message: 'Edge Function returned {"error":"sold_out"}' })).toBe(
      'sold_out',
    );
  });

  // Der wichtige Fall: alles Unbekannte bekommt eine Meldung mit
  // Handlungsoption statt eines durchgereichten englischen Techniktexts.
  it('macht aus allem Unbekannten "unknown"', () => {
    expect(bookingErrorCode(new Error('TypeError: failed to fetch'))).toBe('unknown');
    expect(bookingErrorCode(null)).toBe('unknown');
    expect(bookingErrorCode(undefined)).toBe('unknown');
    expect(bookingErrorCode({})).toBe('unknown');
    expect(bookingErrorCode('irgendwas')).toBe('unknown');
  });
});

describe('formatPrice', () => {
  it('zeigt Cent als oesterreichischen Betrag', () => {
    // Intl setzt ein schmales geschuetztes Leerzeichen zwischen Zahl und
    // Waehrung - deshalb wird auf die Bestandteile geprueft, nicht auf den
    // ganzen String.
    const preis = formatPrice(20000);
    expect(preis).toContain('200,00');
    expect(preis).toContain('€');
  });

  it('rundet nicht weg, was an Cent dranhaengt', () => {
    expect(formatPrice(12345)).toContain('123,45');
  });
});

describe('availabilityOf', () => {
  it('ohne Teilnehmerbegrenzung gibt es keine Grenze', () => {
    expect(availabilityOf(null)).toEqual({ seatsLeft: null, soldOut: false, scarce: false });
    expect(availabilityOf(undefined)).toEqual({ seatsLeft: null, soldOut: false, scarce: false });
  });

  it('null Plaetze heisst ausgebucht', () => {
    expect(availabilityOf(0).soldOut).toBe(true);
    expect(availabilityOf(0).scarce).toBe(false);
  });

  // Kann durch eine von Hand gesetzte Buchung im Studio vorkommen: mehr
  // Buchungen als Plaetze. Ausgebucht ist ausgebucht, nicht "minus zwei frei".
  it('mehr Buchungen als Plaetze bleiben ausgebucht', () => {
    expect(availabilityOf(-2).soldOut).toBe(true);
  });

  it('meldet Knappheit erst ab der Schwelle', () => {
    expect(availabilityOf(SCARCE_FROM).scarce).toBe(true);
    expect(availabilityOf(SCARCE_FROM + 1).scarce).toBe(false);
  });
});
