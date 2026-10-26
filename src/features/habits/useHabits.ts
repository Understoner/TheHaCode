import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileFlag } from '@/features/settings/useProfileFlag';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import { addDays, today as heute, type IsoDate } from './dates';

type Tables = Database['public']['Tables'];
export type HabitCategory = Tables['habit_categories']['Row'];
export type HabitTemplate = Tables['habit_templates']['Row'];
export type UserHabit = Tables['user_habits']['Row'];
export type HabitLog = Tables['habit_logs']['Row'];
export type ExerciseSession = Tables['exercise_sessions']['Row'];
export type HabitFavorite = Tables['habit_favorites']['Row'];

export type MyHabit = UserHabit & { habit_templates: HabitTemplate };

// Jede Abfrage auf eine Nutzertabelle traegt ihren user_id-Bezug selbst, auch
// wenn RLS ohnehin nur die eigenen Zeilen herausgibt (CLAUDE.md §Verboten).
// Zwei Schloesser - faellt eines still aus, haelt das andere.

/**
 * Kategorien und Vorlagen. Welche veroeffentlicht sind, sagt RLS - und auch,
 * dass von den eigenen Habits (0024) nur die der angemeldeten Person
 * mitkommen. Deshalb haengt der Schluessel an der Person: nach einem
 * Kontowechsel duerfen nicht die eigenen Habits des vorigen Kontos stehen.
 * Geloeschte eigene Habits fehlen hier; ihre Eintraege findet useMyHabits.
 */
export function useHabitCatalog() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['habit-catalog', userId],
    enabled: !loading,
    queryFn: async (): Promise<{ categories: HabitCategory[]; templates: HabitTemplate[] }> => {
      const [categories, templates] = await Promise.all([
        supabase.from('habit_categories').select('*').order('sort_order'),
        supabase
          .from('habit_templates')
          .select('*')
          .is('deleted_at', null)
          .order('sort_order')
          .order('title'),
      ]);
      if (categories.error) throw categories.error;
      if (templates.error) throw templates.error;
      return { categories: categories.data ?? [], templates: templates.data ?? [] };
    },
    // Redaktionsdaten aendern sich selten.
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Alle eigenen Habits, auch archivierte: deren Eintraege zaehlen weiter im
 * Score und in den Auswertungen der Vergangenheit. Was heute im Tagebuch
 * steht, filtert die Oberflaeche ueber is_active.
 */
export function useMyHabits() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['my-habits', userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<MyHabit[]> => {
      const { data, error } = await supabase
        .from('user_habits')
        .select('*, habit_templates(*)')
        .eq('user_id', userId!)
        .is('deleted_at', null)
        .order('sort_order');
      if (error) throw error;
      // Eine Vorlage, die die Redaktion zurueckgezogen hat, liefert RLS nicht
      // mehr mit - das Habit bleibt in der Datenbank, verschwindet aber aus
      // der Liste, bis es wieder veroeffentlicht ist.
      return ((data ?? []) as MyHabit[]).filter((h) => h.habit_templates !== null);
    },
  });
}

