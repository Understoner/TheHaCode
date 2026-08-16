# Auth-E-Mails

Die drei Mails, die Supabase im Namen von DER ATEMCODE verschickt. Sie sind das
Erste, was ein neuer Nutzer von uns schriftlich bekommt — und im Auslieferungs­
zustand sind sie englisch („Confirm your signup"). Deshalb liegen sie hier.

## Warum als Dateien im Repo

Die Vorlagen leben eigentlich im Supabase-Dashboard, also in einem Textfeld im
Browser. Das ist kein guter Ort für Text, den zwei Leute pflegen: keine
Historie, kein Review, kein Vergleich zwischen Staging und Live, und ein
Tippfehler fällt erst auf, wenn ihn jemand im Postfach sieht.

Hier sind sie versionierbar, im Pull Request lesbar und lokal überprüfbar:
`supabase/config.toml` bindet sie ein, `supabase start` benutzt sie, und in
Mailpit (<http://127.0.0.1:54324>) sieht man das Ergebnis so, wie es beim
Nutzer ankommt.

## Wie sie auf Staging und Live kommen

**Von Hand, per Copy & Paste** ins Dashboard:

Supabase → Projekt → Authentication → Emails → jeweilige Vorlage → Betreff und
HTML ersetzen.

> **Noch nicht möglich — braucht den Pro-Plan.** Auf dem freien Plan zeigt das
> Dashboard die Vorlagen nur an, ändern lassen sie sich nicht. Bis dahin
> verschickt Supabase die englischen Standardtexte. Nachgeholt wird es mit dem
> ersten zahlenden Kunden; als Aufgabe **T17a** in `docs/BACKLOG.md` vermerkt.

> **Nicht `supabase config push` benutzen.** Der Befehl schiebt den *gesamten*
> Auth-Abschnitt aus `config.toml` ins Projekt — also auch `site_url` und
> `additional_redirect_urls`, die dort auf `http://localhost:8081` stehen. Er
> würde damit genau die Einstellungen überschreiben, die auf Staging und Live
> von Hand richtig gesetzt wurden, und die Anmeldung zerlegen. Aus demselben
> Grund steht er auch nicht in `deploy.yml`.

## Welche Vorlagen es gibt

| Datei | Wann sie verschickt wird |
|---|---|
| `bestaetigung.html` | Registrierung — solange „Confirm email" an ist |
| `passwort-zuruecksetzen.html` | „Passwort vergessen?" auf `/konto` |
| `email-aenderung.html` | Wechsel der E-Mail-Adresse |

Nicht angelegt sind **Magic Link**, **Einladung** und **Reauthentifizierung**:
V1 bietet keinen dieser Wege an, sie können also gar nicht ausgelöst werden.
Kämen sie dazu, gehören sie hierher — nicht ins Dashboard.

## Beim Ändern beachten

- **`{{ .ConfirmationURL }}` muss drin bleiben.** Ohne den Platzhalter geht die
  Mail raus, führt aber nirgendwohin.
- **Keine Bilder, keine externen Schriften, kein CSS aus fremder Quelle.**
  Mailprogramme laden das entweder nicht oder erst auf Nachfrage, und ein
  nachgeladenes Bild verrät dem Absender, wann jemand die Mail geöffnet hat.
  Alles hier ist Text und inline-Stil.
- **Der Link steht zusätzlich als Klartext darunter.** Manche Programme machen
  aus einem `<a>` keinen klickbaren Link, und mancher Nutzer traut einem
  beschrifteten Link nicht. Beides ist mit einer Zeile erledigt.
- **Farben** entsprechen `src/design/tokens.ts` (Ocean und Ink). In einer
  E-Mail müssen sie als Literal stehen — dort gibt es keine Tokens. Das ist
  kein Verstoß gegen die Regel aus CLAUDE.md, die für Komponenten gilt.
