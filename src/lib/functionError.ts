import { FunctionsHttpError } from '@supabase/supabase-js';

// Den Fehlercode einer Edge Function lesbar machen.
//
// WARUM ES DAS BRAUCHT (gefunden bei der Umsetzung des Reviews, 11.11.2026)
// -------------------------------------------------------------------------
// Antwortet eine Edge Function mit 4xx oder 5xx, liefert supabase-js einen
// FunctionsHttpError. Dessen message lautet IMMER "Edge Function returned a
// non-2xx status code" - der Antwortkoerper mit unserem Code
// ({"error":"sold_out"}) steckt ungelesen in error.context, einer Response.
//
// bookingErrorCode() und portalErrorCode() haben den Code in message gesucht
// und dort nie gefunden. Wer einen ausgebuchten Kurs buchen wollte, las
// deshalb "hat nicht geklappt, versuch es noch einmal" statt "ausgebucht" -
// und ein zweiter Versuch aendert daran nichts. Die Geraete-Anbindung
// (useWearables.ts) hat es als einzige richtig gemacht; das hier ist dieselbe
// Loesung an einer Stelle fuer alle.

/**
 * Macht aus dem Fehler eines functions.invoke einen Error, dessen message der
 * Code aus dem Antwortkoerper ist. Die bestehenden Auswerter verstehen das
 * ohne Aenderung. Alles andere - Netzfehler, Antwort ohne JSON, Antwort ohne
 * "error" - kommt unveraendert zurueck.
 */
export async function withFunctionErrorCode(error: unknown): Promise<unknown> {
  if (!(error instanceof FunctionsHttpError)) return error;

  try {
    const body = (await (error.context as Response).clone().json()) as { error?: unknown } | null;
    if (body && typeof body.error === 'string' && body.error.length > 0) {
      return new Error(body.error, { cause: error });
    }
  } catch {
    // Keine JSON-Antwort: der urspruengliche Fehler sagt mehr als ein geratener.
  }

  return error;
}
