import { describe, expect, it } from 'vitest';

import {
  activeUntil,
  courseProgress,
  groupByWeek,
  orderBlocks,
  planDates,
  plusPriceCents,
  totalMinutes,
  type OutlineBlock,
} from './courseLogic';
import { onlineCoursePrice } from '../../../supabase/functions/_shared/online-courses';

function block(id: string, kind: OutlineBlock['kind'], day: number, sort = 0, duration: number | null = null): OutlineBlock {
  return { id, kind, title: id, day_offset: day, sort_order: sort, duration_sec: duration };
}

const blocks = [
  block('quiz', 'quiz', 13, 9),
  block('video', 'video', 0, 1, 360),
  block('text', 'text', 0, 2, 300),
  block('audio', 'audio', 8, 3, 480),
];

describe('orderBlocks und groupByWeek', () => {
  it('ordnet nach Tag, dann nach Reihenfolge', () => {
    expect(orderBlocks(blocks).map((b) => b.id)).toEqual(['video', 'text', 'audio', 'quiz']);
  });

  it('teilt in Wochen', () => {
    expect(groupByWeek(blocks).map((w) => [w.week, w.blocks.map((b) => b.id)])).toEqual([
      [1, ['video', 'text']],
      [2, ['audio', 'quiz']],
    ]);
  });
});

describe('courseProgress', () => {
  it('zaehlt das Quiz nicht als Inhalt', () => {
    const p = courseProgress(blocks, new Set(['video']));
    expect(p).toMatchObject({ contentTotal: 3, contentDone: 1, quizPassed: false, certificateReady: false, next: 'text' });
  });

  it('verlangt fuers Zertifikat alle Inhalte UND das bestandene Quiz', () => {
    expect(courseProgress(blocks, new Set(['video', 'text', 'audio'])).certificateReady).toBe(false);
    expect(courseProgress(blocks, new Set(['quiz'])).certificateReady).toBe(false);
    expect(courseProgress(blocks, new Set(['video', 'text', 'audio', 'quiz'])).certificateReady).toBe(true);
  });

  it('kennt keinen naechsten Block, wenn alles erledigt ist', () => {
    expect(courseProgress(blocks, new Set(['video', 'text', 'audio', 'quiz'])).next).toBeNull();
  });
});

describe('Preise und Dauer', () => {
  it('kuendigt denselben Plus-Preis an, den der Server verlangt', () => {
    for (const list of [8900, 999, 4900, 1]) {
      expect(plusPriceCents(list)).toBe(onlineCoursePrice(list, true).amountCents);
    }
  });

  it('rundet die Gesamtdauer auf Minuten auf', () => {
    expect(totalMinutes(blocks)).toBe(19);
  });
});

describe('activeUntil', () => {
  const now = new Date('2026-11-03T12:00:00Z');

  it('nimmt den laengsten laufenden Kauf', () => {
    expect(
      activeUntil(
        [
          { expires_at: '2026-10-01T00:00:00Z' },
          { expires_at: '2027-11-03T12:00:00Z' },
          { expires_at: '2028-01-01T00:00:00Z', deleted_at: '2026-11-01T00:00:00Z' },
        ],
        now,
      )?.toISOString(),
    ).toBe('2027-11-03T12:00:00.000Z');
  });

  it('liefert null ohne laufenden Kauf', () => {
    expect(activeUntil([{ expires_at: '2026-10-01T00:00:00Z' }], now)).toBeNull();
  });
});

describe('planDates', () => {
  const plan = [
    block('a', 'video', 0, 1),
    block('b', 'text', 0, 2),
    block('c', 'audio', 2, 3),
    block('d', 'quiz', 6, 4),
  ];

  it('legt Bloecke an ihren Vorschlagstag', () => {
    expect(Object.fromEntries(planDates(plan, '2026-11-04', { mode: 'course' }))).toEqual({
      a: '2026-11-04',
      b: '2026-11-04',
      c: '2026-11-06',
      d: '2026-11-10',
    });
  });

  it('verteilt Kurstage auf feste Wochentage und haelt Tage zusammen', () => {
    // 04.11.2026 ist ein Mittwoch; Mo/Mi/Fr = 0/2/4.
    expect(Object.fromEntries(planDates(plan, '2026-11-04', { mode: 'weekdays', weekdays: [0, 2, 4] }))).toEqual({
      a: '2026-11-04',
      b: '2026-11-04',
      c: '2026-11-06',
      d: '2026-11-09',
    });
  });

  it('plant Erledigtes nicht neu', () => {
    expect([...planDates(plan, '2026-11-04', { mode: 'course' }, new Set(['a', 'b'])).keys()]).toEqual(['c', 'd']);
  });

  it('nimmt ohne Wochentage jeden Tag', () => {
    expect(planDates(plan, '2026-11-04', { mode: 'weekdays', weekdays: [] }).get('d')).toBe('2026-11-06');
  });
});
