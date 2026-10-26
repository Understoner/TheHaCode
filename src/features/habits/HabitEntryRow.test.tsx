import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { HabitEntryRow } from './HabitDay';
import type { HabitLog, MyHabit } from './useHabits';

// Die Tagebuch-Eingabe ist neben QueryBoundary die eine Komponente, die SAD §8
// ausdruecklich mit einem Komponententest verlangt: sie entscheidet, was ein
// Antippen in die Datenbank schreibt.

const { from, useAuthMock } = vi.hoisted(() => ({
  from: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));
vi.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const USER = '11111111-1111-1111-1111-111111111111';
const DATUM = '2026-10-25';

function kette(antwort: unknown) {
  const glied: Record<string, unknown> = {
    then: (aufloesen: (wert: unknown) => unknown) => Promise.resolve(antwort).then(aufloesen),
  };
  for (const name of ['select', 'eq', 'is', 'upsert', 'delete']) {
    glied[name] = vi.fn(() => glied);
  }
  return glied;
}

function habit(tracking: 'done' | 'number', overrides: Partial<MyHabit['habit_templates']> = {}): MyHabit {
  return {
    id: 'uh-1',
    user_id: USER,
    template_id: 'tpl-1',
    target_value: null,
    sort_order: 0,
    is_active: true,
    started_on: DATUM,
    archived_at: null,
    created_at: DATUM,
    updated_at: DATUM,
    deleted_at: null,
    client_id: null,
    habit_templates: {
      id: 'tpl-1',
      slug: tracking === 'done' ? 'atmen-zum-einschlafen' : 'bolt-wert',
      category_id: 'cat-1',
      title: tracking === 'done' ? 'Atmen zum Einschlafen' : 'BOLT-Wert ermitteln',
      description_md: null,
      tracking_type: tracking,
      unit: tracking === 'number' ? 'Sekunden' : null,
      min_value: null,
      max_value: null,
      step_value: null,
      default_target: null,
      higher_is_better: true,
      points: 10,
      is_negative: false,
      is_preview: false,
      exercise_id: null,
      icon: null,
      sort_order: 0,
      is_published: true,
      created_at: DATUM,
      updated_at: DATUM,
      owner_id: null,
      deleted_at: null,
      client_id: null,
      ...overrides,
    },
  };
}

const eintrag: HabitLog = {
  id: 'log-1',
  user_id: USER,
  user_habit_id: 'uh-1',
  log_date: DATUM,
  value_numeric: 1,
  value_text: null,
  note: null,
  created_at: DATUM,
  updated_at: DATUM,
  deleted_at: null,
  client_id: null,
};

function zeige(props: Partial<Parameters<typeof HabitEntryRow>[0]> & { habit: MyHabit }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HabitEntryRow date={DATUM} log={null} category={null} locked={false} scoreOn={false} {...props} />
    </QueryClientProvider>,
  );
}

describe('HabitEntryRow', () => {
  beforeEach(() => {
    from.mockReset();
    useAuthMock.mockReturnValue({ session: { user: { id: USER } }, loading: false });
  });

  it('hakt "erledigt" mit einem Tipp ab - als Eintrag fuer genau diesen Tag', async () => {
    const chain = kette({ error: null });
    from.mockReturnValue(chain);

    zeige({ habit: habit('done') });
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(from).toHaveBeenCalledWith('habit_logs'));
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER, user_habit_id: 'uh-1', log_date: DATUM }),
      { onConflict: 'user_habit_id,log_date' },
    );
  });

  it('nimmt einen Haken wieder heraus, indem der Eintrag geloescht wird', async () => {
    const chain = kette({ error: null });
    from.mockReturnValue(chain);

    zeige({ habit: habit('done'), log: eintrag });
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(chain.delete).toHaveBeenCalled());
  });

  // Die Sperre sitzt in der Datenbank. Die Oberflaeche soll trotzdem nicht
  // zum Antippen einladen, was gleich darauf abgelehnt wird.
  it('laesst ein gesperrtes Plus-Habit nicht neu abhaken', () => {
    zeige({ habit: habit('done'), locked: true });
    expect(screen.getByRole('checkbox').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/Gehört zu Plus/)).toBeTruthy();
  });

  // Lesen und Loeschen gehen immer (SAD §3.10) - auch nach Abo-Ende.
  it('laesst einen vorhandenen Eintrag auch gesperrt entfernen', () => {
    zeige({ habit: habit('done'), log: eintrag, locked: true });
    expect(screen.getByRole('checkbox').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('zeigt einen gemessenen Wert mit Einheit', () => {
    zeige({ habit: habit('number'), log: { ...eintrag, value_numeric: 32 } });
    expect(screen.getByText('32 Sekunden')).toBeTruthy();
  });

  it('nennt die Punkte nur, wenn der Tagebuch-Score an ist', () => {
    const kategorie = {
      id: 'cat-1',
      slug: 'atmung',
      title: 'Atmung',
      description: null,
      icon: null,
      is_negative: false,
      max_per_day: 20,
      max_per_week: 100,
      max_per_month: 400,
      sort_order: 1,
      is_published: true,
      created_at: DATUM,
      updated_at: DATUM,
    };
    const { unmount } = zeige({ habit: habit('done'), category: kategorie, scoreOn: false });
    expect(screen.queryByText('+10 Punkte')).toBeNull();
    unmount();

    zeige({ habit: habit('done'), category: kategorie, scoreOn: true });
    expect(screen.getByText('+10 Punkte')).toBeTruthy();
  });

  // Seit 0028 haengt das Vorzeichen am Habit: dieselbe positive Kategorie
  // kann ein Habit tragen, das abzieht.
  it('zeigt ein negatives Habit in einer positiven Kategorie als Abzug', () => {
    const kategorie = {
      id: 'cat-1',
      slug: 'schlaf',
      title: 'Schlaf',
      description: null,
      icon: null,
      is_negative: false,
      max_per_day: 20,
      max_per_week: 100,
      max_per_month: 400,
      sort_order: 6,
      is_published: true,
      created_at: DATUM,
      updated_at: DATUM,
    };
    const negativ = habit('done');
    negativ.habit_templates = { ...negativ.habit_templates, is_negative: true, points: 6 };
    zeige({ habit: negativ, category: kategorie, scoreOn: true });
    expect(screen.getByText('−6 Punkte')).toBeTruthy();
    expect(screen.queryByText('+6 Punkte')).toBeNull();
  });
});
