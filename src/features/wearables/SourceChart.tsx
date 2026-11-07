import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent, type PointerEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors, radius, spacing } from '@/design/tokens';
import { addDays, type IsoDate } from '@/features/habits/dates';
import { formatShort } from '@/features/habits/format';
import type { ValueRule } from '@/features/habits/valuePoints';

import { niceDomain, smoothPath, zoneEdges, zoneKind, zonesFor, type ZoneKind } from './chartMath';
import type { SeriesDay } from './series';

// Ein Wert ueber die letzten Tage (Entwurf vom 07.11.2026, vom User
// freigegeben):
// - der Durchschnitt als weiche Linie, Oura als Kreis, Garmin als Quadrat -
//   unterscheidbar auch ohne Farbe;
// - Farbe der Linie nach den Punktegrenzen des Habits (gruen Punkte, rot
//   Abzug, grau ohne Punkte), die Grenzen gestrichelt und beschriftet - so
//   bleibt die Bedeutung auch ohne Farbsehen lesbar;
// - Werte ohne Grenzen (Gewicht, Ruhepuls, ...) einfarbig, ohne Bewertung
//   (SAD §5.7), auf Wunsch mit dem eigenen Durchschnitt als Hilfslinie;
// - Y-Achse nach Wertebereich statt ab 0, mit beschrifteten Hilfslinien.

const HEIGHT = 188;
const LEFT = 44;
const RIGHT = 8;
const TOP = 12;
const BOTTOM = 8;

export const SOURCE_COLORS = {
  average: colors.ocean700,
  oura: colors.ink700,
  garmin: colors.ink700,
} as const;

const KIND_STROKE: Record<ZoneKind, string> = {
  good: colors.sage700,
  partial: colors.sage700,
  neutral: colors.ink500,
  bad: colors.danger,
};

const KIND_BAND: Record<ZoneKind, { color: string; opacity: number }> = {
  good: { color: colors.sage700, opacity: 0.09 },
  partial: { color: colors.sage700, opacity: 0.045 },
  neutral: { color: colors.surface, opacity: 0 },
  bad: { color: colors.danger, opacity: 0.08 },
};

