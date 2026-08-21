import { describe, expect, it } from 'vitest';

import de from '@/i18n/locales/de/errors.json';
import { portalErrorCode } from './plus';

describe('portalErrorCode', () => {
  it('erkennt die Absagen von create-portal', () => {
    expect(portalErrorCode({ error: 'no_customer' })).toBe('no_customer');
    expect(portalErrorCode({ error: 'portal_not_configured' })).toBe('portal_not_configured');
  });

  // supabase-js reicht bei einem Fehlerstatus den Antwortkoerper als Text
  // durch, nicht als Objekt.
  it('findet den Code auch im Text der Meldung', () => {
    expect(portalErrorCode({ message: 'Edge Function returned {"error":"no_customer"}' })).toBe(
      'no_customer',
    );
  });

  it('macht aus allem Unbekannten "unknown"', () => {
    expect(portalErrorCode(new Error('failed to fetch'))).toBe('unknown');
    expect(portalErrorCode(null)).toBe('unknown');
    expect(portalErrorCode({ error: 'irgendwas' })).toBe('unknown');
  });

  // Ein Code ohne hinterlegten Text waere ein roher Schluessel auf dem
  // Bildschirm - genau das, was CLAUDE.md verbietet.
  it('zu jedem Code gibt es einen deutschen Text mit Handlungsoption', () => {
    const texte = de as Record<string, string>;

    for (const code of ['no_customer', 'portal_not_configured', 'unknown']) {
      const text = texte[`konto.portal.${code}`];
      expect(text, `Text fuer ${code} fehlt`).toBeTruthy();
      expect(text, `Text fuer ${code} nennt keinen naechsten Schritt`).toMatch(
        /office@thehacode\.com|versuch/i,
      );
    }
  });
});
