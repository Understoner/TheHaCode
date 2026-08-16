import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '@/i18n';
import legal from '@/i18n/locales/de/legal.json';

import { LEGAL_DOCUMENTS, LegalDocument, type LegalSection } from './LegalDocument';

const PLACEHOLDER_BANNER = 'Platzhalterdaten — vor Livegang ausfüllen.';

function sectionsOf(key: string): LegalSection[] {
  return (legal as unknown as Record<string, LegalSection[]>)[`${key}.sections`];
}

describe('LegalDocument', () => {
  it.each([...LEGAL_DOCUMENTS])('rendert %s mit Titel und allen Abschnitten', (documentKey) => {
    render(<LegalDocument documentKey={documentKey} />);

    const sections = sectionsOf(documentKey);
    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      expect(screen.getByText(section.title)).toBeTruthy();
    }
  });

  // Der eigentliche Zweck des Banners: solange irgendwo noch ein Platzhalter
  // steht, darf die Seite nicht so aussehen, als waere sie fertig - und zwar
  // auch in Production (siehe LegalPlaceholderBanner). Geprueft wird hier der
  // Text, der tatsaechlich gerendert wird, nicht eine von Hand gepflegte
  // Liste von Feldern.
  it('zeigt den Warnbanner, solange Impressum und AGB Platzhalter enthalten', () => {
    render(<LegalDocument documentKey="impressum" />);
    expect(screen.getByText(PLACEHOLDER_BANNER)).toBeTruthy();
  });

  it('zeigt keinen Warnbanner, wo keine Platzhalter mehr stehen', () => {
    // Der Haftungsausschluss nennt keine Unternehmensdaten und ist deshalb
    // schon vollstaendig. Er ist damit die Gegenprobe: der Banner haengt am
    // Inhalt, nicht daran, dass er einfach immer erscheint.
    render(<LegalDocument documentKey="haftung" />);
    expect(screen.queryByText(PLACEHOLDER_BANNER)).toBeNull();
  });

  it('enthält im Haftungsausschluss die sicherheitskritischen Hinweise', () => {
    // Diese beiden Sätze sind der Grund, warum es das Dokument gibt. Eine
    // Umformulierung ist in Ordnung - ein ersatzloses Streichen soll auffallen.
    const lines = sectionsOf('haftung').flatMap((section) => section.lines.join(' '));
    const text = lines.join(' ');

    expect(text).toMatch(/Wasser/);
    expect(text).toMatch(/Fahrzeug/);
    expect(text).toMatch(/Schwangerschaft/);
    expect(text).toMatch(/Epilepsie/);
  });
});
