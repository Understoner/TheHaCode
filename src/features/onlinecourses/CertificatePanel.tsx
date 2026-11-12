import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { withFunctionErrorCode } from '@/lib/functionError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

// Zertifikat eines Onlinekurses (V1.2, Schritt 8, Migration 0046).
//
// Ausgestellt wird nur ueber issue_certificate(): die Datenbank prueft, dass
// alle Inhalte erledigt sind und das Quiz bestanden ist. Diese Ansicht zeigt
// nur die Checkliste dazu und den Knopf. Die PDF erzeugt die Edge Function
// certificate-pdf aus der eigenen Zeile.

type Certificate = Database['public']['Tables']['certificates']['Row'];

function useCertificate(courseId: string) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ['online-certificate', courseId, userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<Certificate | null> => {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('course_id', courseId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Die PDF holen und im Browser speichern. Nur im Web (statischer Export, SAD §0). */
async function downloadPdf(courseId: string, code: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<Blob>('certificate-pdf', {
    method: 'POST',
    body: { courseId },
  });
  // Der Code der Absage steckt in der Antwort, nicht in error.message.
  if (error) throw await withFunctionErrorCode(error);
  if (!(data instanceof Blob) || Platform.OS !== 'web') throw new Error('no_pdf');
  const href = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = href;
  a.download = `zertifikat-${code}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export function CertificatePanel({
  courseId,
  contentDone,
  contentTotal,
  quizPassed,
  defaultName,
}: {
  courseId: string;
  contentDone: number;
  contentTotal: number;
  quizPassed: boolean;
  defaultName: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cert = useCertificate(courseId);
  const [name, setName] = useState(defaultName);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const ready = contentTotal > 0 && contentDone === contentTotal && quizPassed;

  const issue = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('issue_certificate', { p_course_id: courseId, p_full_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setAsking(false);
      void queryClient.invalidateQueries({ queryKey: ['online-certificate', courseId] });
    },
  });
  const download = useMutation({ mutationFn: (code: string) => downloadPdf(courseId, code) });

  if (cert.data) {
    const c = cert.data;
    const verifyPath = `/zertifikat/${c.code}`;
    const verifyUrl = typeof window !== 'undefined' ? `${window.location.origin}${verifyPath}` : verifyPath;
    return (
      <View style={styles.box}>
        <Text style={styles.kicker}>{t('onlineCourses.cert.title')}</Text>
        <Text style={styles.text}>
          {t('onlineCourses.cert.issued', {
            name: c.full_name,
            date: new Date(c.issued_at).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' }),
          })}
        </Text>
        <Button
          label={download.isPending ? t('onlineCourses.cert.preparing') : t('onlineCourses.cert.download')}
          disabled={download.isPending}
          block
          onPress={() => download.mutate(c.code)}
        />
        {download.isError ? (
          <Text style={styles.error}>
            {t(
              // Der Name enthaelt Zeichen, die die PDF nicht setzen kann
              // (Review S5). Noch einmal versuchen hilft dann nicht.
              download.error instanceof Error && download.error.message === 'name_not_printable'
                ? 'onlineCourses.cert.nameNotPrintable'
                : 'onlineCourses.cert.downloadFailed',
            )}
          </Text>
        ) : null}
        <PressableRing
          style={styles.copy}
          onPress={() => {
            void navigator.clipboard?.writeText(verifyUrl).then(() => setCopied(true));
          }}
        >
          <Text style={styles.copyText}>{copied ? t('onlineCourses.cert.copied') : t('onlineCourses.cert.copyLink')}</Text>
        </PressableRing>
        <Text style={styles.hint}>{t('onlineCourses.cert.codeHint', { code: c.code })}</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>{t('onlineCourses.cert.title')}</Text>
      <Check done={contentDone === contentTotal && contentTotal > 0} label={t('onlineCourses.cert.allContent', { done: contentDone, total: contentTotal })} />
      <Check done={quizPassed} label={t('onlineCourses.cert.quiz')} />
      {asking ? (
        <View style={styles.form}>
          <TextField
            label={t('onlineCourses.cert.nameLabel')}
            value={name}
            onChangeText={setName}
            onBlur={() => setName((n) => n.trim())}
            autoComplete="name"
          />
          <Text style={styles.hint}>{t('onlineCourses.cert.nameHint')}</Text>
          <Button
            label={issue.isPending ? t('onlineCourses.cert.issuing') : t('onlineCourses.cert.issue')}
            disabled={issue.isPending || name.trim().length < 2}
            block
            onPress={() => issue.mutate()}
          />
          {issue.isError ? <Text style={styles.error}>{t('onlineCourses.cert.issueFailed')}</Text> : null}
        </View>
      ) : (
        <Button label={t('onlineCourses.cert.issue')} disabled={!ready} block onPress={() => setAsking(true)} />
      )}
    </View>
  );
}

function Check({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={styles.check}>
      <View style={[styles.mark, done && styles.markDone]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md, marginTop: spacing.sm },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.ocean700 },
  text: { fontSize: 14, lineHeight: 21, color: colors.ink700, flexShrink: 1 },
  hint: { fontSize: 13, lineHeight: 19, color: colors.ink700 },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.lineStrong },
  markDone: { backgroundColor: colors.sage700, borderColor: colors.sage700 },
  form: { gap: spacing.sm },
  copy: { paddingVertical: 6 },
  copyText: { fontSize: 14, fontWeight: '600', color: colors.ocean700 },
  error: { fontSize: 14, color: colors.danger },
});
