import { describe, expect, it } from 'vitest';

import type { PlayableExercise } from '@/types/breathing';
import { buildTimeline, phaseAt, phaseProgress, totalDurationMs } from './timeline';

// Die Timeline ist rein und deterministisch - genau deshalb laesst sich hier
// pruefen, was sonst 20 Minuten echte Wartezeit braeuchte (BACKLOG T08:
// "Nach 20 Minuten simulierter Laufzeit keine Drift").

type PhaseInput = {
  position: number;
  kind: 'inhale' | 'hold_in' | 'exhale' | 'hold_out' | 'free_breathing';
  duration_seconds: number;
  is_open_ended?: boolean;
  duration_delta_per_round?: number;
  max_duration_seconds?: number | null;
};

function uebung(steps: { repeat_count: number; rest_seconds?: number; phases: PhaseInput[] }[]) {
  return {
    exercise_steps: steps.map((step, i) => ({
      id: `s${i}`,
      exercise_id: 'e',
      position: i + 1,
      label: null,
      repeat_count: step.repeat_count,
      rest_seconds: step.rest_seconds ?? 0,
      exercise_phases: step.phases.map((p, j) => ({
        id: `p${i}-${j}`,
        step_id: `s${i}`,
        position: p.position,
        kind: p.kind,
        duration_seconds: p.duration_seconds,
        is_open_ended: p.is_open_ended ?? false,
        duration_delta_per_round: p.duration_delta_per_round ?? 0,
        max_duration_seconds: p.max_duration_seconds ?? null,
        cue_text: null,
      })),
    })),
  } as unknown as PlayableExercise;
}

const box4444 = uebung([
  {
    repeat_count: 8,
    phases: [
      { position: 1, kind: 'inhale', duration_seconds: 4 },
      { position: 2, kind: 'hold_in', duration_seconds: 4 },
      { position: 3, kind: 'exhale', duration_seconds: 4 },
      { position: 4, kind: 'hold_out', duration_seconds: 4 },
    ],
  },
]);

describe('buildTimeline', () => {
  it('legt Box-Atmung 4-4-4-4 als 32 Segmente ueber 128 Sekunden an', () => {
    const t = buildTimeline(box4444);

    expect(t).toHaveLength(8 * 4);
    expect(totalDurationMs(t)).toBe(128_000);
  });

  it('laesst weder Luecke noch Ueberlappung zwischen den Segmenten', () => {
    const t = buildTimeline(box4444);

    expect(t[0].startMs).toBe(0);
    for (let i = 1; i < t.length; i += 1) {
      expect(t[i].startMs, `Segment ${i} schliesst luecken- und ueberlappungsfrei an`).toBe(
        t[i - 1].endMs
      );
    }
  });

  it('sortiert Bloecke und Phasen nach position, nicht nach Eingangsreihenfolge', () => {
    const verdreht = uebung([
      {
        repeat_count: 1,
        phases: [
          { position: 3, kind: 'exhale', duration_seconds: 3 },
          { position: 1, kind: 'inhale', duration_seconds: 1 },
          { position: 2, kind: 'hold_in', duration_seconds: 2 },
        ],
      },
    ]);

    expect(buildTimeline(verdreht).map((s) => s.kind)).toEqual(['inhale', 'hold_in', 'exhale']);
  });

  it('zaehlt Runden je Block und legt die Pause als eigenes Segment dazwischen', () => {
    const t = buildTimeline(
      uebung([
        { repeat_count: 2, rest_seconds: 10, phases: [{ position: 1, kind: 'inhale', duration_seconds: 5 }] },
        { repeat_count: 1, phases: [{ position: 1, kind: 'exhale', duration_seconds: 5 }] },
      ])
    );

    expect(t.map((s) => s.kind)).toEqual(['inhale', 'inhale', 'rest', 'exhale']);
    expect(t.map((s) => s.stepIndex)).toEqual([0, 0, 0, 1]);
    // 2x5s, dann 10s Pause, dann beginnt der zweite Block bei 20s
    expect(t[2].startMs).toBe(10_000);
    expect(t[3].startMs).toBe(20_000);
  });

  // Die Pause war frueher ein Loch in der Zeitachse: phaseAt lieferte dort
  // null, der Player zeigte wieder den Titel und der Ring stand still,
  // obwohl die Uebung laeuft. Bei einer Sequenz aus mehreren Bloecken faellt
  // das sofort auf.
  it('laesst zwischen zwei Bloecken keine Luecke offen', () => {
    const t = buildTimeline(
      uebung([
        { repeat_count: 2, rest_seconds: 10, phases: [{ position: 1, kind: 'inhale', duration_seconds: 5 }] },
        { repeat_count: 1, phases: [{ position: 1, kind: 'exhale', duration_seconds: 5 }] },
      ])
    );

    for (let ms = 0; ms < 25_000; ms += 250) {
      expect(phaseAt(t, ms), `bei ${ms} ms laeuft ein Segment`).not.toBeNull();
    }
    expect(phaseAt(t, 14_000)?.kind, 'mitten in der Pause').toBe('rest');
  });

  it('laesst Bloecke ohne Pause direkt ineinander uebergehen', () => {
    const t = buildTimeline(
      uebung([
        { repeat_count: 1, phases: [{ position: 1, kind: 'inhale', duration_seconds: 5 }] },
        { repeat_count: 1, phases: [{ position: 1, kind: 'exhale', duration_seconds: 5 }] },
      ])
    );

    expect(t.map((s) => s.kind)).toEqual(['inhale', 'exhale']);
    expect(t[1].startMs).toBe(5_000);
  });

  it('rechnet eine dreiteilige Session korrekt durch', () => {
    // Entspricht der Beispielsequenz "Aufbau-Session" aus seed.sql:
    // 4x16s + 12s + 4x24s + 12s + 4x19s = 260s
    const t = buildTimeline(
      uebung([
        {
          repeat_count: 4,
          rest_seconds: 12,
          phases: [
            { position: 1, kind: 'inhale', duration_seconds: 4 },
            { position: 2, kind: 'hold_in', duration_seconds: 4 },
            { position: 3, kind: 'exhale', duration_seconds: 4 },
            { position: 4, kind: 'hold_out', duration_seconds: 4 },
          ],
        },
        {
          repeat_count: 4,
          rest_seconds: 12,
          phases: [
            { position: 1, kind: 'inhale', duration_seconds: 6 },
            { position: 2, kind: 'hold_in', duration_seconds: 6 },
            { position: 3, kind: 'exhale', duration_seconds: 6 },
            { position: 4, kind: 'hold_out', duration_seconds: 6 },
          ],
        },
        {
          repeat_count: 4,
          phases: [
            { position: 1, kind: 'inhale', duration_seconds: 4 },
            { position: 2, kind: 'hold_in', duration_seconds: 7 },
            { position: 3, kind: 'exhale', duration_seconds: 8 },
          ],
        },
      ])
    );

    expect(totalDurationMs(t)).toBe(260_000);
    expect(new Set(t.map((s) => s.stepIndex)).size, 'drei Bloecke').toBe(3);
    expect(t.filter((s) => s.kind === 'rest')).toHaveLength(2);
    // Der zweite Block beginnt nach Block 1 plus Pause
    expect(phaseAt(t, 76_000)?.stepIndex).toBe(1);
  });

  it('laesst Phasen ohne Dauer weg statt sie als Nullsegment zu fuehren', () => {
    const t = buildTimeline(
      uebung([
        {
          repeat_count: 1,
          phases: [
            { position: 1, kind: 'inhale', duration_seconds: 5 },
            { position: 2, kind: 'hold_in', duration_seconds: 0 },
            { position: 3, kind: 'exhale', duration_seconds: 5 },
          ],
        },
      ])
    );

    expect(t.map((s) => s.kind)).toEqual(['inhale', 'exhale']);
  });
});

