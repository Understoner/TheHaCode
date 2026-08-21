// Datenauskunft nach Art. 15 und Datenuebertragbarkeit nach Art. 20 DSGVO.
//
// WARUM DAS IM CLIENT PASSIERT UND NICHT IN EINER EDGE FUNCTION
// --------------------------------------------------------------
// Weil es nichts zu entscheiden gibt. Was ein Nutzer bekommen darf, sind genau
// seine eigenen Zeilen - und welche das sind, entscheidet ohnehin RLS, bei
// jeder Abfrage, unabhaengig davon wer sie stellt. Eine Funktion mit
// service_role muesste dieselbe Frage noch einmal beantworten, diesmal ohne
// Netz: sie muesste je Tabelle von Hand auf user_id filtern. Das ist mehr Code
// an der gefaehrlicheren Stelle fuer dasselbe Ergebnis.
//
// Die Kehrseite steht in der Aufzaehlung unten: sie muss gepflegt werden. Eine
// neue Nutzertabelle, die hier fehlt, fehlt auch in der Auskunft. Deshalb ist
// EXPORT_TABLES eine Liste an einer Stelle und keine Abfrage an fuenf.

/** Die Nutzertabellen, die in die Auskunft gehoeren. */
export const EXPORT_TABLES = [
  'profiles',
  'exercises',
  'subscriptions',
  'course_bookings',
  'user_consents',
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

export type ExportDocument = {
  erstelltAm: string;
  hinweis: string;
  konto: { id: string; email: string | null };
  daten: Record<string, unknown[]>;
};

/**
 * Die Auskunft als Dokument. Rein: rein, damit sie ohne Netz pruefbar ist.
 */
export function buildExport(
  konto: { id: string; email: string | null },
  daten: Record<string, unknown[]>,
): ExportDocument {
  return {
    erstelltAm: new Date().toISOString(),
    hinweis:
      'Auskunft nach Art. 15 DSGVO und Datenuebertragbarkeit nach Art. 20 DSGVO. ' +
      'Enthalten sind die zu diesem Konto gespeicherten Daten. Zahlungsbelege ' +
      'liegen zusaetzlich bei unserem Zahlungsdienstleister Stripe.',
    konto,
    daten,
  };
}

/** Ein Dateiname, der beim Wiederfinden hilft. */
export function exportFileName(now: Date = new Date()): string {
  const datum = now.toISOString().slice(0, 10);
  return `thehacode-datenauskunft-${datum}.json`;
}

/**
 * Die Datei an den Browser geben.
 *
 * Ausserhalb eines Browsers passiert nichts - die App wird als statische
 * Website ausgeliefert (web.output: "static"), aber die Komponenten laufen in
 * Tests auch ohne echtes DOM.
 */
export function downloadJson(document_: Document | undefined, name: string, payload: unknown): void {
  if (!document_ || typeof URL?.createObjectURL !== 'function') return;

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document_.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document_.body.appendChild(anchor);
  anchor.click();
  document_.body.removeChild(anchor);

  // Ohne das haelt der Browser den Speicher der Datei bis zum Neuladen fest.
  URL.revokeObjectURL(url);
}
