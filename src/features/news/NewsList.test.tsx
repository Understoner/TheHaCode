import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { NewsList } from './NewsList';

// Seit die Karten auf /news/<slug> verlinken, zieht der Test expo-router mit
// herein - und dessen Typen-Datei laesst sich unter Vitest nicht laden.
// Der Ersatz macht aus jedem Link ein <a>, damit die Adresse pruefbar bleibt.
vi.mock('expo-router', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string; params: { slug: string } };
    children: ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname.replace('[slug]', href.params.slug)} {...props}>
      {children}
    </a>
  ),
}));

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
  const eq = vi.fn(() => ({ order: orderPinned }));
  const select = vi.fn(() => ({ order: orderPinned, eq }));
  fromMock.mockReturnValue({ select });
  return { select, eq, orderPinned, orderPublished };
}

function post(overrides: Record<string, unknown>) {
  return {
    id: overrides.id,
    slug: `beitrag-${overrides.id}`,
    title: overrides.title,
    excerpt: 'Kurzfassung',
    body_md: 'Ein kurzer Beitrag.',
    cover_image_path: null,
    is_pinned: false,
    published_at: '2026-08-01T00:00:00Z',
    category: 'allgemein',
    ...overrides,
  };
}

describe('NewsList', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('zeigt die ersten drei Beitraege als Hero-Karten mit Titel und Anriss', async () => {
    mockNewsQuery({
      data: [post({ id: '1', title: 'Neu im Studio' })],
      error: null,
    });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Neu im Studio')).toBeTruthy());
    expect(screen.getByText('Kurzfassung')).toBeTruthy();
  });

  it('zeigt Beitraege ab Position vier als schlanke Liste ohne Anriss', async () => {
    mockNewsQuery({
      data: [
        post({ id: '1', title: 'Beitrag eins' }),
        post({ id: '2', title: 'Beitrag zwei' }),
        post({ id: '3', title: 'Beitrag drei' }),
        post({ id: '4', title: 'Beitrag vier' }),
      ],
      error: null,
    });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Beitrag vier')).toBeTruthy());
    expect(screen.getAllByText('Kurzfassung')).toHaveLength(3);
  });

  it('zeigt den Leer-Zustand ohne veroeffentlichte Beitraege', async () => {
    mockNewsQuery({ data: [], error: null });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Noch keine Neuigkeiten')).toBeTruthy());
  });

  it('zeigt die Kategorie als Badge auf der Karte', async () => {
    mockNewsQuery({
      data: [post({ id: '1', title: 'Atemtechnik Grundlagen', category: 'praxis' })],
      error: null,
    });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Atemtechnik Grundlagen')).toBeTruthy());
    expect(screen.getAllByText('Praxis').length).toBeGreaterThan(0);
  });

  it('filtert die Abfrage nach der gewaehlten Kategorie', async () => {
    const { eq } = mockNewsQuery({ data: [], error: null });

    renderWithClient(<NewsList />);

    await waitFor(() => expect(screen.getByText('Alle')).toBeTruthy());
    fireEvent.click(screen.getByText('Kurs'));

    await waitFor(() => expect(eq).toHaveBeenCalledWith('category', 'kurs'));
  });
});
