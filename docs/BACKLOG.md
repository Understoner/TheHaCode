# Backlog — V1

Jede Aufgabe ist so geschnitten, dass sie in einer Claude-Code-Sitzung erledigt werden kann: ein Ziel, benannte Dateien, prüfbare Abnahmekriterien.

**Arbeitsweise:** `/task T03` öffnet die Aufgabe. Erst lesen, dann `feature/T03-...` anlegen, dann arbeiten. Vor jedem Commit `npm run verify`.

**Legende:** 🔒 = nicht an einen Assistenten delegieren (SAD §13.2) · ⏱ = grobe Stundenschätzung

---

## Block 1 — Fundament (Wochen 1–2)

### T01 · Repo aufsetzen ⏱6
**Ziel:** Lauffähiges Expo-Projekt mit CI.
**Dateien:** `package.json`, `app.json`, `tsconfig.json`, `.eslintrc.js`, `tailwind.config.js`, `vitest.config.ts`, `.gitignore`
**Abnahme:**
- [ ] `npm run dev` startet die App lokal
- [ ] `npm run verify` läuft grün durch
- [ ] `supabase start` und `npm run db:reset` spielen alle Migrationen ein
- [ ] Grundmigration (Extensions, Enums, `profiles`, `has_plus_access()` — SAD §3.2–3.3) liegt als `supabase/migrations/0001_foundation.sql`
- [ ] `supabase/tests/001_foundation.test.sql` existiert mit der UNION-Liste aller Nutzertabellen (CLAUDE.md); künftige Nutzertabellen tragen dort nach
- [ ] CI läuft auf einem Test-PR grün (Workflow `ci.yml`, Status-Check `verify`)

### T01a · iOS-Audio-Spike (gesperrter Bildschirm) ⏱4
**Ziel:** Die einzige offene Frage beantworten, die die Roadmap noch verschieben könnte (SAD §7.7, §10).
**Vorgehen:** Minimale PWA mit Audio-Element und Media Session API bauen, auf einem echten iPhone installieren, Bildschirm sperren, zwölf Minuten warten.
**Abnahme:**
- [ ] Ergebnis dokumentiert: Audio läuft bei gesperrtem Bildschirm weiter — ja/nein
- [ ] Bei „nein": Entscheidung getroffen und in SAD §7.7 nachgetragen, welcher der drei dort genannten Auswege gilt

> Steht bewusst vor T02, nicht in Block 3 bei T10 — SAD §7.7 verlangt ihn ausdrücklich für Sprint 1, weil sein Ergebnis noch die Roadmap verschieben kann.

### T02 · Deployment-Pipeline ⏱6
**Ziel:** Beide Umgebungen laufen, Beförderung funktioniert.
**Dateien:** `.github/workflows/*`, `scripts/wait-for-deploy.sh`, `scripts/write-build-info.mjs`
**Abnahme:**
- [ ] `npm run build:web` ruft `scripts/write-build-info.mjs` am Ende auf; `dist/build-info.json` liegt danach neben den übrigen Build-Dateien
- [ ] Push auf `develop` → Staging aktualisiert sich
- [ ] Smoke-Tests laufen gegen die **neue** Version, nicht die alte
- [ ] Freigabe → `main` → Production aktualisiert sich
- [ ] Ein absichtlich fehlschlagender Smoke-Test verhindert die Beförderung

### T03 · Design-Tokens und Komponenteninventar ⏱14
**Ziel:** Die zwölf Bausteine, aus denen alle Screens bestehen.
**Dateien:** `src/design/tokens.ts`, `src/components/*`
**Vorlage:** `ui/01_startscreen.svg` (Token-Leiste unten), SAD §6
**Bausteine:** Button (primär/sekundär/tertiär), TextInput, Stepper, Slider, Toggle, Card, ListRow, StateMessage, SkeletonList, QueryBoundary, Sheet, BreathRing
**Abnahme:**
- [ ] Alle Farben stammen aus `tokens.ts`, kein Hex-Literal in Komponenten
- [ ] Fließtext nutzt ausschließlich die 700er-Töne (Kontrast ≥ 4,5:1)
- [ ] Keine Schatten; Abgrenzung über 1-px-Linien
- [ ] Sichtbarer Tastaturfokus auf allen bedienbaren Elementen
- [ ] ESLint-Regel verbietet Hex-Literale in `src/components` und `src/app`

