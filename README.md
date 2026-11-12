# TheHaCode — DER ATEMCODE

Progressive Web App für Atemtraining. Sie ersetzt die frühere Website und ist
zugleich die App.

**Stack:** Expo Router (statischer Web-Export) · Supabase · Stripe · Hostinger Business
**Sprache:** Deutsch, i18n-fähig
**Stand dieser Datei:** 11.11.2026

---

## Was die App kann

| Bereich | Inhalt | Zugang |
|---|---|---|
| Website | Startseite, News, Team, Rechtstexte | öffentlich |
| Sessions | Geführte Atem-Sessions mit Tönen, Ansagen und Videos | kostenlos |
| Sequenz-Konfigurator | Eigene Atemsequenzen bauen und speichern | Plus-Abo |
| Habit Tracker | Tagebuch mit Habits, Score, Übungswegen und Auswertung | mit Einwilligung in Gesundheitsdaten; eigene Habits mit Plus |
| Kurse | Präsenzkurse mit Buchung und Anzahlung, auch als Gast | Zahlung je Kurs |
| Onlinekurse | On-Demand-Kurse aus Blöcken mit Quiz und Zertifikat als PDF | je Kurs: öffentlich, Konto, Plus oder Einzelkauf |
| Geräte-Anbindung | Oura und Garmin füllen Habits automatisch | **nur Testsystem** |

Was verbindlich gilt und was bewusst nicht gebaut wird, steht in `CLAUDE.md`.

---

## Lokal starten

Noch nichts eingerichtet? Dann zuerst **`docs/SETUP_WINDOWS.md`**.

```bash
npm ci
cp .env.example .env.local          # Supabase-Werte des Staging-Projekts eintragen

supabase start                      # lokale Datenbank
npm run db:reset                    # Migrationen und Seeds einspielen
npm run db:types                    # TypeScript-Typen erzeugen

npm run dev                         # App unter http://localhost:8081
```

Die Supabase-CLI lokal in derselben Version wie in der CI verwenden (steht in
`.github/workflows/ci.yml`, dort auch die Begründung). Mit einer anderen
Version können die Datenbanktests andere Ergebnisse liefern.

## Vor jedem Pull Request

```bash
npm run verify                      # typecheck + lint + vitest
supabase start && npm run db:lint && npm run db:test
npm run build:web
```

Alles grün, sonst kein Merge. Die CI erzwingt es ohnehin.

---

## Wo was steht

| Pfad | Inhalt |
|---|---|
| `CLAUDE.md` | Projektregeln, verbindlich — für Menschen und KI-Assistenten |
| `docs/SAD.md` | System Architecture Document: die Begründungen. Enthält auch Zielbild, das noch nicht gebaut ist |
| `docs/DEPLOYMENT.md` | Einrichtung und Betrieb: Hostinger, Supabase, GitHub, Checklisten |
| `docs/SECURITY-SCAN.md` | Der Security-Scan vor jeder Beförderung nach Live |
| `docs/KURSBUCHUNG.md` | Kursbuchung, Anzahlung, Restbetrag |
| `docs/WEARABLES.md` | Geräte-Anbindung (Testsystem) |
| `docs/VERARBEITUNGSVERZEICHNIS.md` | Verzeichnis der Verarbeitungstätigkeiten (DSGVO) |
| `docs/INHALTE.md`, `docs/inhalte/` | Redaktionsinhalte und die SQL-Dateien dazu |
| `docs/SETUP_WINDOWS.md` | Rechner und Cloud-Dienste vorbereiten |
| `docs/BACKLOG.md` | Die Aufgaben von V1 — erledigt, als Verlauf aufbewahrt |
| `supabase/migrations/` | Schema — die einzige Quelle der Wahrheit, ausnahmslos additiv |
| `supabase/tests/` | pgTAP: RLS und Missbrauchsfälle |
| `supabase/functions/` | Edge Functions; Eigenheiten in `_HINWEIS.md` |
| `src/features/breathing/` | Die Atem-Engine. Handarbeit, gut getestet |
| `src/lib/` | Kleine Helfer mit eigener Begründung: seitenweises Lesen, Fehlercodes der Edge Functions, Content Security Policy |

---

## Auslieferung

```
feature/*  →  PR nach develop
develop    →  Testsystem   dev.deratemcode.at
main       →  Livesystem   deratemcode.at
```

Ein Merge nach `develop` spielt die Migrationen in Supabase Staging ein,
Hostinger baut, die Smoke-Tests und der Security-Scan laufen. Sind sie grün,
wartet die Beförderung nach `main` auf eine Freigabe im GitHub-Environment
`production`. Details in `docs/DEPLOYMENT.md`.

**Direkte Commits auf `develop` oder `main` sind nicht vorgesehen.**

---

## Vier Dinge, die man wissen sollte

**Migrationen sind additiv.** Hostinger deployt selbstständig bei jedem Push; die
Reihenfolge Datenbank-vor-App lässt sich nicht erzwingen. Kein `drop column`,
kein Umbenennen. Begründung in `docs/SAD.md` §2.6.

**Der `service_role`-Key liegt nur in Supabase.** Nicht in GitHub, nicht in
hPanel, nicht auf einem Laptop. Es ist der einzige Schlüssel, mit dem sich RLS
umgehen lässt.

**RLS trägt die Sicherheit, nicht der Client.** Es gibt keinen eigenen API-Layer.
Auch fehlerhafter App-Code kann keine fremden Daten lesen — vorausgesetzt, die
Policies und die Rechte stimmen. Deshalb gehört zu jeder Policy ein Test, der den
Missbrauchsfall prüft, und jede neue Tabelle oder Funktion entzieht `anon` und
`authenticated` zuerst alles (Migration 0055).

**Der Server gibt je Anfrage höchstens 1.000 Zeilen heraus** und meldet das
Abschneiden nicht. Abfragen, deren Ergebnis je Nutzer wächst, laufen deshalb über
`src/lib/fetchAllRows.ts`.
