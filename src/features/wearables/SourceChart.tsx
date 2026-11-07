import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import { colors, spacing } from '@/design/tokens';
import { addDays, type IsoDate } from '@/features/habits/dates';
import { formatShort } from '@/features/habits/format';

import type { SeriesDay } from './series';

// Ein Wert ueber die letzten Tage: der Durchschnitt als Linie, Oura als
// Kreis, Garmin als Quadrat - unterscheidbar auch ohne Farbe. Wie charts.tsx
// ohne Achsenbeschriftung im SVG und ohne Normbereiche (SAD §5.7).

const HEIGHT = 140;
const PAD = 8;

export const SOURCE_COLORS = {
  average: colors.ocean700,
  oura: colors.ink700,
  garmin: colors.sage700,
} as const;

export function SourceChart({
  days,
  today,
  window,
  title,
}: {
  days: SeriesDay[];
  today: IsoDate;
  window: number;
  title: string;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const start = addDays(today, -(window - 1));
  const visible = days.filter((d) => d.day >= start && d.day <= today);
  const values = visible.flatMap((d) => [d.oura, d.garmin, d.average]).filter((v): v is number => v !== null);
  const max = Math.max(1, ...values);
  // Etwas Luft nach unten, damit kleine Schwankungen (Ruhepuls) sichtbar bleiben.
  const min = values.length > 0 ? Math.max(0, Math.min(...values) * 0.8) : 0;

  const index = new Map<IsoDate, number>();
  for (let i = 0, d = start; i < window; i += 1, d = addDays(d, 1)) index.set(d, i);
  const x = (day: IsoDate) => PAD + ((index.get(day) ?? 0) / Math.max(1, window - 1)) * (width - 2 * PAD);
  const y = (v: number) => HEIGHT - PAD - ((v - min) / Math.max(1e-9, max - min)) * (HEIGHT - 2 * PAD);

  return (
    <View onLayout={onLayout} style={styles.chart}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT} accessibilityLabel={t('wearables.insights.chartLabel', { title })}>
          <Line x1={PAD} x2={width - PAD} y1={HEIGHT - PAD} y2={HEIGHT - PAD} stroke={colors.line} strokeWidth={1} />
          {visible.length > 1 ? (
            <Polyline
              points={visible.map((d) => `${x(d.day)},${y(d.average)}`).join(' ')}
              fill="none"
              stroke={SOURCE_COLORS.average}
              strokeWidth={2}
            />
          ) : null}
          {visible.map((d) =>
            d.oura === null ? null : (
              <Circle
                key={`o-${d.day}`}
                cx={x(d.day)}
                cy={y(d.oura)}
                r={3.5}
                fill="none"
                stroke={SOURCE_COLORS.oura}
                strokeWidth={1.5}
              />
            ),
          )}
          {visible.map((d) =>
            d.garmin === null ? null : (
              <Rect
                key={`g-${d.day}`}
                x={x(d.day) - 3}
                y={y(d.garmin) - 3}
                width={6}
                height={6}
                fill={SOURCE_COLORS.garmin}
              />
            ),
          )}
        </Svg>
      ) : null}
      <View style={styles.axis}>
        <Text style={styles.axisText}>{formatShort(start)}</Text>
        <Text style={styles.axisText}>{formatShort(today)}</Text>
      </View>
    </View>
  );
}

/** Die Legende als Text, damit sie Schriftgroesse und Kontrastregel folgt. */
export function SourceLegend({ showOura, showGarmin }: { showOura: boolean; showGarmin: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatchLine, { backgroundColor: SOURCE_COLORS.average }]} />
        <Text style={styles.legendText}>{t('wearables.insights.average')}</Text>
      </View>
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
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
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
    width: 16,
    height: 2,
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
  },
});
