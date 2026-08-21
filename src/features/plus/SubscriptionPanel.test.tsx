import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { SubscriptionPanel } from './SubscriptionPanel';

const { invokeMock, fromMock, useAuthMock, openExternalUrlMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fromMock: vi.fn(),
  useAuthMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock, functions: { invoke: invokeMock } },
}));

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

vi.mock('expo-router', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/externalLink', () => ({
  openExternalUrl: openExternalUrlMock,
  safeExternalUrl: (value: string | null) => value,
}));

function mockSubscription(result: { data: unknown[] | null; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn(() => ({ limit }));
  const is = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ is }));
  fromMock.mockReturnValue({ select });
}

const inDreissigTagen = new Date(Date.now() + 30 * 86_400_000).toISOString();

function renderPanel(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('SubscriptionPanel', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    fromMock.mockReset();
    openExternalUrlMock.mockReset();
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  });

  it('ohne Abo zeigt es den Weg zu Plus', async () => {
    mockSubscription({ data: [], error: null });

    renderPanel(<SubscriptionPanel />);

    await waitFor(() => expect(screen.getByText('Kein Abo')).toBeTruthy());
    expect(screen.getByText('Plus ansehen')).toBeTruthy();
    expect(screen.queryByText('Kundenportal öffnen')).toBeNull();
  });

  it('zeigt Tarif und Verlaengerungsdatum', async () => {
    mockSubscription({
      data: [
        {
          plan: 'yearly',
          status: 'active',
          current_period_end: inDreissigTagen,
          cancel_at_period_end: false,
        },
      ],
      error: null,
    });

    renderPanel(<SubscriptionPanel />);

    await waitFor(() => expect(screen.getByText('Plus, jährlich')).toBeTruthy());
    expect(screen.getByText(/verlängert sich am/)).toBeTruthy();
  });

  it('sagt bei einer Kuendigung, bis wann es noch laeuft', async () => {
    mockSubscription({
      data: [
        {
          plan: 'monthly',
          status: 'active',
          current_period_end: inDreissigTagen,
          cancel_at_period_end: true,
        },
      ],
      error: null,
    });

    renderPanel(<SubscriptionPanel />);

    await waitFor(() => expect(screen.getByText(/Gekündigt/)).toBeTruthy());
  });

  it('fuehrt zum Kundenportal, statt selbst zu kuendigen', async () => {
    mockSubscription({
      data: [
        {
          plan: 'monthly',
          status: 'active',
          current_period_end: inDreissigTagen,
          cancel_at_period_end: false,
        },
      ],
      error: null,
    });
    invokeMock.mockResolvedValue({ data: { url: 'https://billing.stripe.com/p/session' }, error: null });

    renderPanel(<SubscriptionPanel />);

    await waitFor(() => expect(screen.getByText('Kundenportal öffnen')).toBeTruthy());
    fireEvent.click(screen.getByText('Kundenportal öffnen'));

    await waitFor(() =>
      expect(openExternalUrlMock).toHaveBeenCalledWith('https://billing.stripe.com/p/session'),
    );
    expect(invokeMock).toHaveBeenCalledWith('create-portal', { method: 'POST' });
  });

  // Ein Lesefehler ist keine Aussage ueber den Vertrag. "Kein Abo" waere hier
  // die falsche Auskunft - und die, die zum zweiten Kauf verleitet.
  it('behauptet bei einem Fehler nicht, es gaebe kein Abo', async () => {
    mockSubscription({ data: null, error: { message: 'kaputt' } });

    renderPanel(<SubscriptionPanel />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('Kein Abo')).toBeNull();
  });

  // Die Zusage aus SAD §3.4: die Bezahlschranke sitzt am Anlegen, nicht am
  // Lesen. Wer das Abo beendet, verliert seine Sequenzen nicht.
  it('sagt, dass die eigenen Sequenzen bleiben', async () => {
    mockSubscription({
      data: [
        {
          plan: 'monthly',
          status: 'canceled',
          current_period_end: new Date(Date.now() - 86_400_000).toISOString(),
          cancel_at_period_end: false,
        },
      ],
      error: null,
    });

    renderPanel(<SubscriptionPanel />);

    await waitFor(() => expect(screen.getByText(/bleiben dir in jedem Fall/)).toBeTruthy());
  });
});
