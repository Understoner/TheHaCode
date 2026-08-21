import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QueryBoundary } from '@/components/QueryBoundary';
import { colors, radius, spacing } from '@/design/tokens';
import { useConsents, useSetConsent, type ConsentState } from '@/features/consents/useConsents';
import { formatDate } from '@/features/plus/plus';

// Einwilligungen auf der Kontoseite.
//
// Zwei Dinge stehen hier, und sie sind verschieden: WOZU zugestimmt wurde (der
// Wortlaut der Fassung, versioniert) und WANN (der Nachweis). Beides kommt aus
// der Datenbank, nicht aus dem Code - eine hier hartkodierte Liste wuerde beim
// naechsten Tagebuch-Consent vergessen.
//
// Pflichteinwilligungen (is_required) lassen sich nicht per Knopf widerrufen.
// Das ist keine Bevormundung: AGB und Datenschutz sind Grundlage der
// Kontonutzung, ihr Widerruf ist die Kontoloeschung - und die steht auf
// derselben Seite, ein Stueck weiter unten.
export function ConsentPanel() {
  const { t } = useTranslation();
  const consents = useConsents();

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('konto.consents.titel')}</Text>

      <QueryBoundary
        query={consents}
        empty={{ title: t('konto.consents.leerTitel'), hint: t('konto.consents.leerHinweis') }}
      >
        {(liste) => (
          <View style={styles.list}>
            {liste.map((state) => (
              <ConsentRow key={state.definition.id} state={state} />
            ))}
          </View>
        )}
      </QueryBoundary>
    </View>
  );
}

function ConsentRow({ state }: { state: ConsentState }) {
  const { t } = useTranslation();
  const setConsent = useSetConsent();

  const { definition, latest, granted } = state;
  const wannGeaendert = latest?.granted_at ?? latest?.revoked_at ?? null;

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{definition.title}</Text>
        <Text style={styles.rowBody}>{definition.body_md}</Text>

        <Text style={granted ? styles.granted : styles.missing}>
          {granted
            ? t('konto.consents.erteilt', { datum: formatDate(wannGeaendert) })
            : latest
              ? t('konto.consents.widerrufen', { datum: formatDate(wannGeaendert) })
              : t('konto.consents.offen')}
        </Text>

        <Text style={styles.version}>
          {t('konto.consents.fassung', { version: definition.version })}
        </Text>
      </View>

      {/* Zustimmen darf man immer; widerrufen nur, was keine Pflicht ist. */}
      {!granted ? (
        <Pressable
          onPress={() => setConsent.mutate({ definition, granted: true })}
          disabled={setConsent.isPending}
          style={styles.action}
        >
          <Text style={styles.actionText}>{t('konto.consents.zustimmen')}</Text>
        </Pressable>
      ) : definition.is_required ? (
        <Link href="/agb" style={styles.actionLink}>
          {t('konto.consents.nachlesen')}
        </Link>
      ) : (
        <Pressable
          onPress={() => setConsent.mutate({ definition, granted: false })}
          disabled={setConsent.isPending}
          style={styles.action}
        >
          <Text style={styles.actionText}>{t('konto.consents.widerrufen_aktion')}</Text>
        </Pressable>
      )}

      {setConsent.isError ? (
        <Text role="alert" style={styles.error}>
          {t('errors:konto.consent')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    flexBasis: 220,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  rowBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  granted: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.sage700,
  },
  missing: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink900,
  },
  version: {
    fontSize: 12,
    color: colors.ink700,
  },
  action: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.full,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  actionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ocean700,
  },
  error: {
    flexBasis: '100%',
    fontSize: 13,
    color: colors.danger,
  },
});
