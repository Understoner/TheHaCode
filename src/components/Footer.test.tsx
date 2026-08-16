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
  // Der Fussbereich ist der einzige Ort, an dem die Pflichtseiten erreichbar
  // sind. Faellt einer der Links weg, ist die Seite im Livebetrieb nicht mehr
  // vollstaendig - deshalb steht hier jeder einzeln.
  it.each([
    ['Impressum', '/impressum'],
    ['Datenschutzerklärung', '/datenschutz'],
    ['AGB', '/agb'],
    ['Haftungsausschluss', '/haftungsausschluss'],
  ])('verlinkt %s auf %s', (label, href) => {
    render(<Footer />);

    const link = screen.getByText(label);
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(href);
  });
});
