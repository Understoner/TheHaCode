import type { UseQueryResult } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { QueryBoundary } from './QueryBoundary';

function makeQuery<T>(overrides: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return {
    isPending: false,
    isError: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<T>;
}

describe('QueryBoundary', () => {
  it('zeigt ein Skeleton waehrend des Ladens und ruft die Kinder nicht auf', () => {
    const children = vi.fn(() => <Text>Inhalt</Text>);
    render(
      <QueryBoundary query={makeQuery<string[]>({ isPending: true })}>{children}</QueryBoundary>
    );

    expect(screen.getByTestId('skeleton-list')).toBeTruthy();
    expect(children).not.toHaveBeenCalled();
  });

  it('zeigt eine Fehlermeldung mit Wiederholen-Aktion', () => {
    const refetch = vi.fn();
    render(
      <QueryBoundary query={makeQuery<string[]>({ isError: true, error: new Error('boom'), refetch })}>
        {() => null}
      </QueryBoundary>
    );

    expect(screen.getByText('Daten konnten nicht geladen werden')).toBeTruthy();
    fireEvent.click(screen.getByText('Erneut versuchen'));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('zeigt den Leer-Zustand bei einer leeren Liste', () => {
    render(
      <QueryBoundary
        query={makeQuery<string[]>({ data: [] })}
        empty={{ title: 'Nichts hier', hint: 'Komm später wieder' }}
      >
        {() => null}
      </QueryBoundary>
    );

    expect(screen.getByText('Nichts hier')).toBeTruthy();
    expect(screen.getByText('Komm später wieder')).toBeTruthy();
  });

  it('rendert die Kinder mit den Daten bei Erfolg', () => {
    render(
      <QueryBoundary query={makeQuery<string[]>({ data: ['a', 'b'] })}>
        {(data) => <Text>{data.join(',')}</Text>}
      </QueryBoundary>
    );

    expect(screen.getByText('a,b')).toBeTruthy();
  });
});
