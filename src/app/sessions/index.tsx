import type { ReactNode } from 'react';
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
import { responsive } from '@/design/responsive';
import { PageColumn } from '@/design/PageColumn';
import { colors, DESIGN_PREVIEW, spacing } from '@/design/tokens';
import { parseSessionFilter } from '@/features/sessions/effects';
import { MoodSessions } from '@/features/sessions/MoodSessions';
import { parseMood } from '@/features/sessions/moods';
import { PlayerHilfe } from '@/features/sessions/PlayerHilfe';
import { SessionsList } from '@/features/sessions/SessionsList';

export default function SessionsScreen() {
  const { t } = useTranslation();
  // Der Filter steht in der Adresse (?filter=), gesetzt von /sessions/filter.
  const params = useLocalSearchParams<{ filter?: string; stimmung?: string }>();
  const filter = parseSessionFilter(params.filter);
  // Die Stimmung (Testsystem, 02.11.2026) steht wie der Filter in der Adresse,
  // damit "Zurueck" aus einer Session dieselbe Auswahl zeigt.
  const mood = parseMood(params.stimmung);
  const filtered = filter !== 'all';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Column>
        {/* Kein Untertitel mehr (06.09.2026): was eine Session ist, erklaert
            sich an der ersten Karte besser als an einem Satz darueber.
  
            Neben der Ueberschrift seit 30.10.2026 drei Symbole statt Filterleiste
            und Link darunter - die Sessions stehen so gleich unter dem Titel:
            Filter (eigene Seite), die eigenen Sequenzen (Konfigurator, bewusst
            ohne eigenen Eintrag in der Tab-Leiste) und dieselbe Hilfe wie im
            Player. */}
        <View style={styles.titleRow}>
          <Text role="heading" style={styles.title}>
            {DESIGN_PREVIEW ? t('sessions.mood.title') : t('sessions.title')}
          </Text>
          <View {...responsive('header-icons')} style={styles.icons}>
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
  
        {DESIGN_PREVIEW ? <MoodSessions filter={filter} mood={mood} /> : <SessionsList filter={filter} />}
      </Column>
    </ScrollView>
  );
}

// Im Testsystem steht alles in der zentrierten Seitenspalte (PageColumn,
// 02.11.2026), im Livesystem bleibt die Seite wie bisher.
function Column({ children }: { children: ReactNode }) {
  return DESIGN_PREVIEW ? <PageColumn gap={spacing.md}>{children}</PageColumn> : <>{children}</>;
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
