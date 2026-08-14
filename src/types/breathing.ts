import type { Database } from '@/types/database';

// Die Engine arbeitet auf genau diesem Baum. Er entsteht aus einer einzigen
// verschachtelten Supabase-Abfrage (siehe features/sessions/useSession.ts) -
// die Typen kommen aus der generierten Datei, damit eine Schemaaenderung hier
// laut scheitert statt still danebenzuliegen (CLAUDE.md: Datenbanktypen
// generieren, nie schreiben).
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type Step = Database['public']['Tables']['exercise_steps']['Row'];
export type Phase = Database['public']['Tables']['exercise_phases']['Row'];

export type PhaseKind = Database['public']['Enums']['phase_kind'];

export type PlayableStep = Step & { exercise_phases: Phase[] };
export type PlayableExercise = Exercise & { exercise_steps: PlayableStep[] };
