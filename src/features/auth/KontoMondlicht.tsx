import type { Session } from '@supabase/supabase-js';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { PressableRing } from '@/components/PressableRing';
import { moonPath } from '@/design/moon';
import { displayFont } from '@/design/responsive';
import { useThemePalette } from '@/design/theme';
import { colors, radius, spacing } from '@/design/tokens';
import { DataExport } from '@/features/auth/DataExport';
import { DeleteAccount } from '@/features/auth/DeleteAccount';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { ConsentPanel } from '@/features/consents/ConsentPanel';
import { today as heute, toIsoDate } from '@/features/habits/dates';
import { minutesPerWeek } from '@/features/habits/stats';
import { useMyHabits, useMySessions } from '@/features/habits/useHabits';
import { SubscriptionPanel } from '@/features/plus/SubscriptionPanel';
import { supabase } from '@/lib/supabase';

// Das Konto im Vorschlag "Mondlicht Mobile" (02.11.2026, nur Testsystem).
//
// Angemeldet: oben ein "Mondpass" - Begruessung, seit wann man dabei ist,
// Plus-Status, und die letzten acht Wochen als acht Monde: je mehr
// Atemminuten in einer Woche, desto voller der Mond (die staerkste Woche ist
// Vollmond). Nur eigene Zahlen, kein Vergleich mit anderen, keine Wertung.
// Darunter dieselben Bereiche wie bisher (Abo, Einwilligungen, Daten,
// Loeschen), unveraendert in ihrer Logik; Abmelden steht ruhig am Ende.
//
// Abgemeldet: ein kurzer Vorraum mit dem, was ein Konto moeglich macht, dann
// das bekannte Anmeldeformular (AuthPanel, unveraendert).

const dabeiSeit = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' });

