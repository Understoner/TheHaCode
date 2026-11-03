import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

// Datenzugriff fuer Onlinekurse (V1.2, Migrationen 0042/0043).
//
// Was jemand sehen darf, entscheidet RLS mit can_open_course() - nicht diese
// Datei. Gliederung und Kursdaten sind fuer alle lesbar, der Inhalt eines
// Blocks nur mit Zugang: kommt er nicht zurueck, ist der Kurs fuer diese
// Person gesperrt, und genau so wird es angezeigt.

export type OnlineCourse = Database['public']['Tables']['online_courses']['Row'];
export type OnlineBlock = Database['public']['Tables']['online_course_blocks']['Row'];
export type OnlineBlockContent = Database['public']['Tables']['online_course_block_contents']['Row'];
export type CourseAccessRow = Database['public']['Tables']['course_access']['Row'];

const MEDIA_BUCKET = 'course-media';
/** Gueltigkeit einer signierten Medienadresse. Laenger als die laengste Aufnahme. */
const SIGNED_URL_SECONDS = 60 * 60 * 2;

export function useOnlineCourses() {
  return useQuery({
    queryKey: ['online-courses'],
    queryFn: async (): Promise<OnlineCourse[]> => {
      const { data, error } = await supabase
        .from('online_courses')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type CourseWithBlocks = { course: OnlineCourse; blocks: OnlineBlock[] };

export function useOnlineCourse(slug: string | undefined) {
  return useQuery({
    queryKey: ['online-course', slug],
    enabled: Boolean(slug),
    queryFn: async (): Promise<CourseWithBlocks | null> => {
      const { data: course, error } = await supabase
        .from('online_courses')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      if (!course) return null;

      const { data: blocks, error: blockError } = await supabase
        .from('online_course_blocks')
        .select('*')
        .eq('course_id', course.id)
        .order('day_offset', { ascending: true })
        .order('sort_order', { ascending: true });
      if (blockError) throw blockError;

      return { course, blocks: blocks ?? [] };
    },
  });
}

/** Darf die angemeldete (oder anonyme) Person den Kurs oeffnen? Antwort der Datenbank. */
export function useCanOpenCourse(courseId: string | undefined) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ['online-course-open', courseId, userId],
    enabled: Boolean(courseId) && !loading,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('can_open_course', { p_course_id: courseId! });
      if (error) throw error;
      return data === true;
    },
  });
}

/** Inhalt eines Blocks; null heisst: kein Zugang (RLS) oder noch kein Inhalt. */
export function useBlockContent(blockId: string | undefined, enabled = true) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ['online-block-content', blockId, userId],
    enabled: Boolean(blockId) && enabled,
    queryFn: async (): Promise<OnlineBlockContent | null> => {
      const { data, error } = await supabase
        .from('online_course_block_contents')
        .select('*')
        .eq('block_id', blockId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Signierte Adresse fuer eine Datei im privaten Bucket. Stellt Supabase nur
 * aus, wenn die Storage-Policy (can_open_course_media) es erlaubt.
 */
export function useMediaUrl(path: string | null | undefined, download?: string) {
  return useQuery({
    queryKey: ['online-media-url', path, download ?? null],
    enabled: Boolean(path),
    // Kurz vor Ablauf neu holen, nicht erst danach.
    staleTime: (SIGNED_URL_SECONDS - 300) * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(path!, SIGNED_URL_SECONDS, download ? { download } : undefined);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Erledigte Bloecke eines Kurses fuer die angemeldete Person. Ohne Konto: leer. */
export function useCourseProgress(courseId: string | undefined) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ['online-course-progress', courseId, userId],
    enabled: Boolean(courseId) && !loading,
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set();
      const { data, error } = await supabase
        .from('course_progress')
        .select('block_id')
        .eq('course_id', courseId!)
        .is('deleted_at', null);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.block_id));
    },
  });
}