/** Eintraege in einem Zeitraum, beide Grenzen eingeschlossen. */
export function useHabitLogs(from: IsoDate, to: IsoDate) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['habit-logs', userId, from, to],
    enabled: !loading && userId !== null,
    // Beim Blaettern im Monat bleibt das Bisherige stehen, bis das Neue da
    // ist - sonst fiele die ganze Seite kurz auf das Skelett zurueck.
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<HabitLog[]> => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', userId!)
        .gte('log_date', from)
        .lte('log_date', to)
        .is('deleted_at', null)
        .order('log_date');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMySessions(sinceDays = 8 * 7) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const since = addDays(heute(), -sinceDays);

  return useQuery({
    queryKey: ['my-sessions', userId, since],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<ExerciseSession[]> => {
      const { data, error } = await supabase
        .from('exercise_sessions')
        .select('*')
        .eq('user_id', userId!)
        .gte('started_at', `${since}T00:00:00`)
        .is('deleted_at', null)
        .order('started_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Ein Habit ins Tagebuch aufnehmen oder wieder herausnehmen. */
export function useChooseHabit() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      chosen,
      sortOrder,
    }: {
      templateId: string;
      chosen: boolean;
      sortOrder?: number;
    }): Promise<void> => {
      if (!userId) throw new Error('unauthorized');

      if (chosen) {
        // Wer ein Habit wieder aufnimmt, soll seine alten Eintraege
        // wiederfinden: die haengen am alten user_habit. Deshalb zuerst
        // reaktivieren, erst wenn es keines gibt, neu anlegen.
        const revived = await supabase
          .from('user_habits')
          .update({ is_active: true, archived_at: null })
          .eq('user_id', userId)
          .eq('template_id', templateId)
          .eq('is_active', false)
          .is('deleted_at', null)
          .select('id');
        if (revived.error) throw revived.error;
        if ((revived.data ?? []).length > 0) return;

        const { error } = await supabase
          .from('user_habits')
          .insert({ user_id: userId, template_id: templateId, sort_order: sortOrder ?? 0 });
        // 23505: schon gewaehlt (zweites Fenster, Doppelklick). Der
        // gewuenschte Zustand ist damit hergestellt.
        if (error && error.code !== '23505') throw error;
        return;
      }

      // Herausnehmen heisst archivieren, nicht loeschen: die Eintraege haengen
      // per cascade am Habit und blieben sonst nicht erhalten.
      const { error } = await supabase
        .from('user_habits')
        .update({ is_active: false, archived_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('template_id', templateId)
        .eq('is_active', true);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-habits'] });
    },
  });
}

export type LogInput = {
  userHabitId: string;
  date: IsoDate;
  valueNumeric?: number | null;
  valueText?: string | null;
  note?: string | null;
};

/**
 * Eintragen und Korrigieren in einem: ein Eintrag je Habit und Tag (unique in
 * 0021), also upsert.
 *
 * Optimistisch, wie SAD §6 es fuer das Tagebuch verlangt: der Haken steht
 * sofort. Lehnt die Datenbank ab (keine Einwilligung, kein Plus), wird er
 * zurueckgenommen und der Fehler geht an die Oberflaeche.
 */
export function useSaveLog() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogInput): Promise<void> => {
      if (!userId) throw new Error('unauthorized');
      const { error } = await supabase.from('habit_logs').upsert(
        {
          user_id: userId,
          user_habit_id: input.userHabitId,
          log_date: input.date,
          value_numeric: input.valueNumeric ?? null,
          value_text: input.valueText ?? null,
          note: input.note ?? null,
          deleted_at: null,
        },
        { onConflict: 'user_habit_id,log_date' },
      );
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['habit-logs', userId] });
      const before = queryClient.getQueriesData<HabitLog[]>({ queryKey: ['habit-logs', userId] });
      const now = new Date().toISOString();

      for (const [key, logs] of before) {
        if (!logs) continue;
        const [, , from, to] = key as [string, string, IsoDate, IsoDate];
        if (input.date < from || input.date > to) continue;
        const without = logs.filter(
          (l) => !(l.user_habit_id === input.userHabitId && l.log_date === input.date),
        );
        const optimistic: HabitLog = {
          id: `optimistic-${input.userHabitId}-${input.date}`,
          user_id: userId!,
          user_habit_id: input.userHabitId,
          log_date: input.date,
          value_numeric: input.valueNumeric ?? 1,
          value_text: input.valueText ?? null,
          note: input.note ?? null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          client_id: null,
        };
        queryClient.setQueryData<HabitLog[]>(key, [...without, optimistic]);
      }
      return { before };
    },
    onError: (_error, _input, context) => {
      for (const [key, logs] of context?.before ?? []) queryClient.setQueryData(key, logs);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
    },
  });
}

