import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntitlementSync } from './useEntitlementSync';

const { channelMock, removeChannelMock, useAuthMock } = vi.hoisted(() => ({
  channelMock: vi.fn(),
  removeChannelMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { channel: channelMock, removeChannel: removeChannelMock },
}));
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children);
}

/** Ein Kanal, dessen subscribe sich so verhaelt, wie der Test es vorgibt. */
function kanal(subscribe: () => unknown) {
  const angemeldet = { subscribe: vi.fn(subscribe) };
  channelMock.mockReturnValue({ on: vi.fn(() => angemeldet) });
  return angemeldet;
}

describe('useEntitlementSync', () => {
  beforeEach(() => {
    channelMock.mockReset();
    removeChannelMock.mockReset().mockResolvedValue('ok');
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('abonniert nach der Anmeldung die eigene Profilzeile', () => {
    const angemeldet = kanal(() => undefined);

    renderHook(() => useEntitlementSync(), { wrapper });

    expect(channelMock).toHaveBeenCalledWith('entitlement:u1');
    expect(angemeldet.subscribe).toHaveBeenCalledTimes(1);
  });

  // Der Fall vom 14.09.2026: Safari lehnte den Websocket wegen der Content
  // Security Policy ab, realtime-js warf weiter, und die App blieb leer.
  it('reisst die App nicht mit, wenn der Websocket abgelehnt wird', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const angemeldet = kanal(() => {
      throw new Error('WebSocket not available: The operation is insecure.');
    });

    const { unmount } = renderHook(() => useEntitlementSync(), { wrapper });

    expect(warn).toHaveBeenCalled();
    // Auch der fehlgeschlagene Kanal wird beim Verlassen weggeraeumt.
    unmount();
    expect(removeChannelMock).toHaveBeenCalledWith(angemeldet);
  });

  it('oeffnet ohne Anmeldung keinen Kanal', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false });

    renderHook(() => useEntitlementSync(), { wrapper });

    expect(channelMock).not.toHaveBeenCalled();
  });
});
