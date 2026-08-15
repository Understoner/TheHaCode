import { describe, expect, it } from 'vitest';

import { authErrorKey, authErrorMessageKey, urlErrorMessageKey } from './authErrors';
import de from '@/i18n/locales/de/errors.json';

describe('authErrorKey', () => {
  it('unterscheidet falsche Zugangsdaten von einer nicht bestaetigten Adresse', () => {
    expect(authErrorKey({ code: 'invalid_credentials', status: 400 })).toBe('invalidCredentials');
    expect(authErrorKey({ code: 'email_not_confirmed', status: 400 })).toBe('emailNotConfirmed');
  });

  it('erkennt eine bereits vergebene Adresse', () => {
    expect(authErrorKey({ code: 'user_already_exists', status: 422 })).toBe('emailTaken');
    expect(authErrorKey({ code: 'email_exists', status: 422 })).toBe('emailTaken');
  });

  it('erkennt zu viele Versuche auch ohne Code', () => {
    expect(authErrorKey({ code: 'over_email_send_rate_limit', status: 429 })).toBe('rateLimited');
    expect(authErrorKey({ status: 429, message: 'Too many requests' })).toBe('rateLimited');
  });

  // Ein Verbindungsfehler ist kein Anmeldefehler: "E-Mail oder Passwort stimmen
  // nicht" waere hier schlicht falsch und schickt den Nutzer auf die falsche
  // Suche.
  it('trennt Verbindungsfehler von Anmeldefehlern', () => {
    expect(authErrorKey({ status: 0, message: 'Failed to fetch' })).toBe('network');
    expect(authErrorKey({ message: 'Load failed' })).toBe('network');
  });

  it('faellt bei Unbekanntem auf einen allgemeinen Hinweis zurueck', () => {
    expect(authErrorKey({ code: 'irgendwas_neues', status: 500 })).toBe('unknown');
    expect(authErrorKey(null)).toBe('unknown');
    expect(authErrorKey('kaputt')).toBe('unknown');
  });
});

describe('authErrorMessageKey', () => {
  // Ein Schluessel ohne Text waere im Browser der Schluessel selbst - also
  // "errors:auth.weakPassword" mitten auf der Seite.
  it('zeigt auf einen Text, den es wirklich gibt', () => {
    const texte = de as Record<string, string>;
    const faelle = [
      { code: 'invalid_credentials' },
      { code: 'email_not_confirmed' },
      { code: 'user_already_exists' },
      { code: 'weak_password' },
      { code: 'over_request_rate_limit' },
      { code: 'signup_disabled' },
      { code: 'otp_expired' },
      { code: 'same_password' },
      { status: 0 },
      {},
    ];

    for (const fall of faelle) {
      const key = authErrorMessageKey(fall).replace('errors:', '');
      expect(texte[key], `Text fuer ${key} fehlt`).toBeTruthy();
    }
  });
});

describe('urlErrorMessageKey', () => {
  // Ein abgelaufener Link meldet sich nicht als Antwort auf einen Aufruf,
  // sondern ueber die Adresse, auf die zurueckgesprungen wird - je nach Ablauf
  // als Query oder als Fragment. Beides muss ankommen.
  it('liest den Fehler aus der Query', () => {
    expect(
      urlErrorMessageKey('https://app.example.at/passwort-neu?error=invalid_request&error_code=otp_expired')
    ).toBe('errors:auth.linkExpired');
  });

  it('liest den Fehler auch aus dem Fragment', () => {
    expect(
      urlErrorMessageKey('https://app.example.at/passwort-neu#error=invalid_request&error_code=flow_state_expired')
    ).toBe('errors:auth.linkExpired');
  });

  it('faellt auf error zurueck, wenn es keinen error_code gibt', () => {
    expect(urlErrorMessageKey('https://app.example.at/passwort-neu?error=server_error')).toBe(
      'errors:auth.unknown'
    );
  });

  it('meldet nichts, wenn in der Adresse gar kein Fehler steht', () => {
    expect(urlErrorMessageKey('https://app.example.at/passwort-neu')).toBeNull();
    expect(urlErrorMessageKey('https://app.example.at/passwort-neu?code=abc')).toBeNull();
    expect(urlErrorMessageKey('kaputt')).toBeNull();
  });
});
