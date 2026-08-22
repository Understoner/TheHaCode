import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { CoursesList } from './CoursesList';

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock, functions: { invoke: vi.fn() } },
}));

// expo-routers Link zieht react-native-webs unkompilierte Animated-Quelle
// (Flow-Syntax), die esbuild nicht parsen kann - wie in NavBar.test.tsx.
vi.mock('expo-router', () => ({
  // Wie in NewsList.test.tsx: seit die Kacheln auf /kurse/<slug> verlinken,
  // kommt href als Objekt herein und wird hier zur Adresse aufgeloest.
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
    // Die freien Plaetze holt CoursesList seit T20 nebenher; ohne Kurs mit
    // booking_enabled bleibt die Antwort ohne Wirkung.
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });
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

  it('verlinkt den Titel auf die Detailseite und zeigt den Termin', async () => {
    mockCoursesQuery({
      data: [
        {
          id: '1',
          slug: 'besser-atmen-ampflwang-2027-01',
          title: 'Besser atmen – besser leben',
          description: 'Vier Abende Breathwork.',
          location: 'Musikschule Ampflwang',
          price_info: null,
          signup_url: null,
          // 19:00 Ortszeit im Jaenner, also 18:00 UTC
          starts_at: '2027-01-19T18:00:00Z',
        },
      ],
      error: null,
    });

    renderWithClient(<CoursesList />);

    // Der Titel ist der Weg zum Langtext - ohne ihn waere die Detailseite
    // nur ueber die Adresszeile erreichbar.
    const titel = await screen.findByText('Besser atmen – besser leben');
    expect(titel.closest('a')?.getAttribute('href')).toContain('besser-atmen-ampflwang-2027-01');
    expect(screen.getByText('Mehr erfahren')).toBeTruthy();
    // Der Termin steht auf der Kachel, nicht erst im Text: danach sucht,
    // wer eine Kursliste ueberfliegt.
    expect(screen.getByText('19. Jänner 2027')).toBeTruthy();
  });

  it('kommt ohne Termin aus - nicht jeder Kurs hat schon einen', async () => {
    mockCoursesQuery({
      data: [
        {
          id: '1',
          slug: 'ohne-termin',
          title: 'Kurs ohne Termin',
          description: 'Beschreibung',
          location: null,
          price_info: null,
          signup_url: null,
          starts_at: null,
        },
      ],
      error: null,
    });

    renderWithClient(<CoursesList />);

    await waitFor(() => expect(screen.getByText('Kurs ohne Termin')).toBeTruthy());
  });

  it('zeigt den Leer-Zustand ohne veroeffentlichte Kurse', async () => {
    mockCoursesQuery({ data: [], error: null });

    renderWithClient(<CoursesList />);

    await waitFor(() => expect(screen.getByText('Aktuell keine Kurse')).toBeTruthy());
  });
});
