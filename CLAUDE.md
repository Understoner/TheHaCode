# TheHaCode — Projektregeln

Verbindlich für alle Beiträge, ob von Hand oder mit KI-Unterstützung geschrieben.
Ausführliche Begründungen im System Architecture Document: `docs/SAD.md`.

**Team:** 2 Personen in Teilzeit, 20 Stunden pro Woche gemeinsam.
**Konsequenz:** Wartungsarmut schlägt Eleganz. Wenige bewegliche Teile schlagen
optimale Einzellösungen.

---

## Was V1 ist

1. Landing Page mit News, Kurse, Team und Navigation — öffentlich, ersetzt
   die alte Website. Inkl. Impressum/Datenschutzerklärung als Voraussetzung
   für den sofortigen Umzug auf die Hauptdomain (Kostenersparnis, ein
   Hosting-Vertrag statt zwei — vorgezogen aus SAD §11.3, siehe §2.4).
   Redaktion von News/Kurse/Team läuft vorerst über Supabase Studio, keine
   eigene Admin-Oberfläche in dieser Phase.
2. Vorkonfigurierte Box-Sequenzen und Videos — kostenlos, dauerhaft
3. Der Sequenz-Konfigurator — die bezahlte Funktion

**Nicht in V1:** Atem-Tagebuch, Micro Habits, Session-Protokoll, geführte
Aufnahmen, Hintergrundmusik, Sprachansagen, Testzeitraum, Lifetime-Tarif,
native Apps, Offline-Betrieb, In-App-Redaktionsoberfläche (Studio reicht).
Wenn eine Aufgabe eines
dieser Themen berührt: nicht anfangen, sondern melden.

---

## Stack — nicht verhandelbar (SAD §0)

| Ebene | Festlegung |
|---|---|
| Sprache | TypeScript, `strict: true` |
| Framework | Expo + Expo Router, `web.output: "static"` |
| Server State | TanStack Query v5 |
| Client State | Zustand |
| Styling | NativeWind v4 + `src/design/tokens.ts` |
| Animation | Reanimated 3 |
| Audio | Web Audio API, synthetische Töne über `OscillatorNode` — keine Dateien |
| Formulare | React Hook Form + Zod |
| Backend | Supabase — Auth, Postgres, Storage, Edge Functions |
| Hosting | Hostinger Business, Node.js Web App (statisch ausgeliefert), GitHub-Integration |
| i18n | i18next, Sprache `de` |
| Tests | Vitest, pgTAP, Playwright |

**Keine neuen Bibliotheken ohne Rücksprache** — insbesondere nicht für State,
Styling, Datenzugriff, Datumsrechnung, Formulare oder Auth. Wirkt eine Aufgabe
mit dem vorhandenen Stack umständlich, ist das eine Frage ans Team, keine
Einladung zu `npm install`.

---

## Nutzerverwaltung: vollständig Supabase Auth

Registrierung, Anmeldung, Sitzungen, Token-Erneuerung, Passwort-Zurücksetzen,
Google- und Apple-Anmeldung, Kontoverknüpfung und Löschung kommen aus Supabase.
**Nichts davon wird selbst gebaut.**

- Kein eigenes Passwort-Hashing, keine eigenen Tokens, keine eigene Sitzungstabelle.
- `auth.users` gehört Supabase und wird nie direkt beschrieben.
- Fachliche Nutzerdaten liegen in `public.profiles`, verknüpft über die gleiche ID.
- Die Provider stehen in `auth.identities` — **keine** eigene `auth_provider`-Spalte.
  Ein Konto kann mehrere Provider haben.
- Rollen stehen in `app_metadata` (nicht `user_metadata` — das ist vom Client
  manipulierbar) und werden ausschließlich per `service_role` gesetzt.

---

## Verboten

- **Farbliterale in Komponenten.** Nur Tokens aus `src/design/tokens.ts`.
- **Fließtext in den 500er-Farbtönen.** Kontrast unter 4,5:1. Text nutzt die 700er.
- **Abfragen auf Nutzertabellen ohne `user_id`-Bezug.**
- **RLS-Policies mit `using (true)`** oder Schreibpolicies ohne `with check`.
- **`setInterval` für Zeitkritisches.** Timer driften kumulativ (SAD §7.1).
- **`localStorage` für fachliche Daten.**
- **Audiodateien für Cues oder Musik.** Töne kommen aus dem Oszillator; Musik
  bringt der Nutzer in seiner eigenen App mit.
