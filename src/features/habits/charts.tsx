import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import { colors, spacing } from '@/design/tokens';

import { addDays, type IsoDate } from './dates';
import { formatShort } from './format';
import type { TrendPoint, WeekMinutes } from './stats';

// Zwei kleine Diagramme mit react-native-svg (mit dem Team abgestimmt am
// 25.10.2026). Bewusst ohne Achsenbeschriftung im SVG: Zahlen stehen als
// normaler Text daneben, damit sie Schriftgroesse und Kontrastregel der App
// folgen. Farben nur aus den Tokens.

const HEIGHT = 140;
const PAD = 8;

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

/**
 * Messpunkte und gleitender Schnitt ueber die letzten `days` Tage. Ohne
 * Normbereiche, ohne Farbbewertung (SAD §5.7) - nur der eigene Verlauf.
 */
export function TrendChart({
  points,
  today,
  title,
  days = 60,
}: {
  points: TrendPoint[];
  today: IsoDate;
  title: string;
  days?: number;
}) {
  const { t } = useTranslation();
  const [width, onLayout] = useWidth();
  const start = addDays(today, -(days - 1));
  const visible = points.filter((p) => p.date >= start && p.date <= today);

  const maxValue = Math.max(10, ...visible.map((p) => Math.max(p.value, p.average)));
  const x = (date: IsoDate) => {
    // Tage seit Beginn, ueber die Kalenderfunktion statt ueber Millisekunden
    // (Zeitumstellung, siehe dates.ts).
    let index = 0;
    for (let d = start; d < date; d = addDays(d, 1)) index += 1;
    return PAD + (index / (days - 1)) * (width - 2 * PAD);
  };
  const y = (value: number) => HEIGHT - PAD - (value / maxValue) * (HEIGHT - 2 * PAD);

  return (
    <View onLayout={onLayout} style={styles.chart}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT} accessibilityLabel={t('diary.insights.chartLabel', { title })}>
          <Line
            x1={PAD}
            x2={width - PAD}
            y1={HEIGHT - PAD}
            y2={HEIGHT - PAD}
            stroke={colors.line}
            strokeWidth={1}
          />
          {visible.length > 1 ? (
            <Polyline
              points={visible.map((p) => `${x(p.date)},${y(p.average)}`).join(' ')}
              fill="none"
              stroke={colors.sage700}
              strokeWidth={2}
            />
          ) : null}
          {visible.map((p) => (
            <Circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={3.5} fill={colors.ocean700} />
          ))}
        </Svg>
      ) : null}
      <View style={styles.axis}>
        <Text style={styles.axisText}>{formatShort(start)}</Text>
        <Text style={styles.axisText}>{formatShort(today)}</Text>
      </View>
    </View>
  );
}

/** Balken je Woche, aelteste links. */
export function WeekBars({ weeks, title }: { weeks: WeekMinutes[]; title: string }) {
  const { t } = useTranslation();
  const [width, onLayout] = useWidth();
  const max = Math.max(1, ...weeks.map((w) => w.minutes));
  const slot = weeks.length > 0 ? (width - 2 * PAD) / weeks.length : 0;
  const barWidth = Math.max(4, slot * 0.6);

  return (
    <View onLayout={onLayout} style={styles.chart}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT} accessibilityLabel={t('diary.insights.chartLabel', { title })}>
          <Line
            x1={PAD}
            x2={width - PAD}
            y1={HEIGHT - PAD}
            y2={HEIGHT - PAD}
            stroke={colors.line}
            strokeWidth={1}
          />
          {weeks.map((w, i) => {
            const h = (w.minutes / max) * (HEIGHT - 2 * PAD);
            return (
              <Rect
                key={w.weekStart}
                x={PAD + i * slot + (slot - barWidth) / 2}
                y={HEIGHT - PAD - h}
                width={barWidth}
                height={h}
                rx={3}
                fill={i === weeks.length - 1 ? colors.ocean700 : colors.ocean500}
              />
            );
          })}
        </Svg>
      ) : null}
      <View style={styles.axis}>
        <Text style={styles.axisText}>{weeks[0] ? formatShort(weeks[0].weekStart) : ''}</Text>
        <Text style={styles.axisText}>
          {weeks.length ? `${weeks[weeks.length - 1].minutes} min` : ''}
        </Text>
      </View>
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
});
