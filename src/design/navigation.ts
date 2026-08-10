import type { Href } from 'expo-router';

// typedRoutes (app.json) lehnt ein Href auf eine nicht existierende Route
// beim Typecheck ab - comingSoon-Eintraege bekommen deshalb bewusst kein
// href und sind nicht anklickbar, statt auf eine erfundene Route zu zeigen.
//
// Reihenfolge und Icon-Zuordnung folgen ui/references/05-10 (News, Kurse,
// Uebungen, Team) - dort kein eigener "Konfigurator"-Eintrag, der wird
// spaeter ueber Uebungen erreichbar sein.
export type NavIcon = 'news' | 'kurse' | 'uebungen' | 'team';

export type NavItem =
  | { key: string; labelKey: string; icon: NavIcon; kind: 'link'; href: Href }
  | { key: string; labelKey: string; icon: NavIcon; kind: 'comingSoon' };

// Hoehe der fixen Tab-Bar unten (< 768px) - _layout.tsx reserviert per
// paddingBottom entsprechend Platz, damit der Footer nicht darunter verschwindet.
export const MOBILE_NAV_BREAKPOINT = 768;
export const MOBILE_TAB_BAR_HEIGHT = 64;

// Listen (News/Kurse/Team): so viele Eintraege stehen nebeneinander in der
// "aktuell"-Reihe, bevor der Rest in eine schlanke Liste darunter faellt.
export const RECENT_ITEMS_COUNT = 3;

export const navItems: NavItem[] = [
  { key: 'news', labelKey: 'nav.news', icon: 'news', kind: 'link', href: '/' },
  { key: 'kurse', labelKey: 'nav.kurse', icon: 'kurse', kind: 'link', href: '/kurse' },
  { key: 'uebungen', labelKey: 'nav.uebungen', icon: 'uebungen', kind: 'comingSoon' },
  { key: 'team', labelKey: 'nav.team', icon: 'team', kind: 'link', href: '/team' },
];