/** Einen Block erledigen oder den Haken zuruecknehmen. */
export function useMarkBlock(courseId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  return useMutation({
    mutationFn: async ({ blockId, done }: { blockId: string; done: boolean }) => {
      if (!userId) throw new Error('login_required');
      if (done) {
        // course_id setzt der Trigger aus dem Block (0043); upsert, damit ein
        // zweites Ende derselben Aufnahme keinen Fehler wirft.
        const { error } = await supabase
          .from('course_progress')
          .upsert(
            { user_id: userId, course_id: courseId, block_id: blockId },
            { onConflict: 'user_id,block_id', ignoreDuplicates: true },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_progress').delete().eq('block_id', blockId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['online-course-progress', courseId] });
      void queryClient.invalidateQueries({ queryKey: ['online-plan', 'agenda'] });
    },
  });
}

/** Eigene Kaeufe eines Kurses (RLS: nur die eigenen). */
export function useCourseAccess(courseId: string | undefined) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ['online-course-access', courseId, userId],
    enabled: Boolean(courseId) && !loading && userId !== null,
    queryFn: async (): Promise<CourseAccessRow[]> => {
      const { data, error } = await supabase
        .from('course_access')
        .select('*')
        .eq('course_id', courseId!)
        .order('expires_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Plus fuer die Preisankuendigung: usePlusAccess() aus dem Konfigurator
// (has_plus_access(), CLAUDE.md §Zugriff) - kein zweiter Hook dafuer.

/** Kaufen: zu Stripe wechseln. Preis, Rabatt und Laufzeit entscheidet der Server. */
export function useOnlineCourseCheckout() {
  return useMutation({
    mutationFn: async (courseSlug: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        'create-online-course-checkout',
        { method: 'POST', body: { courseSlug } },
      );
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error ?? 'unknown');
      return data.url;
    },
  });
}

// ---------------------------------------------------------------------------
// Einplanen im Tagebuch (Schritt 6, Migration 0044)
// ---------------------------------------------------------------------------

export type PlanSlot = Database['public']['Tables']['course_plan_slots']['Row'];
export type AgendaSlot = PlanSlot & {
  online_course_blocks: { title: string; kind: OnlineBlock['kind'] } | null;
  online_courses: { slug: string; title: string } | null;
  /** Der Block ist schon erledigt (course_progress). */
  done: boolean;
};

/** Geplante Termine eines Kurses (nur die eigenen, RLS). */
export function usePlanSlots(courseId: string | undefined) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ['online-plan', courseId, userId],
    enabled: Boolean(courseId) && !loading,
    queryFn: async (): Promise<Map<string, PlanSlot>> => {
      if (!userId) return new Map();
      const { data, error } = await supabase
        .from('course_plan_slots')
        .select('*')
        .eq('course_id', courseId!)
        .is('deleted_at', null);
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.block_id, row]));
    },
  });
}

/** Alle eigenen Kurstermine in einem Zeitraum, fuer das Tagebuch. */
export function useAgenda(from: string, to: string) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ['online-plan', 'agenda', from, to, userId],
    enabled: !loading && userId !== null,
    queryFn: async (): Promise<AgendaSlot[]> => {
      const { data, error } = await supabase
        .from('course_plan_slots')
        .select('*, online_course_blocks(title, kind), online_courses(slug, title)')
        .gte('planned_on', from)
        .lte('planned_on', to)
        .is('deleted_at', null)
        .order('planned_on', { ascending: true });
      if (error) throw error;
      const slots = (data ?? []) as unknown as Omit<AgendaSlot, 'done'>[];
      if (slots.length === 0) return [];

      const { data: progress, error: progressError } = await supabase
        .from('course_progress')
        .select('block_id')
        .in('block_id', slots.map((s) => s.block_id))
        .is('deleted_at', null);
      if (progressError) throw progressError;
      const done = new Set((progress ?? []).map((p) => p.block_id));
      return slots.map((s) => ({ ...s, done: done.has(s.block_id) }));
    },
  });
}

/** Termine setzen oder verschieben (einer je Block). */
export function useSavePlan(courseId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  return useMutation({
    mutationFn: async (slots: { blockId: string; plannedOn: string; dayPart: string | null }[]) => {
      if (!userId) throw new Error('login_required');
      if (slots.length === 0) return;
      // course_id setzt der Trigger aus dem Block (0044).
      const { error } = await supabase.from('course_plan_slots').upsert(
        slots.map((s) => ({
          user_id: userId,
          course_id: courseId,
          block_id: s.blockId,
          planned_on: s.plannedOn,
          day_part: s.dayPart,
        })),
        { onConflict: 'user_id,block_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['online-plan'] });
    },
  });
}

/** Einen Termin wieder austragen. */
export function useRemovePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase.from('course_plan_slots').delete().eq('block_id', blockId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['online-plan'] });
    },
  });
}
