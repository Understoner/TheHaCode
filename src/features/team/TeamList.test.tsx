import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { TeamList } from './TeamList';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
    storage: { from: vi.fn(() => ({ getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })) })) },
  },
}));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockTeamQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ order }));
  fromMock.mockReturnValue({ select });
}

describe('TeamList', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('zeigt veroeffentlichte Teammitglieder mit Name und Rolle', async () => {
    mockTeamQuery({
      data: [{ id: '1', full_name: 'Michael Untersteiner', role_title: 'Gründer', bio: null, photo_path: null }],
      error: null,
    });

    renderWithClient(<TeamList />);

    await waitFor(() => expect(screen.getByText('Michael Untersteiner')).toBeTruthy());
    expect(screen.getByText('Gründer')).toBeTruthy();
  });

  it('zeigt Teammitglieder ab Position vier in der Weiteres-Team-Liste', async () => {
    const member = (id: string, full_name: string) => ({ id, full_name, role_title: null, bio: null, photo_path: null });

    mockTeamQuery({
      data: [member('1', 'Person eins'), member('2', 'Person zwei'), member('3', 'Person drei'), member('4', 'Person vier')],
      error: null,
    });

    renderWithClient(<TeamList />);

    await waitFor(() => expect(screen.getByText('Person vier')).toBeTruthy());
    expect(screen.getByText('Person eins')).toBeTruthy();
  });

  it('zeigt den Leer-Zustand ohne veroeffentlichte Teammitglieder', async () => {
    mockTeamQuery({ data: [], error: null });

    renderWithClient(<TeamList />);

    await waitFor(() => expect(screen.getByText('Team wird gerade vorgestellt')).toBeTruthy());
  });
});
