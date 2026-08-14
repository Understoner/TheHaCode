import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { NavBar } from './NavBar';

// expo-router's Link zieht react-native-web's unkompilierte Animated-Quelle
// (Flow-Syntax), die esbuild nicht parsen kann. Der Test prueft NavBar, nicht
// expo-router selbst - ein einfacher Stub reicht.
vi.mock('expo-router', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/',
}));

// Seit dem Umstieg auf CSS-Breakpoints stehen BEIDE Navigationsfassungen im
// HTML; sichtbar ist je nach Fensterbreite genau eine, ausgeblendet per Media
// Query (src/design/responsive.ts). jsdom wertet keine Media Queries aus, hier
// sind also immer beide zu sehen - genau das pruefen die Tests unten. Dass die
// sichtbare Fassung dann auch richtig aussieht, prueft der Playwright-Test in
// e2e/smoke.spec.ts an echtem Layout.
function variants() {
  const desktop = document.querySelector('[data-thc="nav-desktop"]');
  const mobile = document.querySelector('[data-thc="nav-mobile"]');
  if (!(desktop instanceof HTMLElement) || !(mobile instanceof HTMLElement)) {
    throw new Error('Beide Navigationsfassungen muessen im HTML stehen');
  }
  return { desktop, mobile };
}

describe('NavBar', () => {
  it('rendert beide Fassungen, damit CSS und nicht JavaScript entscheidet', () => {
    render(<NavBar />);

    const { desktop, mobile } = variants();
    for (const label of ['News', 'Kurse', 'Team', 'Sessions', 'Konto']) {
      expect(within(desktop).getByText(label, { exact: false })).toBeTruthy();
      expect(within(mobile).getByText(label)).toBeTruthy();
    }
  });

  it('kennzeichnet die mobile Fassung als Navigationsbereich', () => {
    render(<NavBar />);

    expect(variants().mobile.tagName).toBe('NAV');
  });

  it('markiert die aktuelle Seite in beiden Fassungen', () => {
    render(<NavBar />);

    const { desktop, mobile } = variants();
    expect(desktop.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe('/');
    expect(mobile.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe('/');
  });

  it('zeigt noch nicht gebaute Funktionen in keiner Fassung als Link', () => {
    render(<NavBar />);

    // Sessions ist seit Migration 0007 eine echte Route; uebrig bleibt Konto,
    // das an Supabase Auth haengt.
    for (const label of ['Konto']) {
      for (const found of screen.getAllByText(label, { exact: false })) {
        expect(found.closest('a')).toBeNull();
      }
    }
  });
});
