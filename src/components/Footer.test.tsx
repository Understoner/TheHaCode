import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { Footer } from './Footer';

// Siehe NavBar.test.tsx: Link-Stub umgeht react-native-webs unkompilierte
// Flow-Quelle, die esbuild nicht parsen kann.
vi.mock('expo-router', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Footer', () => {
  it('zeigt Links zu Impressum und Datenschutzerklärung', () => {
    render(<Footer />);

    expect(screen.getByText('Impressum')).toBeTruthy();
    expect(screen.getByText('Datenschutzerklärung')).toBeTruthy();
  });
});
