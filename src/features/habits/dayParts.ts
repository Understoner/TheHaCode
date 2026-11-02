// Das Tagebuch nach Tageszeit (02.11.2026, Vorschlag "Mondlicht Mobile",
// nur Testsystem). Die Tageszeit steht seit 0039 an der Vorlage; ohne Wert
// gehoert ein Habit in "Tagsueber".

export type DayPart = 'morgens' | 'tagsueber' | 'abends';

export const DAY_PARTS: DayPart[] = ['morgens', 'tagsueber', 'abends'];

export function dayPartOf(value: string | null | undefined): DayPart {
  return value === 'morgens' || value === 'abends' ? value : 'tagsueber';
}

/** Gruppen in fester Reihenfolge; leere Gruppen fallen weg, die Reihenfolge innerhalb bleibt. */
export function groupByDayPart<T>(items: readonly T[], partOf: (item: T) => string | null | undefined) {
  return DAY_PARTS.map((part) => ({
    part,
    items: items.filter((item) => dayPartOf(partOf(item)) === part),
  })).filter((group) => group.items.length > 0);
}
