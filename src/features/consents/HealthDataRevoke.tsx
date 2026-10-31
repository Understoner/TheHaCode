import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';
import { useSetConsent, type ConsentDefinition } from '@/features/consents/useConsents';
import { useDeleteDiaryData } from '@/features/habits/useDeleteDiaryData';

// Widerruf der Einwilligung health_data (Tagebuch).
//
// Entscheidung des Users vom 31.10.2026: Beim Widerruf wird angeboten, alles
// aus dem Tagebuch sofort zu loeschen (Art. 17 Abs. 1 lit. b DSGVO). Wer die
// Daten behalten will, widerruft nur - Ansehen, Exportieren und einzelnes
// Loeschen bleiben dann wie bisher moeglich.
//
// Erst widerrufen, dann loeschen: scheitert das Loeschen, ist wenigstens der
// Widerruf wirksam, und der Knopf "Noch einmal loeschen" bleibt stehen. Andersherum
// waeren die Daten weg, die Einwilligung aber noch erteilt.
type Phase = 'choose' | 'deleteFailed' | 'kept' | 'deleted';

export function HealthDataRevoke({
  definition,
  onClose,
}: {
  definition: ConsentDefinition;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const setConsent = useSetConsent();
  const deleteDiary = useDeleteDiaryData();
  const [phase, setPhase] = useState<Phase>('choose');
  const [revokeFailed, setRevokeFailed] = useState(false);

  const pending = setConsent.isPending || deleteDiary.isPending;

  const revoke = async (alsoDelete: boolean) => {
    setRevokeFailed(false);
    try {
      await setConsent.mutateAsync({ definition, granted: false });
    } catch {
      setRevokeFailed(true);
      return;
    }
    if (!alsoDelete) {
      setPhase('kept');
      return;
    }
    await removeDiary();
  };

  const removeDiary = async () => {
    try {
      await deleteDiary.mutateAsync();
      setPhase('deleted');
    } catch {
      setPhase('deleteFailed');
    }
  };

  if (phase === 'kept' || phase === 'deleted') {
    return (
      <View style={styles.panel}>
        <Text role="status" style={styles.done}>
          {t(phase === 'deleted' ? 'konto.healthRevoke.doneDeleted' : 'konto.healthRevoke.doneKept')}
        </Text>
        <PressableRing onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>{t('konto.healthRevoke.close')}</Text>
        </PressableRing>
      </View>
    );
  }

  if (phase === 'deleteFailed') {
    return (
      <View style={[styles.panel, styles.panelDanger]}>
        <Text role="alert" style={styles.error}>
          {t('errors:konto.diaryDelete')}
        </Text>
        <View style={styles.row}>
          <PressableRing
            disabled={pending}
            onPress={() => void removeDiary()}
            style={[styles.confirm, pending && styles.confirmPending]}
          >
            <Text style={[styles.confirmText, pending && styles.confirmTextPending]}>
              {pending ? t('konto.healthRevoke.pending') : t('konto.healthRevoke.retryDelete')}
            </Text>
          </PressableRing>
          <PressableRing disabled={pending} onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('konto.healthRevoke.close')}</Text>
          </PressableRing>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.panel, styles.panelDanger]}>
      <Text style={styles.title}>{t('konto.healthRevoke.title')}</Text>
      <Text style={styles.body}>{t('konto.healthRevoke.body')}</Text>
      <Text style={styles.body}>{t('konto.healthRevoke.deleteHint')}</Text>

      {revokeFailed ? (
        <Text role="alert" style={styles.error}>
          {t('errors:konto.consent')}
        </Text>
      ) : null}

      <View style={styles.row}>
        <PressableRing
          disabled={pending}
          onPress={() => void revoke(true)}
          style={[styles.confirm, pending && styles.confirmPending]}
        >
          <Text style={[styles.confirmText, pending && styles.confirmTextPending]}>
            {pending ? t('konto.healthRevoke.pending') : t('konto.healthRevoke.revokeAndDelete')}
          </Text>
        </PressableRing>
        <PressableRing disabled={pending} onPress={() => void revoke(false)} style={styles.keep}>
          <Text style={styles.keepText}>{t('konto.healthRevoke.revokeAndKeep')}</Text>
        </PressableRing>
        <PressableRing disabled={pending} onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>{t('konto.healthRevoke.cancel')}</Text>
        </PressableRing>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexBasis: '100%',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
  },
  panelDanger: {
    borderColor: colors.danger,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink900,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink700,
  },
  done: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.sage700,
  },
  error: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.danger,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirm: {
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  // Wie bei der Kontoloeschung: kein opacity, sonst faellt Weiss auf Rot unter 4,5:1.
  confirmPending: {
    backgroundColor: colors.lineStrong,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.surface,
  },
  confirmTextPending: {
    color: colors.ink900,
  },
  keep: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  keepText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
  cancel: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ocean700,
  },
});
