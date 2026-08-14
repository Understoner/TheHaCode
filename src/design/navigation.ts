import type { Href } from 'expo-router';
import type { DimensionValue } from 'react-native';

// typedRoutes (app.json) lehnt ein Href auf eine nicht existierende Route
// beim Typecheck ab - comingSoon-Eintraege bekommen deshalb bewusst kein
// href und sind nicht anklickbar, statt auf eine erfundene Route zu zeigen.
//
// Reihenfolge und Icon-Zuordnung folgen ui/references/05-10 (News, Kurse,
// Uebungen, Team) - dort kein eigener "Konfigurator"-Eintrag, der wird
// spaeter ueber Uebungen erreichbar sein. "Konto" kommt dazu, sobald Supabase
// Auth angebunden ist - bis dahin comingSoon wie Uebungen.
export type NavIcon = 'news' | 'kurse' | 'uebungen' | 'team' | 'konto';

export type NavItem =
  | { key: string; labelKey: string; icon: NavIcon; kind: 'link'; href: Href }
  | { key: string; labelKey: string; icon: NavIcon; kind: 'comingSoon' };

// Hoehe der fixen Tab-Bar unten (< 768px) - _layout.tsx reserviert per
// paddingBottom entsprechend Platz, damit der Footer nicht darunter verschwindet.
export const MOBILE_NAV_BREAKPOINT = 768;
export const MOBILE_TAB_BAR_HEIGHT = 64;

// Auf iPhones mit Home-Indikator liegen die untersten ~34px der fixen Leiste
// hinter der Systemgeste: die Beschriftungen sind dort halb verdeckt und der
// untere Rand ist kaum treffbar. env(safe-area-inset-bottom) legt die Leiste
// darueber, der Fallback 0px gilt auf allen Geraeten ohne Aussparung - dort
// aendert sich also nichts. Voraussetzung ist viewport-fit=cover im <head>
// (src/app/+html.tsx), sonst liefert env() immer 0.
//
// Der Cast ist noetig, weil React Natives Style-Typen nur fuer Nativ gedacht
// sind und keine CSS-Funktionen kennen - react-native-web reicht den Wert
// unveraendert an CSS durch (gleiche Ueberlegung wie position: 'fixed' in
// NavBar.tsx).
export const MOBILE_TAB_BAR_SAFE_HEIGHT =
  `calc(${MOBILE_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))` as unknown as DimensionValue;

// Listen (News/Kurse/Team): so viele Eintraege stehen nebeneinander in der
// "aktuell"-Reihe, bevor der Rest in eine schlanke Liste darunter faellt.
export const RECENT_ITEMS_COUNT = 3;

export const navItems: NavItem[] = [
  { key: 'news', labelKey: 'nav.news', icon: 'news', kind: 'link', href: '/' },
  { key: 'kurse', labelKey: 'nav.kurse', icon: 'kurse', kind: 'link', href: '/kurse' },
  { key: 'uebungen', labelKey: 'nav.uebungen', icon: 'uebungen', kind: 'comingSoon' },
  { key: 'team', labelKey: 'nav.team', icon: 'team', kind: 'link', href: '/team' },
  { key: 'konto', labelKey: 'nav.konto', icon: 'konto', kind: 'comingSoon' },
];
