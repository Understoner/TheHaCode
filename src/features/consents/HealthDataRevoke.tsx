import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { PressableRing } from '@/components/PressableRing';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDataExport } from '@/features/auth/DataExport';
import { useSetConsent, type ConsentDefinition } from '@/features/consents/useConsents';
import { useDeleteDiaryData } from '@/features/habits/useDeleteDiaryData';

// Widerruf der Einwilligung health_data (Tagebuch).
//
// Seit 03.11.2026 (Verarbeitungsverzeichnis Abschnitt 7, Punkt 1): Widerruf
// heisst Loeschen. Gesundheitsdaten nach Art. 9 duerfen nur mit Einwilligung
// gespeichert werden - nach dem Widerruf gibt es fuer sie keine
// Rechtsgrundlage mehr (Art. 17 Abs. 1 lit. b DSGVO). Die Wahl "Widerrufen,
// Daten behalten" (31.10.2026) entfaellt deshalb. Wer eine Kopie will, laedt
// sie im selben Dialog vorher herunter (Art. 20).
//
// Erst widerrufen, dann loeschen: scheitert das Loeschen, ist wenigstens der
// Widerruf wirksam, und der Knopf "Noch einmal loeschen" bleibt stehen. Andersherum
// waeren die Daten weg, die Einwilligung aber noch erteilt.
type Phase = 'choose' | 'deleteFailed' | 'deleted';

export function HealthDataRevoke({
  definition,
  onClose,
}: {
  definition: ConsentDefinition;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const setConsent = useSetConsent();
  const deleteDiary = useDeleteDiaryData();
  const [phase, setPhase] = useState<Phase>('choose');
  const [revokeFailed, setRevokeFailed] = useState(false);

  const pending = setConsent.isPending || deleteDiary.isPending;

  const revoke = async () => {
    setRevokeFailed(false);
    try {
      await setConsent.mutateAsync({ definition, granted: false });
    } catch {
      setRevokeFailed(true);
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

  if (phase === 'deleted') {
    return (
      <View style={styles.panel}>
        <Text role="status" style={styles.done}>
          {t('konto.healthRevoke.doneDeleted')}
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

      {session ? <ExportFirst session={session} disabled={pending} /> : null}

      {revokeFailed ? (
        <Text role="alert" style={styles.error}>
          {t('errors:konto.consent')}
        </Text>
      ) : null}

      <View style={styles.row}>
        <PressableRing
          disabled={pending}
          onPress={() => void revoke()}
          style={[styles.confirm, pending && styles.confirmPending]}
        >
          <Text style={[styles.confirmText, pending && styles.confirmTextPending]}>
            {pending ? t('konto.healthRevoke.pending') : t('konto.healthRevoke.revokeAndDelete')}
          </Text>
        </PressableRing>
        <PressableRing disabled={pending} onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>{t('konto.healthRevoke.cancel')}</Text>
        </PressableRing>
      </View>
    </View>
  );
}

/** "Vorher herunterladen" - dieselbe Datei wie unter "Deine Daten". */
function ExportFirst({ session, disabled }: { session: Session; disabled: boolean }) {
  const { t } = useTranslation();
  const { run, pending, error } = useDataExport(session);

  return (
    <View style={styles.exportBox}>
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <PressableRing disabled={disabled || pending} onPress={() => void run()} style={styles.keep}>
        <Text style={styles.keepText}>
          {pending ? t('konto.export.pending') : t('konto.healthRevoke.exportFirst')}
        </Text>
      </PressableRing>
    </View>
  );
}

const styles = StyleSheet.create({
  exportBox: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
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
