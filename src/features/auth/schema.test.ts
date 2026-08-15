import { describe, expect, it } from 'vitest';

import { MIN_PASSWORD_LENGTH, signInSchema, signUpSchema } from './schema';
import de from '@/i18n/locales/de/errors.json';

const gueltig = {
  email: 'jemand@example.at',
  name: '',
  password: 'geheim1234',
  passwordRepeat: 'geheim1234',
};

function fehler(werte: Record<string, unknown>) {
  const ergebnis = signUpSchema.safeParse(werte);
  if (ergebnis.success) return [];
  return ergebnis.error.issues.map((issue) => issue.message);
}

describe('signInSchema', () => {
  it('nimmt eine Adresse mit Passwort an', () => {
    expect(signInSchema.safeParse({ email: 'a@b.at', password: 'x' }).success).toBe(true);
  });

  it('weist eine unvollstaendige Adresse ab', () => {
    expect(signInSchema.safeParse({ email: 'a@b', password: 'x' }).success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('nimmt eine vollstaendige Registrierung an', () => {
    expect(signUpSchema.safeParse(gueltig).success).toBe(true);
  });

  it('besteht auf zwei gleichen Passwoertern', () => {
    expect(fehler({ ...gueltig, passwordRepeat: 'etwasanderes' })).toContain(
      'errors:auth.passwordMismatch'
    );
  });

  it('besteht auf der Mindestlaenge', () => {
    const kurz = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(fehler({ ...gueltig, password: kurz, passwordRepeat: kurz })).toContain(
      'errors:auth.passwordTooShort'
    );
  });

  it('laesst den Namen weg, verlangt aber zwei Zeichen wenn er da ist', () => {
    expect(signUpSchema.safeParse({ ...gueltig, name: '   ' }).success).toBe(true);
    expect(fehler({ ...gueltig, name: 'M' })).toContain('errors:auth.nameTooShort');
  });

  // Die Schluessel stehen im Schema als Text - ohne diesen Test faellt ein
  // Tippfehler erst im Browser auf, und zwar als roher Schluessel im Formular.
  it('nennt nur Fehlerschluessel, zu denen es einen deutschen Text gibt', () => {
    const texte = de as Record<string, string>;
    const alle = fehler({ email: 'kaputt', name: 'M', password: 'kurz', passwordRepeat: 'anders' });

    expect(alle.length).toBeGreaterThan(0);
    for (const key of alle) {
      expect(texte[key.replace('errors:', '')], `Text fuer ${key} fehlt`).toBeTruthy();
    }
  });
});
