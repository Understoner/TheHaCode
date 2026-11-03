import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { displayFont } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { addDays, today as heute } from '@/features/habits/dates';
import { ONLINE_COURSES_ENABLED } from './flag';
import { KindIcon } from './KindIcon';
import { blockHref } from './OnlineCourseView';
import { formatPlanDate } from './PlanCourse';
import { useAgenda } from './useOnlineCourses';

// Geplante Kurstermine im Tagebuch (V1.2, Schritt 6).
//
// Sie stehen NEBEN den Habits, nicht darin: keine habit_logs, kein Score,
// keine Einwilligung noetig (Migration 0044). Deshalb auch ausserhalb der
// Einwilligungsabfrage des Tagebuchs. Gezeigt werden die naechsten 14 Tage
// und was in den letzten 7 Tagen liegen geblieben ist. Wer einen Block
// erledigt, sieht ihn weiter, durchgestrichen - bis der Tag vorbei ist.

const PAST_DAYS = 7;
const NEXT_DAYS = 14;

export function CourseAgenda() {
  const { t } = useTranslation();
  const today = heute();
  const agenda = useAgenda(addDays(today, -PAST_DAYS), addDays(today, NEXT_DAYS));

  if (!ONLINE_COURSES_ENABLED || !agenda.data || agenda.data.length === 0) return null;

  return (
    <View style={styles.box} aria-label={t('onlineCourses.agenda.title')}>
      <Text style={styles.title} {...displayFont}>
        {t('onlineCourses.agenda.title')}
      </Text>
      {agenda.data.map((slot) => {
        const block = slot.online_course_blocks;
        const course = slot.online_courses;
        if (!block || !course) return null;
        const missed = slot.planned_on < today && !slot.done;
        // Erledigtes aus der Vergangenheit muss nicht mehr erscheinen.
        if (slot.done && slot.planned_on < today) return null;
        return (
          <Link key={slot.id} href={blockHref(course.slug, slot.block_id)} asChild>
            <PressableRing style={styles.row}>
              <KindIcon kind={block.kind} size={32} />
              <View style={styles.text}>
                <Text style={styles.meta}>
                  {slot.planned_on === today ? t('diary.day.today') : formatPlanDate(slot.planned_on)}
                  {slot.day_part ? ` · ${t(`diary.today.part.${slot.day_part}`)}` : ''}
                  {missed ? ` · ${t('onlineCourses.agenda.missed')}` : ''}
                  {slot.done ? ` · ${t('onlineCourses.done')}` : ''}
                </Text>
                <Text style={[styles.blockTitle, slot.done && styles.doneTitle]}>{block.title}</Text>
                <Text style={styles.course}>{course.title}</Text>
              </View>
            </PressableRing>
          </Link>
        );
      })}
      <Text style={styles.hint}>{t('onlineCourses.agenda.hint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 18, color: colors.ink900 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  doneTitle: { textDecorationLine: 'line-through', color: colors.ink700 },
  text: { flex: 1, minWidth: 0 },
  meta: { fontSize: 12, fontWeight: '700', color: colors.ocean700 },
  blockTitle: { fontSize: 15, fontWeight: '600', color: colors.ink900 },
  course: { fontSize: 13, color: colors.ink700 },
  hint: { fontSize: 12, color: colors.ink700 },
});
