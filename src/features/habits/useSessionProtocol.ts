import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

import { today } from './dates';

/**
 * Das Session-Protokoll (SAD §3.6, Migration 0021): der Player meldet Start
 * und Abschluss, mehr nicht.
 *
 * Bewusst getrennt von der Breathing Engine. Der Player ruft begin() und
 * complete() an zwei Stellen auf, die es ohnehin gibt (Start und Ende); an
 * der Uhr, der Zeitleiste und den Toenen aendert sich nichts.
 *
 * Fehler sind hier still: ein Protokolleintrag, der nicht geschrieben wird,
 * darf eine laufende Atemuebung nicht stoeren. Sichtbar wird er nur als
 * fehlende Minute in der Statistik.
 *
 * Und nach dem Abschluss: haengt ein gewaehltes Habit vom Typ "erledigt" an
 * genau dieser Sequenz ("Atmen zum Einschlafen" an "Sinkflug"), wird es fuer
 * heute eingetragen. Ohne Einwilligung oder ohne Plus lehnt die Datenbank ab -
 * dann bleibt es beim Protokoll, und autoLogged bleibt false.
 */
export function useSessionProtocol(exerciseId: string) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  // Die Zeile des laufenden Durchgangs. null = kein offener Durchgang.
  const openRef = useRef<Promise<string | null> | null>(null);
  const [autoLogged, setAutoLogged] = useState(false);

  /** Ein neuer Durchgang beginnt. Ein zweiter Aufruf ohne Abschluss tut nichts. */
  const begin = useCallback(() => {
    if (!userId || openRef.current) return;
    setAutoLogged(false);
    openRef.current = (async () => {
      const { data, error } = await supabase
        .from('exercise_sessions')
        .insert({ user_id: userId, exercise_id: exerciseId })
        .select('id')
        .single();
      return error ? null : data.id;
    })();
  }, [userId, exerciseId]);

  /** Der Durchgang wurde abgebrochen (Von vorn): die Zeile bleibt unvollendet stehen. */
  const abandon = useCallback(() => {
    openRef.current = null;
  }, []);

  const complete = useCallback(
    (durationMs: number) => {
      const pending = openRef.current;
      openRef.current = null;
      if (!userId || !pending) return;

      void (async () => {
        const id = await pending;
        if (id) {
          await supabase
            .from('exercise_sessions')
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
              duration_seconds: Math.round(durationMs / 1000),
            })
            .eq('user_id', userId)
            .eq('id', id);
          void queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
        }

        const habits = await supabase
          .from('user_habits')
          .select('id, habit_templates!inner(exercise_id, tracking_type)')
          .eq('user_id', userId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('habit_templates.exercise_id', exerciseId)
          .eq('habit_templates.tracking_type', 'done');
        if (habits.error || !habits.data?.length) return;

        const { error } = await supabase.from('habit_logs').upsert(
          habits.data.map((h) => ({
            user_id: userId,
            user_habit_id: h.id,
            log_date: today(),
            value_numeric: 1,
          })),
          { onConflict: 'user_habit_id,log_date' },
        );
        if (!error) {
          setAutoLogged(true);
          void queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
        }
      })();
    },
    [userId, exerciseId, queryClient],
  );

  return { begin, abandon, complete, autoLogged };
}