export function SourceChart({
  days,
  today,
  window,
  title,
  unit,
  decimals,
  rule,
  showMean = false,
  connectGaps = false,
}: {
  days: SeriesDay[];
  today: IsoDate;
  window: number;
  title: string;
  unit: string;
  decimals: number;
  /** Punktegrenzen des gewaehlten Habits - ohne: einfarbig. */
  rule: ValueRule | null;
  /** Eigener Durchschnitt als gestrichelte Hilfslinie (Werte ohne Grenzen). */
  showMean?: boolean;
  /** Luecken verbinden - fuer Werte, die nicht taeglich kommen (Gewicht). */
  connectGaps?: boolean;
}) {
  const { t } = useTranslation();
  const clipId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const start = addDays(today, -(window - 1));
  const visible = days.filter((d) => d.day >= start && d.day <= today);
  const zones = zonesFor(rule);
  const edges = zoneEdges(zones);
  const values = visible.flatMap((d) => [d.oura, d.garmin, d.average]).filter((v): v is number => v !== null);
  const domain = niceDomain(
    values,
    edges.map((e) => e.value),
  );
  const mean = visible.length > 0 ? visible.reduce((a, d) => a + d.average, 0) / visible.length : null;

  const innerW = Math.max(1, width - LEFT - RIGHT);
  const innerH = HEIGHT - TOP - BOTTOM;
  const index = new Map<IsoDate, number>();
  for (let i = 0, d = start; i < window; i += 1, d = addDays(d, 1)) index.set(d, i);
  const xAt = (i: number) => LEFT + (i / Math.max(1, window - 1)) * innerW;
  const x = (day: IsoDate) => xAt(index.get(day) ?? 0);
  const y = (v: number) => TOP + innerH - ((v - domain.lo) / Math.max(1e-9, domain.hi - domain.lo)) * innerH;
  const fmt = (v: number) =>
    v.toLocaleString('de-AT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const tickFmt = (v: number) =>
    v.toLocaleString('de-AT', { maximumFractionDigits: domain.step < 1 ? 1 : 0 });

  // Zusammenhaengende Tage als eigene Kurve; Luecken bleiben Luecken.
  const runs: SeriesDay[][] = [];
  for (const d of visible) {
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (last && (connectGaps || (prev && addDays(prev.day, 1) === d.day))) last.push(d);
    else runs.push([d]);
  }
  const paths = runs.map((run) => ({
    run,
    d: smoothPath(run.map((d) => [x(d.day), y(d.average)] as const)),
  }));

  // Zonen in Pixeln, von oben nach unten, auf den sichtbaren Bereich gekappt.
  const bands = zones
    .map((z) => {
      const hi = Math.min(z.hi, domain.hi);
      const lo = Math.max(z.lo, domain.lo);
      return hi > lo ? { kind: z.kind, top: y(hi), bottom: y(lo) } : null;
    })
    .filter((b): b is { kind: ZoneKind; top: number; bottom: number } => b !== null);

  const edgeLabel = (edge: (typeof edges)[number], side: 'above' | 'below') => {
    const kind = edge[side];
    const value = edge.value.toLocaleString('de-AT');
    if (side === 'above' && (kind === 'good' || kind === 'partial')) return t(`wearables.chart.from.${kind}`, { value });
    if (side === 'below' && kind === 'bad') return t('wearables.chart.below.bad', { value });
    if (side === 'below' && (kind === 'good' || kind === 'partial')) return t(`wearables.chart.upTo.${kind}`, { value });
    if (side === 'above' && kind === 'bad') return t('wearables.chart.above.bad', { value });
    return null;
  };

  const pick = (e: PointerEvent) => {
    const px = e.nativeEvent.offsetX;
    if (typeof px !== 'number' || width === 0) return;
    const i = Math.round(((px - LEFT) / innerW) * (window - 1));
    setHover(Math.max(0, Math.min(window - 1, i)));
  };
  const hoverDay = hover === null ? null : addDays(start, hover);
  const hovered = hoverDay ? visible.find((d) => d.day === hoverDay) ?? null : null;
  const hoverKind = hovered && rule && zones.length > 0 ? zoneKind(rule, hovered.average) : null;

  return (
    <View style={styles.chart}>
      <View onLayout={onLayout} style={styles.plot}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT} accessibilityLabel={t('wearables.insights.chartLabel', { title })}>
            <Defs>
              {bands.map((b, i) => (
                <ClipPath key={i} id={`${clipId}z${i}`}>
                  <Rect
                    x={0}
                    y={i === 0 ? 0 : b.top}
                    width={width}
                    height={(i === bands.length - 1 ? HEIGHT : b.bottom) - (i === 0 ? 0 : b.top)}
                  />
                </ClipPath>
              ))}
            </Defs>

            {bands.map((b, i) =>
              KIND_BAND[b.kind].opacity > 0 ? (
                <Rect
                  key={`band${i}`}
                  x={LEFT}
                  y={b.top}
                  width={innerW}
                  height={Math.max(0, b.bottom - b.top)}
                  fill={KIND_BAND[b.kind].color}
                  fillOpacity={KIND_BAND[b.kind].opacity}
                />
              ) : null,
            )}

            {domain.ticks.map((tick) => (
              <G key={`t${tick}`}>
                <Line x1={LEFT} x2={width - RIGHT} y1={y(tick)} y2={y(tick)} stroke={colors.line} strokeWidth={1} />
                <SvgText x={LEFT - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={colors.ink700}>
                  {tickFmt(tick)}
                </SvgText>
              </G>
            ))}

            {edges.map((edge) => {
              if (edge.value <= domain.lo || edge.value >= domain.hi) return null;
              const above = edgeLabel(edge, 'above');
              const below = edgeLabel(edge, 'below');
              return (
                <G key={`e${edge.value}`}>
                  <Line
                    x1={LEFT}
                    x2={width - RIGHT}
                    y1={y(edge.value)}
                    y2={y(edge.value)}
                    stroke={colors.lineStrong}
                    strokeWidth={1.2}
                    strokeDasharray="4 4"
                  />
                  {above ? (
                    <SvgText x={width - RIGHT - 2} y={y(edge.value) - 5} textAnchor="end" fontSize={10.5} fontWeight="700" fill={colors.ink700}>
                      {above}
                    </SvgText>
                  ) : null}
                  {below ? (
                    <SvgText x={width - RIGHT - 2} y={y(edge.value) + 14} textAnchor="end" fontSize={10.5} fontWeight="700" fill={colors.ink700}>
                      {below}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}

            {showMean && mean !== null ? (
              <G>
                <Line
                  x1={LEFT}
                  x2={width - RIGHT}
                  y1={y(mean)}
                  y2={y(mean)}
                  stroke={colors.ink500}
                  strokeWidth={1.2}
                  strokeDasharray="2 4"
                />
                <SvgText x={width - RIGHT - 2} y={y(mean) - 5} textAnchor="end" fontSize={10.5} fontWeight="700" fill={colors.ink700}>
                  {t('wearables.chart.ownMean', { value: fmt(mean) })}
                </SvgText>
              </G>
            ) : null}

            {paths.map(({ run, d }, i) => {
              if (run.length < 2) return null;
              if (bands.length === 0) {
                const first = run[0];
                const last = run[run.length - 1];
                const area = `${d} L${x(last.day)},${TOP + innerH} L${x(first.day)},${TOP + innerH} Z`;
                return (
                  <G key={`p${i}`}>
                    <Path d={area} fill={SOURCE_COLORS.average} fillOpacity={0.08} />
                    <Path d={d} fill="none" stroke={SOURCE_COLORS.average} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </G>
                );
              }
              return (
                <G key={`p${i}`}>
                  {bands.map((b, bi) => (
                    <Path
                      key={bi}
                      d={d}
                      fill="none"
                      stroke={KIND_STROKE[b.kind]}
                      strokeWidth={2.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      clipPath={`url(#${clipId}z${bi})`}
                    />
                  ))}
                </G>
              );
            })}

            {visible.map((d) => {
              // Einzelne Tage ohne Nachbarn (oder Gewicht): als Punkt zeigen.
              const alone = connectGaps || runs.some((r) => r.length === 1 && r[0].day === d.day);
              return alone ? (
                <Circle
                  key={`a-${d.day}`}
                  cx={x(d.day)}
                  cy={y(d.average)}
                  r={3.4}
                  fill={rule && zones.length > 0 ? KIND_STROKE[zoneKind(rule, d.average)] : SOURCE_COLORS.average}
                  stroke={colors.surface}
                  strokeWidth={1.5}
                />
              ) : null;
            })}

            {visible.map((d) =>
              d.oura === null ? null : (
                <Circle
                  key={`o-${d.day}`}
                  cx={x(d.day)}
                  cy={y(d.oura)}
                  r={3.2}
                  fill={colors.surface}
                  stroke={SOURCE_COLORS.oura}
                  strokeWidth={1.4}
                />
              ),
            )}
            {visible.map((d) =>
              d.garmin === null ? null : (
                <Rect
                  key={`g-${d.day}`}
                  x={x(d.day) - 2.8}
                  y={y(d.garmin) - 2.8}
                  width={5.6}
                  height={5.6}
                  rx={1.2}
                  fill={SOURCE_COLORS.garmin}
                  stroke={colors.surface}
                  strokeWidth={1}
                />
              ),
            )}

            {hover !== null ? (
              <Line x1={xAt(hover)} x2={xAt(hover)} y1={TOP} y2={TOP + innerH} stroke={colors.ink500} strokeWidth={1} />
            ) : null}
            {hovered ? (
              <Circle
                cx={x(hovered.day)}
                cy={y(hovered.average)}
                r={5}
                fill={colors.surface}
                stroke={hoverKind ? KIND_STROKE[hoverKind] : SOURCE_COLORS.average}
                strokeWidth={2.5}
              />
            ) : null}
          </Svg>
        ) : null}

        {/* Ueber dem Diagramm, ohne Kinder: offsetX ist so immer relativ zur Flaeche. */}
        <View
          style={styles.hit}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setHover(null)}
        />

        {hover !== null && hoverDay ? (
          <View
            pointerEvents="none"
            style={[styles.tip, xAt(hover) > width / 2 ? { right: width - xAt(hover) + 10 } : { left: xAt(hover) + 10 }]}
          >
            <Text style={styles.tipTitle}>{formatShort(hoverDay)}</Text>
            {hovered ? (
              <>
                <Text style={styles.tipText}>{t('wearables.insights.meanAverage', { value: fmt(hovered.average), unit })}</Text>
                {hovered.oura !== null ? (
                  <Text style={styles.tipText}>{t('wearables.insights.meanOura', { value: fmt(hovered.oura), unit })}</Text>
                ) : null}
                {hovered.garmin !== null ? (
                  <Text style={styles.tipText}>{t('wearables.insights.meanGarmin', { value: fmt(hovered.garmin), unit })}</Text>
                ) : null}
                {hoverKind ? <Text style={styles.tipText}>{t(`wearables.chart.kind.${hoverKind}`)}</Text> : null}
              </>
            ) : (
              <Text style={styles.tipText}>{t('wearables.chart.noValue')}</Text>
            )}
          </View>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{formatShort(start)}</Text>
        <Text style={styles.axisText}>{formatShort(addDays(start, Math.floor((window - 1) / 2)))}</Text>
        <Text style={styles.axisText}>{formatShort(today)}</Text>
      </View>
    </View>
  );
}

/** Die Legende als Text, damit sie Schriftgroesse und Kontrastregel folgt. */
export function SourceLegend({
  showOura,
  showGarmin,
  rule,
}: {
  showOura: boolean;
  showGarmin: boolean;
  rule: ValueRule | null;
}) {
  const { t } = useTranslation();
  const kinds = [...new Set(zonesFor(rule).map((z) => z.kind))];
  return (
    <View style={styles.legend}>
      {kinds.length > 0 ? (
        kinds.map((kind) => (
          <View key={kind} style={styles.legendItem}>
            <View style={[styles.swatchLine, { backgroundColor: KIND_STROKE[kind] }]} />
            <Text style={styles.legendText}>{t(`wearables.chart.legend.${kind}`)}</Text>
          </View>
        ))
      ) : (
        <View style={styles.legendItem}>
          <View style={[styles.swatchLine, { backgroundColor: SOURCE_COLORS.average }]} />
          <Text style={styles.legendText}>{t('wearables.insights.average')}</Text>
        </View>
      )}
      {showOura ? (
        <View style={styles.legendItem}>
          <View style={[styles.swatchCircle, { borderColor: SOURCE_COLORS.oura }]} />
          <Text style={styles.legendText}>{t('wearables.provider.oura')}</Text>
        </View>
      ) : null}
      {showGarmin ? (
        <View style={styles.legendItem}>
          <View style={[styles.swatchSquare, { backgroundColor: SOURCE_COLORS.garmin }]} />
          <Text style={styles.legendText}>{t('wearables.provider.garmin')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    alignSelf: 'stretch',
    gap: 4,
  },
  plot: {
    position: 'relative',
  },
  hit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tip: {
    position: 'absolute',
    top: 4,
    minWidth: 132,
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink900,
  },
  tipText: {
    fontSize: 12,
    color: colors.ink700,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: LEFT,
    paddingRight: RIGHT,
    marginTop: spacing.sm / 2,
  },
  axisText: {
    fontSize: 12,
    color: colors.ink700,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.ink700,
  },
  swatchLine: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  swatchCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  swatchSquare: {
    width: 7,
    height: 7,
    borderRadius: 1.5,
  },
});
