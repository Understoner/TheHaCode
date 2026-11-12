import { describe, expect, it } from 'vitest';

import { toPrintable } from '../pdf-text.ts';

describe('toPrintable', () => {
  it('laesst stehen, was die Standardschrift kennt', () => {
    const text = 'Jörg Müßig-Çelik – „Atmen“ für 9 € · Œuvre, Šárka Žák';
    // Šárka: Š und á kennt WinAnsi; das k und der Rest ohnehin.
    expect(toPrintable(text)).toEqual({ text, lost: 0 });
  });

  // Der Fall aus dem Review: mit ć warf pdf-lib, und es gab nie eine PDF.
  it('fuehrt Buchstaben mit unbekanntem Akzent auf den Grundbuchstaben zurueck', () => {
    expect(toPrintable('Jović')).toEqual({ text: 'Jovic', lost: 0 });
    // Nur das Unbekannte faellt weg: das á in Dvořák kennt die Schrift.
    expect(toPrintable('Čapek Dvořák Erdős Şahin')).toEqual({ text: 'Capek Dvorák Erdos Sahin', lost: 0 });
  });

  it('kennt die Buchstaben, die sich nicht zerlegen lassen', () => {
    expect(toPrintable('Wałęsa Đoković')).toEqual({ text: 'Walesa Dokovic', lost: 0 });
  });

  // So liefert ein Mac Umlaute: Grundbuchstabe plus getrennter Akzent. Ohne
  // die Normalisierung vorweg wuerde aus "ü" ein "u".
  it('behaelt Umlaute auch in zerlegter Schreibweise', () => {
    expect(toPrintable('Müller')).toEqual({ text: 'Müller', lost: 0 });
  });

  it('zaehlt, was sich nicht ersetzen laesst', () => {
    expect(toPrintable('Иван')).toEqual({ text: '????', lost: 4 });
    expect(toPrintable('Li 李')).toEqual({ text: 'Li ?', lost: 1 });
  });

  it('macht aus Umbruechen und geschuetzten Leerzeichen einfache Leerzeichen', () => {
    expect(toPrintable(' Anna\n\tMaria Huber ')).toEqual({ text: 'Anna Maria Huber', lost: 0 });
  });

  it('laesst unsichtbare Zeichen weg', () => {
    expect(toPrintable('An­na​')).toEqual({ text: 'Anna', lost: 0 });
  });
});
