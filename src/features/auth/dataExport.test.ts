import { describe, expect, it, vi } from 'vitest';

import { buildExport, downloadJson, EXPORT_TABLES, exportFileName } from './dataExport';

describe('EXPORT_TABLES', () => {
  // Eine neue Nutzertabelle, die hier fehlt, fehlt auch in der Auskunft nach
  // Art. 15 - und das faellt sonst niemandem auf. Dieser Test ist die
  // Erinnerung: kommt eine dazu, wird er rot und die Liste wird ergaenzt.
  it('enthaelt alle Nutzertabellen, die es heute gibt', () => {
    expect([...EXPORT_TABLES].sort()).toEqual([
      'course_bookings',
      'exercises',
      'profiles',
      'subscriptions',
      'user_consents',
    ]);
  });
});

describe('buildExport', () => {
  it('nennt Konto, Zeitpunkt und die Daten', () => {
    const dokument = buildExport({ id: 'u1', email: 'wer@example.at' }, { profiles: [{ id: 'u1' }] });

    expect(dokument.konto).toEqual({ id: 'u1', email: 'wer@example.at' });
    expect(dokument.daten.profiles).toHaveLength(1);
    expect(Date.parse(dokument.erstelltAm)).not.toBeNaN();
  });

  // Der Hinweis ist Teil der Auskunft, nicht Deko: ohne ihn koennte jemand
  // annehmen, die Datei sei vollstaendig - Zahlungsbelege liegen aber bei
  // Stripe.
  it('weist auf die Belege bei Stripe hin', () => {
    const dokument = buildExport({ id: 'u1', email: null }, {});
    expect(dokument.hinweis).toMatch(/Stripe/);
    expect(dokument.hinweis).toMatch(/Art\. 15/);
  });
});

describe('exportFileName', () => {
  it('traegt das Datum im Namen', () => {
    expect(exportFileName(new Date('2026-08-21T10:00:00Z'))).toBe(
      'thehacode-datenauskunft-2026-08-21.json',
    );
  });
});

describe('downloadJson', () => {
  it('haengt einen Link an, klickt ihn und raeumt ihn wieder weg', () => {
    const click = vi.fn();
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    const appendChild = vi.fn();
    const removeChild = vi.fn();

    const fake = {
      createElement: () => anchor,
      body: { appendChild, removeChild },
    } as unknown as Document;

    downloadJson(fake, 'auskunft.json', { a: 1 });

    expect(anchor.download).toBe('auskunft.json');
    expect(click).toHaveBeenCalledOnce();
    expect(appendChild).toHaveBeenCalledOnce();
    // Ohne das Aufraeumen bliebe bei jedem Download ein Element im Baum stehen.
    expect(removeChild).toHaveBeenCalledOnce();
  });

  it('tut ohne DOM nichts, statt zu werfen', () => {
    expect(() => downloadJson(undefined, 'auskunft.json', {})).not.toThrow();
  });
});
