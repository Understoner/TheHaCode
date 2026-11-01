import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import type { IsoDate } from '@/features/habits/dates';
import type { HabitTemplate, UserHabit } from '@/features/habits/useHabits';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type { ChallengePlan, PlannedSlot } from './plan';

type Tables = Database['public']['Tables'];
export type ChallengeTemplateRow = Tables['challenge_templates']['Row'];
export type ChallengeTemplateItemRow = Tables['challenge_template_items']['Row'];
export type ChallengeRow = Tables['challenges']['Row'];
export type ChallengeItemRow = Tables['challenge_items']['Row'];
export type ChallengeSlotRow = Tables['challenge_slots']['Row'];

export type ChallengeTemplate = ChallengeTemplateRow & {
  challenge_template_items: (ChallengeTemplateItemRow & {
    habit_templates: HabitTemplate | null;
  })[];
};

export type ChallengeItem = ChallengeItemRow & {
  user_habits: (UserHabit & { habit_templates: HabitTemplate | null }) | null;
};

export type Challenge = ChallengeRow & {
  challenge_items: ChallengeItem[];
  challenge_slots: ChallengeSlotRow[];
};

// Jede Abfrage auf eine Nutzertabelle traegt ihren user_id-Bezug selbst, auch
// wenn RLS ohnehin nur die eigenen Zeilen herausgibt (CLAUDE.md §Verboten).

/**
 * Vorlagen der Redaktion samt ihren Habits. Ein Habit, das die Redaktion
 * zurueckgezogen hat, liefert RLS nicht mit - es faellt aus der Vorlage.
 */
export function useChallengeTemplates() {
  const { loading } = useAuth();

  return useQuery({
    queryKey: ['challenge-templates'],
    enabled: !loading,
    queryFn: async (): Promise<ChallengeTemplate[]> => {
      const { data, error } = await supabase
        .from('challenge_templates')
        .select('*, challenge_template_items(*, habit_templates(*))')
        .order('sort_order')
        .order('title');
      if (error) throw error;
      return ((data ?? []) as ChallengeTemplate[]).map((t) => ({
        ...t,
        challenge_template_items: [...t.challenge_template_items]
          .filter((i) => i.habit_templates !== null)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Alle eigenen Challenges, neueste zuerst, mit Habits und Terminen. */
export function useMyChallenges() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['challenges', userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<Challenge[]> => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*, challenge_items(*, user_habits(*, habit_templates(*))), challenge_slots(*)')
        .eq('user_id', userId!)
        .is('deleted_at', null)
        .order('starts_on', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Challenge[]).map((c) => ({
        ...c,
        challenge_items: [...c.challenge_items].sort((a, b) => a.sort_order - b.sort_order),
        challenge_slots: [...c.challenge_slots].sort((a, b) => (a.due_on < b.due_on ? -1 : 1)),
      }));
    },
  });
}

export type SaveChallengeInput = {
  id?: string;
  templateId?: string | null;
  title: string;
  description: string | null;
  startsOn: IsoDate;
  endsOn: IsoDate;
  items: {
    habitTemplateId: string;
    plan: ChallengePlan;
    slots: PlannedSlot[];
  }[];
};

/**
 * Anlegen oder den kuenftigen Plan aendern, in einem Rutsch ueber
 * save_challenge_plan() (0036). Die Datenbank waehlt die Habits dabei ins
 * Tagebuch und laesst vergangene Termine stehen.
 */
export function useSaveChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveChallengeInput): Promise<string> => {
      const { data, error } = await supabase.rpc('save_challenge_plan', {
        p_challenge: {
          id: input.id ?? null,
          template_id: input.templateId ?? null,
          title: input.title,
          description: input.description,
          starts_on: input.startsOn,
          ends_on: input.endsOn,
        },
        p_items: input.items.map((item) => ({
          habit_template_id: item.habitTemplateId,
          plan: item.plan,
          slots: item.slots.map((s) => ({
            starts_on: s.startsOn,
            due_on: s.dueOn,
          })),
        })),
      });
      if (error) throw error;
      return data as string;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
      void queryClient.invalidateQueries({ queryKey: ['my-habits'] });
    },
  });
}

/** Abbrechen geht immer; die Datenbank raeumt dabei die kuenftigen Termine ab. */
export function useCancelChallenge() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('unauthorized');
      const { error } = await supabase
        .from('challenges')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}

/**
 * Eine Challenge ganz loeschen - geht immer, auch nach Abo-Ende. Die
 * Tagebuch-Eintraege bleiben; sie gehoeren dem Tagebuch, nicht der Challenge.
 */
export function useDeleteChallenge() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('unauthorized');
      const { error } = await supabase.from('challenges').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}

type MaybePgError = { code?: string; message?: string } | null | undefined;

/** Was die Datenbank beim Planen ablehnt, als Satz mit Handlungsoption. */
export function challengeErrorKey(error: unknown): string {
  const code = (error as MaybePgError)?.code;
  const message = (error as MaybePgError)?.message ?? '';
  if (code === '42501') return 'errors:challenges.forbidden';
  if (code === '23514' && message.includes('Vergangen')) return 'errors:challenges.past';
  if (code === '23514' && message.includes('beginnt')) return 'errors:challenges.startPast';
  if (code === '23514') return 'errors:challenges.range';
  return 'errors:challenges.save';
}
