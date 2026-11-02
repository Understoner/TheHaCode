import { Link } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { moonPath } from '@/design/moon';
import { displayFont } from '@/design/responsive';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';

import { TrendChart } from './charts';
import { addDays, type IsoDate } from './dates';
import { PATTERN_WEEKS, useInsightsData, WINDOW_DAYS, type Props } from './DiaryInsights';
import type { PeriodScore } from './score';
import type { HabitCategory } from './useHabits';

// Die Auswertung im Vorschlag "Mondlicht Mobile" (02.11.2026, nur
// Testsystem). Dieselben Zahlen wie DiaryInsights (useInsightsData), aber als
// Bilder, die man auf einen Blick liest:
//
//   28 Tage       als Monde - voll heisst "alles Gewaehlte erledigt"
//   Hoehepunkte   laengste laufende Serie, staerkster Wochentag, Atemzeit
//   Punkte-Ringe  Tag, Woche, Monat, Jahr als Ringe um eine Mitte
//   Wochenwelle   der Wochenrhythmus als Atemkurve
//   Verlaeufe     BOLT, Schlaf und andere Zahlen-Habits
//   Habit fuer Habit  je Habit 28 Punkte, ein leuchtender je erledigtem Tag
//   Bereiche      je Bereich ein Blatt, so lang wie die aktiven Tage
//
// Ueberschriften seit 02.11.2026 ohne "Mondzyklus", "Spuren", "Bluete"
// (Wunsch User: weniger esoterisch); die Bilder bleiben.
//
// Bewusst ohne Wertung (SAD §5.7): keine Normen, kein "gut/schlecht", nur
// die eigenen Zahlen und der Vergleich mit dem eigenen Zeitraum davor.

