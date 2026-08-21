import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSoundPreference } from './useSoundPreference';

const { fromMock, useAuthMock } = vi.hoisted(() => ({ fromMock: vi.fn(), useAuthMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

const updateEq = vi.fn().mockResolvedValue({ error: null });

function mockProfile(soundEnabled: boolean | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: soundEnabled === null ? null : { sound_enabled: soundEnabled },
    error: null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const update = vi.fn(() => ({ eq: updateEq }));
  fromMock.mockReturnValue({ select, update });
  return { update };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

describe('useSoundPreference', () => {
  beforeEach(() => {
    fromMock.mockReset();
    updateEq.mockClear();
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  });

  it('uebernimmt den gespeicherten Stand aus profiles', async () => {
    mockProfile(false);

    const { result } = renderHook(() => useSoundPreference(), { wrapper });

    await waitFor(() => expect(result.current.soundOn).toBe(false));
  });

  it('schreibt eine Aenderung nach profiles', async () => {
    const { update } = mockProfile(true);

    const { result } = renderHook(() => useSoundPreference(), { wrapper });
    await waitFor(() => expect(result.current.soundOn).toBe(true));

    act(() => result.current.setSoundOn(false));

    // Umgelegt wird der Schalter, bevor der Server antwortet - onMutate setzt
    // den Cache. Ein Tick vergeht trotzdem, weil onMutate zuerst laufende
    // Abfragen abbricht; deshalb waitFor und kein sofortiger Vergleich.
    await waitFor(() => expect(result.current.soundOn).toBe(false));
    expect(update).toHaveBeenCalledWith({ sound_enabled: false });
  });

  // Ohne Konto gibt es keine Zeile in profiles. Der Schalter muss trotzdem
  // funktionieren - nur eben ohne Gedaechtnis.
  it('funktioniert ohne Anmeldung, ohne zu schreiben', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });
    const { update } = mockProfile(true);

    const { result } = renderHook(() => useSoundPreference(), { wrapper });

    expect(result.current.soundOn).toBe(true);
    act(() => result.current.setSoundOn(false));
    expect(result.current.soundOn).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('faellt auf "an" zurueck, wenn nichts gespeichert ist', async () => {
    mockProfile(null);

    const { result } = renderHook(() => useSoundPreference(), { wrapper });

    await waitFor(() => expect(result.current.soundOn).toBe(true));
  });
});
