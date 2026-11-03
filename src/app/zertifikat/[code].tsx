import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { StateMessage } from '@/components/StateMessage';
import { PageColumn } from '@/design/PageColumn';
import { displayFont } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { OnlineCoursesGate } from '@/features/onlinecourses/OnlineCoursesGate';
import { supabase } from '@/lib/supabase';

// Oeffentliche Pruefung eines Zertifikats (V1.2, Schritt 8, Migration 0046).
// Zeigt nur Name, Kurs und Datum - mehr gibt verify_certificate() nicht her.
export default function ZertifikatScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const query = useQuery({
    queryKey: ['verify-certificate', code],
    enabled: Boolean(code),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('verify_certificate', { p_code: code! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  return (
    <OnlineCoursesGate>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PageColumn>
          <QueryBoundary query={query}>
            {(cert) =>
              cert ? (
                <View style={styles.card}>
                  <Text style={styles.kicker}>{t('onlineCourses.verify.valid')}</Text>
                  <Text style={styles.name} {...displayFont}>
                    {cert.full_name}
                  </Text>
                  <Text style={styles.text}>{t('onlineCourses.verify.course', { course: cert.course_title })}</Text>
                  <Text style={styles.text}>
                    {t('onlineCourses.verify.date', {
                      date: new Date(cert.issued_at).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' }),
                    })}
                  </Text>
                  <Text style={styles.hint}>{t('onlineCourses.verify.hint', { code })}</Text>
                </View>
              ) : (
                <StateMessage title={t('onlineCourses.verify.unknownTitle')} body={t('onlineCourses.verify.unknownHint')} />
              )
            }
          </QueryBoundary>
        </PageColumn>
      </ScrollView>
    </OnlineCoursesGate>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  card: {
    alignSelf: 'center',
    maxWidth: 560,
    width: '100%',
    gap: spacing.sm,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.sage700 },
  name: { fontSize: 30, color: colors.ink900, textAlign: 'center' },
  text: { fontSize: 15, color: colors.ink700, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.ink700, textAlign: 'center', marginTop: spacing.sm },
});
