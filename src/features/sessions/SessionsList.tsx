import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FavoriteStar } from '@/components/FavoriteStar';
import { QueryBoundary } from '@/components/QueryBoundary';
import { SkeletonList } from '@/components/SkeletonList';
import { StateMessage } from '@/components/StateMessage';
import { colors, radius, spacing } from '@/design/tokens';
import { responsive } from '@/design/responsive';
import { buildTimeline, totalDurationMs } from '@/features/breathing/timeline';
import {
  EXERCISE_EFFECTS,
  effectColors,
  type ExerciseEffect,
} from '@/features/sessions/effects';
import { useFavorites } from '@/features/sessions/useFavorites';
import { useSessionsList } from '@/features/sessions/useSessions';
import type { PlayableExercise } from '@/types/breathing';
import { PressableRing } from '@/components/PressableRing';

// "favoriten" steht in derselben Reihe wie die Wirkeffekte und nicht als
// zweiter Schalter daneben: beide beantworten dieselbe Frage ("welche
// Sequenzen sehe ich gerade?"), und zwei unabhaengige Filter uebereinander
// waeren bei fuenf Chips mehr Bedienung als Nutzen.
type Filter = ExerciseEffect | 'all' | 'favoriten';

/** "4-4-4-4" aus den Phasen der ersten Runde - die Kurzform, die jeder kennt. */
function rhythmOf(exercise: PlayableExercise): string | null {
  // Bei mehreren Bloecken gibt es keinen EINEN Rhythmus - die Kurzform waere
  // dort schlicht falsch, deshalb steht an der Stelle dann die Blockanzahl.
  if (exercise.exercise_steps.length > 1) return null;
  const step = [...exercise.exercise_steps].sort((a, b) => a.position - b.position)[0];
  if (!step) return null;
  const phases = [...step.exercise_phases].sort((a, b) => a.position - b.position);
  if (phases.length === 0) return null;
  return phases
    .map((p) => {
      const n = Number(p.duration_seconds);
      return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
    })
    .join('-');
}

