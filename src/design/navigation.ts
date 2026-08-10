import type { Href } from 'expo-router';

// typedRoutes (app.json) lehnt ein Href auf eine nicht existierende Route
// beim Typecheck ab - comingSoon-Eintraege bekommen deshalb bewusst kein
// href und sind nicht anklickbar, statt auf eine erfundene Route zu zeigen.
export type NavItem =
  | { key: string; labelKey: string; kind: 'link'; href: Href }
  | { key: string; labelKey: string; kind: 'comingSoon' };

export const navItems: NavItem[] = [
  { key: 'start', labelKey: 'nav.start', kind: 'link', href: '/' },
  { key: 'kurse', labelKey: 'nav.kurse', kind: 'link', href: '/kurse' },
  { key: 'team', labelKey: 'nav.team', kind: 'link', href: '/team' },
  { key: 'uebungen', labelKey: 'nav.uebungen', kind: 'comingSoon' },
  { key: 'konfigurator', labelKey: 'nav.konfigurator', kind: 'comingSoon' },
];
