import { describe, expect, it, vi } from 'vitest';

import { fetchAllRows } from './fetchAllRows';

/** Ein Server mit n Zeilen, der je Anfrage hoechstens maxRows herausgibt. */
function server(n: number, maxRows: number, withCount: boolean) {
  const all = Array.from({ length: n }, (_, i) => ({ id: i }));
  return vi.fn(async (from: number, to: number) => ({
    data: all.slice(from, Math.min(to + 1, from + maxRows)),
    error: null,
    count: withCount ? n : null,
  }));
}

describe('fetchAllRows', () => {
  // Der eigentliche Befund: 1.001 Zeilen, der Server kappt bei 1.000. Ohne
  // Blaettern fehlte die letzte - ohne jede Meldung.
  it('holt auch die 1001. Zeile', async () => {
    const page = server(1001, 1000, true);

    const rows = await fetchAllRows(page);

    expect(rows).toHaveLength(1001);
    expect(rows.at(-1)).toEqual({ id: 1000 });
    expect(page).toHaveBeenCalledTimes(2);
    expect(page).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('kommt im Normalfall mit einer Anfrage aus, wenn der Server die Gesamtzahl nennt', async () => {
    const page = server(12, 1000, true);

    expect(await fetchAllRows(page)).toHaveLength(12);
    expect(page).toHaveBeenCalledTimes(1);
  });

  // Stellt jemand max_rows kleiner als die Seitengroesse, ist JEDE Seite
  // kuerzer als bestellt. "Kuerzer heisst fertig" verloere dann wieder Daten.
  it('verliert nichts, wenn der Server weniger herausgibt als bestellt', async () => {
    expect(await fetchAllRows(server(2500, 400, true))).toHaveLength(2500);
    expect(await fetchAllRows(server(2500, 400, false))).toHaveLength(2500);
  });

  it('hoert ohne Gesamtzahl erst bei einer leeren Seite auf', async () => {
    const page = server(1000, 1000, false);

    expect(await fetchAllRows(page)).toHaveLength(1000);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('liefert bei einer leeren Tabelle eine leere Liste', async () => {
    expect(await fetchAllRows(server(0, 1000, true))).toEqual([]);
  });

  // Eine halbe Auskunft waere schlimmer als keine: sie sieht vollstaendig aus.
  it('wirft, wenn eine spaetere Seite scheitert, statt die halbe Antwort zu liefern', async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], error: null, count: 2 })
      .mockResolvedValueOnce({ data: null, error: new Error('netz'), count: null });

    await expect(fetchAllRows(page)).rejects.toThrow('netz');
  });

  it('laeuft nicht endlos, wenn die gemeldete Gesamtzahl nie erreicht wird', async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], error: null, count: 5 })
      .mockResolvedValue({ data: [], error: null, count: 5 });

    expect(await fetchAllRows(page)).toHaveLength(1);
    expect(page).toHaveBeenCalledTimes(2);
  });
});
