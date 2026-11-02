import { Link } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { FavoriteStar } from '@/components/FavoriteStar';
import { PressableRing } from '@/components/PressableRing';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { useReduceMotion } from '@/design/useReduceMotion';
import { Lotus } from '@/features/breathing/Lotus';
import { buildTimeline, totalDurationMs } from '@/features/breathing/timeline';
import { firstRound, leadMood, profileKeyframes, sessionKind, type SessionKind } from '@/features/sessions/moods';
import { ClockGlyph, MoodGlyph, PlayGlyph } from '@/features/sessions/SessionArt';
import type { PhaseKind, PlayableExercise } from '@/types/breathing';

// Die Session-Seite VOR dem Start im Vorschlag "Mondlicht Mobile"
// (02.11.2026, nur Testsystem): der Lotus atmet die erste Runde im echten
// Takt vor, der Rhythmus steht als farbiger Zeitstrahl, die Texte sind
// linksbuendig und aufklappbar, der Start-Knopf bleibt unten erreichbar.
//
// Sobald gestartet ist, zeigt [id].tsx den bisherigen Player - Uhr, Toene
// und Protokoll bleiben dort unangetastet.
//
// Audio- und Video-Sessions (eigene Aufnahmen, kommen nach V1.1) haben
// keinen Rhythmus: statt Lotus und Zeitstrahl steht dort ein Platzhalter,
// starten laesst sich noch nichts.

const LOTUS_SIZE = 170;
// Kleinste und groesste Oeffnung - derselbe Bereich, auf den Lotus.tsx
// seinen aeusseren Kranz abbildet.
const OPEN_MIN = 0.62;
const OPEN_MAX = 1;

type Props = {
  session: PlayableExercise;
  onStart: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  settings: ReactNode;
};

