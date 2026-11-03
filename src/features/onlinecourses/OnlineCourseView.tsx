import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { StateMessage } from '@/components/StateMessage';
import { PageColumn } from '@/design/PageColumn';
import { displayFont, responsive } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlusAccess } from '@/features/configurator/useSequences';
import { Markdown } from '@/features/news/Markdown';
import { openExternalUrl } from '@/lib/externalLink';
import { AccessBadge } from './AccessBadge';
import { KindIcon } from './KindIcon';
import { activeUntil, courseProgress, formatEuro, groupByWeek, plusPriceCents, totalMinutes } from './courseLogic';
import {
  useCanOpenCourse,
  useCourseAccess,
  useCourseProgress,
  useOnlineCourseCheckout,
  usePlanSlots,
  type CourseWithBlocks,
} from './useOnlineCourses';
import { formatPlanDate } from './PlanCourse';

// Die Kursseite eines Onlinekurses (V1.2, SAD §11.2): Beschreibung,
// Hinweis "on demand", Zeitverlauf und rechts (am Handy darunter) der Weg
// hinein - je nach Zugangsart und Stand der Person.
//
// Ob der Kurs offen ist, sagt can_open_course() (useCanOpenCourse). Diese
// Seite rechnet das nicht selbst nach, sie zeigt nur den passenden Weg.

export const blockHref = (slug: string, block: string) => ({
  pathname: '/onlinekurse/[slug]/[block]' as const,
  params: { slug, block },
});

export const planHref = (slug: string) => ({ pathname: '/onlinekurse/[slug]/planen' as const, params: { slug } });