/** Einen Eintrag entfernen - geht immer, auch nach Widerruf oder Abo-Ende. */
export function useDeleteLog() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userHabitId, date }: { userHabitId: string; date: IsoDate }) => {
      if (!userId) throw new Error('unauthorized');
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('user_id', userId)
        .eq('user_habit_id', userHabitId)
        .eq('log_date', date);
      if (error) throw error;
    },
    onMutate: async ({ userHabitId, date }) => {
      await queryClient.cancelQueries({ queryKey: ['habit-logs', userId] });
      const before = queryClient.getQueriesData<HabitLog[]>({ queryKey: ['habit-logs', userId] });
      for (const [key, logs] of before) {
        if (!logs) continue;
        queryClient.setQueryData<HabitLog[]>(
          key,
          logs.filter((l) => !(l.user_habit_id === userHabitId && l.log_date === date)),
        );
      }
      return { before };
    },
    onError: (_error, _input, context) => {
      for (const [key, logs] of context?.before ?? []) queryClient.setQueryData(key, logs);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
    },
  });
}

/** Der Tagebuch-Score an oder aus - in profiles, geraeteuebergreifend. */
export function useHabitScoreEnabled() {
  const { value, setValue } = useProfileFlag('habit_score_enabled', false);
  return { scoreOn: value, setScoreOn: setValue };
}

/** Die Vorlagen, die sich die Person als Favorit gemerkt hat. */
export function useHabitFavorites() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['habit-favorites', userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('habit_favorites')
        .select('template_id')
        .eq('user_id', userId!)
        .is('deleted_at', null);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.template_id));
    },
  });
}

/** Stern an oder aus. Optimistisch: der Stern reagiert sofort. */
export function useToggleHabitFavorite() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const key = ['habit-favorites', userId];

  return useMutation({
    mutationFn: async ({ templateId, favorite }: { templateId: string; favorite: boolean }) => {
      if (!userId) throw new Error('unauthorized');
      if (favorite) {
        const { error } = await supabase
          .from('habit_favorites')
          .insert({ user_id: userId, template_id: templateId });
        // 23505: schon Favorit - der gewuenschte Zustand besteht.
        if (error && error.code !== '23505') throw error;
        return;
      }
      const { error } = await supabase
        .from('habit_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('template_id', templateId);
      if (error) throw error;
    },
    onMutate: async ({ templateId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<Set<string>>(key);
      const next = new Set(before ?? []);
      if (favorite) next.add(templateId);
      else next.delete(templateId);
      queryClient.setQueryData(key, next);
      return { before };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.before);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export type OwnHabitInput = {
  categoryId: string;
  title: string;
  description: string | null;
  trackingType: 'done' | 'number';
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  /** 0 bis 10 je Erledigung (0026). */
  points: number;
  /** Zieht die Punkte ab, statt sie zu bringen (0028). */
  isNegative: boolean;
};

/**
 * Ein eigenes Habit anlegen (ohne id) oder aendern (mit id). Vorschau und
 * Slug setzt die Datenbank (0024); Punkte waehlt die Person, 0 bis 10, die
 * Datenbank prueft die Grenze (0026). Die Art des Eintrags ist nach dem
 * Anlegen fest.
 */
export function useSaveOwnHabit() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: OwnHabitInput }): Promise<string> => {
      if (!userId) throw new Error('unauthorized');
      const values = {
        category_id: input.categoryId,
        title: input.title,
        description_md: input.description,
        unit: input.trackingType === 'number' ? input.unit : null,
        min_value: input.trackingType === 'number' ? input.minValue : null,
        max_value: input.trackingType === 'number' ? input.maxValue : null,
        step_value: input.trackingType === 'number' ? 1 : null,
        points: input.points,
        is_negative: input.isNegative,
      };

      if (id) {
        const { error } = await supabase
          .from('habit_templates')
          .update(values)
          .eq('id', id)
          .eq('owner_id', userId);
        if (error) throw error;
        return id;
      }

      const { data, error } = await supabase
        .from('habit_templates')
        .insert({ ...values, owner_id: userId, tracking_type: input.trackingType })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['habit-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['my-habits'] });
    },
  });
}

/**
 * Ein eigenes Habit loeschen. Geht immer, auch ohne Abo. Die Datenbank nimmt
 * es dabei aus dem Tagebuch; die Eintraege bleiben in den Auswertungen.
 */
export function useDeleteOwnHabit() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('unauthorized');
      const { error } = await supabase
        .from('habit_templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', userId);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['habit-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['my-habits'] });
      void queryClient.invalidateQueries({ queryKey: ['habit-favorites'] });
    },
  });
}