- **Deutsche Strings im Code.** Alles über i18next.
- **Schemaänderungen im Supabase Studio.** Nur als Migration im Repo.
- **`service_role`-Key im Client-Bundle, in hPanel oder in einer lokalen `.env`.**
  Er lebt ausschließlich in Supabase Function Secrets.
- **Zerstörerische Migrationen.** Siehe nächster Abschnitt.
- **Schatten im UI.** Abgrenzung über 1-px-Linien und Weißraum.

---

## Migrationen sind ausnahmslos additiv (SAD §2.6)

Hostinger deployt selbstständig bei jedem Push. Die Reihenfolge „erst Datenbank,
dann App" ist deshalb **nicht erzwingbar** — beide starten gleichzeitig.

- Nur hinzufügen, nie entfernen oder umbenennen. Neue Spalten sind `nullable`
  oder haben ein Default.
- Die alte App-Version muss mit dem neuen Schema laufen und umgekehrt.
- Umbenennen wird zu drei Schritten über zwei Releases: neue Spalte anlegen und
  doppelt schreiben, dann Lesen umstellen, im übernächsten Release die alte
  Spalte entfernen.

---

## Immer

- **Datenbanktypen generieren, nie schreiben:** `npm run db:types`
- **Jede Datenkomponente behandelt vier Zustände:** Laden, Fehler, Leer, Erfolg —
  über `QueryBoundary` (SAD §6.2).
- **Neue Nutzertabelle** → `on delete cascade` auf `auth.users`, `user_id`
  denormalisiert, `updated_at`, `deleted_at`, `client_id` — und ein Eintrag in
  der UNION-Liste in `supabase/tests/001_foundation.test.sql`.
- **Neue Tabelle** → `enable row level security` in derselben Migration.
- **Neue Policy** → ein pgTAP-Test, der den **Missbrauchsfall** prüft, nicht nur
  den Normalfall.
- **Fehlermeldungen deutsch, ohne Technikjargon, immer mit Handlungsoption.**
  Technische Details gehen an Sentry.

---

## Zugriff

Es gibt **keinen Testzeitraum**. Zugriff heißt bezahlt.

`profiles.has_active_subscription` ist der einzige Wert, geschrieben ausschließlich
vom Stripe-Trigger. **RLS und UI fragen ihn nie direkt, sondern immer über
`has_plus_access()`.** Diese Funktion liest heute nur die eine Spalte — käme
später eine Aktion oder ein Gutschein dazu, ändert sich genau sie und keine
einzige Policy.

Die bezahlte Leistung ist eine **Fähigkeit, kein Inhalt**: Die Prüfung sitzt am
`INSERT` in `exercises`, nicht am `SELECT`. Lesen, Abspielen und Löschen eigener
Sequenzen bleiben immer erlaubt — auch nach Ende des Abos (SAD §3.4).

---

## Branches und Auslieferung

```
feature/*  →  PR nach develop
develop    →  Testsystem  (staging.deine-domain.at)
main       →  Livesystem  (app.deine-domain.at)  — nur über die Beförderung
```

Nach dem Merge in `develop` läuft alles automatisch: Migrationen nach Supabase
Staging, Hostinger baut, die Pipeline wartet auf `build-info.json`, Smoke-Tests laufen.
Sind sie grün, wird `develop` nach `main` befördert. Details: `docs/DEPLOYMENT.md`.

**Niemals direkt auf `main` oder `develop` committen.**

---

## Aufgabenteilung

| Gut geeignet für KI-Unterstützung | Selbst prüfen |
|---|---|
| CRUD-Screens, Formulare, Listen | Breathing Engine (`src/features/breathing/`) |
| Migrationen nach vorhandenem Muster | RLS-Policies und Consent-Logik |
| Tests zu bestehender Logik | Stripe-Webhook und Entitlement |
| Styling nach Tokens | Alles, was `service_role` berührt |

**Faustregel:** Wo ein Fehler laut scheitert, darf ein Assistent arbeiten. Wo ein
Fehler still Daten preisgibt oder verfälscht, schaut ein Mensch hin.

---

## Vor jedem Pull Request

```bash
npm run verify        # typecheck + lint + vitest
supabase start && npm run db:lint && npm run db:test
npm run build:web
```

Alles grün, sonst kein Merge. Die CI erzwingt es ohnehin — lokal zuerst zu prüfen
spart eine Runde.
