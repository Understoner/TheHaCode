import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { bookingErrorCode } from '@/features/courses/booking';
import { portalErrorCode } from '@/features/plus/plus';

import { withFunctionErrorCode } from './functionError';

function httpError(body: string, status = 409): FunctionsHttpError {
  return new FunctionsHttpError(new Response(body, { status }));
}

describe('withFunctionErrorCode', () => {
  it('liest den Code aus dem Antwortkoerper', async () => {
    const error = await withFunctionErrorCode(httpError('{"error":"sold_out"}'));

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('sold_out');
  });

  // Der eigentliche Befund: so, wie supabase-js den Fehler liefert, fanden die
  // Auswerter den Code nie. Mit dem Umweg ueber diese Funktion schon.
  it('macht die Absagen fuer die bestehenden Auswerter lesbar', async () => {
    const roh = httpError('{"error":"sold_out"}');
    expect(bookingErrorCode(roh)).toBe('unknown');
    expect(bookingErrorCode(await withFunctionErrorCode(roh))).toBe('sold_out');

    expect(portalErrorCode(await withFunctionErrorCode(httpError('{"error":"no_customer"}', 404)))).toBe(
      'no_customer',
    );
  });

  it('laesst alles andere unveraendert', async () => {
    const netz = new Error('failed to fetch');
    expect(await withFunctionErrorCode(netz)).toBe(netz);

    const keinJson = httpError('<html>502</html>', 502);
    expect(await withFunctionErrorCode(keinJson)).toBe(keinJson);

    const ohneCode = httpError('{"hinweis":"nichts"}', 500);
    expect(await withFunctionErrorCode(ohneCode)).toBe(ohneCode);

    expect(await withFunctionErrorCode(null)).toBeNull();
  });
});
