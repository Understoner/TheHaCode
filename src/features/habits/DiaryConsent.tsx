import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { colors, radius, spacing } from '@/design/tokens';
import { useSetConsent, type ConsentDefinition } from '@/features/consents/useConsents';

/**
 * Die Einwilligung nach Art. 9 DSGVO, bevor der erste Eintrag entsteht.
 *
 * Getrennt von AGB und Datenschutz und keine Voraussetzung fuer das Konto
 * (SAD §5.1, Kopplungsverbot): sie steht genau hier, vor dem Tagebuch, und
 * nirgends sonst. Der Wortlaut kommt aus der Datenbank - zugestimmt wird der
 * versionierten Fassung, nicht einem Text im Code. Widerrufen wird unter
 * "Konto" (ConsentPanel), dort steht sie nach der Zustimmung mit Datum.
 *
 * Der Haken ist kein Formalismus: "ausdruecklich" heisst, dass die Person
 * selbst etwas tut. Ein einzelner Knopf "Weiter" waere das nicht.
 */
export function DiaryConsent({ definition }: { definition: ConsentDefinition }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const setConsent = useSetConsent();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('diary.consent.title')}</Text>
      <Text style={styles.text}>{t('diary.consent.text')}</Text>

      <View style={styles.wording}>
        <Text style={styles.wordingTitle}>{definition.title}</Text>
        <Text style={styles.wordingText}>{definition.body_md}</Text>
      </View>

      <Checkbox
        checked={checked}
        onToggle={() => setChecked((c) => !c)}
        label={t('diary.consent.check')}
      >
        {t('diary.consent.check')}
      </Checkbox>

      {setConsent.isError ? (
        <Text role="alert" style={styles.error}>
          {t('diary.consent.failed')}
        </Text>
      ) : null}

      <Button
        label={t('diary.consent.action')}
        disabled={!checked || setConsent.isPending}
        onPress={() => setConsent.mutate({ definition, granted: true })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink900,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink700,
  },
  wording: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.line,
  },
  wordingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink900,
  },
  wordingText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
