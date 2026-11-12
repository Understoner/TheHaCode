// Text fuer die Standardschriften der PDF druckbar machen - rein, ohne pdf-lib.
//
// WARUM ES DAS GIBT (Review 11.11.2026, S5)
// -----------------------------------------
// Das Zertifikat nutzt die Standardschriften von pdf-lib (Helvetica, Times).
// Die kennen nur den Zeichensatz WinAnsi - Umlaute und ß ja, ć, č, ł oder ő
// nein - und WERFEN bei jedem anderen Zeichen. Eine Person namens "Jović"
// bekam deshalb ein Zertifikat in der Datenbank, aber nie eine PDF: die
// Funktion antwortete mit einem unbehandelten Fehler, und der Name laesst sich
// nach dem Ausstellen nicht mehr aendern. Ein einziges solches Zeichen im
// Kurstitel haette die PDF fuer ALLE Teilnehmer des Kurses verhindert.
//
// WAS HIER PASSIERT - UND WAS BEWUSST NICHT
// -----------------------------------------
// Die saubere Loesung ist eine eingebettete Schrift mit vollem lateinischem
// Zeichensatz. pdf-lib braucht dafuer @pdf-lib/fontkit, eine neue Bibliothek,
// und die gibt das Team frei, nicht diese Datei (CLAUDE.md).
//
// Bis dahin: was die Schrift nicht kennt, wird auf den Grundbuchstaben
// zurueckgefuehrt (ć -> c, ł -> l). Der Name in der Datenbank und auf der
// Pruefseite bleibt der richtige - nur die PDF weicht ab. Das ist der Grund,
// die Eingabe NICHT schon beim Ausstellen abzulehnen: ein abgelehnter Name
// waere fuer immer falsch gespeichert, ein richtig gespeicherter wird mit der
// eingebetteten Schrift von selbst richtig gedruckt.
//
// Laesst sich ein Zeichen nicht zurueckfuehren (kyrillisch, griechisch,
// chinesisch), zaehlt es als verloren. Was der Aufrufer daraus macht, ist
// seine Sache: ein Name aus Fragezeichen ist kein Zertifikat.

/** Die 27 Zeichen, die WinAnsi (Windows-1252) ueber Latin-1 hinaus kennt. */
const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

/** Buchstaben, die sich nicht in Grundbuchstabe und Akzent zerlegen lassen. */
const BASE_LETTER: Record<string, string> = {
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ħ: 'h',
  Ħ: 'H',
  ŧ: 't',
  Ŧ: 'T',
  ı: 'i',
  ŋ: 'n',
  Ŋ: 'N',
  ĸ: 'k',
  ĳ: 'ij',
  Ĳ: 'IJ',
  ŉ: "'n",
  ſ: 's',
};

function isWinAnsi(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff && code !== 0xad) || WIN_ANSI_EXTRA.has(code);
}

/**
 * Den Text so umschreiben, dass die Standardschriften ihn setzen koennen.
 * lost zaehlt die Zeichen, fuer die es keinen Ersatz gab - sie stehen als "?"
 * im Ergebnis.
 */
export function toPrintable(input: string): { text: string; lost: number } {
  let text = '';
  let lost = 0;

  // NFC zuerst: ein "e" mit getrenntem Akzent (so liefert es ein Mac) wird
  // zu "é" und bleibt damit erhalten, statt den Akzent zu verlieren.
  for (const char of input.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0;

    if (isWinAnsi(char)) {
      text += char;
    } else if (code === 0xa0 || code < 0x20 || code === 0x7f) {
      // Geschuetztes Leerzeichen, Zeilenumbruch, Tabulator: ein Leerzeichen.
      text += ' ';
    } else if (code === 0xad || (code >= 0x200b && code <= 0x200d) || code === 0xfeff) {
      // Weiches Trennzeichen und unsichtbare Zeichen: ersatzlos.
    } else if (BASE_LETTER[char] !== undefined) {
      text += BASE_LETTER[char];
    } else {
      const base = char.normalize('NFD').replace(/\p{M}/gu, '');
      if (base.length > 0 && [...base].every(isWinAnsi)) {
        text += base;
      } else {
        text += '?';
        lost += 1;
      }
    }
  }

  return { text: text.replace(/ {2,}/g, ' ').trim(), lost };
}
