import { describe, expect, it } from 'vitest';

import { safeExternalUrl } from './externalLink';

describe('safeExternalUrl', () => {
  it('laesst gewoehnliche Anmeldelinks durch', () => {
    expect(safeExternalUrl('https://kurse.example.at/anmeldung')).toBe('https://kurse.example.at/anmeldung');
    expect(safeExternalUrl('http://example.at')).toBe('http://example.at');
  });

  it('behandelt fehlende Angaben als nicht vorhanden', () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(safeExternalUrl('')).toBeNull();
  });

  // Der eigentliche Grund fuer die Pruefung: ein solcher Wert in
  // courses.signup_url wuerde ungeprueft im Kontext der eigenen Seite laufen.
  it('weist Schemata ab, die Code ausfuehren oder ins Dateisystem zeigen', () => {
    expect(safeExternalUrl('javascript:alert(document.cookie)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('weist an, was gar keine vollstaendige URL ist', () => {
    expect(safeExternalUrl('kurse/anmeldung')).toBeNull();
    expect(safeExternalUrl('example.at')).toBeNull();
  });
});