describe('Rundenprogression', () => {
  it('verlaengert die Phase je Runde um das Delta', () => {
    const t = buildTimeline(
      uebung([
        {
          repeat_count: 3,
          phases: [{ position: 1, kind: 'exhale', duration_seconds: 4, duration_delta_per_round: 0.5 }],
        },
      ])
    );

    expect(t.map((s) => s.durationMs)).toEqual([4000, 4500, 5000]);
  });

  it('respektiert das Maximum', () => {
    const t = buildTimeline(
      uebung([
        {
          repeat_count: 5,
          phases: [
            {
              position: 1,
              kind: 'exhale',
              duration_seconds: 4,
              duration_delta_per_round: 1,
              max_duration_seconds: 6,
            },
          ],
        },
      ])
    );

    expect(t.map((s) => s.durationMs)).toEqual([4000, 5000, 6000, 6000, 6000]);
  });
});

describe('phaseAt', () => {
  const t = buildTimeline(box4444);

  it('findet die Phase am Anfang, in der Mitte und kurz vor dem Ende', () => {
    expect(phaseAt(t, 0)?.kind).toBe('inhale');
    expect(phaseAt(t, 3_999)?.kind).toBe('inhale');
    expect(phaseAt(t, 4_000)?.kind).toBe('hold_in');
    expect(phaseAt(t, 127_999)?.kind).toBe('hold_out');
  });

  it('liefert null ausserhalb der Uebung', () => {
    expect(phaseAt(t, -1)).toBeNull();
    expect(phaseAt(t, 128_000)).toBeNull();
    expect(phaseAt([], 0)).toBeNull();
  });

  // Der eigentliche Drift-Test: die Phase an einem spaeten Zeitpunkt haengt
  // ausschliesslich an der absoluten Zeit, nicht an der Anzahl vorheriger
  // Auswertungen. Ein aufsummierender Timer waere hier laengst danebengelaufen.
  it('bleibt nach 20 Minuten simulierter Laufzeit exakt', () => {
    const lang = buildTimeline(
      uebung([{ repeat_count: 300, phases: [{ position: 1, kind: 'inhale', duration_seconds: 4 }] }])
    );
    expect(totalDurationMs(lang)).toBe(20 * 60 * 1000);

    // Jede Phasengrenze exakt getroffen - keine Verschiebung um Millisekunden
    for (let runde = 0; runde < 300; runde += 1) {
      const grenze = runde * 4000;
      expect(phaseAt(lang, grenze)?.round, `Runde bei ${grenze} ms`).toBe(runde + 1);
      expect(phaseAt(lang, grenze + 3999)?.round).toBe(runde + 1);
    }
  });

  it('findet auch bei sehr vielen Segmenten in logarithmischer Zeit das richtige', () => {
    const lang = buildTimeline(
      uebung([{ repeat_count: 200, phases: [{ position: 1, kind: 'inhale', duration_seconds: 4 }] }])
    );

    expect(phaseAt(lang, 199 * 4000)?.round).toBe(200);
  });
});

describe('phaseProgress', () => {
  const t = buildTimeline(box4444);

  it('laeuft von 0 bis 1 innerhalb der Phase', () => {
    expect(phaseProgress(t[0], 0)).toBe(0);
    expect(phaseProgress(t[0], 2000)).toBe(0.5);
    expect(phaseProgress(t[0], 4000)).toBe(1);
  });

  it('bleibt ausserhalb der Phase in den Grenzen', () => {
    expect(phaseProgress(t[1], 0)).toBe(0);
    expect(phaseProgress(t[1], 999_999)).toBe(1);
  });
});
