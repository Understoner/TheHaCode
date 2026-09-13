import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { FavoriteStar } from './FavoriteStar';

const { from, useAuthMock, push } = vi.hoisted(() => ({
  from: vi.fn(),
  useAuthMock: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));

const USER = '11111111-1111-1111-1111-111111111111';
const SEQUENZ = '22222222-2222-2222-2222-222222222222';

/**
 * Der Supabase-Client wird in Ketten benutzt (.select().eq().is()), und erst
 * das letzte Glied wird abgewartet. Der Ersatz hier gibt deshalb ueberall
 * dasselbe Objekt zurueck, das zugleich ein Promise ist.
 */
function kette(antwort: unknown) {
  const glied: Record<string, unknown> = {
    then: (aufloesen: (wert: unknown) => unknown) => Promise.resolve(antwort).then(aufloesen),
  };
  for (const name of ['select', 'eq', 'is', 'upsert', 'delete']) {
    glied[name] = vi.fn(() => glied);
  }
  return glied;
}

function zeige() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FavoriteStar exerciseId={SEQUENZ} />
    </QueryClientProvider>
  );
}

describe('FavoriteStar', () => {
  beforeEach(() => {
    push.mockReset();
    from.mockReset();
    useAuthMock.mockReturnValue({ session: { user: { id: USER } }, loading: false });
  });

  // Ohne Konto gibt es keine Favoriten - localStorage ist fuer fachliche Daten
  // verboten (CLAUDE.md). Der Stern verschwindet trotzdem nicht, sonst
  // erfuehre niemand ohne Konto, dass es die Funktion gibt.
  it('fuehrt ohne Anmeldung zum Konto, statt still nichts zu tun', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });
    from.mockReturnValue(kette({ data: [], error: null }));

    zeige();
    fireEvent.click(screen.getByRole('button'));

    expect(push).toHaveBeenCalledWith('/konto');
    expect(from).not.toHaveBeenCalled();
  });

  it('setzt den Stern und legt dabei eine Zeile mit user_id an', async () => {
    const glied = kette({ data: [], error: null });
    from.mockReturnValue(glied);

    zeige();
    await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false'));

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(glied.upsert).toHaveBeenCalled());
    expect(from).toHaveBeenCalledWith('exercise_favorites');
    // upsert statt insert: zwei schnelle Klicks duerfen nicht am
    // unique-Constraint scheitern.
    expect(glied.upsert).toHaveBeenCalledWith(
      { user_id: USER, exercise_id: SEQUENZ },
      expect.objectContaining({ ignoreDuplicates: true })
    );
  });

  it('zeigt einen gesetzten Stern und nimmt ihn beim naechsten Druck zurueck', async () => {
    const glied = kette({ data: [{ exercise_id: SEQUENZ }], error: null });
    from.mockReturnValue(glied);

    zeige();
    await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByText('★')).toBeTruthy();

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(glied.delete).toHaveBeenCalled());
    expect(glied.upsert).not.toHaveBeenCalled();
    // Der user_id-Bezug steht auch beim Loeschen ausdruecklich da, obwohl RLS
    // ohnehin nur die eigenen Zeilen herausgibt (CLAUDE.md §Verboten).
    expect(glied.eq).toHaveBeenCalledWith('user_id', USER);
    expect(glied.eq).toHaveBeenCalledWith('exercise_id', SEQUENZ);
  });
});
