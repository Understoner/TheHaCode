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
}));

describe('NavBar', () => {
  it('zeigt Start, Kurse und Team als Links', () => {
    render(<NavBar />);

    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('Kurse')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
  });

  it('zeigt noch nicht gebaute Funktionen als "bald verfügbar", nicht als Link', () => {
    render(<NavBar />);

    expect(screen.getByText(/Übungen.*bald verfügbar/)).toBeTruthy();
    expect(screen.getByText(/Konfigurator.*bald verfügbar/)).toBeTruthy();
  });
});
