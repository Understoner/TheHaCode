import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { NewsList } from './NewsList';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock },
}));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockNewsQuery(result: { data: unknown; error: unknown }) {
  const orderPublished = vi.fn().mockResolvedValue(result);
  const orderPinned = vi.fn(() => ({ order: orderPublished }));
  const select = vi.fn(() => ({ order: orderPinned }));
  fromMock.mockReturnValue({ select });
}

describe('NewsList', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('zeigt veroeffentlichte Beitraege mit Titel und Anriss', async () => {
    mockNewsQuery({
      data: [{ id: '1', title: 'Neu im Studio', excerpt: 'Kurzfassung' }],
      error: null,
    });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Neu im Studio')).toBeTruthy());
    expect(screen.getByText('Kurzfassung')).toBeTruthy();
  });

  it('zeigt den Leer-Zustand ohne veroeffentlichte Beitraege', async () => {
    mockNewsQuery({ data: [], error: null });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Noch keine Neuigkeiten')).toBeTruthy());
  });
});
