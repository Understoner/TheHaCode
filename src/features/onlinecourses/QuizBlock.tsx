import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PressableRing } from '@/components/PressableRing';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StateMessage } from '@/components/StateMessage';
import { displayFont } from '@/design/responsive';
import { colors, radius, spacing } from '@/design/tokens';
import { supabase } from '@/lib/supabase';

// Das Wissensquiz eines Onlinekurses (V1.2, Schritt 7, Migration 0045).
//
// Erst alle Fragen beantworten, dann abgeben. Die Loesung kennt nur der
// Server (submit_quiz); er gibt sie mit der Erklaerung erst NACH der Abgabe
// zurueck. Eine Pruefung Frage fuer Frage gibt es deshalb nicht.

type Question = { id: string; sort_order: number; question: string };
type Option = { id: string; question_id: string; sort_order: number; label: string };
type QuizData = { questions: Question[]; options: Map<string, Option[]> };
type QuizResult = {
  score: number;
  total: number;
  percent: number;
  pass_percent: number;
  passed: boolean;
  results: { question_id: string; correct: boolean; correct_option_id: string; explanation: string | null }[];
};

function useQuiz(blockId: string) {
  return useQuery({
    queryKey: ['online-quiz', blockId],
    queryFn: async (): Promise<QuizData> => {
      // Nur die freigegebenen Spalten - is_correct und explanation sind fuer
      // die App nicht lesbar (Spaltenrechte, 0045); select('*') scheitert.
      const { data: questions, error } = await supabase
        .from('online_quiz_questions')
        .select('id, sort_order, question')
        .eq('block_id', blockId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const ids = (questions ?? []).map((q) => q.id);
      const options = new Map<string, Option[]>();
      if (ids.length > 0) {
        const { data: opts, error: optError } = await supabase
          .from('online_quiz_options')
          .select('id, question_id, sort_order, label')
          .in('question_id', ids)
          .order('sort_order', { ascending: true });
        if (optError) throw optError;
        for (const o of opts ?? []) options.set(o.question_id, [...(options.get(o.question_id) ?? []), o]);
      }
      return { questions: questions ?? [], options };
    },
  });
}

export function QuizBlock({
  courseId,
  blockId,
  passPercent,
  passedBefore,
}: {
  courseId: string;
  blockId: string;
  passPercent: number;
  passedBefore: boolean;
}) {
  const { t } = useTranslation();
  const quiz = useQuiz(blockId);
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const submit = useMutation({
    mutationFn: async (): Promise<QuizResult> => {
      const { data, error } = await supabase.rpc('submit_quiz', { p_block_id: blockId, p_answers: answers });
      if (error) throw error;
      return data as unknown as QuizResult;
    },
    onSuccess: (r) => {
      setResult(r);
      void queryClient.invalidateQueries({ queryKey: ['online-course-progress', courseId] });
      void queryClient.invalidateQueries({ queryKey: ['online-plan', 'agenda'] });
    },
  });

  return (
    <QueryBoundary query={quiz}>
      {({ questions, options }) => {
        if (questions.length === 0) {
          return <StateMessage title={t('onlineCourses.quiz.emptyTitle')} body={t('onlineCourses.quiz.emptyHint')} />;
        }
        const need = Math.ceil((questions.length * passPercent) / 100);
        const complete = questions.every((q) => answers[q.id]);
        const byQuestion = new Map(result?.results.map((r) => [r.question_id, r]));

        return (
          <View style={styles.wrap}>
            {passedBefore && !result ? <Text style={styles.passedBefore}>{t('onlineCourses.quiz.passedBefore')}</Text> : null}
            <Text style={styles.intro}>{t('onlineCourses.quiz.intro', { count: questions.length, need })}</Text>

            {questions.map((q, i) => {
              const r = byQuestion.get(q.id);
              return (
                <View key={q.id} style={styles.question}>
                  <Text style={styles.qNumber}>{t('onlineCourses.quiz.number', { index: i + 1, total: questions.length })}</Text>
                  <Text style={styles.qText} {...displayFont}>
                    {q.question}
                  </Text>
                  <View role="radiogroup" aria-label={q.question} style={styles.options}>
                    {(options.get(q.id) ?? []).map((o) => {
                      const chosen = answers[q.id] === o.id;
                      const isRight = r ? o.id === r.correct_option_id : false;
                      const isWrong = r ? chosen && !r.correct : false;
                      return (
                        <PressableRing
                          key={o.id}
                          role="radio"
                          aria-checked={chosen}
                          disabled={Boolean(result)}
                          onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                          style={[styles.option, chosen && styles.optionChosen, isRight && styles.optionRight, isWrong && styles.optionWrong]}
                        >
                          <View style={[styles.dot, chosen && styles.dotChosen]} />
                          <Text style={styles.optionText}>{o.label}</Text>
                        </PressableRing>
                      );
                    })}
                  </View>
                  {r ? (
                    <Text style={[styles.explain, !r.correct && styles.explainWrong]}>
                      <Text style={styles.explainLead}>{r.correct ? t('onlineCourses.quiz.right') : t('onlineCourses.quiz.wrong')} </Text>
                      {r.explanation ?? ''}
                    </Text>
                  ) : null}
                </View>
              );
            })}

            {result ? (
              <View style={styles.result}>
                <Text style={styles.score} {...displayFont}>
                  {result.score}/{result.total}
                </Text>
                <Text style={styles.resultTitle}>{result.passed ? t('onlineCourses.quiz.passed') : t('onlineCourses.quiz.failed')}</Text>
                <Text style={styles.intro}>
                  {result.passed
                    ? t('onlineCourses.quiz.passedHint')
                    : t('onlineCourses.quiz.failedHint', { percent: result.pass_percent })}
                </Text>
                <Button
                  label={t('onlineCourses.quiz.again')}
                  onPress={() => {
                    setResult(null);
                    setAnswers({});
                  }}
                />
              </View>
            ) : (
              <Button
                label={submit.isPending ? t('onlineCourses.quiz.submitting') : t('onlineCourses.quiz.submit')}
                disabled={!complete || submit.isPending}
                onPress={() => submit.mutate()}
              />
            )}
            {!complete && !result ? <Text style={styles.hint}>{t('onlineCourses.quiz.answerAll')}</Text> : null}
            {submit.isError ? <Text style={styles.error}>{t('onlineCourses.quiz.submitFailed')}</Text> : null}
          </View>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  passedBefore: { fontSize: 14, fontWeight: '700', color: colors.sage700 },
  intro: { fontSize: 15, lineHeight: 22, color: colors.ink700 },
  question: { gap: spacing.sm },
  qNumber: { fontSize: 12, fontWeight: '700', color: colors.ink700 },
  qText: { fontSize: 20, lineHeight: 27, color: colors.ink900 },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  optionChosen: { borderColor: colors.ocean700 },
  optionRight: { borderColor: colors.sage700 },
  optionWrong: { borderColor: colors.danger },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.lineStrong },
  dotChosen: { borderColor: colors.ocean700, backgroundColor: colors.ocean700 },
  optionText: { flex: 1, fontSize: 15, color: colors.ink900 },
  explain: { fontSize: 14, lineHeight: 21, color: colors.ink700, borderLeftWidth: 2, borderLeftColor: colors.sage700, paddingLeft: spacing.sm },
  explainWrong: { borderLeftColor: colors.danger },
  explainLead: { fontWeight: '700', color: colors.ink900 },
  result: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  score: { fontSize: 44, color: colors.ocean700 },
  resultTitle: { fontSize: 20, fontWeight: '700', color: colors.ink900 },
  hint: { fontSize: 13, color: colors.ink700 },
  error: { fontSize: 14, color: colors.danger },
});
