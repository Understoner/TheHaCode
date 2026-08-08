# TheHaCode — Atem-App

Progressive Web App für Atemtraining. Geführte Sequenzen kostenlos, eigene
Box-Atemsequenzen mit Plus.

**Stack:** Expo Router (statisch) · Supabase · Stripe · Hostinger Business
**Sprache:** Deutsch, i18n-fähig

---

## Erste Schritte

Noch nichts eingerichtet? Dann zuerst **`docs/SETUP_WINDOWS.md`** — von leerem
Windows-PC bis zur ersten Claude-Code-Sitzung, mit allen Konten und Wartezeiten.

Wenn die Bereitschaftsprüfung dort durch ist:

```bash
npm ci
cp .env.example .env.local          # Supabase-Werte des Staging-Projekts eintragen

supabase start                      # lokale Datenbank
npm run db:reset                    # Migrationen + Seeds einspielen
npm run db:types                    # TypeScript-Typen erzeugen

npm run dev                         # App unter http://localhost:8081
```

Vor jedem Commit:

```bash
npm run verify                      # typecheck + lint + vitest
npm run db:test                     # pgTAP: RLS, Kaskaden, Konfigurator
```

---

## Wo was steht

| Pfad | Inhalt |
|---|---|
| `docs/SAD.md` | System Architecture Document — die Begründung zu allem |
| `docs/BACKLOG.md` | Aufgaben für V1, als Briefings geschnitten |
| `docs/SETUP_WINDOWS.md` | **Hier anfangen** — Rechner und Cloud-Dienste vorbereiten |
| `docs/DEPLOYMENT.md` | Einrichtung Hostinger, Supabase, GitHub |
| `CLAUDE.md` | Projektregeln, verbindlich |
| `ui/*.svg` | UI-Spezifikation mit Maßen und Tokens |
| `supabase/migrations/` | Schema — die einzige Quelle der Wahrheit |
| `supabase/tests/` | pgTAP: RLS und Missbrauchsfälle |
| `src/features/breathing/` | Die Engine. Handarbeit, gut getestet |

---

## Mit Claude Code arbeiten

```
/task T07          Backlog-Aufgabe aufnehmen und umsetzen
/verify            komplette Prüfkette lokal ausführen
/review-rls        Policies auf die typischen Lücken prüfen
```

`CLAUDE.md` wird automatisch gelesen. Nach der Einrichtung ist **T01** der Start,
danach **T03** — das Komponenteninventar ist die Referenzscheibe, an der sich
alles Weitere orientiert.

---

## Auslieferung

```
feature/*  →  PR nach develop
develop    →  Testsystem   staging.deine-domain.at
main       →  Livesystem   app.deine-domain.at
```

Merge nach `develop` löst alles Weitere aus: Migrationen, Hostinger-Build,
Smoke-Tests, Beförderung nach `main`. Etwa 12 bis 18 Minuten bis live.

**Direkte Commits auf `develop` oder `main` sind nicht vorgesehen.**

---

## Drei Dinge, die man wissen sollte

**Migrationen sind additiv.** Hostinger deployt selbstständig bei jedem Push; die
Reihenfolge Datenbank-vor-App lässt sich nicht erzwingen. Kein `drop column`,
kein Umbenennen. Begründung in `docs/SAD.md` §2.6.

**Der `service_role`-Key liegt nur in Supabase.** Nicht in GitHub, nicht in
hPanel, nicht auf einem Laptop. Es ist der einzige Schlüssel, mit dem sich RLS
umgehen lässt.

**RLS trägt die Sicherheit, nicht der Client.** Es gibt keinen eigenen API-Layer.
Auch fehlerhafter App-Code kann keine fremden Daten lesen — vorausgesetzt, die
Policies stimmen. Deshalb gehört zu jeder Policy ein Test, der den Missbrauchsfall
prüft.
