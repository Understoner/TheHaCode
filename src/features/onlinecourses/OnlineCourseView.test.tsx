import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { OnlineCourseView } from './OnlineCourseView';
import type { CourseWithBlocks } from './useOnlineCourses';

// Die Kursseite zeigt je Zugangsart und Stand den passenden Weg. Ob der Kurs
// offen ist, kommt aus can_open_course() - hier gemockt.

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  open: false,
  plus: false,
  done: new Set<string>(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
// react-native-svg laeuft in jsdom nicht (wie MoonMark im NavBar-Test).
vi.mock('./KindIcon', () => ({ KindIcon: () => null }));
vi.mock('./CertificatePanel', () => ({ CertificatePanel: () => null }));
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: state.session, loading: false }),
}));
vi.mock('@/features/configurator/useSequences', () => ({
  usePlusAccess: () => ({ data: state.plus }),
}));
vi.mock('expo-router', () => ({
  Link: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => (asChild ? children : <a>{children}</a>),
  useLocalSearchParams: () => ({}),
}));
vi.mock('./useOnlineCourses', () => ({
  useCanOpenCourse: () => ({ data: state.open, isPending: false, refetch: vi.fn() }),
  useCourseProgress: () => ({ data: state.done }),
  useCourseAccess: () => ({ data: [] }),
  useOnlineCourseCheckout: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  usePlanSlots: () => ({ data: new Map() }),
}));

function data(access: 'public' | 'account' | 'plus' | 'paid'): CourseWithBlocks {
  return {
    course: {
      id: 'c1',
      slug: 'kurs',
      title: 'Ruhig atmen',
      subtitle: null,
      summary_md: null,
      description_md: null,
      cover_path: null,
      access,
      price_cents: access === 'paid' ? 8900 : null,
      access_days: 365,
      pass_percent: 80,
      suggested_days: 14,
      is_published: true,
      is_featured: false,
      level: null,
      sort_order: 0,
      created_at: '',
      updated_at: '',
    },
    blocks: [
      { id: 'b1', course_id: 'c1', kind: 'text', title: 'Einstieg', summary: null, day_offset: 0, sort_order: 1, duration_sec: 300, created_at: '', updated_at: '' },
      { id: 'b2', course_id: 'c1', kind: 'quiz', title: 'Wissensquiz', summary: null, day_offset: 13, sort_order: 2, duration_sec: null, created_at: '', updated_at: '' },
    ],
  };
}

function renderView(access: 'public' | 'account' | 'plus' | 'paid') {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <OnlineCourseView data={data(access)} />
    </QueryClientProvider>,
  );
}

describe('OnlineCourseView', () => {
  beforeEach(() => {
    state.session = null;
    state.open = false;
    state.plus = false;
    state.done = new Set();
  });

  it('sagt immer, dass es kein Live-Unterricht ist', () => {
    renderView('public');
    expect(screen.getByText('Onlinekurs on demand, kein Live-Unterricht')).toBeTruthy();
  });

  it('laesst Gaeste einen freien Kurs ansehen und bietet ein Konto an', () => {
    state.open = true;
    renderView('public');
    expect(screen.getByText('Ansehen')).toBeTruthy();
    expect(screen.getAllByText('Kostenloses Konto anlegen').length).toBeGreaterThan(0);
  });

  it('zeigt Plus-Kunden den Rabattpreis auf einen Einzelkauf', () => {
    state.session = { user: { id: 'u1' } };
    state.plus = true;
    renderView('paid');
    expect(screen.getByText(/75,65/)).toBeTruthy();
    expect(screen.getByText('Kurs kaufen')).toBeTruthy();
  });

  it('schickt Gaeste vor dem Kauf zur Anmeldung', () => {
    renderView('paid');
    expect(screen.getByText('Anmelden und kaufen')).toBeTruthy();
    expect(screen.queryByText('Kurs kaufen')).toBeNull();
  });

  it('zeigt bei offenem Kurs den Fortschritt ohne das Quiz', () => {
    state.session = { user: { id: 'u1' } };
    state.open = true;
    state.done = new Set(['b1']);
    renderView('account');
    expect(screen.getByText('1 von 1 erledigt')).toBeTruthy();
  });

  it('bietet einen Plus-Kurs ohne Plus ueber die Plus-Seite an', () => {
    state.session = { user: { id: 'u1' } };
    renderView('plus');
    expect(screen.getByText('Plus ansehen')).toBeTruthy();
  });
});
