import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { AuthPanel } from './AuthPanel';

const { signInWithPassword, signUp, resetPasswordForEmail, signInWithOAuth } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword, signUp, resetPasswordForEmail, signInWithOAuth } },
}));

// Wie in NavBar.test.tsx: expo-routers Link zieht react-native-webs
// unkompilierte Animated-Quelle nach, die esbuild nicht parsen kann.
vi.mock('expo-router', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

function feld(label: string) {
  return screen.getByLabelText(label);
}

describe('AuthPanel', () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signUp.mockReset();
    resetPasswordForEmail.mockReset();
    signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null });
    // Google und Apple erscheinen nur, wenn sie in Supabase wirklich
    // eingerichtet sind - die Variable sagt das (src/features/auth/oauth.ts).
    vi.stubEnv('EXPO_PUBLIC_AUTH_PROVIDERS', 'google,apple');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('startet beim Anmelden und laesst zum Registrieren wechseln', () => {
    render(<AuthPanel />);

    expect(feld('Passwort')).toBeTruthy();
    expect(screen.queryByLabelText('Passwort wiederholen')).toBeNull();

    fireEvent.click(screen.getByText('Registrieren'));

    expect(screen.getByLabelText('Passwort wiederholen')).toBeTruthy();
  });

  it('meldet mit E-Mail und Passwort an', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null });

    render(<AuthPanel />);
    fireEvent.change(feld('E-Mail'), { target: { value: 'jemand@example.at' } });
    fireEvent.change(feld('Passwort'), { target: { value: 'geheim1234' } });
    fireEvent.click(screen.getByText('Jetzt anmelden'));

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'jemand@example.at',
        password: 'geheim1234',
      })
    );
  });

  // Der wichtigste Fall fuer den Nutzer: falsches Passwort. Er darf keinen
  // englischen Serversatz und keinen Fehlercode zu sehen bekommen.
  it('zeigt bei falschen Zugangsdaten einen deutschen Hinweis mit Handlungsoption', async () => {
    signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    });

    render(<AuthPanel />);
    fireEvent.change(feld('E-Mail'), { target: { value: 'jemand@example.at' } });
    fireEvent.change(feld('Passwort'), { target: { value: 'falsch123' } });
    fireEvent.click(screen.getByText('Jetzt anmelden'));

    await waitFor(() =>
      expect(
        screen.getByText('E-Mail-Adresse oder Passwort stimmen nicht.', { exact: false })
      ).toBeTruthy()
    );
    expect(screen.queryByText('Invalid login credentials')).toBeNull();
  });

  it('sendet ohne gueltige Eingaben gar nicht erst ab', async () => {
    render(<AuthPanel />);
    fireEvent.change(feld('E-Mail'), { target: { value: 'keine-adresse' } });
    fireEvent.change(feld('Passwort'), { target: { value: 'geheim1234' } });
    fireEvent.click(screen.getByText('Jetzt anmelden'));

    await waitFor(() =>
      expect(
        screen.getByText('Diese E-Mail-Adresse sieht nicht vollständig aus.', { exact: false })
      ).toBeTruthy()
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('gibt den freiwilligen Namen an Supabase weiter und erklaert die Bestaetigungsmail', async () => {
    // Kein session im Ergebnis: das Projekt verlangt eine Bestaetigung per Mail.
    signUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });

    render(<AuthPanel />);
    fireEvent.click(screen.getByText('Registrieren'));

    fireEvent.change(feld('E-Mail'), { target: { value: 'neu@example.at' } });
    fireEvent.change(feld('Name (freiwillig)'), { target: { value: 'Michael' } });
    fireEvent.change(feld('Passwort'), { target: { value: 'geheim1234' } });
    fireEvent.change(feld('Passwort wiederholen'), { target: { value: 'geheim1234' } });
    fireEvent.click(screen.getByText('Konto anlegen'));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: 'neu@example.at',
        password: 'geheim1234',
        options: { data: { full_name: 'Michael' } },
      })
    );

    await waitFor(() => expect(screen.getByText('Fast geschafft')).toBeTruthy());
    expect(screen.getByText('neu@example.at', { exact: false })).toBeTruthy();
  });

  it('weist auf ein vorhandenes Konto hin statt auf einen Serverfehler', async () => {
    signUp.mockResolvedValue({
      data: {},
      error: { code: 'user_already_exists', status: 422, message: 'User already registered' },
    });

    render(<AuthPanel />);
    fireEvent.click(screen.getByText('Registrieren'));

    fireEvent.change(feld('E-Mail'), { target: { value: 'alt@example.at' } });
    fireEvent.change(feld('Passwort'), { target: { value: 'geheim1234' } });
    fireEvent.change(feld('Passwort wiederholen'), { target: { value: 'geheim1234' } });
    fireEvent.click(screen.getByText('Konto anlegen'));

    await waitFor(() =>
      expect(
        screen.getByText('Für diese E-Mail-Adresse gibt es schon ein Konto.', { exact: false })
      ).toBeTruthy()
    );
  });

  // Der Standard ist "kein Anbieter": ein Knopf, der auf einer
  // Supabase-Fehlerseite endet, waere schlimmer als gar keiner.
  it('zeigt Google und Apple gar nicht erst, solange sie nicht eingerichtet sind', () => {
    vi.stubEnv('EXPO_PUBLIC_AUTH_PROVIDERS', '');

    render(<AuthPanel />);

    expect(screen.queryByText('Mit Google anmelden')).toBeNull();
    expect(screen.queryByText('Mit Apple anmelden')).toBeNull();
    expect(screen.queryByText('oder')).toBeNull();
    // Der Weg mit E-Mail und Passwort bleibt davon unberuehrt.
    expect(screen.getByText('Jetzt anmelden')).toBeTruthy();
  });

  it('zeigt nur die Anbieter, die wirklich eingeschaltet sind', () => {
    vi.stubEnv('EXPO_PUBLIC_AUTH_PROVIDERS', 'google');

    render(<AuthPanel />);

    expect(screen.getByText('Mit Google anmelden')).toBeTruthy();
    expect(screen.queryByText('Mit Apple anmelden')).toBeNull();
  });

  it('schickt den Nutzer zum eingerichteten Anbieter', async () => {
    render(<AuthPanel />);

    fireEvent.click(screen.getByText('Mit Google anmelden'));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(signInWithOAuth.mock.calls[0][0].provider).toBe('google');
    expect(screen.getByText('Mit Apple anmelden')).toBeTruthy();
  });

  it('erklaert es, wenn der Anbieter gar nicht eingerichtet ist', async () => {
    signInWithOAuth.mockResolvedValue({
      data: {},
      error: { code: 'provider_disabled', status: 400, message: 'Unsupported provider' },
    });

    render(<AuthPanel />);
    fireEvent.click(screen.getByText('Mit Apple anmelden'));

    await waitFor(() =>
      expect(
        screen.getByText('Diese Anmeldung ist gerade nicht eingerichtet.', { exact: false })
      ).toBeTruthy()
    );
  });

  it('fordert einen Link zum Zuruecksetzen an - mit Ziel /passwort-neu', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    render(<AuthPanel />);
    fireEvent.click(screen.getByText('Passwort vergessen?'));

    fireEvent.change(feld('E-Mail'), { target: { value: 'jemand@example.at' } });
    fireEvent.click(screen.getByText('Link schicken'));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledTimes(1));
    const [adresse, optionen] = resetPasswordForEmail.mock.calls[0];
    expect(adresse).toBe('jemand@example.at');
    expect(String(optionen.redirectTo)).toContain('/passwort-neu');
  });

  // Supabase antwortet auch fuer unbekannte Adressen mit Erfolg, damit sich
  // nicht durchprobieren laesst, wer ein Konto hat. Der Text darf deshalb
  // nicht behaupten, die Mail sei sicher unterwegs.
  it('bestaetigt den Versand, ohne die Existenz des Kontos zu verraten', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    render(<AuthPanel />);
    fireEvent.click(screen.getByText('Passwort vergessen?'));
    fireEvent.change(feld('E-Mail'), { target: { value: 'unbekannt@example.at' } });
    fireEvent.click(screen.getByText('Link schicken'));

    await waitFor(() => expect(screen.getByText('Schau in dein Postfach')).toBeTruthy());
    expect(screen.getByText('Falls es zu', { exact: false })).toBeTruthy();
  });

  it('fuehrt vom Zuruecksetzen wieder zum Anmelden zurueck', () => {
    render(<AuthPanel />);

    fireEvent.click(screen.getByText('Passwort vergessen?'));
    expect(screen.getByText('Link schicken')).toBeTruthy();

    fireEvent.click(screen.getByText('Zurück zum Anmelden'));
    expect(screen.getByText('Jetzt anmelden')).toBeTruthy();
  });
});
