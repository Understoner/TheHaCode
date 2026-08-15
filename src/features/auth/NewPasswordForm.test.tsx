import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { NewPasswordForm } from './NewPasswordForm';

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { updateUser } } }));

vi.mock('expo-router', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

describe('NewPasswordForm', () => {
  beforeEach(() => {
    updateUser.mockReset();
  });

  it('speichert das neue Passwort und bestaetigt es', async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });

    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText('Neues Passwort'), {
      target: { value: 'neuesgeheim1' },
    });
    fireEvent.change(screen.getByLabelText('Passwort wiederholen'), {
      target: { value: 'neuesgeheim1' },
    });
    fireEvent.click(screen.getByText('Passwort speichern'));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'neuesgeheim1' }));
    await waitFor(() => expect(screen.getByText('Passwort geändert')).toBeTruthy());
  });

  it('sendet nicht ab, wenn die Wiederholung abweicht', async () => {
    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText('Neues Passwort'), {
      target: { value: 'neuesgeheim1' },
    });
    fireEvent.change(screen.getByLabelText('Passwort wiederholen'), {
      target: { value: 'etwasanderes' },
    });
    fireEvent.click(screen.getByText('Passwort speichern'));

    await waitFor(() =>
      expect(screen.getByText('Die beiden Passwörter sind nicht gleich.', { exact: false })).toBeTruthy()
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  // Supabase lehnt das bisherige Passwort ab. Ohne eigene Uebersetzung stuende
  // hier "New password should be different from the old password".
  it('uebersetzt den Hinweis auf das unveraenderte Passwort', async () => {
    updateUser.mockResolvedValue({
      data: {},
      error: { code: 'same_password', status: 422, message: 'New password should be different' },
    });

    render(<NewPasswordForm />);
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'altesgeheim1' } });
    fireEvent.change(screen.getByLabelText('Passwort wiederholen'), {
      target: { value: 'altesgeheim1' },
    });
    fireEvent.click(screen.getByText('Passwort speichern'));

    await waitFor(() =>
      expect(screen.getByText('Das ist dein bisheriges Passwort.', { exact: false })).toBeTruthy()
    );
  });
});
