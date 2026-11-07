// Tageswerte der Geraete fuer die Auswertung: je Wert und Tag Oura, Garmin
// und der Durchschnitt. Derselbe Durchschnitt, den die Datenbank ins Tagebuch
// schreibt (apply_wearable_days, 0053) - liefert nur ein Geraet, ist es
// dessen Wert.
//
// Bewusst ohne Wertung (SAD §5.7): keine Normbereiche, kein "zu niedrig".

import { addDays, type IsoDate } from '@/features/habits/dates';

export type WearableProvider = 'oura' | 'garmin';

export const METRICS = [
  // Im Tagebuch als Habit
  'steps',
  'sleep_hours',
  'sleep_score',
  'floors',
  'intensity_minutes',
  // Nur in der Auswertung
  'resting_hr',
  'body_battery',
  'stress_level',
  'stress_minutes',
  'respiration',
] as const;

export type WearableMetric = (typeof METRICS)[number];

/** Werte, die ein Habit fuellen koennen (habit_templates.wearable_metric). */
export const HABIT_METRICS: readonly WearableMetric[] = [
  'steps',
  'sleep_hours',
  'sleep_score',
  'floors',
  'intensity_minutes',
];

/** Nachkommastellen in der Anzeige. */
export const DECIMALS: Record<WearableMetric, number> = {
  steps: 0,
  sleep_hours: 1,
  sleep_score: 0,
  floors: 0,
  intensity_minutes: 0,
  resting_hr: 0,
  body_battery: 0,
  stress_level: 0,
  stress_minutes: 0,
  respiration: 1,
};

export type DailyRow = { provider: WearableProvider; metric: string; day: IsoDate; value: number | string };

export type SeriesDay = { day: IsoDate; oura: number | null; garmin: number | null; average: number };

export type MetricSeries = {
  metric: WearableMetric;
  days: SeriesDay[];
  /** Durchschnitt ueber den Zeitraum - je Quelle und gemittelt. */
  mean: { oura: number | null; garmin: number | null; average: number | null };
};

function isMetric(value: string): value is WearableMetric {
  return (METRICS as readonly string[]).includes(value);
}

export function roundFor(metric: WearableMetric, value: number): number {
  const f = 10 ** DECIMALS[metric];
  return Math.round(value * f) / f;
}

function meanOf(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Je Wert eine Reihe ueber [from, to], nur Tage mit mindestens einer Messung.
 * Werte ohne einen einzigen Tag fehlen ganz - die Auswertung zeigt nur, was
 * die Geraete wirklich liefern.
 */
export function buildSeries(rows: DailyRow[], from: IsoDate, to: IsoDate): MetricSeries[] {
  const byMetric = new Map<WearableMetric, Map<IsoDate, { oura: number | null; garmin: number | null }>>();

  for (const row of rows) {
    if (!isMetric(row.metric) || row.day < from || row.day > to) continue;
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    const days = byMetric.get(row.metric) ?? new Map();
    const day = days.get(row.day) ?? { oura: null, garmin: null };
    day[row.provider] = value;
    days.set(row.day, day);
    byMetric.set(row.metric, days);
  }

  return METRICS.flatMap((metric) => {
    const days = byMetric.get(metric);
    if (!days || days.size === 0) return [];
    const list: SeriesDay[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const v = days.get(d);
      if (!v) continue;
      const present = [v.oura, v.garmin].filter((x): x is number => x !== null);
      list.push({ day: d, oura: v.oura, garmin: v.garmin, average: meanOf(present)! });
    }
    const pick = (key: 'oura' | 'garmin' | 'average') =>
      meanOf(list.map((x) => x[key]).filter((x): x is number => x !== null));
    const mean = { oura: pick('oura'), garmin: pick('garmin'), average: pick('average') };
    return [
      {
        metric,
        days: list,
        mean: {
          oura: mean.oura === null ? null : roundFor(metric, mean.oura),
          garmin: mean.garmin === null ? null : roundFor(metric, mean.garmin),
          average: mean.average === null ? null : roundFor(metric, mean.average),
        },
      },
    ];
  });
}

/** Abgleichen, wenn der letzte laenger als `hours` her ist (oder nie war). */
export function syncDue(lastSyncedAt: string | null, now: Date, hours = 3): boolean {
  if (!lastSyncedAt) return true;
  const last = new Date(lastSyncedAt).getTime();
  return !Number.isFinite(last) || now.getTime() - last > hours * 3600_000;
}
