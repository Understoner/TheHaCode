// Punkte eines Eintrags nach Wertgrenzen (Migration 0035, Entscheidung des
// Users vom 01.11.2026).
//
// Ohne Grenzen gilt die alte Regel aus 0021: Punkte fuers Eintragen, das
// Vorzeichen gibt das Habit (is_negative). Mit Grenzen haengt das Ergebnis vom
// Wert ab - Beispiel Schlafdauer, mehr ist besser:
//
//   Wert >= points_from   -> +points
//   Wert <  penalty_from  -> -penalty_points
//   dazwischen            -> 0
//
// Ist weniger besser (higher_is_better = false, etwa Bildschirmzeit), drehen
// sich die Vergleiche um: <= points_from bringt Punkte, > penalty_from zieht ab.
// Fehlt points_from, bringt jeder Wert ausserhalb der Minus-Zone die Punkte;
// fehlt penalty_from, gibt es nie Abzug.
//
// Die Datenbank sorgt dafuer, dass Grenzen nur an Zahlen-Habits ohne eigenes
// Vorzeichen und nie an Gesundheits-Messwerten (BOLT) stehen. Diese Funktion
// verlaesst sich nicht darauf: steht trotzdem etwas Ungereimtes da, faellt sie
// auf die alte Regel zurueck.
//
// Selbst pruefen (CLAUDE.md §Aufgabenteilung): ein Fehler hier verfaelscht
// still den Score.

export type ValueRule = {
  tracking_type: string;
  points: number;
  is_negative: boolean;
  higher_is_better: boolean;
  points_from: number | null;
  penalty_from: number | null;
  penalty_points: number | null;
};

/** Ergebnis eines Eintrags: Betrag und Richtung, wie ScoreEntry sie erwartet. */
export type EntryPoints = { points: number; isNegative: boolean };

export function hasValueRule(rule: ValueRule): boolean {
  return (
    rule.tracking_type === 'number' &&
    !rule.is_negative &&
    (rule.points_from !== null || rule.penalty_from !== null)
  );
}

type Zone = 'plus' | 'neutral' | 'minus';

function zoneOf(rule: ValueRule, value: number): Zone {
  const better = (a: number, b: number) => (rule.higher_is_better ? a >= b : a <= b);
  // Minus zuerst: liegt ein Wert unter der Minus-Grenze, hilft keine Plus-Grenze.
  if (rule.penalty_from !== null && !better(value, rule.penalty_from)) return 'minus';
  if (rule.points_from === null || better(value, rule.points_from)) return 'plus';
  return 'neutral';
}

/**
 * Die Punkte eines Eintrags. Bei einem Habit mit Wertgrenzen und ohne Wert
 * (sollte nicht vorkommen, die Datenbank verlangt einen) gibt es nichts.
 */
export function pointsForEntry(rule: ValueRule, value: number | null): EntryPoints {
  if (!hasValueRule(rule)) return { points: rule.points, isNegative: rule.is_negative };
  if (value === null || !Number.isFinite(value)) return { points: 0, isNegative: false };

  const zone = zoneOf(rule, value);
  if (zone === 'minus') return { points: Math.max(0, rule.penalty_points ?? 0), isNegative: true };
  if (zone === 'plus') return { points: rule.points, isNegative: false };
  return { points: 0, isNegative: false };
}

/**
 * Hat ein Eintrag das Ziel erreicht? Fuer Challenges (0036): ein Zahlen-Habit
 * mit Grenzen zaehlt erst in der Plus-Zone, alles andere mit dem Eintrag
 * selbst.
 */
export function meetsGoal(rule: ValueRule, value: number | null): boolean {
  if (!hasValueRule(rule)) return true;
  if (value === null || !Number.isFinite(value)) return false;
  return zoneOf(rule, value) === 'plus';
}
