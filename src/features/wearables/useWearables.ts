import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import type { IsoDate } from '@/features/habits/dates';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import { WEARABLES_ENABLED } from './flag';
import { syncDue, type WearableProvider } from './series';

// Geraete-Anbindung (0053). Lesen direkt aus den eigenen Zeilen (RLS),
// Verbinden, Abgleichen und Trennen nur ueber die Edge Function "wearables" -
// die Schluessel der Anbieter sieht der Client nie.

export type WearableConnection = Database['public']['Tables']['wearable_connections']['Row'];
export type WearableDailyRow = Database['public']['Tables']['wearable_daily']['Row'];

/** Fehlercodes der Edge Function, fuer errors:wearables.* */
const KNOWN_ERRORS = [
  'consent_required',
  'not_configured',
  'state_invalid',
  'oura_membership',
  'token_expired',
  'denied',
  'garmin_key_invalid',
  'garmin_personal_empty',
  'garmin_personal_failed',
] as const;

export class WearableActionError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Fehlercode -> Uebersetzungsschluessel (CLAUDE.md: deutsch, mit Handlungsoption). */
export function wearableErrorKey(error: unknown): string {
  const code = error instanceof WearableActionError ? error.code : 'failed';
  return (KNOWN_ERRORS as readonly string[]).includes(code) ? `errors:wearables.${code}` : 'errors:wearables.failed';
}

/** Den Fehlercode aus der Antwort lesen - supabase-js liefert sie bei 4xx/5xx nur als Response. */
async function codeOf(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    // 404 ohne JSON: Funktion auf dieser Umgebung ausgeschaltet
    // (Secret WEARABLES_ENABLED fehlt) - nicht die allgemeine Meldung zeigen.
    if ((error.context as Response).status === 404) return 'not_configured';
    try {
      const body = (await (error.context as Response).json()) as { error?: string };
      if (typeof body.error === 'string') return body.error;
    } catch {
      // keine JSON-Antwort
    }
  }
  return 'failed';
}

type Action =
  | { action: 'start'; provider: WearableProvider }
  | { action: 'finish'; code: string; state: string }
  | { action: 'sync' }
  | { action: 'disconnect'; provider: WearableProvider }
  | { action: 'garmin_personal'; apiKey: string };

async function invoke<T>(body: Action): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('wearables', { method: 'POST', body });
  if (error) throw new WearableActionError(await codeOf(error));
  return data as T;
}

export function useWearableConnections() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['wearable-connections', userId],
    enabled: WEARABLES_ENABLED && !loading && userId !== null,
    queryFn: async (): Promise<WearableConnection[]> => {
      const { data, error } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', userId!)
        .is('deleted_at', null)
        .order('provider');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWearableDaily(from: IsoDate, to: IsoDate) {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['wearable-daily', userId, from, to],
    enabled: WEARABLES_ENABLED && !loading && userId !== null,
    queryFn: async (): Promise<WearableDailyRow[]> => {
      const { data, error } = await supabase
        .from('wearable_daily')
        .select('*')
        .eq('user_id', userId!)
        .gte('day', from)
        .lte('day', to)
        .is('deleted_at', null)
        .order('day');
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['wearable-connections', 'wearable-daily', 'habit-logs'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

/** Zum Anbieter wechseln - zurueck kommt die Person auf /habit-tracker/geraete. */
export function useConnectWearable() {
  return useMutation({
    mutationFn: async (provider: WearableProvider) => {
      const { url } = await invoke<{ url: string }>({ action: 'start', provider });
      if (typeof window !== 'undefined') window.location.assign(url);
    },
  });
}

/** Den Code vom Anbieter einloesen - mit der Sitzung dieser Person. */
export function useFinishWearable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { code: string; state: string }) =>
      invoke<{ connected: WearableProvider }>({ action: 'finish', ...input }),
    onSuccess: () => invalidate(),
  });
}

export function useSyncWearables() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => invoke<{ synced: boolean }>({ action: 'sync' }),
    onSettled: () => invalidate(),
  });
}

export function useDisconnectWearable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (provider: WearableProvider) => invoke<{ disconnected: WearableProvider }>({ action: 'disconnect', provider }),
    onSuccess: () => invalidate(),
  });
}

/**
 * Die letzten 30 Tage mit dem persoenlichen Garmin-Schluessel laden (Test und
 * erster Import). Der Schluessel geht nur an die Edge Function und wird dort
 * nicht gespeichert; im Client liegt er nur im Eingabefeld.
 */
export function useGarminPersonalImport() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (apiKey: string) =>
      invoke<{ imported: Record<string, number> }>({ action: 'garmin_personal', apiKey }),
    onSettled: () => invalidate(),
  });
}

/**
 * Oura von selbst abgleichen, wenn das Tagebuch oder die Auswertung offen
 * ist und der letzte Abgleich laenger als drei Stunden her ist - einmal je
 * Seitenaufruf, still. Garmin liefert ohnehin selbst.
 */
export function useWearableAutoSync() {
  const connections = useWearableConnections();
  const sync = useSyncWearables();
  const started = useRef(false);

  const oura = connections.data?.find((c) => c.provider === 'oura');
  const due = oura ? syncDue(oura.last_synced_at, new Date()) : false;

  useEffect(() => {
    if (!due || started.current) return;
    started.current = true;
    sync.mutate();
    // sync ist stabil genug; nur beim ersten Faelligwerden ausloesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due]);
}
