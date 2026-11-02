import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { NavBar } from './NavBar';

// expo-router's Link zieht react-native-web's unkompilierte Animated-Quelle
// (Flow-Syntax), die esbuild nicht parsen kann. Der Test prueft NavBar, nicht
// expo-router selbst - ein einfacher Stub reicht.
// vi.hoisted, weil vi.mock vor allen Importen und Konstanten laeuft.
const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('expo-router', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => pathname.current,
}));

// react-native-svg bringt wie expo-router unkompilierte Quellen mit; der Mond
// in der Kopfzeile ist fuer diesen Test belanglos.
vi.mock('@/components/MoonMark', () => ({ MoonMark: () => null }));
// Ebenso die Tab-Leiste des Vorschlags "Mondlicht Mobile".
vi.mock('@/components/MobileTabBar', () => ({ MobileTabBar: () => null }));

// Mit Mondlicht (seit 02.11.2026 in beiden Umgebungen) navigiert der Desktop
// ueber die Pillen in der Kopfzeile, das Handy ueber MobileTabBar (oben
// gestubbt; ihr Layout prueft e2e/smoke.spec.ts an echtem Layout). Links in
// der Kopfzeile steht immer der Mond als Weg zur Startseite.
function desktop() {
  const el = document.querySelector('[data-thc="nav-desktop"]');
  if (!(el instanceof HTMLElement)) throw new Error('Die Desktop-Navigation muss im HTML stehen');
  return el;
}

describe('NavBar', () => {
  it('zeigt am Desktop alle Eintraege als Pillen', () => {
    render(<NavBar />);

    for (const label of ['News', 'Kurse', 'Sessions', 'Tagebuch', 'Team', 'Konto']) {
      expect(within(desktop()).getByText(label, { exact: false })).toBeTruthy();
    }
  });

  it('fuehrt ueber den Mond immer zur Startseite', () => {
    render(<NavBar />);

    const home = screen.getByLabelText('Zur Startseite', { exact: false });
    expect(home.closest('a')?.getAttribute('href') ?? home.getAttribute('href')).toBe('/');
  });

  it('markiert die aktuelle Seite', () => {
    pathname.current = '/kurse';
    try {
      render(<NavBar />);
      expect(desktop().querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe('/kurse');
    } finally {
      pathname.current = '/';
    }
  });

  it('fuehrt jeden Eintrag auf eine echte Route', () => {
    render(<NavBar />);

    // Sessions ist seit Migration 0007 eine echte Route, Konto seit der
    // Anbindung von Supabase Auth. Damit ist kein Eintrag mehr ein
    // Platzhalter - wer tippt, landet auch irgendwo.
    expect(screen.queryByText('bald verfügbar', { exact: false })).toBeNull();

    for (const found of screen.getAllByText('Konto', { exact: false })) {
      expect(found.closest('a')?.getAttribute('href')).toBe('/konto');
    }
    for (const found of screen.getAllByText('Tagebuch', { exact: false })) {
      expect(found.closest('a')?.getAttribute('href')).toBe('/habit-tracker');
    }
  });
});