export function OnlineCourseView({ data }: { data: CourseWithBlocks }) {
  const { t } = useTranslation();
  const { course, blocks } = data;
  const { session } = useAuth();
  const params = useLocalSearchParams<{ kauf?: string }>();
  const justBought = params.kauf === 'erfolg';

  const open = useCanOpenCourse(course.id);
  const progress = useCourseProgress(course.id);
  const plan = usePlanSlots(course.id);
  const done = progress.data ?? new Set<string>();
  const facts = courseProgress(blocks, done);
  const weeks = groupByWeek(blocks);
  const minutes = totalMinutes(blocks);
  const loggedIn = Boolean(session);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <PageColumn gap={spacing.lg}>
        <Link href="/onlinekurse" style={styles.back}>
          {t('onlineCourses.back')}
        </Link>

        {justBought && open.data !== true ? (
          <StateMessage
            title={t('onlineCourses.buy.pendingTitle')}
            body={t('onlineCourses.buy.pendingHint')}
            actionLabel={t('onlineCourses.buy.refresh')}
            onAction={() => void open.refetch()}
          />
        ) : null}
        {params.kauf === 'abgebrochen' ? (
          <StateMessage title={t('onlineCourses.buy.cancelledTitle')} body={t('onlineCourses.buy.cancelledHint')} />
        ) : null}

        <View {...responsive('m-split')} style={styles.split}>
          <View style={styles.main}>
            <AccessBadge access={course.access} />
            <Text style={styles.title} role="heading" aria-level={1} {...displayFont}>
              {course.title}
            </Text>
            {course.subtitle ? <Text style={styles.subtitle}>{course.subtitle}</Text> : null}
            {course.summary_md ? <Text style={styles.lead}>{course.summary_md}</Text> : null}

            <View style={styles.onDemand}>
              <Text style={styles.onDemandTitle}>{t('onlineCourses.onDemand.title')}</Text>
              <Text style={styles.onDemandText}>{t('onlineCourses.onDemand.text')}</Text>
            </View>

            <View style={styles.chips}>
              <Text style={styles.chip}>{t('onlineCourses.chips.blocks', { count: blocks.length })}</Text>
              {course.suggested_days ? (
                <Text style={styles.chip}>{t('onlineCourses.chips.days', { count: course.suggested_days })}</Text>
              ) : null}
              {minutes > 0 ? <Text style={styles.chip}>{t('onlineCourses.chips.minutes', { count: minutes })}</Text> : null}
            </View>

            {course.description_md ? <Markdown source={course.description_md} /> : null}

            <Text style={styles.section} role="heading" aria-level={2} {...displayFont}>
              {t('onlineCourses.timeline')}
            </Text>
            {weeks.map(({ week, blocks: weekBlocks }) => (
              <View key={week} style={styles.week}>
                {weeks.length > 1 ? <Text style={styles.weekTitle}>{t('onlineCourses.week', { week })}</Text> : null}
                {weekBlocks.map((block) => (
                  <Link key={block.id} href={blockHref(course.slug, block.id)} asChild>
                    <PressableRing style={styles.row}>
                      <Text style={styles.day}>{t('onlineCourses.day', { day: block.day_offset + 1 })}</Text>
                      <KindIcon kind={block.kind} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle}>{block.title}</Text>
                        <Text style={styles.rowMeta}>{t(`onlineCourses.kind.${block.kind}`)}</Text>
                      </View>
                      <Text
                        style={[
                          styles.rowState,
                          done.has(block.id) && styles.rowDone,
                          !done.has(block.id) && plan.data?.has(block.id) && styles.rowPlanned,
                        ]}
                      >
                        {done.has(block.id)
                          ? t('onlineCourses.done')
                          : plan.data?.get(block.id)
                            ? formatPlanDate(plan.data.get(block.id)!.planned_on)
                            : block.duration_sec
                            ? t('onlineCourses.minutes', { count: Math.ceil(block.duration_sec / 60) })
                            : ''}
                      </Text>
                    </PressableRing>
                  </Link>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.side}>
            <SidePanel
              data={data}
              open={open.data === true}
              openPending={open.isPending}
              loggedIn={loggedIn}
              contentDone={facts.contentDone}
              contentTotal={facts.contentTotal}
              quizPassed={facts.quizPassed}
              next={facts.next}
            />
          </View>
        </View>
      </PageColumn>
    </ScrollView>
  );
}

type SideProps = {
  data: CourseWithBlocks;
  open: boolean;
  openPending: boolean;
  loggedIn: boolean;
  contentDone: number;
  contentTotal: number;
  quizPassed: boolean;
  next: string | null;
};

function SidePanel({ data, open, openPending, loggedIn, contentDone, contentTotal, quizPassed, next }: SideProps) {
  const { t } = useTranslation();
  const { course, blocks } = data;
  const plus = usePlusAccess();
  const access = useCourseAccess(course.access === 'paid' ? course.id : undefined);
  const checkout = useOnlineCourseCheckout();
  const first = next ?? blocks[0]?.id ?? null;

  if (openPending) return <View style={styles.panel} />;

  // Offen und angemeldet: Fortschritt und weiter.
  if (open && loggedIn) {
    const until = course.access === 'paid' ? activeUntil(access.data ?? []) : null;
    return (
      <View style={styles.panel}>
        <Text style={styles.panelKicker}>{t(`onlineCourses.panel.open.${course.access}`)}</Text>
        <Text style={styles.panelBig}>{t('onlineCourses.panel.progress', { done: contentDone, total: contentTotal })}</Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${contentTotal ? (contentDone / contentTotal) * 100 : 0}%` }]} />
        </View>
        {until ? (
          <Text style={styles.panelText}>
            {t('onlineCourses.panel.until', { date: until.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </Text>
        ) : null}
        {course.access === 'plus' ? <Text style={styles.panelText}>{t('onlineCourses.panel.plusHint')}</Text> : null}
        {first ? (
          <Link href={blockHref(course.slug, first)} asChild>
            <PressableRing style={styles.primary}>
              <Text style={styles.primaryText}>
                {contentDone > 0 || quizPassed ? t('onlineCourses.panel.continue') : t('onlineCourses.panel.start')}
              </Text>
            </PressableRing>
          </Link>
        ) : (
          <Text style={styles.panelText}>{t('onlineCourses.panel.allDone')}</Text>
        )}
        {next ? (
          <Link href={planHref(course.slug)} asChild>
            <PressableRing style={styles.secondary}>
              <Text style={styles.secondaryText}>{t('onlineCourses.panel.plan')}</Text>
            </PressableRing>
          </Link>
        ) : null}
        <Text style={styles.panelHint}>{t('onlineCourses.panel.certificateRule')}</Text>
      </View>
    );
  }

  // Offen fuer alle, aber ohne Konto: ansehen ja, speichern nein.
  if (open) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelBig}>{t('onlineCourses.panel.free')}</Text>
        <Text style={styles.panelText}>{t('onlineCourses.panel.guestHint')}</Text>
        {first ? (
          <Link href={blockHref(course.slug, first)} asChild>
            <PressableRing style={styles.primary}>
              <Text style={styles.primaryText}>{t('onlineCourses.panel.view')}</Text>
            </PressableRing>
          </Link>
        ) : null}
        <Link href="/konto?modus=registrieren" style={styles.link}>
          {t('onlineCourses.panel.register')}
        </Link>
      </View>
    );
  }

  if (course.access === 'account') {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelBig}>{t('onlineCourses.panel.free')}</Text>
        <Text style={styles.panelText}>{t('onlineCourses.panel.accountHint')}</Text>
        <Link href="/konto?modus=registrieren" asChild>
          <PressableRing style={styles.primary}>
            <Text style={styles.primaryText}>{t('onlineCourses.panel.register')}</Text>
          </PressableRing>
        </Link>
      </View>
    );
  }

  if (course.access === 'plus') {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelBig}>{t('onlineCourses.panel.inPlus')}</Text>
        <Text style={styles.panelText}>{t('onlineCourses.panel.plusOffer')}</Text>
        <Link href="/plus" asChild>
          <PressableRing style={styles.primary}>
            <Text style={styles.primaryText}>{t('onlineCourses.panel.toPlus')}</Text>
          </PressableRing>
        </Link>
      </View>
    );
  }

  // Einzelkauf.
  const list = course.price_cents ?? 0;
  const hasPlus = plus.data === true;
  const expired = (access.data ?? []).length > 0;
  const errorKey = checkout.error instanceof Error ? checkout.error.message : null;

  return (
    <View style={styles.panel}>
      <View style={styles.priceRow}>
        {hasPlus ? <Text style={styles.strike}>{formatEuro(list)}</Text> : null}
        <Text style={styles.panelBig}>{formatEuro(hasPlus ? plusPriceCents(list) : list)}</Text>
      </View>
      <Text style={styles.panelText}>
        {hasPlus
          ? t('onlineCourses.panel.plusPrice')
          : t('onlineCourses.panel.oneOff', { price: formatEuro(plusPriceCents(list)) })}
      </Text>
      <Text style={styles.panelText}>{t('onlineCourses.panel.yearRule', { days: course.access_days })}</Text>
      {expired ? <Text style={styles.panelText}>{t('onlineCourses.panel.expired')}</Text> : null}
      {loggedIn ? (
        <Button
          label={checkout.isPending ? t('onlineCourses.buy.pending') : t('onlineCourses.buy.action')}
          disabled={checkout.isPending}
          block
          onPress={() =>
            checkout.mutate(course.slug, {
              onSuccess: (url) => openExternalUrl(url),
            })
          }
        />
      ) : (
        <Link href="/konto" asChild>
          <PressableRing style={styles.primary}>
            <Text style={styles.primaryText}>{t('onlineCourses.buy.login')}</Text>
          </PressableRing>
        </Link>
      )}
      {errorKey ? (
        <Text style={styles.error}>
          {t(errorKey === 'already_owned' ? 'onlineCourses.buy.alreadyOwned' : 'onlineCourses.buy.failed')}
        </Text>
      ) : null}
      <Text style={styles.panelHint}>{t('onlineCourses.buy.legal')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  back: { fontSize: 15, fontWeight: '600', color: colors.ocean700 },
  split: { gap: spacing.xl },
  main: { gap: spacing.md, flexShrink: 1 },
  side: { gap: spacing.md },
  title: { fontSize: 32, lineHeight: 40, color: colors.ink900 },
  subtitle: { fontSize: 18, color: colors.ink700, fontStyle: 'italic' },
  lead: { fontSize: 17, lineHeight: 26, color: colors.ink700 },
  onDemand: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    backgroundColor: colors.surfaceSubtle,
  },
  onDemandTitle: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  onDemandText: { fontSize: 14, lineHeight: 21, color: colors.ink700 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    fontSize: 13,
    color: colors.ink700,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: 11,
  },
  section: { fontSize: 22, color: colors.ink900, marginTop: spacing.sm },
  week: { gap: 4 },
  weekTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.ink700 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  day: { width: 48, fontSize: 12, fontWeight: '700', color: colors.ink700 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 13, color: colors.ink700 },
  rowState: { fontSize: 12, fontWeight: '700', color: colors.ink700 },
  rowDone: { color: colors.sage700 },
  rowPlanned: { color: colors.ocean700 },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 120,
  },
  panelKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.sage700 },
  panelBig: { fontSize: 26, color: colors.ink900, fontWeight: '600' },
  panelText: { fontSize: 14, lineHeight: 21, color: colors.ink700 },
  panelHint: { fontSize: 13, lineHeight: 19, color: colors.ink700, marginTop: spacing.sm },
  bar: { height: 6, borderRadius: radius.full, backgroundColor: colors.oceanTint, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.sage700 },
  primary: {
    marginTop: spacing.sm,
    backgroundColor: colors.ocean700,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: colors.surface },
  secondary: {
    borderWidth: 1,
    borderColor: colors.ocean700,
    borderRadius: radius.full,
    paddingVertical: 11,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: colors.ocean700 },
  link: { fontSize: 14, fontWeight: '600', color: colors.ocean700, marginTop: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  strike: { fontSize: 18, color: colors.ink700, textDecorationLine: 'line-through' },
  error: { fontSize: 14, color: colors.danger },
});