> Diese Aufgabe ist die **Referenzscheibe** aus SAD §13.1. Sie wird von Hand gebaut und ist danach die Vorlage für alles Weitere.

---

## Block 2 — Auth, Profil, öffentliche Seite (Wochen 3–4)

### T04 · Supabase-Client und Auth 🔒 ⏱12
**Ziel:** Nutzerverwaltung vollständig über Supabase Auth. Nichts davon wird selbst gebaut.
**Dateien:** `src/lib/supabase.ts`, `src/features/auth/*`, `src/app/(auth)/*`
**Umfang:**
- E-Mail und Passwort, Google, Apple — alle drei über `supabase.auth`
- Sitzungspersistenz: `expo-secure-store` nativ, `localStorage` im Web
- Token-Erneuerung übernimmt `supabase-js` selbst
- `useSession()`-Hook, Zustand-Store nur für den abgeleiteten Zustand
- Geschützte Routen leiten auf `/anmelden` **und merken sich das Ziel**
**Abnahme:**
- [ ] Registrierung, Anmeldung, Abmeldung, Passwort zurücksetzen funktionieren
- [ ] Google und Apple funktionieren im Web
- [ ] Neuer Nutzer bekommt automatisch ein `profiles`-Zeile (Trigger aus 0002)
- [ ] Nach Neuladen bleibt man angemeldet
- [ ] Alle Fehlertexte deutsch, ohne Technikjargon
- [ ] Keine eigene Passwort-, Token- oder Sitzungslogik im Code

### T05 · Consent-Flow 🔒 ⏱8
**Ziel:** AGB und Datenschutz beim Signup, nachweisbar.
**Dateien:** `src/features/consent/*`
**Abnahme:**
- [ ] Zustimmung schreibt eine Zeile in `user_consents` mit `definition_id`
- [ ] Ohne Zustimmung kein Abschluss der Registrierung
- [ ] Im Profil sichtbar, welcher Version zugestimmt wurde
- [ ] Widerruf erzeugt eine **neue** Zeile, kein Update

### T06 · Konto löschen und Daten exportieren 🔒 ⏱10
**Ziel:** Betroffenenrechte, funktionsfähig ab Tag eins.
**Dateien:** `supabase/functions/delete-account/`, `supabase/functions/export-my-data/`, `src/app/(app)/profil/`
**Abnahme:**
- [ ] Export liefert eine JSON-Datei mit allen Nutzerdaten
- [ ] Löschen entfernt das Konto restlos; pgTAP-Kaskadentest bleibt grün
- [ ] Löschen verlangt eine Bestätigung mit Eingabe der E-Mail-Adresse
- [ ] Beide Functions lehnen Aufrufe ohne gültiges JWT ab

### T07 · Landing Page und News ⏱16
**Ziel:** Die öffentliche Seite — sie ersetzt die alte Website.
**Dateien:** `src/app/(public)/index.tsx`, `src/app/(public)/neu/[slug].tsx`, `src/features/news/*`
**Vorlage:** `ui/01_startscreen.svg`
**Abnahme:**
- [ ] Ohne Anmeldung erreichbar, freie Sequenzen sichtbar
- [ ] Neuer News-Beitrag im Studio erscheint **ohne Neubau** (Daten kommen zur Laufzeit)
- [ ] „Über mich", Angebot und Kontakt als gepinnte Beiträge
- [ ] Vier Zustände über `QueryBoundary` behandelt

---

## Block 3 — Breathing Engine (Wochen 5–6) 🔒