export function DiaryJourney(props: Props) {
  const { t } = useTranslation();
  const { today, categories, scoreOn } = props;
  const data = useInsightsData(props);
  const totalMinutes = data.minutes.reduce((sum, w) => sum + w.minutes, 0);

  // Hoehepunkte - nur, was es wirklich gibt.
  const streak = data.consistency
    .filter((c) => !c.isNegative && c.currentStreak >= 2)
    .sort((a, b) => b.currentStreak - a.currentStreak)[0];
  const maxDay = Math.max(...data.pattern);
  const bestDay = maxDay > 0 ? data.pattern.indexOf(maxDay) : -1;
  const longDays = t('diary.analysis.weekdays.long').split(',');
  const highlights: { key: string; value: string; label: string }[] = [];
  if (streak) {
    highlights.push({
      key: 'streak',
      value: t('diary.journey.streakValue', { count: streak.currentStreak }),
      label: t('diary.journey.streakLabel', { title: streak.habit.habit_templates.title }),
    });
  }
  if (bestDay >= 0) highlights.push({ key: 'day', value: longDays[bestDay], label: t('diary.journey.bestDay') });
  if (totalMinutes > 0) {
    highlights.push({ key: 'min', value: t('diary.journey.minutesValue', { count: totalMinutes }), label: t('diary.journey.minutesLabel') });
  }

  return (
    <View style={styles.stack}>
      <CycleHero cycle={data.cycle} today={today} />

      {highlights.length > 0 ? (
        <View style={styles.highlights}>
          {highlights.map((h) => (
            <View key={h.key} style={styles.highlight}>
              <Text {...displayFont} style={styles.highlightValue} numberOfLines={1}>
                {h.value}
              </Text>
              <Text style={styles.highlightLabel} numberOfLines={2}>
                {h.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {scoreOn ? (
        <ScoreRings scores={data.scores} />
      ) : (
        <Card title={t('diary.score.title')}>
          <Text style={styles.text}>{t('diary.analysis.scoreOff')}</Text>
          <Link href="/habit-tracker/einstellungen" style={styles.link}>
            {t('diary.analysis.toSettings')}
          </Link>
        </Card>
      )}

      <Card title={t('diary.journey.rhythm')} hint={t('diary.analysis.weekdays.explain', { weeks: PATTERN_WEEKS })}>
        {bestDay < 0 ? <Text style={styles.text}>{t('diary.analysis.empty')}</Text> : <RhythmWave pattern={data.pattern} best={bestDay} />}
      </Card>

      {data.trends.map(({ habit, trend, summary }) => (
        <Card key={habit.id} title={t('diary.insights.trend', { title: habit.habit_templates.title })} hint={t('diary.insights.average')}>
          {summary.best === null ? (
            <Text style={styles.text}>{t('diary.insights.trendEmpty')}</Text>
          ) : (
            <>
              <TrendChart points={trend} today={today} title={habit.habit_templates.title} />
              <Text style={styles.text}>{t('diary.insights.best', { value: summary.best, unit: habit.habit_templates.unit ?? '' })}</Text>
            </>
          )}
        </Card>
      ))}

      <Card title={t('diary.journey.trails')} hint={t('diary.journey.trailsHint', { days: WINDOW_DAYS })}>
        {data.consistency.length === 0 ? (
          <Text style={styles.text}>{t('diary.analysis.habits.empty')}</Text>
        ) : (
          data.consistency.map((row) => (
            <HabitTrail
              key={row.habitId}
              title={row.habit.habit_templates.title}
              dates={data.datesByHabit.get(row.habitId) ?? new Set()}
              today={today}
              negative={row.isNegative}
              note={
                row.isNegative
                  ? row.daysSinceLast === null
                    ? t('diary.analysis.habits.neverInWindow', { total: row.windowDays })
                    : t('diary.analysis.habits.freeSince', { count: row.daysSinceLast })
                  : [
                      t('diary.analysis.habits.done', { count: row.doneDays, total: row.windowDays }),
                      ...(row.currentStreak > 0 ? [t('diary.analysis.habits.current', { count: row.currentStreak })] : []),
                    ].join(' · ')
              }
            />
          ))
        )}
      </Card>

      <Card title={t('diary.journey.bloom')} hint={t('diary.journey.bloomHint', { days: WINDOW_DAYS })}>
        {data.comparison.length === 0 ? (
          <Text style={styles.text}>{t('diary.analysis.empty')}</Text>
        ) : (
          <Bloom comparison={data.comparison} categories={categories} />
        )}
      </Card>

      <Card title={t('diary.journey.breathTime')} hint={totalMinutes > 0 ? t('diary.insights.minutesTotal', { minutes: totalMinutes }) : undefined}>
        {totalMinutes > 0 ? (
          <Tide weeks={data.minutes.map((w) => w.minutes)} />
        ) : (
          <Text style={styles.text}>{t('diary.journey.breathTimeEmpty')}</Text>
        )}
      </Card>
    </View>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text role="heading" aria-level={2} style={styles.cardTitle}>
        {title}
      </Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(e.nativeEvent.layout.width)];
}

// ---------------------------------------------------------------------------

function CycleHero({ cycle, today }: { cycle: ReturnType<typeof useInsightsData>['cycle']; today: IsoDate }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const withEntry = cycle.filter((d) => d.done > 0).length;
  const full = cycle.filter((d) => d.possible > 0 && d.share >= 1).length;
  const weekdays = t('diary.insights.weekdays').split(',');
  const firstWeekday = (new Date(`${cycle[0]?.date ?? today}T12:00:00`).getDay() + 6) % 7;

  return (
    <View style={styles.hero}>
      <Svg width="100%" height="100%" viewBox="0 0 358 360" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} aria-hidden>
        <Circle cx={322} cy={30} r={44} fill={palette.glow} opacity={0.06} />
        {[
          [24, 20, 1.2],
          [120, 12, 1],
          [200, 30, 1.3],
          [340, 90, 1],
          [16, 120, 0.9],
        ].map(([x, y, r]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={palette.ink900} opacity={0.6} />
        ))}
      </Svg>
      <Text {...displayFont} style={styles.heroTitle}>
        {t('diary.journey.cycleTitle', { days: WINDOW_DAYS })}
      </Text>
      <View style={styles.weekHead}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={styles.weekLabel}>
            {weekdays[(firstWeekday + i) % 7]}
          </Text>
        ))}
      </View>
      <View
        style={styles.moonGrid}
        accessibilityLabel={t('diary.journey.cycleLabel', { days: withEntry, total: cycle.length, full })}
      >
        {cycle.map((d) => {
          const isToday = d.date === today;
          return (
            <View key={d.date} style={styles.moonCell}>
              <Svg width={34} height={34} viewBox="-17 -17 34 34" aria-hidden>
                {d.share >= 1 ? <Circle r={16} fill={palette.glow} opacity={0.18} /> : null}
                <Circle r={13} fill={palette.line} />
                <Path d={moonPath(d.share, 13)} fill={palette.glow} />
                {isToday ? <Circle r={16} fill="none" stroke={palette.blossom} strokeWidth={1.4} /> : null}
              </Svg>
            </View>
          );
        })}
      </View>
      <Text style={styles.heroText}>{t('diary.journey.cycleSummary', { days: withEntry, total: cycle.length, full, count: full })}</Text>
      <Text style={styles.heroHint}>{t('diary.journey.cycleHint')}</Text>
    </View>
  );
}

function ScoreRings({ scores }: { scores: PeriodScore[] }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const labels: Record<PeriodScore['period'], string> = {
    day: t('diary.score.day'),
    week: t('diary.score.week'),
    month: t('diary.score.month'),
    year: t('diary.score.year'),
  };
  const tones = [palette.glow, palette.sage700, palette.blossom, palette.ink700];
  const day = scores.find((s) => s.period === 'day');

  // Innen der Tag, aussen das Jahr. Jeder Ring fuellt sich mit Wert/Maximum.
  const arc = (r: number, share: number) => {
    const a = Math.min(0.999, Math.max(0, share)) * 2 * Math.PI;
    const x = r * Math.sin(a);
    const y = -r * Math.cos(a);
    return `M0 ${-r} A ${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  };

  return (
    <Card title={t('diary.score.title')} hint={t('diary.score.explain')}>
      <View style={styles.rings}>
        <Svg width={170} height={170} viewBox="-85 -85 170 170" aria-hidden>
          {scores.map((s, i) => {
            const r = 34 + i * 14;
            const share = s.maxTotal > 0 ? Math.abs(s.total) / s.maxTotal : 0;
            const color = s.total < 0 ? palette.danger : tones[i];
            return (
              <G key={s.period}>
                <Circle r={r} fill="none" stroke={palette.line} strokeWidth={8} />
                {share > 0 ? <Path d={arc(r, share)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" /> : null}
              </G>
            );
          })}
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <Text {...displayFont} style={styles.ringValue}>
            {day ? day.total : '–'}
          </Text>
          <Text style={styles.ringLabel}>{t('diary.score.day')}</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {scores.map((s, i) => (
          <View key={s.period} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: s.total < 0 ? palette.danger : tones[i] }]} />
            <Text style={[styles.text, styles.grow]}>{labels[s.period]}</Text>
            <Text style={[styles.value, s.total < 0 && styles.negative]}>
              {t('diary.score.of', { value: s.total, max: s.maxTotal })}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Der Wochenrhythmus als Atemkurve durch sieben Punkte, der staerkste Tag als Mond. */
function RhythmWave({ pattern, best }: { pattern: number[]; best: number }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const [width, onLayout] = useWidth();
  const short = t('diary.insights.weekdays').split(',');
  const H = 110;
  const max = Math.max(1, ...pattern);
  const pad = 16;
  const pts = pattern.map((v, i) => ({
    x: pad + (i * (Math.max(width, 1) - 2 * pad)) / 6,
    y: H - 14 - (v / max) * (H - 34),
  }));
  // Glatte Kurve (Catmull-Rom als Bezier).
  let d = pts.length ? `M${pts[0].x} ${pts[0].y}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return (
    <View onLayout={onLayout} accessibilityLabel={short.map((s, i) => `${s} ${pattern[i]}`).join(', ')}>
      {width > 0 ? (
        <Svg width={width} height={H} aria-hidden>
          <Path d={`${d} L${pts[6].x} ${H} L${pts[0].x} ${H} Z`} fill={palette.glow} opacity={0.08} />
          <Path d={d} fill="none" stroke={palette.glow} strokeWidth={2.5} strokeLinecap="round" />
          {pts.map((p, i) =>
            i === best ? (
              <G key={i}>
                <Circle cx={p.x} cy={p.y} r={10} fill={palette.glow} opacity={0.2} />
                <Circle cx={p.x} cy={p.y} r={6} fill={palette.glow} />
              </G>
            ) : (
              <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={palette.surface} stroke={palette.glow} strokeWidth={1.5} />
            ),
          )}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
      <View style={styles.waveLabels}>
        {short.map((s, i) => (
          <View key={s} style={styles.waveLabel}>
            <Text style={[styles.waveCount, i === best && styles.waveBest]}>{pattern[i]}</Text>
            <Text style={[styles.weekLabel, i === best && styles.waveBest]}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Ein Habit als Sternspur: 28 Punkte, ein leuchtender je erledigtem Tag. */
function HabitTrail({
  title,
  dates,
  today,
  negative,
  note,
}: {
  title: string;
  dates: ReadonlySet<IsoDate>;
  today: IsoDate;
  negative: boolean;
  note: string;
}) {
  const palette = useThemePalette();
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(today, i - (WINDOW_DAYS - 1)));
  return (
    <View style={styles.trail}>
      <Text style={styles.trailTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.dots} aria-hidden>
        {days.map((day) => {
          const done = dates.has(day);
          // Abzug-Habits lesen sich andersherum: die freien Tage leuchten.
          const lit = negative ? !done : done;
          return (
            <View
              key={day}
              style={[
                styles.dot,
                lit
                  ? { backgroundColor: negative ? palette.sage700 : palette.glow }
                  : { backgroundColor: palette.line },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.hint}>{note}</Text>
    </View>
  );
}

/** Je Bereich ein Blatt der Bluete, so lang wie die aktiven Tage im Zeitraum. */
function Bloom({
  comparison,
  categories,
}: {
  comparison: ReturnType<typeof useInsightsData>['comparison'];
  categories: HabitCategory[];
}) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const tones = [palette.glow, palette.sage700, palette.blossom, palette.ink700];
  const n = comparison.length;
  // Relativ zum aktivsten Bereich: der laengste Blatt ist voll lang, damit
  // die Bluete auch bei wenigen Eintraegen lesbar bleibt.
  const most = Math.max(1, ...comparison.map((c) => c.current.activeDays));

  return (
    <View style={styles.bloom}>
      <Svg width={180} height={180} viewBox="-90 -90 180 180" aria-hidden>
        {comparison.map((c, i) => {
          const share = c.current.activeDays / most;
          const len = 26 + share * 58;
          const w = Math.max(12, Math.min(30, 150 / Math.max(n, 1)));
          const angle = (360 / n) * i;
          return (
            <Path
              key={c.categoryId}
              d={`M0 0 C ${-w} ${-len * 0.35}, ${-w * 0.6} ${-len * 0.85}, 0 ${-len} C ${w * 0.6} ${-len * 0.85}, ${w} ${-len * 0.35}, 0 0 Z`}
              transform={`rotate(${angle})`}
              fill={tones[i % tones.length]}
              opacity={0.35 + share * 0.55}
            />
          );
        })}
        <Circle r={7} fill={palette.glow} />
      </Svg>
      <View style={styles.legend}>
        {comparison.map((c, i) => {
          const title = categories.find((cat) => cat.id === c.categoryId)?.title ?? '';
          const change = c.current.positive - c.previous.positive;
          return (
            <View key={c.categoryId} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: tones[i % tones.length] }]} />
              <Text style={[styles.text, styles.grow]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.value}>
                {t('diary.journey.bloomDays', { count: c.current.activeDays })}
                <Text style={styles.hint}>{`  ${change > 0 ? '+' : change < 0 ? '−' : '±'}${Math.abs(change)}`}</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Atemminuten je Woche als steigende Flut, die juengste Woche rechts. */
function Tide({ weeks }: { weeks: number[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...weeks);
  return (
    <View style={styles.tide} accessibilityLabel={t('diary.journey.tideLabel', { minutes: weeks.join(', ') })}>
      {weeks.map((m, i) => (
        <View key={i} style={styles.tideCol}>
          <Text style={styles.tideValue}>{m > 0 ? m : ''}</Text>
          <View style={styles.tideTrack}>
            <View style={[styles.tideFill, { height: `${Math.max(m > 0 ? 6 : 0, (m / max) * 100)}%` }, i === weeks.length - 1 && styles.tideNow]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  hero: {
    gap: 10,
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanImageBg,
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 31,
    color: colors.ink900,
  },
  weekHead: {
    flexDirection: 'row',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: colors.ink700,
  },
  moonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  moonCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  heroText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    color: colors.ink900,
  },
  heroHint: {
    marginTop: -6,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink700,
  },
  highlights: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  highlight: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  highlightValue: {
    fontSize: 19,
    lineHeight: 23,
    color: colors.ocean700,
  },
  highlightLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.ink700,
  },
  card: {
    gap: 12,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.ink900,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink900,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink700,
  },
  value: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink900,
  },
  negative: {
    color: colors.danger,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ocean700,
  },
  rings: {
    alignSelf: 'center',
    width: 170,
    height: 170,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.ink900,
  },
  ringLabel: {
    fontSize: 11,
    color: colors.ink700,
  },
  legend: {
    gap: 6,
    alignSelf: 'stretch',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  waveLabels: {
    flexDirection: 'row',
    marginTop: 4,
  },
  waveLabel: {
    flex: 1,
    alignItems: 'center',
  },
  waveCount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink900,
  },
  waveBest: {
    color: colors.ocean700,
    fontWeight: '800',
  },
  trail: {
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  trailTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink900,
  },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  bloom: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  tide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 130,
  },
  tideCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    gap: 4,
  },
  tideValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink700,
  },
  tideTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.oceanTint,
  },
  tideFill: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: colors.sage700,
  },
  tideNow: {
    backgroundColor: colors.ocean700,
  },
});