export function SessionsList() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  // Der Favoritenfilter ist kein Wirkeffekt - die Abfrage bekommt in dem Fall
  // also keinen Effekt mit und liefert alles, was sichtbar ist. Gefiltert wird
  // danach hier, gegen die Sternliste.
  const effekt = filter === 'all' || filter === 'favoriten' ? undefined : filter;
  const query = useSessionsList(effekt);
  const favoriten = useFavorites();

  const filters: Filter[] = ['all', 'favoriten', ...EXERCISE_EFFECTS];

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {filters.map((value) => {
          const active = value === filter;
          // "Alle" und "Favoriten" tragen keine Effektfarbe - sie gehoeren zu
          // keinem Effekt.
          const tone = value === 'all' || value === 'favoriten' ? null : effectColors(value);
          return (
            <PressableRing
              key={value}
              onPress={() => setFilter(value)}
              style={[
                styles.filterChip,
                active &&
                  (tone
                    ? { backgroundColor: tone.tint, borderColor: tone.text }
                    : styles.filterChipActiveAll),
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active &&
                    (tone ? { color: tone.text, fontWeight: '600' } : styles.filterChipTextActiveAll),
                ]}
              >
                {value === 'all'
                  ? t('sessions.filter.all')
                  : value === 'favoriten'
                    ? t('favoriten.filter')
                    : t(`sessions.effects.${value}`)}
              </Text>
            </PressableRing>
          );
        })}
      </View>

      <QueryBoundary
        query={query}
        empty={{ title: t('sessions.empty.title'), hint: t('sessions.empty.hint') }}
      >
        {(sessions) => {
          // Die Sterne kommen aus einer zweiten Abfrage und sind einen Moment
          // spaeter da als die Sequenzen. Ohne diese Zeile staende in genau
          // diesem Moment "Noch keine Favoriten" - eine Aussage, die zu dem
          // Zeitpunkt niemand treffen kann.
          if (filter === 'favoriten' && favoriten.laedt) return <SkeletonList />;

          const sichtbar =
            filter === 'favoriten'
              ? sessions.filter((session) => favoriten.istFavorit(session.id))
              : sessions;

          // Der Leerzustand von QueryBoundary haengt an der Antwort des
          // Servers und kann diesen Fall deshalb nicht kennen: es KAMEN
          // Sequenzen, nur keine mit Stern. Ohne die eigene Meldung staende
          // hier ein leeres Raster ohne Erklaerung.
          if (filter === 'favoriten' && sichtbar.length === 0) {
            return (
              <View style={styles.emptyBox}>
                <StateMessage
                  title={t(
                    favoriten.angemeldet ? 'favoriten.leer.titel' : 'favoriten.leer.ohneKontoTitel'
                  )}
                  body={t(
                    favoriten.angemeldet
                      ? 'favoriten.leer.hinweis'
                      : 'favoriten.leer.ohneKontoHinweis'
                  )}
                />
              </View>
            );
          }

          return (
            <View {...responsive('sessions-grid')} style={styles.grid}>
              {sichtbar.map((session) => {
                const seconds = Math.round(totalDurationMs(buildTimeline(session)) / 1000);
                const rhythm = rhythmOf(session);

                return (
                  // Die Huelle traegt die Rasterbreite (siehe responsive.ts:
                  // das direkte Kind von sessions-grid) und den Stern, der
                  // darueber liegt. Er kann NICHT in die Karte selbst: die Karte
                  // ist ein Link, und alles darin fuehrt beim Tippen zum Player.
                  <View key={session.id} style={styles.cardShell}>
                    <Link href={`/sessions/${session.id}`} style={styles.card}>
                      <View style={styles.cardInner}>
                        <View style={styles.metaRow}>
                          <Text style={styles.meta}>
                            {t('sessions.duration', { minutes: Math.max(1, Math.round(seconds / 60)) })}
                          </Text>
                          {session.default_round_count ? (
                            <Text style={styles.meta}>
                              {t('sessions.rounds', { count: session.default_round_count })}
                            </Text>
                          ) : null}
                          {session.exercise_steps.length > 1 ? (
                            <Text style={styles.meta}>
                              {t('sessions.blocks', { count: session.exercise_steps.length })}
                            </Text>
                          ) : null}
                          {session.difficulty ? (
                            <Text style={styles.meta}>
                              {t(`sessions.difficulty.${session.difficulty}`)}
                            </Text>
                          ) : null}
                        </View>

                        <Text style={styles.title}>{session.title}</Text>
                        {session.subtitle ? (
                          <Text style={styles.subtitle}>{session.subtitle}</Text>
                        ) : null}

                        <View style={styles.tagRow}>
                          {rhythm ? (
                            <View style={styles.rhythmPill}>
                              <Text style={styles.rhythmText}>{rhythm}</Text>
                            </View>
                          ) : null}
                          {session.effects.map((effect) => {
                            const tone = effectColors(effect);
                            return (
                              <View
                                key={effect}
                                style={[styles.effectPill, { backgroundColor: tone.tint }]}
                              >
                                <Text style={[styles.effectText, { color: tone.text }]}>
                                  {t(`sessions.effects.${effect}`)}
                                </Text>
                              </View>
          );
                        })}
                      </View>
                    </View>
                  </Link>
                  <View style={styles.starSlot}>
                    <FavoriteStar exerciseId={session.id} />
                  </View>
                </View>
              );
            })}
          </View>
          );
        }}
      </QueryBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  filterChipActiveAll: {
    backgroundColor: colors.ocean700,
    borderColor: colors.ocean700,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.ink700,
  },
  filterChipTextActiveAll: {
    color: colors.surface,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  // Die Rasterbreite liegt jetzt auf der Huelle, nicht mehr auf der Karte:
  // die Media Query in responsive.ts spricht das DIREKTE Kind von
  // sessions-grid an, und das ist seit dem Stern die Huelle.
  cardShell: {
    flexGrow: 0,
    flexBasis: '100%',
    // Der Bezugspunkt fuer den Stern darueber.
    position: 'relative',
  },
  // display/flexDirection ausdruecklich: der Link rendert im Web ein <Text>
  // mit display: inline, das als Flex-Kind zu block wird - dieselbe Falle wie
  // in der Tab-Leiste (siehe NavBar.tsx).
  card: {
    // flexGrow statt fester Hoehe: in einer Reihe sind die Karten
    // unterschiedlich hoch, die Huelle dehnt sich auf die hoechste, und ohne
    // das endete die weisse Flaeche vorher.
    flexGrow: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  starSlot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  emptyBox: {
    paddingHorizontal: spacing.md,
  },
  cardInner: {
    gap: spacing.sm,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    // Platz fuer den Stern oben rechts. Nur diese Zeile braucht ihn - Titel
    // und Untertitel laufen unter ihm durch.
    paddingRight: 44,
  },
  meta: {
    fontSize: 11,
    color: colors.ink700,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink900,
  },
  subtitle: {
    fontSize: 13,
    color: colors.ink700,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rhythmPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  rhythmText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink900,
    letterSpacing: 0.5,
  },
  effectPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  effectText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
