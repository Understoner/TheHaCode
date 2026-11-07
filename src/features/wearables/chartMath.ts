// Rechnen fuer die Geraete-Diagramme (Entwurf vom 07.11.2026, vom User
// freigegeben): Achse nach Wertebereich, weiche Kurve, Zonen nach den
// Punktegrenzen des Habits.
//
// Die Zonen kommen aus pointsForEntry() - dieselbe Rechnung wie der Habit
// Score, damit Diagramm und Tagebuch nie auseinanderlaufen. Gesundheitswerte
// (Gewicht, Ruhepuls, ...) haben keine Grenzen und bleiben ohne Zonen
// (SAD §5.7).

import { hasValueRule, pointsForEntry, type ValueRule } from '@/features/habits/valuePoints';

export type ZoneKind = 'good' | 'partial' | 'neutral' | 'bad';

/** Ein Wertebereich mit seiner Art; lo/hi duerfen unendlich sein. */
export type Zone = { lo: number; hi: number; kind: ZoneKind };

export type Domain = { lo: number; hi: number; step: number; ticks: number[] };

/** Was das Tagebuch fuer einen Wert gibt - als Farbe im Diagramm. */
export function zoneKind(rule: ValueRule, value: number): ZoneKind {
  const result = pointsForEntry(rule, value);
  if (result.isNegative && result.points > 0) return 'bad';
  if (result.points <= 0) return 'neutral';
  return result.points >= rule.points ? 'good' : 'partial';
}

/**
 * Die Zonen eines Habits, von oben nach unten. Ohne Wertgrenzen: keine.
 * Jede Zone wird an einem Wert in ihrer Mitte eingeordnet - so gelten die
 * Vergleiche (>=, <, weniger ist besser) genau wie im Score.
 */
export function zonesFor(rule: ValueRule | null): Zone[] {
  if (!rule || !hasValueRule(rule)) return [];
  const bounds = [...new Set([rule.points_from, rule.penalty_from].filter((v): v is number => v !== null))].sort(
    (a, b) => b - a,
  );
  const edges = [Infinity, ...bounds, -Infinity];
  const zones: Zone[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const hi = edges[i];
    const lo = edges[i + 1];
    const probe = !Number.isFinite(hi) ? lo + 1 : !Number.isFinite(lo) ? hi - 1 : (hi + lo) / 2;
    const kind = zoneKind(rule, probe);
    // Gleiche Nachbarn zusammenfassen (z. B. ohne Minus-Grenze).
    const prev = zones[zones.length - 1];
    if (prev && prev.kind === kind) prev.lo = lo;
    else zones.push({ lo, hi, kind });
  }
  return zones.length > 1 ? zones : [];
}

/** Die Grenzen zwischen den Zonen - fuer die gestrichelten Linien. */
export function zoneEdges(zones: Zone[]): { value: number; above: ZoneKind; below: ZoneKind }[] {
  const out: { value: number; above: ZoneKind; below: ZoneKind }[] = [];
  for (let i = 0; i < zones.length - 1; i += 1) {
    out.push({ value: zones[i].lo, above: zones[i].kind, below: zones[i + 1].kind });
  }
  return out;
}

function niceStep(span: number, count: number): number {
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const f = raw / power;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * power;
}

/**
 * Y-Achse nach Wertebereich statt ab 0: knapp unter dem kleinsten bis knapp
 * ueber dem groessten Wert, auf runde Schritte. Die Punktegrenzen liegen
 * immer im Bereich, damit die Zonen sichtbar sind. Unter 0 nur, wenn ein
 * Wert darunter liegt.
 */
export function niceDomain(values: number[], include: number[] = [], tickCount = 4): Domain {
  const all = [...values, ...include].filter((v) => Number.isFinite(v));
  if (all.length === 0) return { lo: 0, hi: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.08 || Math.max(1, Math.abs(max) * 0.05);
  const step = niceStep(max - min + 2 * pad, tickCount);
  let lo = Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  if (lo < 0 && min >= 0) lo = 0;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 1000; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { lo, hi, step, ticks };
}

/**
 * Weiche Kurve durch die Punkte, die nie ueber die Werte hinausschiesst
 * (monotone kubische Interpolation nach Fritsch-Carlson). Punkte nach x
 * sortiert.
 */
export function smoothPath(points: readonly (readonly [number, number])[]): string {
  const n = points.length;
  if (n === 0) return '';
  const f = (v: number) => (Math.round(v * 10) / 10).toString();
  if (n === 1) return `M${f(points[0][0])},${f(points[0][1])}`;

  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1][0] - points[i][0];
    m[i] = dx[i] === 0 ? 0 : (points[i + 1][1] - points[i][1]) / dx[i];
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i += 1) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }

  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d += ` C${f(x0 + h)},${f(y0 + h * t[i])} ${f(x1 - h)},${f(y1 - h * t[i + 1])} ${f(x1)},${f(y1)}`;
  }
  return d;
}
