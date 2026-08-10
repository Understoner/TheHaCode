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

  it('zeigt gepinnte Beitraege als Hero-Karte mit Titel und Anriss', async () => {
    mockNewsQuery({
      data: [
        {
          id: '1',
          title: 'Neu im Studio',
          excerpt: 'Kurzfassung',
          body_md: 'Ein kurzer Beitrag.',
          cover_image_path: null,
          is_pinned: true,
          published_at: '2026-08-10T00:00:00Z',
        },
      ],
      error: null,
    });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Neu im Studio')).toBeTruthy());
    expect(screen.getByText('Kurzfassung')).toBeTruthy();
  });

  it('zeigt nicht gepinnte Beitraege als schlanke Liste ohne Anriss', async () => {
    mockNewsQuery({
      data: [
        {
          id: '2',
          title: 'Kursreihe startet',
          excerpt: 'Kurzfassung',
          body_md: 'Ein kurzer Beitrag.',
          cover_image_path: null,
          is_pinned: false,
          published_at: '2026-08-05T00:00:00Z',
        },
      ],
      error: null,
    });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Kursreihe startet')).toBeTruthy());
    expect(screen.queryByText('Kurzfassung')).toBeNull();
  });

  it('zeigt den Leer-Zustand ohne veroeffentlichte Beitraege', async () => {
    mockNewsQuery({ data: [], error: null });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Noch keine Neuigkeiten')).toBeTruthy());
  });
});