export function AccountMondlicht({ session }: { session: Session }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fullName = session.user.user_metadata?.full_name;
  const name = typeof fullName === 'string' && fullName ? fullName : (session.user.email ?? '');
  const firstName = typeof fullName === 'string' && fullName ? fullName.split(' ')[0] : null;

  const signOut = async () => {
    setError(null);
    setPending(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setPending(false);
    if (signOutError) setError(t('errors:auth.signOutFailed'));
  };

  return (
    <View style={styles.page}>
      <MoonPass name={name} firstName={firstName} since={session.user.created_at} />

      <Section icon="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z">
        <SubscriptionPanel />
      </Section>
      <Section icon="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z">
        <ConsentPanel />
      </Section>
      <Section icon="M12 4v11M7 10l5 5 5-5M5 20h14">
        <DataExport session={session} />
      </Section>
      <Section quiet>
        <DeleteAccount />
      </Section>

      <View style={styles.signOutWrap}>
        <PressableRing onPress={() => void signOut()} disabled={pending} style={styles.signOut}>
          <Text style={styles.signOutText}>{pending ? t('auth.signOutPending') : t('auth.signOut')}</Text>
        </PressableRing>
        {error ? (
          <Text role="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MoonPass({ name, firstName, since }: { name: string; firstName: string | null; since: string }) {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const plus = usePlusAccess();
  const sessions = useMySessions();
  const habits = useMyHabits();
  const today = heute();

  const weeks = useMemo(
    () => (sessions.data ? minutesPerWeek(sessions.data, today, (ts) => toIsoDate(new Date(ts))) : null),
    [sessions.data, today],
  );
  const total = weeks?.reduce((sum, w) => sum + w.minutes, 0) ?? null;
  const strongest = weeks ? Math.max(...weeks.map((w) => w.minutes)) : 0;
  const sinceDate = new Date(since);
  const habitCount = habits.data?.filter((h) => h.is_active).length ?? null;

  return (
    <View style={styles.pass}>
      <Svg width="100%" height="100%" viewBox="0 0 358 260" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} aria-hidden>
        <Circle cx={300} cy={46} r={70} fill={palette.glow} opacity={0.06} />
        <Circle cx={300} cy={46} r={44} fill={palette.glow} opacity={0.08} />
        {[
          [30, 24, 1.2],
          [140, 16, 1],
          [220, 54, 1.3],
          [96, 70, 0.9],
        ].map(([x, y, r]) => (
          <Circle key={`${x}`} cx={x} cy={y} r={r} fill={palette.ink900} opacity={0.6} />
        ))}
      </Svg>

      <View style={styles.passHead}>
        <View style={styles.avatar}>
          <Text {...displayFont} style={styles.avatarText}>
            {(firstName ?? name).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.grow}>
          <Text {...displayFont} style={styles.hello}>
            {firstName ? t('konto.m.hello', { name: firstName }) : t('konto.m.helloPlain')}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {name}
          </Text>
          {Number.isNaN(sinceDate.getTime()) ? null : (
            <Text style={styles.meta}>{t('konto.m.since', { date: dabeiSeit.format(sinceDate) })}</Text>
          )}
        </View>
        {plus.data !== undefined ? (
          <Text style={[styles.badge, plus.data && styles.badgePlus]}>
            {plus.data ? t('konto.m.plus') : t('konto.m.free')}
          </Text>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat value={total === null ? '–' : String(total)} label={t('konto.m.minutes')} />
        <Stat value={sessions.data ? String(sessions.data.length) : '–'} label={t('konto.m.sessions')} />
        <Stat value={habitCount === null ? '–' : String(habitCount)} label={t('konto.m.habits')} />
      </View>

      {weeks ? (
        <View>
          <View
            style={styles.moons}
            accessibilityLabel={t('konto.m.moonsLabel', { minutes: weeks.map((w) => w.minutes).join(', ') })}
          >
            {weeks.map((w) => (
              <Svg key={w.weekStart} width={28} height={28} viewBox="-14 -14 28 28" aria-hidden>
                <Circle r={12} fill={palette.line} />
                <Path d={moonPath(strongest > 0 ? w.minutes / strongest : 0, 12)} fill={palette.glow} />
              </Svg>
            ))}
          </View>
          <Text style={styles.moonsHint}>{strongest > 0 ? t('konto.m.moonsHint') : t('konto.m.moonsEmpty')}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text {...displayFont} style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Ein Bereich mit Zeichen am Rand. Die Inhalte bringen Ueberschrift und Karten selbst mit. */
function Section({ icon, quiet, children }: { icon?: string; quiet?: boolean; children: ReactNode }) {
  const palette = useThemePalette();
  return (
    <View style={[styles.section, quiet && styles.sectionQuiet]}>
      {icon ? (
        <View style={styles.sectionIcon}>
          <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
            <Path d={icon} fill="none" stroke={palette.ocean700} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      ) : null}
      <View style={styles.grow}>{children}</View>
    </View>
  );
}

/** Der Vorraum vor dem Anmeldeformular: was ein Konto moeglich macht. */
export function GuestWelcome() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const items = [
    { icon: 'M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM9.5 11l2 2 3.5-4', text: t('konto.m.guest.diary') },
    { icon: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z', text: t('konto.m.guest.favorites') },
    { icon: 'M12 3c-4 5-4 11 0 18M12 3c4 5 4 11 0 18M4 12c4-2 12-2 16 0', text: t('konto.m.guest.sequences') },
  ];
  return (
    <View style={styles.guest}>
      <Svg width="100%" height="100%" viewBox="0 0 358 220" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} aria-hidden>
        <Circle cx={296} cy={52} r={62} fill={palette.glow} opacity={0.06} />
        <Circle cx={296} cy={52} r={22} fill={palette.glow} />
        <Circle cx={306} cy={45} r={20} fill={palette.oceanImageBg} />
        <Path d="M0 200 C 90 188, 250 212, 358 198" fill="none" stroke={palette.glow} strokeOpacity={0.3} strokeWidth={1.5} />
      </Svg>
      <Text {...displayFont} style={styles.guestTitle}>
        {t('konto.m.guest.title')}
      </Text>
      <View style={styles.guestList}>
        {items.map((item) => (
          <View key={item.text} style={styles.guestRow}>
            <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
              <Path d={item.icon} fill="none" stroke={palette.ocean700} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.guestText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  pass: {
    gap: spacing.md,
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.ocean700,
    backgroundColor: colors.oceanImageBg,
    overflow: 'hidden',
  },
  passHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.ocean700,
  },
  avatarText: {
    fontSize: 28,
    color: colors.surface,
  },
  hello: {
    fontSize: 22,
    lineHeight: 26,
    color: colors.ink900,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink700,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.ink700,
  },
  badgePlus: {
    borderColor: colors.ocean700,
    backgroundColor: colors.ocean700,
    color: colors.surface,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 28,
    color: colors.ink900,
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
    color: colors.ink700,
  },
  moons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moonsHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink700,
  },
  // Keine eigene Flaeche: Abo, Einwilligungen und Co. bringen ihre Karten
  // selbst mit - eine Karte in der Karte waere doppelt.
  section: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: spacing.sm,
  },
  sectionQuiet: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.oceanTint,
  },
  signOutWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  signOut: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink900,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
  },
  guest: {
    gap: spacing.md,
    padding: 20,
    paddingTop: 28,
    borderRadius: 26,
    backgroundColor: colors.oceanImageBg,
    overflow: 'hidden',
  },
  guestTitle: {
    fontSize: 26,
    lineHeight: 31,
    color: colors.ink900,
    maxWidth: 240,
  },
  guestList: {
    gap: 10,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guestText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink900,
  },
});
