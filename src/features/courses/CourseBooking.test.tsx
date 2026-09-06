import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { CourseBooking } from './CourseBooking';
import type { Course } from './useCoursesList';

const { invokeMock, fromMock, useAuthMock, openExternalUrlMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fromMock: vi.fn(),
  useAuthMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock, functions: { invoke: invokeMock }, rpc: vi.fn() },
}));

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

// expo-routers Link zieht react-native-webs unkompilierte Animated-Quelle
// (Flow-Syntax), die esbuild nicht parsen kann - wie in NavBar.test.tsx.
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

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 'kurs-1',
    slug: 'atem-camp',
    title: 'Atem-Camp',
    description: 'Vier Tage',
    booking_enabled: true,
    price_cents: 40000,
    deposit_cents: null,
    capacity: 10,
    starts_at: '2026-12-01T09:00:00Z',
    ...overrides,
  } as Course;
}

function mockBookings(rows: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const is = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ is }));
  fromMock.mockReturnValue({ select });
}

function renderBooking(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * Die Karte ist zugeklappt: erst der Knopf, dann das Formular. Der Knopf im
 * zugeklappten Zustand und der zum Absenden tragen dieselbe Beschriftung -
 * sichtbar ist aber immer nur einer, deshalb genuegt getByText.
 */
function aufklappen() {
  fireEvent.click(screen.getByText('Verbindlich buchen'));
}

describe('CourseBooking', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    fromMock.mockReset();
    openExternalUrlMock.mockReset();
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
    mockBookings([]);
  });

  it('zeigt den Preis', () => {
    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
    expect(screen.getByText(/400,00/)).toBeTruthy();
  });

  // de-AT stellt das Waehrungszeichen VOR den Betrag ("€ 200,00") und trennt
  // mit einem geschuetzten Leerzeichen - deshalb hier ein Muster statt eines
  // wortgleichen Vergleichs.
  it('nennt die Anzahlung, wenn der Kurs eine verlangt', () => {
    renderBooking(<CourseBooking course={course({ deposit_cents: 20000 })} seatsLeft={5} />);
    expect(screen.getByText(/Anzahlung.*200,00/)).toBeTruthy();
  });

  // Der Haken ist die Einbeziehung der AGB (§ 11). Ohne ihn darf nicht gebucht
  // werden - aber der Knopf muss trotzdem ausloesen und SAGEN, was fehlt. Ein
  // gesperrter Knopf ohne Begruendung war genau das Problem beim Test auf dev.
  // Auf der Karte selbst steht nur der Knopf. Bei siebzehn Terminen
  // untereinander war die Liste sonst nicht mehr ueberblickbar.
  it('zeigt auf der Karte nur den Knopf, nicht das Formular', () => {
    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);

    expect(screen.getByText('Verbindlich buchen')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('bucht ohne Haken nicht', () => {
    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
    aufklappen();

    fireEvent.click(screen.getByText('Verbindlich buchen'));

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('laesst sich wieder zuklappen', () => {
    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
    aufklappen();
    expect(screen.getByRole('checkbox')).toBeTruthy();

    fireEvent.click(screen.getByText('Abbrechen'));

    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('sagt beim Druck ohne Haken, was fehlt', () => {
    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
    aufklappen();

    fireEvent.click(screen.getByText('Verbindlich buchen'));

    expect(screen.getByRole('alert').textContent).toMatch(/AGB/);
  });

  it('nimmt den Hinweis zurueck, sobald der Haken sitzt', () => {
    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
    aufklappen();

    fireEvent.click(screen.getByText('Verbindlich buchen'));
    expect(screen.queryByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('bucht nach dem Haken und schickt zu Stripe', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/c/pay/cs_test' }, error: null });

    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
    aufklappen();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Verbindlich buchen'));

    await waitFor(() =>
      expect(openExternalUrlMock).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test'),
    );

    // Ohne guest im Koerper: wer angemeldet ist, bucht als Konto - die Adresse
    // steht dort und wird nicht aus dem Formular genommen.
    expect(invokeMock).toHaveBeenCalledWith('create-course-checkout', {
      method: 'POST',
      body: { courseSlug: 'atem-camp', agbAccepted: true },
    });
  });

  it('meldet einen ausgebuchten Kurs verstaendlich, statt ihn anzubieten', () => {
    renderBooking(<CourseBooking course={course()} seatsLeft={0} />);

    expect(screen.getByText('Ausgebucht')).toBeTruthy();
    expect(screen.queryByText('Verbindlich buchen')).toBeNull();
  });

  // ---------- Ohne Konto buchen ----------
  // Ein Kurs ist ein Kaufvorgang, kein Zugang. Vor dem 06.09.2026 stand hier
  // ein Verweis auf die Anmeldung und sonst nichts - eine Huerde ohne
  // Gegenwert.
  describe('als Gast', () => {
    beforeEach(() => {
      useAuthMock.mockReturnValue({ session: null, loading: false });
    });

    // Auch ohne Konto steht auf der Karte zuerst nur der Knopf - das war der
    // Anlass fuer die ganze Umstellung.
    it('zeigt auf der Karte nur den Knopf', () => {
      renderBooking(<CourseBooking course={course()} seatsLeft={5} />);

      expect(screen.getByText('Verbindlich buchen')).toBeTruthy();
      expect(screen.queryByLabelText('E-Mail-Adresse')).toBeNull();
      expect(screen.queryByText('Anmelden oder registrieren')).toBeNull();
    });

    it('bietet Nichtangemeldeten das Buchen an, statt sie wegzuschicken', () => {
      renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
      aufklappen();

      expect(screen.getByLabelText('Vor- und Nachname')).toBeTruthy();
      expect(screen.getByLabelText('E-Mail-Adresse')).toBeTruthy();
      expect(screen.getByText('Verbindlich buchen')).toBeTruthy();
    });

    // Der Weg ueber ein Konto bleibt sichtbar: wer eines hat, soll es
    // benutzen, dann steht die Buchung spaeter auch dort.
    // Nach dem Klick steht beides nebeneinander: als Gast buchen, oder ueber
    // ein Konto gehen. Das ist die Auswahl, um die es geht.
    it('stellt nach dem Klick Gastbuchung und Konto zur Wahl', () => {
      renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
      aufklappen();

      expect(screen.getByLabelText('E-Mail-Adresse')).toBeTruthy();
      expect(screen.getByText('Anmelden oder registrieren')).toBeTruthy();
    });

    it('bucht ohne Name und Adresse nicht und sagt, was fehlt', async () => {
      renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
      aufklappen();

      fireEvent.click(screen.getByText('Verbindlich buchen'));

      await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('bucht ohne Haken bei den AGB nicht', async () => {
      renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
      aufklappen();

      fireEvent.change(screen.getByLabelText('Vor- und Nachname'), {
        target: { value: 'Gerda Gast' },
      });
      fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), {
        target: { value: 'gerda@example.at' },
      });
      fireEvent.click(screen.getByText('Verbindlich buchen'));

      await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/AGB/));
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('schickt Name und Adresse mit und wechselt zu Stripe', async () => {
      invokeMock.mockResolvedValue({
        data: { url: 'https://checkout.stripe.com/c/pay/cs_gast' },
        error: null,
      });

      renderBooking(<CourseBooking course={course()} seatsLeft={5} />);
      aufklappen();

      fireEvent.change(screen.getByLabelText('Vor- und Nachname'), {
        target: { value: '  Gerda Gast  ' },
      });
      fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), {
        target: { value: 'gerda@example.at' },
      });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByText('Verbindlich buchen'));

      await waitFor(() =>
        expect(openExternalUrlMock).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_gast'),
      );

      expect(invokeMock).toHaveBeenCalledWith('create-course-checkout', {
        method: 'POST',
        body: {
          courseSlug: 'atem-camp',
          agbAccepted: true,
          guest: { email: 'gerda@example.at', name: 'Gerda Gast' },
        },
      });
    });

    // Ein ausgebuchter Kurs sagt das - er zeigt kein Formular, das ohnehin an
    // der Reservierung scheitern wuerde.
    it('bietet bei einem ausgebuchten Kurs kein Formular an', () => {
      renderBooking(<CourseBooking course={course()} seatsLeft={0} />);

      expect(screen.queryByText('Verbindlich buchen'), 'gar kein Knopf').toBeNull();
      expect(screen.queryByLabelText('E-Mail-Adresse')).toBeNull();
      expect(screen.getByText(/Alle Plätze sind vergeben/)).toBeTruthy();
    });
  });

  it('zeigt eine bestehende Buchung, statt sie ein zweites Mal anzubieten', async () => {
    mockBookings([{ id: 'b1', course_id: 'kurs-1', status: 'confirmed' }]);

    renderBooking(<CourseBooking course={course()} seatsLeft={5} />);

    await waitFor(() => expect(screen.getByText(/Du bist dabei/)).toBeTruthy());
    expect(screen.queryByText('Verbindlich buchen')).toBeNull();
  });

  // Der Fehlertext kommt aus errors.json und traegt eine Handlungsoption -
  // kein durchgereichter Techniktext (CLAUDE.md).
  it('uebersetzt eine Absage der Edge Function in eine deutsche Meldung', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: '{"error":"sold_out"}' } });

    renderBooking(<CourseBooking course={course()} seatsLeft={1} />);
    aufklappen();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Verbindlich buchen'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toMatch(/ausgebucht/i);
  });

  it('zeigt bei einem nicht buchbaren Kurs gar nichts', () => {
    const { container } = renderBooking(
      <CourseBooking course={course({ booking_enabled: false })} seatsLeft={5} />,
    );
    expect(container.textContent).toBe('');
  });
});
