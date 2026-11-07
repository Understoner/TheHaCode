import { Link } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { addDays, type IsoDate } from '@/features/habits/dates';

import { WEARABLES_ENABLED } from './flag';
import { buildSeries, HABIT_METRICS, type MetricSeries } from './series';
import { SourceChart, SourceLegend } from './SourceChart';
import { useWearableAutoSync, useWearableConnections, useWearableDaily } from './useWearables';

/** Zeitraum der Geraete-Diagramme in Tagen. */
const WINDOW = 28;

/**
 * Die Werte der Geraete in der Auswertung (0053, nur Testsystem): je Wert
 * ein Diagramm mit Durchschnitt, Oura und Garmin. Erscheint nur, wenn ein
 * Geraet verbunden ist.
 */
export function WearableInsights({ today }: { today: IsoDate }) {
  if (!WEARABLES_ENABLED) return null;
  return <Connected today={today} />;
}

function Connected({ today }: { today: IsoDate }) {
  const connections = useWearableConnections();
  useWearableAutoSync();

  // Ohne Verbindung keine Karte - auch keine Lade- oder Fehlerzeile, die
  // Auswertung soll fuer alle anderen unveraendert bleiben.
  if (!connections.data || connections.data.length === 0) return null;
  return <Cards today={today} />;
}

function Cards({ today }: { today: IsoDate }) {
  const { t } = useTranslation();
  const from = addDays(today, -(WINDOW - 1));
  const daily = useWearableDaily(from, today);

  return (
    <View style={styles.stack}>
      <Text style={styles.kicker}>{t('wearables.insights.title')}</Text>
      <QueryBoundary query={daily}>
        {(rows) => <SeriesCards rows={rows} from={from} today={today} />}
      </QueryBoundary>
    </View>
  );
}

function SeriesCards({
  rows,
  from,
  today,
}: {
  rows: Parameters<typeof buildSeries>[0];
  from: IsoDate;
  today: IsoDate;
}) {
  const { t } = useTranslation();
  const series = useMemo(() => buildSeries(rows, from, today), [rows, from, today]);

  if (series.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.text}>{t('wearables.insights.empty')}</Text>
        <Link href="/habit-tracker/geraete" style={styles.link}>
          {t('wearables.insights.toDevices')}
        </Link>
      </View>
    );
  }

  const inDiary = series.filter((s) => HABIT_METRICS.includes(s.metric));
  const more = series.filter((s) => !HABIT_METRICS.includes(s.metric));

  return (
    <>
      {inDiary.map((s) => (
        <SeriesCard key={s.metric} series={s} today={today} />
      ))}
      {more.length > 0 ? <Text style={styles.kicker}>{t('wearables.insights.more')}</Text> : null}
      {more.map((s) => (
        <SeriesCard key={s.metric} series={s} today={today} />
      ))}
      <Text style={styles.meta}>{t('wearables.insights.explain', { days: WINDOW })}</Text>
    </>
  );
}

function SeriesCard({ series, today }: { series: MetricSeries; today: IsoDate }) {
  const { t } = useTranslation();
  const title = t(`wearables.metric.${series.metric}`);
  const unit = t(`wearables.unit.${series.metric}`);
  const showOura = series.mean.oura !== null;
  const showGarmin = series.mean.garmin !== null;
  const fmt = (v: number) => v.toLocaleString('de-AT');

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <SourceLegend showOura={showOura} showGarmin={showGarmin} />
      <SourceChart days={series.days} today={today} window={WINDOW} title={title} />
      <Text style={styles.text}>
        {[
          series.mean.average === null
            ? null
            : t('wearables.insights.meanAverage', { value: fmt(series.mean.average), unit }),
          showOura ? t('wearables.insights.meanOura', { value: fmt(series.mean.oura!), unit }) : null,
          showGarmin ? t('wearables.insights.meanGarmin', { value: fmt(series.mean.garmin!), unit }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  kicker: {
    marginTop: spacing.sm,
    paddingHorizontal: 4,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 14,
    color: colors.ink700,
  },
  meta: {
    paddingHorizontal: 4,
    fontSize: 12,
    color: colors.ink700,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
