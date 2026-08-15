import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { DeleteAccount } from './DeleteAccount';

const { invoke, signOut } = vi.hoisted(() => ({ invoke: vi.fn(), signOut: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke }, auth: { signOut } },
}));

describe('DeleteAccount', () => {
  beforeEach(() => {
    invoke.mockReset();
    signOut.mockReset().mockResolvedValue({ error: null });
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
    fireEvent.click(screen.getByText('Konto löschen'));
    fireEvent.click(screen.getByText('Endgültig löschen'));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  // Ein stiller Fehlschlag waere hier besonders schlecht: der Nutzer glaubt,
  // sein Konto sei weg, und es ist noch da.
  it('sagt es, wenn das Loeschen nicht geklappt hat', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    render(<DeleteAccount />);
    fireEvent.click(screen.getByText('Konto löschen'));
    fireEvent.click(screen.getByText('Endgültig löschen'));

    await waitFor(() =>
      expect(screen.getByText('Das Löschen hat nicht geklappt.', { exact: false })).toBeTruthy()
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});
