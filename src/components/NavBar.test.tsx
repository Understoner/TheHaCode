import { render, screen } from '@testing-library/react';
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

describe('NavBar', () => {
  it('zeigt News, Kurse und Team als Links', () => {
    render(<NavBar />);

    expect(screen.getByText('News')).toBeTruthy();
    expect(screen.getByText('Kurse')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
  });

  it('zeigt noch nicht gebaute Funktionen nicht als Link', () => {
    render(<NavBar />);

    const uebungen = screen.getByText('Übungen');
    expect(uebungen.closest('a')).toBeNull();

    const konto = screen.getByText('Konto');
    expect(konto.closest('a')).toBeNull();
  });
});
