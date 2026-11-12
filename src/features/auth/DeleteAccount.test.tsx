import { FunctionsHttpError } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { DeleteAccount } from './DeleteAccount';

const { invoke, signOut, useAuthMock, useSubscriptionMock } = vi.hoisted(() => ({
  invoke: vi.fn(),
  signOut: vi.fn(),
  useAuthMock: vi.fn(),
  useSubscriptionMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke }, auth: { signOut } },
}));

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

vi.mock('@/features/plus/usePlus', () => ({ useSubscription: useSubscriptionMock }));

const EMAIL = 'wer@example.at';

/** Aufklappen und die Adresse abtippen - ohne das bleibt der Knopf zu. */
function bestaetigen(text: string = EMAIL) {
  fireEvent.click(screen.getByText('Konto löschen'));
  fireEvent.change(screen.getByDisplayValue(''), { target: { value: text } });
}

describe('DeleteAccount', () => {
  beforeEach(() => {
    invoke.mockReset();
    signOut.mockReset().mockResolvedValue({ error: null });
    useAuthMock.mockReturnValue({ session: { user: { email: EMAIL } }, loading: false });
    useSubscriptionMock.mockReturnValue({ data: null });
  });

  // Review 11.11.2026, S1: das Abo endet mit dem Loeschen - das steht in der
  // Warnung, bevor jemand bestaetigt.
  it('weist auf ein laufendes Plus-Abo hin', () => {
    useSubscriptionMock.mockReturnValue({ data: { status: 'active' } });

    render(<DeleteAccount />);
    fireEvent.click(screen.getByText('Konto löschen'));

    expect(screen.getByText('Du hast ein laufendes Plus-Abo.', { exact: false })).toBeTruthy();
  });

  it('erwaehnt kein Abo, wenn keines laeuft', () => {
    useSubscriptionMock.mockReturnValue({ data: { status: 'canceled' } });

    render(<DeleteAccount />);
    fireEvent.click(screen.getByText('Konto löschen'));

    expect(screen.queryByText('Du hast ein laufendes Plus-Abo.', { exact: false })).toBeNull();
  });

  // Laesst sich das Abo bei Stripe nicht beenden, loescht der Server nicht.
  // Die allgemeine Meldung waere hier falsch: sie verschweigt, dass das Konto
  // noch da ist und warum.
  it('sagt es eigens, wenn das Abo nicht beendet werden konnte', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response('{"error":"subscription_cancel_failed"}', { status: 502 }),
      ),
    });

    render(<DeleteAccount />);
    bestaetigen();
    fireEvent.click(screen.getByText('Endgültig löschen'));

    await waitFor(() =>
      expect(screen.getByText('Dein Plus-Abo ließ sich nicht beenden.', { exact: false })).toBeTruthy(),
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  // Der eigentliche Schutz: ein einzelner Druck loescht nichts. Ginge das,
  // waere ein Fehlgriff neben "Abmelden" endgueltig.
  it('loescht beim ersten Druck noch nichts', () => {
    render(<DeleteAccount />);

    fireEvent.click(screen.getByText('Konto löschen'));

    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByText('Konto endgültig löschen?')).toBeTruthy();
  });

  it('laesst sich abbrechen', () => {
    render(<DeleteAccount />);

    fireEvent.click(screen.getByText('Konto löschen'));
    fireEvent.click(screen.getByText('Abbrechen'));

    expect(invoke).not.toHaveBeenCalled();
    expect(screen.queryByText('Konto endgültig löschen?')).toBeNull();
  });

  it('ruft erst nach der Bestaetigung die Edge Function und meldet danach ab', async () => {
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });

    render(<DeleteAccount />);
    bestaetigen();
    fireEvent.click(screen.getByText('Endgültig löschen'));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  // Der zweite Schutz, und der eigentliche Grund fuer die Eingabe: der
  // Bestaetigungsknopf sitzt genau dort, wo eben noch "Konto loeschen" stand.
  // Zweimal schnell gedrueckt waere das Konto sonst weg.
  it('loescht nicht ohne die abgetippte Adresse', () => {
    render(<DeleteAccount />);
    fireEvent.click(screen.getByText('Konto löschen'));
    fireEvent.click(screen.getByText('Endgültig löschen'));

    expect(invoke).not.toHaveBeenCalled();
  });

  it('loescht auch bei einer falschen Adresse nicht', () => {
    render(<DeleteAccount />);
    bestaetigen('jemand.anderes@example.at');
    fireEvent.click(screen.getByText('Endgültig löschen'));

    expect(invoke).not.toHaveBeenCalled();
  });

  // Grossschreibung ist bei E-Mail-Adressen keine Aussage - daran soll es
  // nicht scheitern.
  it('nimmt die Adresse auch in Grossbuchstaben an', async () => {
    invoke.mockResolvedValue({ data: null, error: null });

    render(<DeleteAccount />);
    bestaetigen('WER@EXAMPLE.AT');
    fireEvent.click(screen.getByText('Endgültig löschen'));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  });

  // Ein stiller Fehlschlag waere hier besonders schlecht: der Nutzer glaubt,
  // sein Konto sei weg, und es ist noch da.
  it('sagt es, wenn das Loeschen nicht geklappt hat', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    render(<DeleteAccount />);
    bestaetigen();
    fireEvent.click(screen.getByText('Endgültig löschen'));

    await waitFor(() =>
      expect(screen.getByText('Das Löschen hat nicht geklappt.', { exact: false })).toBeTruthy()
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});
