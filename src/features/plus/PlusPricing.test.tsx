import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { PlusPricing } from './PlusPricing';

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

const PREISE = [
  { plan: 'monthly', amountCents: 990, currency: 'eur', interval: 'month' },
  { plan: 'yearly', amountCents: 9900, currency: 'eur', interval: 'year' },
];

function mockSubscription(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn(() => ({ limit }));
  const is = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ is }));
  fromMock.mockReturnValue({ select });
}

function renderPricing(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('PlusPricing', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    fromMock.mockReset();
    openExternalUrlMock.mockReset();
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    mockSubscription([]);
    invokeMock.mockResolvedValue({ data: { prices: PREISE }, error: null });
  });

  it('zeigt beide Tarife mit ihren Betraegen', async () => {
    renderPricing(<PlusPricing />);

    await waitFor(() => expect(screen.getByText(/9,90/)).toBeTruthy());
    expect(screen.getByText(/99,00/)).toBeTruthy();
  });

  it('nennt die Ersparnis beim Jahrestarif', async () => {
    renderPricing(<PlusPricing />);
    await waitFor(() => expect(screen.getByText(/16 %/)).toBeTruthy());
  });

  it('schickt den gewaehlten Tarif zum Checkout', async () => {
    renderPricing(<PlusPricing />);

    await waitFor(() => expect(screen.getAllByText('Auswählen')).toHaveLength(2));

    invokeMock.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/c/pay/cs_test' },
      error: null,
    });
    fireEvent.click(screen.getAllByText('Auswählen')[0]);

    await waitFor(() =>
      expect(openExternalUrlMock).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test'),
    );
    expect(invokeMock).toHaveBeenLastCalledWith('create-checkout', {
      method: 'POST',
      body: { plan: 'monthly' },
    });
  });

  it('weist Nichtangemeldete zum Konto, statt in den Checkout', async () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });

    renderPricing(<PlusPricing />);

    await waitFor(() => expect(screen.getAllByText('Anmelden oder registrieren')).toHaveLength(2));
    expect(screen.queryByText('Auswählen')).toBeNull();
  });

  // Lieber kein Preis als ein geratener: faellt get-prices aus, darf die Seite
  // keine Betraege erfinden und auch keine leeren Karten zeigen.
  it('sagt Bescheid, wenn die Preise nicht zu holen sind', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'kaputt' } });

    renderPricing(<PlusPricing />);

    // QueryBoundary zeigt bei einem Fehler seinen eigenen Fehlerzustand -
    // entscheidend ist, dass keine Karte mit einem Betrag erscheint.
    // Der laengere Zeitraum ist Absicht: usePrices versucht es einmal erneut
    // (retry: 1), und dazwischen liegt die Wartezeit von TanStack Query.
    await waitFor(() => expect(screen.getByText(/nicht geladen werden/i)).toBeTruthy(), {
      timeout: 5000,
    });
    expect(screen.queryByText('Auswählen')).toBeNull();
    expect(screen.queryByText(/9,90/)).toBeNull();
  });

  it('bietet einem bestehenden Abonnenten keinen zweiten Kauf an', async () => {
    mockSubscription([
      {
        plan: 'yearly',
        status: 'active',
        current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
        cancel_at_period_end: false,
      },
    ]);

    renderPricing(<PlusPricing />);

    await waitFor(() => expect(screen.getByText('Du hast Plus')).toBeTruthy());
    expect(screen.queryByText('Auswählen')).toBeNull();
  });

  // Es gibt keinen Testzeitraum (CLAUDE.md §Zugriff) - und das soll auf der
  // Seite stehen, nicht nur in der Architektur.
  it('sagt ausdruecklich, dass es keinen Testzeitraum gibt', async () => {
    renderPricing(<PlusPricing />);
    await waitFor(() => expect(screen.getByText(/keinen Testzeitraum/i)).toBeTruthy());
  });
});
