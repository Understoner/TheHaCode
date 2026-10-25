import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';
import { PlayerHilfe } from '@/features/sessions/PlayerHilfe';
import { SessionsList } from '@/features/sessions/SessionsList';

export default function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Kein Untertitel mehr (06.09.2026): was eine Session ist, erklaert
          sich an der ersten Karte besser als an einem Satz darueber - und die
          Karten sind das, wofuer der Platz da sein soll.

          Dieselbe Hilfe wie im Player (14.09.2026): wer die Liste sieht, will
          oft zuerst wissen, wie eine Session ablaeuft - und dass das Handy
          dafuer nicht auf lautlos stehen darf. */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('sessions.title')}</Text>
        <PlayerHilfe />
      </View>

      {/* Der Konfigurator haengt bewusst an den Sessions und bekommt keinen
          eigenen Eintrag in der Navigation (so schon in design/navigation.ts
          vorgesehen): auf dem Handy sind fuenf Eintraege in der Tab-Leiste die
          Grenze, und wer eigene Sequenzen sucht, sucht sie bei den Sequenzen. */}
      {/* Das Tagebuch haengt aus demselben Grund hier: die Tab-Leiste hat
          auf dem Handy keinen sechsten Platz, und Tagebuch und Sessions
          gehoeren zusammen - "Atmen zum Einschlafen" startet eine Session. */}
      <View style={styles.links}>
        <Link href="/sequenzen" style={styles.mine}>
          {t('sessions.meine')}
        </Link>
        <Link href="/habit-tracker" style={styles.mine}>
          {t('sessions.tagebuch')}
        </Link>
      </View>

      <SessionsList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  title: {
    flexShrink: 1,
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink900,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  mine: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ocean700,
    color: colors.ocean700,
    fontSize: 14,
    fontWeight: '600',
  },
});
