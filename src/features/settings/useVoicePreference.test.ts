import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSoundPreference } from './useSoundPreference';
import { useVoicePreference } from './useVoicePreference';

const { fromMock, useAuthMock } = vi.hoisted(() => ({ fromMock: vi.fn(), useAuthMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

const updateEq = vi.fn().mockResolvedValue({ error: null });

function mockProfile(row: { sound_enabled?: boolean; voice_enabled?: boolean } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const update = vi.fn(() => ({ eq: updateEq }));
  fromMock.mockReturnValue({ select, update });
  return { select, update };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

describe('useVoicePreference', () => {
  beforeEach(() => {
    fromMock.mockReset();
    updateEq.mockClear();
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  });

  it('uebernimmt den gespeicherten Stand aus profiles', async () => {
    mockProfile({ sound_enabled: true, voice_enabled: true });

    const { result } = renderHook(() => useVoicePreference(), { wrapper });

    await waitFor(() => expect(result.current.voiceOn).toBe(true));
  });

  it('schreibt eine Aenderung nach profiles', async () => {
    const { update } = mockProfile({ sound_enabled: true, voice_enabled: false });

    const { result } = renderHook(() => useVoicePreference(), { wrapper });
    await waitFor(() => expect(result.current.voiceOn).toBe(false));

    act(() => result.current.setVoiceOn(true));

    await waitFor(() => expect(result.current.voiceOn).toBe(true));
    // Nur die eigene Spalte, nicht die des Tons daneben.
    expect(update).toHaveBeenCalledWith({ voice_enabled: true });
  });

  // Anders als beim Ton: eine Ansage bei jedem Phasenwechsel ist eine
  // Entscheidung, keine Grundeinstellung.
  it('faellt auf "aus" zurueck, wenn nichts gespeichert ist', async () => {
    mockProfile(null);

    const { result } = renderHook(() => useVoicePreference(), { wrapper });

    await waitFor(() => expect(result.current.voiceOn).toBe(false));
  });

  it('funktioniert ohne Anmeldung, ohne zu schreiben', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });
    const { update } = mockProfile({ voice_enabled: true });

    const { result } = renderHook(() => useVoicePreference(), { wrapper });

    expect(result.current.voiceOn).toBe(false);
    act(() => result.current.setVoiceOn(true));
    expect(result.current.voiceOn).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  // Beide Schalter lesen dieselbe Zeile. Zwei Abfragen fuer eine Zeile waeren
  // eine zu viel - der gemeinsame Abfrageschluessel verhindert das.
  it('holt fuer beide Schalter zusammen nur eine Zeile', async () => {
    const { select } = mockProfile({ sound_enabled: false, voice_enabled: true });

    const { result } = renderHook(
      () => ({ ton: useSoundPreference(), stimme: useVoicePreference() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.stimme.voiceOn).toBe(true));
    expect(result.current.ton.soundOn).toBe(false);
    expect(select).toHaveBeenCalledTimes(1);
  });
});