### T08 · Timeline-Logik 🔒 ⏱10
**Ziel:** Reine, testbare Zeitrechnung ohne React.
**Dateien:** `src/features/breathing/timeline.ts`, `__tests__/timeline.test.ts`
**Vorgehen:** **Tests zuerst.** Die Testfälle stehen fertig in SAD §8.1 — ins Repo kopieren, rot laufen lassen, dann implementieren.
**Abnahme:**
- [ ] Alle Tests aus SAD §8.1 grün
- [ ] 4-4-4-4 × 8 ergibt 32 Segmente und exakt 128 000 ms
- [ ] Keine Lücke und keine Überlappung zwischen Segmenten
- [ ] Rundenprogression respektiert das Maximum
- [ ] Nach 20 Minuten simulierter Laufzeit keine Drift

### T09 · Animation und Ring 🔒 ⏱14
**Ziel:** Der Kreis, den man beim Atmen ansieht.
**Dateien:** `src/features/breathing/BreathCircle.tsx`, `useBreathClock.ts`
**Vorlage:** `ui/03_atem_animation.svg` — die Winkelformeln stehen dort im Abschnitt „Aufbau und Werte"
**Regeln:**
- Einatmen beginnt bei 6 Uhr, Ausatmen bei 12 Uhr
- Linke Hälfte 180° für Einatmen + Halten voll, rechte für Ausatmen + Halten leer
- Segmentzahl folgt den Haltephasen: 4, 3 oder 2
- Nur `transform` und `opacity` animieren
- Ankeruhr statt `setInterval`; App im Hintergrund pausiert
**Abnahme:**
- [ ] Ein Re-Render je Phasenwechsel, nicht je Frame
- [ ] Auf einem Mittelklasse-Android flüssig
- [ ] `prefers-reduced-motion`: fester Radius, Marke und Zähler laufen weiter
- [ ] Bildschirm bleibt während der Übung wach

### T10 · Töne ⏱3
**Ziel:** Ein kurzer Ton je Phasenwechsel, ohne eine einzige Audiodatei.
**Dateien:** `src/features/breathing/tones.ts`
**Vorlage:** SAD §7.5 — der Code steht dort vollständig
**Abnahme:**
- [ ] Drei bis vier Tonhöhen über `OscillatorNode`, keine Dateien im Repo
- [ ] Kurze Hüllkurve, kein Knacken beim Ein- und Ausblenden
- [ ] Ton am Phasen**beginn**, nicht davor
- [ ] Phasen unter 1,2 s bleiben stumm
- [ ] `AudioContext` startet erst auf Nutzerinteraktion
- [ ] Abschaltbar über `profiles.sound_enabled`
- [ ] Auf einem echten iPhone prüfen, ob fremde Musik weiterläuft — Ergebnis notieren

### T11 · Player-Screen ⏱10
**Ziel:** Vollbild, ohne Ablenkung.
**Dateien:** `src/app/(app)/ueben/[id].tsx`
**Vorlage:** `ui/03_atem_animation.svg`
**Abnahme:**
- [ ] Navigation vollständig ausgeblendet
- [ ] Pause, Anhalten, Ton; Ausstieg nur über „Beenden"
- [ ] Bei mehreren Blöcken: „Block 2 von 3 · Runde 3 von 8"
- [ ] Ring teilt sich beim Blockwechsel neu auf, nur in der Pause zwischen Blöcken

---

## Block 4 — Konfigurator (Wochen 7–8)

### T12 · Sequenz-Konfigurator ⏱30
**Ziel:** Die bezahlte Funktion.
**Dateien:** `src/app/(app)/meine/*`, `src/features/sequences/*`
**Vorlage:** `ui/04_konfigurator.svg`
**Umfang:** Blockliste mit Auf- und Zuklappen, Phasen-Stepper, Runden-Slider, Pause je Block, Umsortieren, Duplizieren, Löschen, Zeitleiste über alle Blöcke, Live-Vorschau, Vorhören
**Abnahme:**
- [ ] Bis zu 10 Blöcke, immer nur einer offen
- [ ] Vorschau-Ring aktualisiert sich beim Tippen
- [ ] Zeitleiste zeigt Blockanteile proportional inklusive Runden
- [ ] Grenzen aus der Datenbank, Fehlertexte wie in `ui/04_konfigurator.svg`
- [ ] Optimistisches Speichern mit Rollback bei Fehler
- [ ] Ohne Plus: bedienbar, Speichern gesperrt, Hinweis auf Plus
- [ ] Nach Abo-Ende: eigene Sequenzen abspielbar und löschbar, nicht änderbar

