import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionCacheGuard } from './SessionCacheGuard';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

const angemeldet = (id: string) => ({ session: { user: { id } }, loading: false });
const abgemeldet = { session: null, loading: false };

function aufbau() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['habit-logs', 'nutzer-a'], [{ value: 7 }]);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SessionCacheGuard />
    </QueryClientProvider>,
  );
  const neu = () =>
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <SessionCacheGuard />
      </QueryClientProvider>,
    );
  return { queryClient, neu };
}

describe('SessionCacheGuard', () => {
  beforeEach(() => useAuthMock.mockReset());

  // Der Fall, um den es geht: nach dem Abmelden liegen die Tagebuch-Daten des
  // vorigen Kontos nicht mehr im Speicher des Tabs.
  it('verwirft beim Abmelden alles Geladene', () => {
    useAuthMock.mockReturnValue(angemeldet('nutzer-a'));
    const { queryClient, neu } = aufbau();

    useAuthMock.mockReturnValue(abgemeldet);
    neu();

    expect(queryClient.getQueryData(['habit-logs', 'nutzer-a'])).toBeUndefined();
  });

  it('verwirft auch beim direkten Wechsel auf ein anderes Konto', () => {
    useAuthMock.mockReturnValue(angemeldet('nutzer-a'));
    const { queryClient, neu } = aufbau();

    useAuthMock.mockReturnValue(angemeldet('nutzer-b'));
    neu();

    expect(queryClient.getQueryData(['habit-logs', 'nutzer-a'])).toBeUndefined();
  });

  // Eine Token-Erneuerung liefert eine neue Sitzung mit derselben Nutzer-ID.
  // Wuerde sie den Speicher leeren, flackerte die App jede Stunde.
  it('laesst bei gleicher Nutzer-ID alles stehen', () => {
    useAuthMock.mockReturnValue(angemeldet('nutzer-a'));
    const { queryClient, neu } = aufbau();

    useAuthMock.mockReturnValue(angemeldet('nutzer-a'));
    neu();

    expect(queryClient.getQueryData(['habit-logs', 'nutzer-a'])).toEqual([{ value: 7 }]);
  });

  it('verwirft nichts, solange der erste Stand der Sitzung noch aussteht', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true });
    const { queryClient, neu } = aufbau();

    useAuthMock.mockReturnValue(angemeldet('nutzer-a'));
    neu();

    expect(queryClient.getQueryData(['habit-logs', 'nutzer-a'])).toEqual([{ value: 7 }]);
  });

  it('laedt beim Anmelden neu, ohne etwas zu verwerfen', () => {
    useAuthMock.mockReturnValue(abgemeldet);
    const { queryClient, neu } = aufbau();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const reset = vi.spyOn(queryClient, 'resetQueries');

    useAuthMock.mockReturnValue(angemeldet('nutzer-a'));
    neu();

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