export function SessionIntro({ session, onStart, soundOn, onToggleSound, settingsOpen, onToggleSettings, settings }: Props) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const kind = sessionKind(session);
  const phases = useMemo(() => firstRound(session), [session]);
  const totalSeconds = useMemo(() => Math.round(totalDurationMs(buildTimeline(session)) / 1000), [session]);
  const seconds = kind === 'box' ? totalSeconds : (session.estimated_seconds ?? 0);
  const mood = leadMood(session.effects);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Link href="/sessions" aria-label={t('sessions.intro.back')} style={styles.roundButton}>
            <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
              <Path d="M15 5l-7 7 7 7" fill="none" stroke={palette.ink700} strokeWidth={1.9} strokeLinecap="round" />
            </Svg>
          </Link>
          <View style={styles.headerRight}>
            {kind === 'box' ? (
              <PressableRing
                onPress={onToggleSound}
                role="switch"
                aria-checked={soundOn}
                accessibilityLabel={soundOn ? t('player.soundOn') : t('player.soundOff')}
                style={styles.roundButton}
              >
                <Svg width={19} height={19} viewBox="0 0 24 24" aria-hidden>
                  <Path d="M4 10v4h4l5 4V6L8 10z" fill="none" stroke={palette.ink700} strokeWidth={1.8} strokeLinejoin="round" />
                  {soundOn ? (
                    <Path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke={palette.ink700} strokeWidth={1.8} strokeLinecap="round" />
                  ) : (
                    <Path d="M16 9l5 6M21 9l-5 6" fill="none" stroke={palette.ink700} strokeWidth={1.8} strokeLinecap="round" />
                  )}
                </Svg>
              </PressableRing>
            ) : null}
            <FavoriteStar exerciseId={session.id} />
          </View>
        </View>

        {kind === 'box' ? <LotusPreview phases={phases} /> : <MediaPlaceholder kind={kind} />}

        <View style={styles.body}>
          <Text role="heading" aria-level={1} style={styles.title}>
            {session.title}
          </Text>
          {session.subtitle ? <Text style={styles.subtitle}>{session.subtitle}</Text> : null}

          <View style={styles.stats}>
            <Stat
              icon={<ClockGlyph color={palette.ocean700} size={18} />}
              value={seconds > 0 ? t('sessions.duration', { minutes: Math.max(1, Math.round(seconds / 60)) }) : '–'}
              label={t('sessions.intro.duration')}
            />
            {kind === 'box' ? (
              <Stat
                icon={<RoundsGlyph color={palette.ocean700} />}
                value={
                  session.exercise_steps.length > 1
                    ? String(session.exercise_steps.length)
                    : String(session.exercise_steps[0]?.repeat_count ?? session.default_round_count ?? '–')
                }
                label={session.exercise_steps.length > 1 ? t('sessions.intro.blocks') : t('sessions.intro.rounds')}
              />
            ) : (
              <Stat
                icon={<KindGlyph kind={kind} color={palette.ocean700} />}
                value={t(`sessions.kind.${kind}`)}
                label={t('sessions.intro.kind')}
              />
            )}
            <Stat
              icon={mood ? <MoodGlyph mood={mood} color={palette.ocean700} size={18} /> : null}
              value={mood ? t(`sessions.mood.${mood}`) : '–'}
              label={t('sessions.intro.effect')}
            />
          </View>

          {kind === 'box' && phases.length > 0 ? (
            <RhythmBar phases={phases} firstOfMany={session.exercise_steps.length > 1} session={session} />
          ) : null}

          <Sections session={session} />

          {settingsOpen ? <View style={styles.settings}>{settings}</View> : null}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PressableRing
          onPress={onStart}
          disabled={kind !== 'box'}
          style={[styles.startButton, kind !== 'box' && styles.startDisabled]}
        >
          {kind === 'box' ? <PlayGlyph color={palette.surface} /> : null}
          <Text style={[styles.startText, kind !== 'box' && styles.startTextDisabled]}>
            {kind === 'box' ? t('sessions.start') : t('sessions.intro.soon')}
          </Text>
        </PressableRing>
        {kind === 'box' ? (
          <PressableRing
            onPress={onToggleSettings}
            role="button"
            aria-expanded={settingsOpen}
            accessibilityLabel={t('player.settings')}
            style={[styles.settingsButton, settingsOpen && styles.settingsButtonOn]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
              <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" fill="none" stroke={palette.ink700} strokeWidth={1.8} strokeLinecap="round" />
              <Circle cx={16} cy={7} r={2} fill="none" stroke={palette.ink700} strokeWidth={1.8} />
              <Circle cx={10} cy={17} r={2} fill="none" stroke={palette.ink700} strokeWidth={1.8} />
            </Svg>
          </PressableRing>
        ) : null}
      </View>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RoundsGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <Path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function KindGlyph({ kind, color }: { kind: SessionKind; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      {kind === 'video' ? (
        <Path d="M4 6h16v12H4zM10 9.5l5 2.5-5 2.5z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      ) : (
        <Path d="M5 15v-3a7 7 0 0 1 14 0v3M5 14h3v5H5zM16 14h3v5h-3z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/** Der Lotus atmet die erste Runde vor - Zielwert und Dauer je Phase. */
function LotusPreview({ phases }: { phases: ReturnType<typeof firstRound> }) {
  const reduce = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(OPEN_MIN));

  useEffect(() => {
    if (reduce || phases.length === 0) {
      scale.setValue((OPEN_MIN + OPEN_MAX) / 2);
      return;
    }
    // Reine Vorschau, nichts Zeitkritisches (SAD §7.1 gilt fuer die Uebung,
    // nicht fuer diese Schleife).
    const steps = profileKeyframes(phases).map((k) =>
      Animated.timing(scale, {
        toValue: OPEN_MIN + (OPEN_MAX - OPEN_MIN) * k.to,
        duration: k.ms,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      }),
    );
    scale.setValue(OPEN_MIN);
    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [phases, reduce, scale]);

  return (
    <View aria-hidden style={styles.lotusStage}>
      <Lotus scale={scale} size={LOTUS_SIZE} innerDiameter={44} />
    </View>
  );
}

function MediaPlaceholder({ kind }: { kind: SessionKind }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  return (
    <View style={styles.media}>
      <KindGlyph kind={kind} color={palette.ocean700} />
      <Text style={styles.mediaText}>{t(`sessions.intro.media.${kind}`)}</Text>
    </View>
  );
}

const PHASE_LABEL: Record<PhaseKind, string> = {
  inhale: 'sessions.intro.phase.inhale',
  hold_in: 'sessions.intro.phase.hold',
  exhale: 'sessions.intro.phase.exhale',
  hold_out: 'sessions.intro.phase.hold',
  free_breathing: 'sessions.intro.phase.free',
};

function phaseStyle(kind: PhaseKind) {
  if (kind === 'inhale') return { bg: styles.segInhale, text: styles.segTextOnAccent };
  if (kind === 'exhale') return { bg: styles.segExhale, text: styles.segTextOnAccent };
  return { bg: styles.segHold, text: styles.segTextOnHold };
}

/** Eine Runde als Zeitstrahl, mit einem Strich, der im Takt darueber laeuft. */
function RhythmBar({
  phases,
  firstOfMany,
  session,
}: {
  phases: ReturnType<typeof firstRound>;
  firstOfMany: boolean;
  session: PlayableExercise;
}) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const [head] = useState(() => new Animated.Value(0));
  const total = phases.reduce((sum, p) => sum + p.seconds, 0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reduce || total <= 0) return;
    const loop = Animated.loop(
      Animated.timing(head, { toValue: 1, duration: total * 1000, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [head, reduce, total]);

  // Atemweg der ersten Ein- und Ausatmung, falls gepflegt.
  const step = [...session.exercise_steps].sort((a, b) => a.position - b.position)[0];
  const sorted = step ? [...step.exercise_phases].sort((a, b) => a.position - b.position) : [];
  const routeIn = sorted.find((p) => p.kind === 'inhale')?.route;
  const routeOut = sorted.find((p) => p.kind === 'exhale')?.route;
  const fmt = (n: number) => String(n).replace('.', ',');

  return (
    <View style={styles.rhythm}>
      <View style={styles.rhythmHead}>
        <Text style={styles.rhythmLabel}>{firstOfMany ? t('sessions.intro.firstBlock') : t('sessions.intro.oneRound')}</Text>
        <Text style={styles.rhythmLabel}>{t('sessions.intro.seconds', { seconds: fmt(total) })}</Text>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.barWrap}>
        <View style={styles.bar}>
          {phases.map((p, i) => {
            const look = phaseStyle(p.kind);
            return (
              <View key={i} style={[styles.seg, look.bg, { flexGrow: p.seconds, flexBasis: 0 }]}>
                <Text numberOfLines={1} style={[styles.segText, look.text]}>
                  {t(PHASE_LABEL[p.kind], { seconds: fmt(p.seconds) })}
                </Text>
              </View>
            );
          })}
        </View>
        {!reduce && width > 0 ? (
          <Animated.View
            aria-hidden
            style={[
              styles.playhead,
              { transform: [{ translateX: head.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) }] },
            ]}
          />
        ) : null}
      </View>
      {routeIn || routeOut ? (
        <View style={styles.routes}>
          <Text style={styles.routeText}>
            {routeIn ? `${t('sessions.intro.phase.inhaleWord')} ${t(`phase.route.${routeIn}`)}` : ''}
          </Text>
          <Text style={styles.routeText}>
            {routeOut ? `${t('sessions.intro.phase.exhaleWord')} ${t(`phase.route.${routeOut}`)}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Beschreibung, Wirkung und Hinweis zum Aufklappen; die Beschreibung ist offen. */
function Sections({ session }: { session: PlayableExercise }) {
  const { t } = useTranslation();
  const list = [
    { id: 'about', title: t('sessions.intro.about'), text: session.description_md, notice: false },
    { id: 'benefits', title: t('sessions.benefits'), text: session.benefits_md, notice: false },
    { id: 'notice', title: t('sessions.notice'), text: session.contraindications_md, notice: true },
  ].filter((s) => s.text);
  const [open, setOpen] = useState<string | null>(list[0]?.id ?? null);

  return (
    <View style={styles.sections}>
      {list.map((s) => {
        const isOpen = open === s.id;
        return (
          <View key={s.id} style={styles.section}>
            <PressableRing
              onPress={() => setOpen(isOpen ? null : s.id)}
              role="button"
              aria-expanded={isOpen}
              style={styles.sectionHead}
            >
              <Text style={[styles.sectionTitle, s.notice && styles.sectionNotice]}>{s.title}</Text>
              <Text aria-hidden style={[styles.sectionSign, s.notice && styles.sectionNotice]}>
                {isOpen ? '–' : '+'}
              </Text>
            </PressableRing>
            {isOpen ? <Text style={styles.sectionText}>{s.text}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const BOTTOM_BAR = 90;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingTop: 14,
    paddingBottom: BOTTOM_BAR + spacing.lg,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 620,
    paddingHorizontal: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roundButton: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
  },
  lotusStage: {
    width: LOTUS_SIZE,
    height: LOTUS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    maxWidth: 580,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  mediaText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.ink700,
  },
  body: {
    width: '100%',
    maxWidth: 620,
    paddingHorizontal: 20,
    gap: 14,
  },
  title: {
    fontSize: 28,
    lineHeight: 33,
    textAlign: 'center',
    color: colors.ink900,
  },
  subtitle: {
    marginTop: -10,
    fontSize: 14,
    textAlign: 'center',
    color: colors.ink700,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink900,
  },
  statLabel: {
    fontSize: 11,
    color: colors.ink700,
  },
  rhythm: {
    gap: 6,
  },
  rhythmHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rhythmLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  barWrap: {
    position: 'relative',
    paddingVertical: 4,
  },
  bar: {
    flexDirection: 'row',
    height: 34,
    borderRadius: 12,
    overflow: 'hidden',
  },
  seg: {
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  segInhale: {
    backgroundColor: colors.ocean700,
  },
  segExhale: {
    backgroundColor: colors.sage700,
  },
  segHold: {
    backgroundColor: colors.lineStrong,
  },
  segText: {
    fontSize: 11,
    fontWeight: '800',
  },
  segTextOnAccent: {
    color: colors.surface,
  },
  segTextOnHold: {
    color: colors.ink900,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -1,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.ink900,
  },
  routes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  routeText: {
    fontSize: 12,
    color: colors.ink700,
  },
  sections: {
    gap: spacing.sm,
  },
  section: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  sectionHead: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink900,
  },
  sectionNotice: {
    color: colors.danger,
  },
  sectionSign: {
    fontSize: 18,
    color: colors.ink700,
  },
  sectionText: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  settings: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  bottomBar: {
    position: 'fixed' as 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: spacing.md,
    paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' as unknown as number,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  startButton: {
    flex: 1,
    maxWidth: 520,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  startDisabled: {
    backgroundColor: colors.lineStrong,
  },
  startText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.surface,
  },
  startTextDisabled: {
    fontSize: 15,
    color: colors.ink900,
  },
  settingsButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  settingsButtonOn: {
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanTint,
  },
});
