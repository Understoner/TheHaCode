import { fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlusGate } from './PlusGate';

const { useAuthMock, usePlusAccessMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  usePlusAccessMock: vi.fn(),
}));

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));
vi.mock('@/features/configurator/useSequences', () => ({ usePlusAccess: usePlusAccessMock }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => createElement('a', null, children),
}));

const angemeldet = { session: { user: { id: 'u1' } }, loading: false };

function zugang(stand: { data?: boolean; isError?: boolean; isPending?: boolean }) {
  const refetch = vi.fn();
  usePlusAccessMock.mockReturnValue({ isPending: false, isError: false, refetch, ...stand });
  return refetch;
}

function zeigen() {
  render(
    <PlusGate>
      <Text>Editor</Text>
    </PlusGate>,
  );
}

describe('PlusGate', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue(angemeldet);
  });

  it('laesst mit Plus durch', () => {
    zugang({ data: true });
    zeigen();

    expect(screen.getByText('Editor')).toBeTruthy();
  });

  it('zeigt ohne Plus die Bezahlschranke', () => {
    zugang({ data: false });
    zeigen();

    expect(screen.getByText('sequenz.gate.plusTitel')).toBeTruthy();
    expect(screen.queryByText('Editor')).toBeNull();
  });

  // Der Fall vom 14.09.2026: ein zahlender Nutzer las "Dafuer brauchst du
  // Plus". Scheitert die Abfrage, ist das eine Stoerung und kein fehlendes Abo -
  // der Editor bleibt trotzdem zu.
  it('zeigt bei einem Abfragefehler eine Stoerung mit Neuversuch statt der Bezahlschranke', () => {
    const refetch = zugang({ isError: true });
    zeigen();

    expect(screen.getByText('errors:plus.zugang.title')).toBeTruthy();
    expect(screen.queryByText('sequenz.gate.plusTitel')).toBeNull();
    expect(screen.queryByText('Editor')).toBeNull();

    fireEvent.click(screen.getByText('errors:retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('bittet ohne Anmeldung zuerst zum Konto', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });
    zugang({ isPending: true });
    zeigen();

    expect(screen.getByText('sequenz.gate.anmeldenTitel')).toBeTruthy();
  });
});