### T13 · Policy-Tests zum Konfigurator 🔒 ⏱4
**Ziel:** Die Missbrauchsfälle bleiben abgedeckt.
**Dateien:** `supabase/tests/002_configurator.test.sql`
**Abnahme:**
- [ ] Alle 14 Tests grün
- [ ] Neue Policy ohne zugehörigen Missbrauchstest wird nicht gemerged

---

## Block 5 — Beta (Woche 9)

### T14 · Beta mit Bestandskunden ⏱8
**Ziel:** Die Frage beantworten, ob der Konfigurator zahlungswürdig ist.
**Vorgehen:** 10–15 Bestandskunden manuell freischalten (`provider = 'manual'`, SAD §4.6), zwei Wochen nutzen lassen, dann fragen.
**Abnahme:**
- [ ] Mindestens 10 Personen haben eine eigene Sequenz gebaut
- [ ] Ergebnis schriftlich festgehalten, inklusive der Absagen

> Kein Puffer. Fällt das Ergebnis negativ aus, ist es billiger, jetzt umzudenken als nach Block 6.

---

## Block 6 — Monetarisierung (Wochen 10–11)

### T16 · Stripe Checkout und Webhook 🔒 ⏱16
**Dateien:** `supabase/functions/create-checkout/`, `stripe-webhook/`, `create-portal/`
**Abnahme:**
- [ ] Monat und Jahr; Rabattcodes über `allow_promotion_codes`
- [ ] Signaturprüfung gegen den Rohtext, `constructEventAsync`
- [ ] Idempotenz über `stripe_events`; doppelte Events ändern nichts
- [ ] `user_id` ausschließlich aus `client_reference_id`
- [ ] Nach Zahlung schaltet die App über Realtime frei, ohne Neuladen
- [ ] Rechnung trägt den Kleinunternehmer-Hinweis, kein USt.-Ausweis
- [ ] Tests aus SAD §8.2 grün

### T17 · Paywall und Konto ⏱8
**Abnahme:**
- [ ] Preisseite; Checkout nur im Web
- [ ] Abo im Kundenportal kündbar
- [ ] Kontoseite zeigt Status, Laufzeit, Einwilligungen, Export, Löschen

---

## Block 7 — Launch (Woche 12)

### T18 · Inhalte einpflegen ⏱10
- [ ] Vier freie Sequenzen geprüft und veröffentlicht
- [ ] Erster News-Beitrag steht
- [ ] „Über mich", Angebot und Kontakt als gepinnte Beiträge übernommen
- [ ] 301-Weiterleitungen für alle bisherigen URLs der alten Website

### T19 · Rechtliches und Launch 🔒 ⏱10
- [ ] Impressum, Datenschutzerklärung, AGB online
- [ ] Verzeichnis von Verarbeitungstätigkeiten angelegt
- [ ] AVV mit Supabase, Hostinger, Stripe geschlossen
- [ ] Checkliste aus `docs/DEPLOYMENT.md` Abschnitt 5 abgehakt

---

## Nicht in V1

Atem-Tagebuch und Micro Habits (V1.1) · Session-Protokoll (V1.1) · geführte Aufnahmen mit Markern (V1.2) · Umzug auf die Hauptdomain (V1.3) · native Apps, Programme, Coach-Sicht, Offline (V2).

Wenn eine Aufgabe eines dieser Themen berührt: nicht anfangen, sondern im SAD §11 nachsehen und die Aufgabe zurückstellen.
