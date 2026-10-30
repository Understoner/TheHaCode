import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActiveFilter } from '@/components/FilterControls';
import {
  FilterGlyph,
  HEADER_ICON_GAP,
  HEADER_ICON_SIZE,
  HeaderIconLink,
  ListGlyph,
} from '@/components/HeaderIcon';
import { colors, spacing } from '@/design/tokens';
import { parseSessionFilter } from '@/features/sessions/effects';
import { PlayerHilfe } from '@/features/sessions/PlayerHilfe';
import { SessionsList } from '@/features/sessions/SessionsList';

export default function SessionsScreen() {
  const { t } = useTranslation();
  // Der Filter steht in der Adresse (?filter=), gesetzt von /sessions/filter.
  const filter = parseSessionFilter(useLocalSearchParams<{ filter?: string }>().filter);
  const filtered = filter !== 'all';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Kein Untertitel mehr (06.09.2026): was eine Session ist, erklaert
          sich an der ersten Karte besser als an einem Satz darueber.

          Neben der Ueberschrift seit 30.10.2026 drei Symbole statt Filterleiste
          und Link darunter - die Sessions stehen so gleich unter dem Titel:
          Filter (eigene Seite), die eigenen Sequenzen (Konfigurator, bewusst
          ohne eigenen Eintrag in der Tab-Leiste) und dieselbe Hilfe wie im
          Player. */}
      <View style={styles.titleRow}>
        <Text role="heading" style={styles.title}>
          {t('sessions.title')}
        </Text>
        <View style={styles.icons}>
          <HeaderIconLink
            href={{ pathname: '/sessions/filter', params: { filter } }}
            label={t('sessions.filter.open')}
            active={filtered}
          >
            <FilterGlyph active={filtered} />
          </HeaderIconLink>
          <HeaderIconLink href="/sequenzen" label={t('sessions.meine')}>
            <ListGlyph />
          </HeaderIconLink>
          <PlayerHilfe kompakt />
        </View>
      </View>

      {filtered ? (
        <View style={styles.inset}>
          <ActiveFilter
            summary={
              filter === 'favoriten' ? t('favoriten.filter') : t(`sessions.effects.${filter}`)
            }
            resetHref="/sessions"
          />
        </View>
      ) : null}

      <SessionsList filter={filter} />
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: HEADER_ICON_SIZE,
    fontWeight: '600',
    color: colors.ink900,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HEADER_ICON_GAP,
  },
  inset: {
    paddingHorizontal: spacing.md,
  },
});
