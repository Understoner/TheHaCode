import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { CoursesList } from './CoursesList';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock },
}));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockCoursesQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ order }));
  fromMock.mockReturnValue({ select });
}

describe('CoursesList', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('zeigt veroeffentlichte Kurse mit Titel und Beschreibung', async () => {
    mockCoursesQuery({
      data: [{ id: '1', title: 'Atem-Grundkurs', description: 'Vier Wochen, wöchentlich', location: null, price_info: null, signup_url: null }],
      error: null,
    });

    renderWithClient(<CoursesList />);

    await waitFor(() => expect(screen.getByText('Atem-Grundkurs')).toBeTruthy());
    expect(screen.getByText('Vier Wochen, wöchentlich')).toBeTruthy();
  });

  it('zeigt Kurse ab Position vier als schlanke Liste', async () => {
    const course = (id: string, title: string) => ({
      id,
      title,
      description: 'Beschreibung',
      location: null,
      price_info: null,
      signup_url: null,
    });

    mockCoursesQuery({
      data: [course('1', 'Kurs eins'), course('2', 'Kurs zwei'), course('3', 'Kurs drei'), course('4', 'Kurs vier')],
      error: null,
    });

    renderWithClient(<CoursesList />);

    await waitFor(() => expect(screen.getByText('Kurs vier')).toBeTruthy());
    expect(screen.getAllByText('Beschreibung')).toHaveLength(3);
  });

  it('zeigt den Leer-Zustand ohne veroeffentlichte Kurse', async () => {
    mockCoursesQuery({ data: [], error: null });

    renderWithClient(<CoursesList />);

    await waitFor(() => expect(screen.getByText('Aktuell keine Kurse')).toBeTruthy());
  });
});
