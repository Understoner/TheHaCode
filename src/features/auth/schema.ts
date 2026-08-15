import { z } from 'zod';

// Formularpruefung mit Zod, angebunden ueber React Hook Form (CLAUDE.md,
// Stack-Tabelle "Formulare").
//
// Die Fehlertexte stehen hier als i18next-Schluessel, nicht als deutscher Text
// (CLAUDE.md: keine deutschen Strings im Code). Der Namensraum steht bewusst
// mit im Schluessel ("errors:"), damit das Formular schlicht
// t(error.message) aufrufen kann und nicht an jeder Stelle wissen muss, aus
// welcher Datei der Text kommt.

// Supabase weist kuerzere Passwoerter selbst ab (config.toml:
// minimum_password_length). Hier steht die strengere Zahl, damit der Hinweis
// schon vor dem Absenden erscheint statt erst als Serverantwort.
export const MIN_PASSWORD_LENGTH = 8;

const email = z.email({ error: 'errors:auth.emailInvalid' });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: 'errors:auth.passwordRequired' }),
});

export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    email,
    // Der Name ist freiwillig. Ist er gesetzt, landet er ueber
    // options.data.full_name in raw_user_meta_data und von dort per Trigger
    // (Migration 0001) in profiles.display_name - ohne eigenen Schreibzugriff
    // auf die Tabelle.
    name: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || value.length >= 2, {
        error: 'errors:auth.nameTooShort',
      }),
    password: z.string().min(MIN_PASSWORD_LENGTH, { error: 'errors:auth.passwordTooShort' }),
    passwordRepeat: z.string(),
  })
  .refine((values) => values.password === values.passwordRepeat, {
    error: 'errors:auth.passwordMismatch',
    path: ['passwordRepeat'],
  });

export type SignUpValues = z.infer<typeof signUpSchema>;

/** "Passwort vergessen": nur die Adresse, an die der Link gehen soll. */
export const resetRequestSchema = z.object({ email });

export type ResetRequestValues = z.infer<typeof resetRequestSchema>;

/** Neues Passwort setzen - nach dem Klick auf den Link aus der E-Mail. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, { error: 'errors:auth.passwordTooShort' }),
    passwordRepeat: z.string(),
  })
  .refine((values) => values.password === values.passwordRepeat, {
    error: 'errors:auth.passwordMismatch',
    path: ['passwordRepeat'],
  });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
