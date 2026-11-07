import { describe, expect, it } from 'vitest';

import { buildSeries, syncDue, type DailyRow } from './series';

const rows: DailyRow[] = [
  { provider: 'oura', metric: 'steps', day: '2026-11-05', value: 8000 },
  { provider: 'garmin', metric: 'steps', day: '2026-11-05', value: '9001' },
  { provider: 'garmin', metric: 'steps', day: '2026-11-06', value: 6000 },
  { provider: 'oura', metric: 'respiration', day: '2026-11-06', value: 14.26 },
  { provider: 'oura', metric: 'unbekannt', day: '2026-11-06', value: 1 },
  { provider: 'oura', metric: 'steps', day: '2026-10-01', value: 1 },
];

describe('buildSeries', () => {
  const series = buildSeries(rows, '2026-11-01', '2026-11-07');

  it('mittelt Oura und Garmin je Tag wie die Datenbank', () => {
    const steps = series.find((s) => s.metric === 'steps')!;
    expect(steps.days).toEqual([
      { day: '2026-11-05', oura: 8000, garmin: 9001, average: 8500.5 },
      { day: '2026-11-06', oura: null, garmin: 6000, average: 6000 },
    ]);
  });

  it('rechnet den Zeitraum je Quelle und gemittelt', () => {
    const steps = series.find((s) => s.metric === 'steps')!;
    expect(steps.mean).toEqual({ oura: 8000, garmin: 7501, average: 7250 });
  });

  it('rundet je Wert passend', () => {
    expect(series.find((s) => s.metric === 'respiration')!.mean.average).toBe(14.3);
  });

  it('laesst unbekannte Werte, fremde Tage und leere Werte weg', () => {
    expect(series.map((s) => s.metric)).toEqual(['steps', 'respiration']);
  });
});

describe('syncDue', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  it('gleicht beim ersten Mal und nach drei Stunden ab', () => {
    expect(syncDue(null, now)).toBe(true);
    expect(syncDue('2026-11-07T08:59:00Z', now)).toBe(true);
    expect(syncDue('2026-11-07T10:00:00Z', now)).toBe(false);
  });
});
