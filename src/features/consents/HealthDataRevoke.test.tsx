import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { HealthDataRevoke } from './HealthDataRevoke';
import type { ConsentDefinition } from './useConsents';

const { insert, rpc, calls } = vi.hoisted(() => {
  const calls: string[] = [];
  return { calls, insert: vi.fn(), rpc: vi.fn() };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (...args: unknown[]) => {
        calls.push('widerruf');
        return insert(...args);
      },
    }),
    rpc: (...args: unknown[]) => {
      calls.push('loeschen');
      return rpc(...args);
    },
  },
}));

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u-1' } }, loading: false }),
}));

const definition = {
  id: 'def-health',
  kind: 'health_data',
  version: 3,
  is_required: false,
} as unknown as ConsentDefinition;

function renderPanel(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(<HealthDataRevoke definition={definition} onClose={onClose} />, { wrapper });
  return onClose;
}

describe('HealthDataRevoke', () => {
  beforeEach(() => {
    calls.length = 0;
    insert.mockReset().mockResolvedValue({ error: null });
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it('widerruft ohne zu loeschen, wenn die Daten bleiben sollen', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('Widerrufen, Daten behalten'));

    await screen.findByText(/Deine bisherigen Einträge bleiben/);
    expect(calls).toEqual(['widerruf']);
    expect(insert.mock.calls[0][0]).toMatchObject({ kind: 'health_data', granted_at: null });
  });

  // Reihenfolge ist Absicht: scheitert das Loeschen, ist der Widerruf schon
  // wirksam. Andersherum waeren die Daten weg und die Einwilligung noch da.
  it('widerruft zuerst und loescht danach', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('Widerrufen und alles löschen'));

    await screen.findByText('Widerrufen. Dein Tagebuch ist gelöscht.');
    expect(calls).toEqual(['widerruf', 'loeschen']);
    expect(rpc).toHaveBeenCalledWith('delete_my_diary_data');
  });

  it('loescht nicht, wenn schon der Widerruf scheitert', async () => {
    insert.mockResolvedValue({ error: { message: 'kaputt' } });
    renderPanel();
    fireEvent.click(screen.getByText('Widerrufen und alles löschen'));

    await screen.findByText('Das ließ sich nicht speichern. Versuch es bitte noch einmal.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('bietet nach einem gescheiterten Loeschen einen neuen Versuch an', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'kaputt' } });
    renderPanel();
    fireEvent.click(screen.getByText('Widerrufen und alles löschen'));

    await screen.findByText(/Deine Einwilligung ist widerrufen, aber das Tagebuch/);
    fireEvent.click(screen.getByText('Noch einmal löschen'));

    await screen.findByText('Widerrufen. Dein Tagebuch ist gelöscht.');
    expect(calls).toEqual(['widerruf', 'loeschen', 'loeschen']);
  });

  it('tut beim Abbrechen nichts', () => {
    const onClose = renderPanel();
    fireEvent.click(screen.getByText('Abbrechen'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it('wartet nicht still: waehrend der Arbeit sind die Knoepfe gesperrt', async () => {
    let resolve: (v: { error: null }) => void = () => {};
    insert.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPanel();
    fireEvent.click(screen.getByText('Widerrufen und alles löschen'));

    await screen.findByText('Wird ausgeführt …');
    resolve({ error: null });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
  });
});
