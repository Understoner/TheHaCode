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
- [x] `npm run dev` startet die App lokal
- [x] `npm run verify` läuft grün durch
- [x] `supabase start` und `npm run db:reset` spielen alle Migrationen ein
- [x] Grundmigration (Extensions, Enums, `profiles`, `has_plus_access()` — SAD §3.2–3.3) liegt als `supabase/migrations/0001_foundation.sql`
- [x] `supabase/tests/001_foundation.test.sql` existiert mit der UNION-Liste aller Nutzertabellen (CLAUDE.md); künftige Nutzertabellen tragen dort nach
      — zuletzt ergänzt um `course_bookings` (0011) und `user_consents` (0012)
- [x] CI läuft auf einem Test-PR grün (Workflow `ci.yml`, Status-Check `verify`)

### T01a · iOS-Audio-Spike (gesperrter Bildschirm) ⏱4
**Ziel:** Die einzige offene Frage beantworten, die die Roadmap noch verschieben könnte (SAD §7.7, §10).
**Vorgehen:** Minimale PWA mit Audio-Element und Media Session API bauen, auf einem echten iPhone installieren, Bildschirm sperren, zwölf Minuten warten.
**Abnahme:**
- [ ] Ergebnis dokumentiert: Audio läuft bei gesperrtem Bildschirm weiter — ja/nein
- [ ] Bei „nein": Entscheidung getroffen und in SAD §7.7 nachgetragen, welcher der drei dort genannten Auswege gilt

> **Nicht mehr dringend, aber offen.** V1 spielt keine Audiodateien ab — die Töne
> kommen aus dem Oszillator und nur bei sichtbarem Bildschirm. Die Frage wird
> erst mit den geführten Aufnahmen scharf (V1.2, SAD §11.2). Der Spike blockiert
> V1 also nicht mehr; erledigt gehört er trotzdem, bevor V1.2 geplant wird.

> Steht bewusst vor T02, nicht in Block 3 bei T10 — SAD §7.7 verlangt ihn ausdrücklich für Sprint 1, weil sein Ergebnis noch die Roadmap verschieben kann.

### T02 · Deployment-Pipeline ⏱6
**Ziel:** Beide Umgebungen laufen, Beförderung funktioniert.
**Dateien:** `.github/workflows/*`, `scripts/wait-for-deploy.sh`, `scripts/write-build-info.mjs`
**Abnahme:**
- [x] `npm run build:web` ruft `scripts/write-build-info.mjs` am Ende auf; `dist/build-info.json` liegt danach neben den übrigen Build-Dateien
- [x] Push auf `develop` → Staging aktualisiert sich
- [x] Smoke-Tests laufen gegen die **neue** Version, nicht die alte
      — `wait-for-deploy.sh` prüft auf den **Commit**, nicht auf den Zeitstempel (Fix vom 15.08.2026)
- [x] Freigabe → `main` → Production aktualisiert sich
- [ ] Ein absichtlich fehlschlagender Smoke-Test verhindert die Beförderung
      — strukturell gegeben (`promote` steht auf `needs: staging`), aber nie
      absichtlich provoziert. Ein einmaliger Versuch mit einem kaputten Test
      wäre der Beleg.

> **Bekannte Schwäche, dokumentiert:** Der Wartepunkt kann rot werden, obwohl
> der Livegang in Ordnung ist — wenn Hostingers Bot-Schutz die GitHub-Runner
> abweist. Zweimal erlebt (14.08. als 403 auf der dev-Subdomain, 21.08. als
> Timeout auf der Hauptdomain). Beides steht in `docs/DEPLOYMENT.md`, samt der
> Regel, danach die Smoke-Tests von außen nachzuholen.

### T03 · Design-Tokens und Komponenteninventar ⏱14
**Ziel:** Die zwölf Bausteine, aus denen alle Screens bestehen.
**Dateien:** `src/design/tokens.ts`, `src/components/*`
**Vorlage:** `ui/01_startscreen.svg` (Token-Leiste unten), SAD §6
**Bausteine:** Button (primär/sekundär/tertiär), TextInput, Stepper, Slider, Toggle, Card, ListRow, StateMessage, SkeletonList, QueryBoundary, Sheet, BreathRing
**Abnahme:**
- [x] Alle Farben stammen aus `tokens.ts`, kein Hex-Literal in Komponenten
- [x] Fließtext nutzt ausschließlich die 700er-Töne (Kontrast ≥ 4,5:1)
- [x] Keine Schatten; Abgrenzung über 1-px-Linien
- [x] Sichtbarer Tastaturfokus auf allen bedienbaren Elementen
      — betraf dreizehn Dateien, nicht nur die neuen. Gelöst über
      `components/PressableRing.tsx`: ein Pressable, das seinen Fokus zeigt.
      Der Zustand gehört je Element, nicht je Bildschirm — sonst hätten in den
      Filterlisten alle Chips gleichzeitig geleuchtet.
- [x] ESLint-Regel verbietet Hex-Literale in `src/components` und `src/app`
      — dazu `src/features`. Gegenprobe gefahren: ein eingesetztes `'#16242B'`
      lässt `npm run lint` scheitern.

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
- [x] Registrierung, Anmeldung, Abmeldung, Passwort zurücksetzen funktionieren
- [x] ~~Google und Apple funktionieren im Web~~ — zurückgezogen
      — **am 16.08.2026 auf Wunsch wieder entfernt** (PR #26). Der Stand liegt
      im Branch `feature/auth-google-apple`; Wiedereinbau wäre ein `git revert`.
- [x] Neuer Nutzer bekommt automatisch ein `profiles`-Zeile (Trigger aus 0002)
- [x] Nach Neuladen bleibt man angemeldet
- [x] Alle Fehlertexte deutsch, ohne Technikjargon
- [x] Keine eigene Passwort-, Token- oder Sitzungslogik im Code

### T05 · Consent-Flow 🔒 ⏱8
**Ziel:** AGB und Datenschutz beim Signup, nachweisbar.
**Dateien:** `src/features/consent/*`
**Abnahme:**
- [x] Zustimmung schreibt eine Zeile in `user_consents` mit `definition_id`
      — Infrastruktur kam mit Migration 0012 (T17), nicht hier
- [x] Ohne Zustimmung kein Abschluss der Registrierung
      — Pflichthaken für die **AGB**, und nur für sie. Für die
      Datenschutzerklärung bewusst keiner: verarbeitet wird auf Grundlage des
      Vertrags (Art. 6 Abs. 1 lit. b), nicht auf Grundlage einer Einwilligung —
      ein erzwungenes Häkchen holte eine Zustimmung ein, die niemand braucht
      und die als erzwungene keine freiwillige wäre. Sichtbar informiert wird
      weiterhin. Beide Zeilen entstehen im Trigger aus Migration 0013, weil es
      im Moment der Registrierung noch keine Sitzung gibt.
- [x] Im Profil sichtbar, welcher Version zugestimmt wurde
- [x] Widerruf erzeugt eine **neue** Zeile, kein Update
      — durch UPDATE- und DELETE-Verbot in der Datenbank erzwungen, geprüft in
      `013_consents.test.sql`

### T06 · Konto löschen und Daten exportieren 🔒 ⏱10
**Ziel:** Betroffenenrechte, funktionsfähig ab Tag eins.
**Dateien:** `supabase/functions/delete-account/`, `supabase/functions/export-my-data/`, `src/app/(app)/profil/`
**Abnahme:**
- [x] Export liefert eine JSON-Datei mit allen Nutzerdaten
      — mit T17 gebaut, im Client unter RLS zusammengestellt
- [x] Löschen entfernt das Konto restlos; pgTAP-Kaskadentest bleibt grün
- [x] Löschen verlangt eine Bestätigung mit Eingabe der E-Mail-Adresse
      — die zwei Schritte allein waren zu wenig: der Bestätigungsknopf sitzt
      genau dort, wo eben noch „Konto löschen" stand. Groß- und Kleinschreibung
      spielt keine Rolle.
- [x] Beide Functions lehnen Aufrufe ohne gültiges JWT ab

### T07 · Landing Page und News ⏱16
**Ziel:** Die öffentliche Seite — sie ersetzt die alte Website.
**Dateien:** `src/app/index.tsx`, `src/features/news/*`, `supabase/migrations/0002_news.sql`
**Abnahme:**
- [x] Ohne Anmeldung erreichbar
- [x] Neuer News-Beitrag im Studio erscheint **ohne Neubau** (Daten kommen zur Laufzeit)
- [ ] „Über mich" und Kontakt als gepinnte Beiträge (Angebot zieht nach T07a auf die eigene Kurse-Seite)
      — redaktionell, gehört zu T18. Texte, Bilder und SQL liegen fertig in
      `docs/INHALTE.md`; einzupflegen ist es im Studio.
      **Zuschnitt geändert am 22.08.2026:** aus drei Beiträgen werden drei
      andere — „Der Atemcode" (gepinnt, ganz oben), „Wer hinter DER ATEMCODE
      steht" (gepinnt, mit Portrait und Kontaktangaben) und ein Blog-Beitrag
      „Besser atmen, besser leben" aus dem eBook. Der eigene Kontakt-Beitrag
      entfällt, seine Angaben stehen jetzt im Beitrag über Michael.
- [x] Detailseite `/news/[slug]`
      — **am 22.08.2026 nachgebaut, vorher in keiner Aufgabe.** Grund: `body_md`
      ist `not null`, wurde aber von keiner Ansicht gelesen — ein Pflichtfeld,
      das niemand sieht, ist eine Einladung, es schlecht zu pflegen. Dazu ein
      eigener kleiner Markdown-Leser (`src/features/news/markdown.ts`), weil
      CLAUDE.md keine neue Bibliothek zulässt und die üblichen Pakete ohnehin
      über HTML rendern, das React Native nicht kennt.
      **Dabei gefunden:** der statische Export legt für eine dynamische Route
      nur eine Vorlagendatei mit Klammernamen an — ohne Rewrite-Regel hätte der
      Hoster jeden direkt aufgerufenen Beitrag mit 404 beantwortet. Die Regel
      steht jetzt in `scripts/write-build-info.mjs`. Dieselbe Lücke haben
      `/sessions/<id>` und `/sequenzen/<id>`; sie bleibt dort bewusst offen,
      beide werden nur aus der App heraus angesteuert.
- [x] Vier Zustände über `QueryBoundary` behandelt

> Erledigt bis auf die redaktionelle Befüllung. Freie Sequenzen (T09–T11) folgen erst in Block 3.

### T07a · Kurse-Seite ⏱10
**Ziel:** Aktuell angebotene Kurse öffentlich darstellen, redaktionell über Supabase Studio pflegbar.
**Dateien:** `supabase/migrations/0003_courses_team.sql` (Tabelle `courses`), `src/features/courses/*`, `src/app/kurse.tsx`
**Vorlage:** `src/features/news/*` (identisches Muster: Migration → Typen → Query-Hook → `QueryBoundary`-Komponente → Test)
**Abnahme:**
- [x] Nur veröffentlichte Kurse sichtbar (`published_at`-Gate wie bei News)
- [x] ~~Kein Buchungs-/Zahlungsablauf — Anmeldung über externen Link (`signup_url`)~~ — aufgehoben
      — **am 16.08.2026 aufgehoben, siehe T20.** Der externe Link bleibt, bis
      T20 gebaut ist; danach ist er der Rückfall, nicht der Regelweg.
- [x] Vier Zustände über `QueryBoundary` behandelt
- [x] pgTAP: Normal- und Missbrauchsfall (`supabase/tests/003_courses_team.test.sql`)

### T07b · Team-Seite ⏱8
**Ziel:** Teammitglieder mit Foto und Kurzvorstellung öffentlich darstellen.
**Dateien:** `supabase/migrations/0003_courses_team.sql` (Tabelle `team_members`), `src/features/team/*`, `src/app/team.tsx`
**Abnahme:**
- [x] Sortierung über `sort_order`, nur veröffentlichte Zeilen sichtbar
- [x] Foto über Storage-Bucket `public-assets` (T07e)
- [x] Vier Zustände über `QueryBoundary` behandelt

### T07c · Navigation ⏱6
**Ziel:** Ein Menü, das schon auf noch nicht gebaute Funktionen verweist, ohne den Build zu brechen.
**Dateien:** `src/design/navigation.ts`, `src/components/NavBar.tsx`, `src/app/_layout.tsx`
**Abnahme:**
- [x] Start/News/Kurse/Team als echte Links
- [x] Übungen/Sequenz-Konfigurator als „bald verfügbar" — kein `href` auf eine nicht existierende Route (bricht sonst `typedRoutes: true` aus `app.json`)
      — überholt: beide sind inzwischen echte Routen (`/sessions`, `/sequenzen`).
      Die `comingSoon`-Variante bleibt im Typ, weil sie wieder gebraucht wird.

### T07d · Impressum & Datenschutz 🔒 ⏱6
**Ziel:** Rechtliches Minimum für den Domain-Umzug — ohne erfundene Geschäftsdaten.
**Dateien:** `src/i18n/locales/de/legal.json`, `src/app/impressum.tsx`, `src/app/datenschutz.tsx`
**Warum 🔒:** Rechtsverbindlicher Text braucht Review durch einen Menschen, nicht nur einen grünen Test.
**Abnahme:**
- [x] Keine erfundenen Fakten — fehlende Angaben (Nachname, Anschrift, E-Mail, UID) als `[[TODO: ...]]`-Platzhalter
- [x] Sichtbarer Warnbanner auf beiden Seiten, solange ein Platzhalter steht — **auch in Production**, nicht nur Staging
- [x] ~~Inhaltlich schmal: kein Tracking, keine Nutzerkonten in dieser Phase~~ — überholt, siehe unten

> **Erweitert am 16.08.2026.** Die Annahme „keine Nutzerkonten in dieser Phase"
> ist mit Auth und Stripe hinfällig geworden; die Datenschutzerklärung
> behauptete das aber weiterhin und war damit im Livebetrieb inhaltlich falsch.
> Sie ist jetzt vollständig neu geschrieben: Konto, eigene Sequenzen,
> Zahlungsabwicklung über Stripe, Speicherung im Browser, Empfänger,
> Speicherdauer inklusive § 132 BAO. Ebenfalls korrigiert: der Verweis auf die
> EU-OS-Plattform im Impressum — die wurde eingestellt.
> AGB und Haftungsausschluss kamen mit T19a dazu.

### T07e · Storage-Bucket `public-assets` ⏱4
**Ziel:** Ein öffentlicher Bucket für Kurs-, Team- und (künftig) News-Bilder, Schreibzugriff nur für Admins.
**Dateien:** `supabase/migrations/0004_storage_public_assets.sql`, `supabase/tests/004_storage_public_assets.test.sql`
**Abnahme:**
- [x] Öffentliches Lesen, Schreiben nur mit `is_admin()`
- [x] Ordner-Allowlist (`news`/`courses`/`team`) technisch erzwungen, nicht nur Konvention
- [x] pgTAP deckt den Missbrauchsfall ab (falscher Ordner, fehlende Admin-Rolle)

---

## Block 3 — Breathing Engine (Wochen 5–6) 🔒

### T08 · Timeline-Logik 🔒 ⏱10
**Ziel:** Reine, testbare Zeitrechnung ohne React.
**Dateien:** `src/features/breathing/timeline.ts`, `__tests__/timeline.test.ts`
**Vorgehen:** **Tests zuerst.** Die Testfälle stehen fertig in SAD §8.1 — ins Repo kopieren, rot laufen lassen, dann implementieren.
**Abnahme:**
- [x] Alle Tests aus SAD §8.1 grün
- [x] 4-4-4-4 × 8 ergibt 32 Segmente und exakt 128 000 ms
- [x] Keine Lücke und keine Überlappung zwischen Segmenten
- [x] Rundenprogression respektiert das Maximum
- [x] Nach 20 Minuten simulierter Laufzeit keine Drift

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
- [x] Ein Re-Render je Phasenwechsel, nicht je Frame
- [ ] Auf einem Mittelklasse-Android flüssig
      — nur an einem echten Gerät feststellbar
- [x] `prefers-reduced-motion`: fester Radius, Marke und Zähler laufen weiter
- [x] Bildschirm bleibt während der Übung wach
      — Screen Wake Lock API, samt erneuter Anforderung nach einem Tabwechsel
      (der Browser gibt die Sperre dort von selbst frei). Fehlt die API
      (Firefox, Safari vor 16.4), läuft die Übung wie bisher.

### T10 · Töne ⏱3
**Ziel:** Ein kurzer Ton je Phasenwechsel, ohne eine einzige Audiodatei.
**Dateien:** `src/features/breathing/tones.ts`
**Vorlage:** SAD §7.5 — der Code steht dort vollständig
**Abnahme:**
- [x] Drei bis vier Tonhöhen über `OscillatorNode`, keine Dateien im Repo
- [x] Kurze Hüllkurve, kein Knacken beim Ein- und Ausblenden
- [x] Ton am Phasen**beginn**, nicht davor
- [x] Phasen unter 1,2 s bleiben stumm (`MIN_PHASE_MS`)
- [x] `AudioContext` startet erst auf Nutzerinteraktion
- [x] Abschaltbar über `profiles.sound_enabled`
      — die Einstellung überlebt jetzt Gerät und Sitzung. Ohne Anmeldung gilt
      sie für den Besuch; `localStorage` ist für fachliche Daten verboten.
- [ ] Auf einem echten iPhone prüfen, ob fremde Musik weiterläuft — Ergebnis notieren

### T11 · Player-Screen ⏱10
**Ziel:** Vollbild, ohne Ablenkung.
**Dateien:** `src/app/(app)/ueben/[id].tsx`
**Vorlage:** `ui/03_atem_animation.svg`
**Abnahme:**
- [x] Navigation vollständig ausgeblendet
- [x] Pause, Anhalten, Ton; Ausstieg nur über „Beenden"
- [x] Bei mehreren Blöcken: „Block 2 von 3 · Runde 3 von 8"
- [x] Ring teilt sich beim Blockwechsel neu auf, nur in der Pause zwischen Blöcken

---

## Block 4 — Konfigurator (Wochen 7–8)

### T12 · Sequenz-Konfigurator ⏱30
**Ziel:** Die bezahlte Funktion.
**Dateien:** `src/app/(app)/meine/*`, `src/features/sequences/*`
**Vorlage:** `ui/04_konfigurator.svg`
**Umfang:** Blockliste mit Auf- und Zuklappen, Phasen-Stepper, Runden-Slider, Pause je Block, Umsortieren, Duplizieren, Löschen, Zeitleiste über alle Blöcke, Live-Vorschau, Vorhören
**Abnahme:**
- [x] Bis zu 10 Blöcke, immer nur einer offen
- [x] Vorschau-Ring aktualisiert sich beim Tippen
- [x] Zeitleiste zeigt Blockanteile proportional inklusive Runden
- [x] Grenzen aus der Datenbank, Fehlertexte wie in `ui/04_konfigurator.svg`
- [x] Optimistisches Speichern mit Rollback bei Fehler
      — vorweggenommen wird nur, was die Liste zeigt: Titel und Untertitel.
      Die Blöcke nicht — sie bekommen ihre IDs erst von `save_exercise`, und
      geratene IDs wären schlimmer als eine kurze Verzögerung.
- [x] Ohne Plus: bedienbar, Speichern gesperrt, Hinweis auf Plus
      — der Hinweis führt seit T17 auf `/plus`
- [x] Nach Abo-Ende: eigene Sequenzen abspielbar und löschbar, nicht änderbar

### T13 · Policy-Tests zum Konfigurator 🔒 ⏱4
**Ziel:** Die Missbrauchsfälle bleiben abgedeckt.
**Dateien:** ~~`supabase/tests/002_configurator.test.sql`~~ — tatsächlich
`supabase/tests/007_exercises.test.sql` und `009_save_exercise.test.sql`
**Abnahme:**
- [x] Alle 14 Tests grün — es sind 24 geworden (12 + 12)
- [x] Neue Policy ohne zugehörigen Missbrauchstest wird nicht gemerged
      — eingehalten: 0010 kam mit 18 Tests, 0011 mit 33, 0012 mit 18

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
- [x] Monat und Jahr; Rabattcodes über `allow_promotion_codes`
      — gilt nur fürs Abo; Kursbuchungen kennen keine Rabattcodes
- [x] Signaturprüfung gegen den Rohtext, `constructEventAsync`
- [x] Idempotenz über `stripe_events`; doppelte Events ändern nichts
      — zusätzlich in der Fachlogik: dieselbe Sitzung addiert keinen Betrag zweimal
- [x] `user_id` ausschließlich aus `client_reference_id`
- [x] Nach Zahlung schaltet die App über Realtime frei, ohne Neuladen
      — abonniert wird `profiles`, nicht `subscriptions`: dort steht der Wert,
      an dem `has_plus_access()` hängt, und `subscriptions` führt
      Kundennummern und Periodengrenzen, die über eine offene Verbindung
      niemanden etwas angehen. RLS gilt auch für Realtime.
- [x] Rechnung trägt den Kleinunternehmer-Hinweis, kein USt.-Ausweis
      — im Stripe-Dashboard hinterlegt (21.08.2026)
- [x] Tests aus SAD §8.2 grün

### T17 · Paywall und Konto ⏱8
**Abnahme:**
- [x] Preisseite; Checkout nur im Web
      — `/plus`, Beträge zur Laufzeit aus Stripe (Edge Function `get-prices`), damit
      angezeigter und abgebuchter Preis nicht auseinanderlaufen können.
- [x] Abo im Kundenportal kündbar
      — über `create-portal`. Bewusst kein eigener Kündigen-Knopf: was im Portal
      passiert, kommt als Ereignis über den Webhook zurück und schreibt dieselbe
      Tabelle wie jede andere Änderung.
- [x] Kontoseite zeigt Status, Laufzeit, Einwilligungen, Export, Löschen
      — Einwilligungen brauchten erst die Infrastruktur aus SAD §3.10; sie kam mit
      Migration 0012 (`consent_definitions`, `user_consents`, `has_consent()`).
      `health_data` bleibt unveröffentlicht, V1 verarbeitet keine Art.-9-Daten.
      Export ist eine JSON-Datei aus den eigenen Zeilen, zusammengestellt im
      Client unter RLS.

> **Gebaut am 21.08.2026.** Zwei Anmerkungen zum Nachlesen:
> Der SAD behauptet in §5, die Consent-Infrastruktur sei "bereits gebaut" — das
> stimmte nicht, sie entstand erst hier.
> Und `has_consent()` sortiert nicht nach `created_at`, sondern nach einer
> Identity-Spalte: zwei Erklärungen aus derselben Transaktion tragen denselben
> Zeitstempel, und "die letzte" wäre dann Zufall.

### T17a · Auth-Mails ins Dashboard übertragen ⏱1
**Ziel:** Die deutschen Vorlagen aus `supabase/templates/` gehen tatsächlich raus,
statt weiter englisch („Confirm your signup").
**Auslöser:** Sobald der erste zahlende Kunde da ist — dann ist der Supabase-Pro-Plan
ohnehin gerechtfertigt. **Vorher nicht möglich:** eigene E-Mail-Vorlagen sind im
Dashboard erst ab Pro änderbar, der freie Plan zeigt sie nur an.
**Vorgehen:** Supabase → Projekt → Authentication → Emails → Templates. Betreff und
HTML je Vorlage ersetzen, **in beiden Projekten** (Staging und Live). Zuordnung und
Betreffzeilen stehen in `supabase/templates/_HINWEIS.md`.
**Abnahme:**
- [ ] „Confirm signup", „Reset Password", „Change Email Address" in Staging ersetzt
- [ ] Dieselben drei in Live ersetzt
- [ ] Je eine Testmail ausgelöst und im Postfach geprüft — Link führt ans Ziel
- [ ] `supabase config push` **nicht** benutzt (überschreibt `site_url` und die
      Redirect URLs mit den localhost-Werten aus `config.toml`)

> Bis dahin bleiben die Vorlagen im Repo wirkungslos, aber versioniert. Sie sind
> fertig und reviewt (PR #29) — es fehlt allein der Dashboard-Zugriff.

---

## Block 7 — Launch (Woche 12)

### T18 · Inhalte einpflegen ⏱6
- [ ] Vier freie Sequenzen geprüft und veröffentlicht
- [ ] Erster News-Beitrag steht

> Impressum/Datenschutzerklärung und der Domain-Umzug sind mit T07d/T07e in
> Block 2 vorgezogen, nicht mehr Teil von Launch (geändert in SAD 0.7).

### T19 · Rechtliches und Launch 🔒 ⏱6
- [x] AGB online (erst jetzt nötig — ab hier existieren Nutzerkonten/Zahlungen)
- [x] Haftungsausschluss online — nicht ursprünglich geplant, siehe T19a
- [x] Verzeichnis von Verarbeitungstätigkeiten angelegt
      — `docs/VERARBEITUNGSVERZEICHNIS.md`, neun Tätigkeiten, aus Migrationen
      und Edge Functions zusammengetragen. **Entwurf, noch nicht in Kraft:**
      es fehlt die eine Prüfung, die kein Werkzeug abnehmen kann — ob die
      Speicherdauern dem entsprechen, was tatsächlich passiert.
      Enthält bewusst auch, was *nicht* verarbeitet wird — an genau so einer
      Auslassung ist die Datenschutzerklärung schon einmal falsch geworden.
- [x] AVV mit Supabase, Hostinger, Stripe geschlossen
      — bei allen dreien Anhang der Nutzungsbedingungen, deren Annahme als
      Unterschrift gilt (Art. 28 Abs. 9 lässt elektronische Form zu). Es gab
      also nichts anzufordern und nichts zu unterschreiben. Fassungen,
      Drittlandgrundlage und was daraus noch folgt: Abschnitt 4 des
      Verzeichnisses.
- [ ] Checkliste aus `docs/DEPLOYMENT.md` Abschnitt 5 abgehakt

### T19a · Zustimmung zu AGB und Rücktrittsrecht im Bezahlvorgang 🔒 ⏱3
**Ziel:** Die AGB werden Vertragsbestandteil, und das Rücktrittsrecht ist sauber
geregelt. Beides fehlt derzeit — die Texte stehen online, sind aber an keiner
Stelle des Kaufs zu bestätigen.
**Dateien:** `supabase/functions/create-checkout/index.ts`, Stripe-Dashboard
**Warum 🔒:** Betrifft den Vertragsschluss selbst.
**Vorgehen:** Stripe Checkout kann beides einsammeln, ohne dass wir eine eigene
Oberfläche bauen:
```ts
consent_collection: {
  terms_of_service: 'required',
},
```
Die AGB-Adresse (`<APP_URL>/agb`) muss dafür im Stripe-Dashboard unter
Einstellungen → Checkout hinterlegt sein — **sonst lehnt Stripe den Aufruf ab
und der Kauf bricht.** Deshalb Dashboard zuerst, Code danach.
**Abnahme:**
- [x] Zustimmung zu den AGB ist im Checkout verpflichtend
      — `consent_collection: { terms_of_service: 'required' }` in
      `create-checkout`. **Wirksam erst, wenn die AGB-Adresse im
      Stripe-Dashboard steht** — vorher lehnt Stripe den Aufruf ab und niemand
      kann kaufen. Deshalb Dashboard zuerst, Merge danach.
- [x] Ausdrückliche Zustimmung zum sofortigen Leistungsbeginn samt Hinweis auf
      das Erlöschen des Rücktrittsrechts
      — **Entscheidung vom 21.08.2026: das Recht soll so früh wie möglich
      erlöschen.** Umgesetzt über `custom_text.terms_of_service_acceptance`:
      derselbe Haken trägt beide Erklärungen. Maßgeblich ist dabei nicht
      § 18 Abs. 1 Z 11 FAGG (Dienstleistung, *vollständig* erbracht — bei einem
      laufenden Abo nie), sondern **§ 18 Abs. 2 FAGG**: bei digitalen Inhalten
      erlischt das Recht mit dem *Beginn* der Bereitstellung. § 4 der AGB
      spricht das jetzt ausdrücklich aus.
- [x] Registrierung verweist sichtbar auf AGB und Datenschutzerklärung
      — bestand schon seit dem AGB-Pflichthaken (Migration 0013)
- [x] Hinweis **vor** dem Kauf, nicht nur im Checkout
      — nachgetragen: § 4 FAGG verlangt die Information vor Vertragsabschluss,
      der Haken bei Stripe ist die Bestätigung danach. Zwei Pflichten, zwei
      Stellen. Steht als `plus.widerruf` auf der Preisseite.
- [ ] In beiden Umgebungen scharf — hängt am Dashboard-Schritt, siehe oben

> **Eine Lücke bleibt und ist Absicht.** § 18 Abs. 2 Z 3 FAGG will die
> Bestätigung des Vertrags samt dieser Erklärung auf einem dauerhaften
> Datenträger. Was Stripe verschickt, ist der Zahlungsbeleg — ob die
> Zustimmung darin auftaucht, hängt an den Dashboard-Einstellungen. Eigene
> Mails versendet das Projekt bewusst nicht (`supabase/functions/_HINWEIS.md`).
> Beim Einrichten also prüfen, was in der Bestätigungsmail tatsächlich steht.

> Ohne T19a galt: das vierzehntägige Rücktrittsrecht besteht in vollem Umfang,
> und die AGB sind im Streitfall womöglich nicht wirksam einbezogen.

### T20 · Kurse in der App buchen und bezahlen 🔒 ⏱20
**Ziel:** Workshops, Camps und Kurse werden nicht mehr über einen externen Link
angemeldet, sondern in der App gebucht und über Stripe bezahlt.
**Warum neu:** T07a schließt genau das noch aus („Kein Buchungs-/Zahlungsablauf
— Anmeldung über externen Link `signup_url`"). Das ist am 16.08.2026 bewusst
aufgehoben worden. **T07a ist damit überholt**, nicht T20 falsch.
**Warum 🔒:** Zahlungen und Entgegennahme von Anzahlungen.

**Das Vertragswerk steht schon.** Teil B der AGB (§§ 11–13) regelt Anmeldung,
Anzahlung, Stornostaffel und Absage bereits vollständig — die Implementierung
muss sich daran halten, nicht umgekehrt.

**Der entscheidende Unterschied zum Abo:** ein Kurs ist eine Einmalzahlung,
`mode: 'payment'` statt `mode: 'subscription'`. Daraus folgt fast alles andere:

- `create-checkout` kennt heute nur `subscription`. Entweder ein zweiter
  Einstiegspunkt `create-course-checkout` oder ein Modus-Parameter — beim
  Schneiden daran denken, dass die Prüfung „hat schon ein Abo" für Kurse
  sinnlos ist.
- Der Webhook darf aus einer Kursbuchung **keine** Zeile in `subscriptions`
  schreiben. Heute passiert das nicht: `checkout.session.completed` ohne
  `subscription` liefert in `rowForEvent` `null`, die Funktion quittiert mit
  200 und tut nichts. Der bestehende Code ist also nicht gefährlich, aber auch
  nicht zuständig — es braucht einen eigenen Zweig und eine eigene Tabelle.
- Neue Migration: `course_bookings` (Nutzerbezug, Kurs, Status, gezahlter
  Betrag, Anzahlung/Restzahlung, Stornozeitpunkt). Regeln aus CLAUDE.md für
  Nutzertabellen beachten, Eintrag in die UNION-Liste in `001_foundation`.
- `courses` braucht Preis und Teilnehmerzahl. Additiv, also nullable.
- **Plätze sind endlich.** Das ist der einzige Ort im Projekt mit einem echten
  Wettlauf: zwei Personen buchen den letzten Platz gleichzeitig. Die Zählung
  gehört in die Datenbank, nicht in den Client — und die Reservierung muss vor
  dem Bezahlen greifen und wieder verfallen, wenn nicht gezahlt wird.

**Die unangenehme Stelle: die Anzahlung.** § 11 AGB verlangt bei Offline-Terminen
über 130 € eine Anzahlung von 50 %, Rest spätestens vier Wochen vor Beginn.
Das ist in Stripe kein Standardfall. Vor dem Bauen entscheiden:
- zwei getrennte Zahlungen (Anzahlung jetzt, Restbetrag später per Zahlungslink), oder
- Gesamtbetrag sofort, oder
- die AGB an das anpassen, was ohne Sonderlogik geht.
Die dritte Möglichkeit ist ausdrücklich erlaubt — die AGB sind für uns
geschrieben, nicht gegen uns.

**Abnahme:**
- [x] Buchung legt eine Zeile in `course_bookings` an, geschrieben ausschließlich vom Webhook
      — angelegt wird sie von `reserve_course_seat()` unter `service_role`, bestätigt
      ausschließlich vom Webhook. Der Client hat auf der Tabelle kein Schreibrecht.
- [x] Kursbuchungen erzeugen unter keinen Umständen einen Eintrag in `subscriptions` — pgTAP-Missbrauchstest
- [x] Überbuchung ist ausgeschlossen; Test mit zwei gleichzeitigen Buchungen des letzten Platzes
      — `supabase/tests/012_course_booking_race.test.sql`, zwei echte Verbindungen über dblink.
      Gegenprobe gefahren: ohne `for update` wird der Test rot (zwei Buchungen auf einen Platz).
- [x] Storno nach § 12 AGB abgebildet oder bewusst als Handarbeit dokumentiert
      — Handarbeit, Ablauf in `docs/KURSBUCHUNG.md`.
- [x] Entscheidung zur Anzahlung schriftlich festgehalten, AGB und Umsetzung stimmen überein
      — zwei Zahlungen, Restbetrag per Zahlungslink. `docs/KURSBUCHUNG.md` und Kopf von Migration 0011.
- [x] Bestätigungsmail nach Buchung (§ 11: die Anmeldung wird erst damit verbindlich)
      — der Zahlungsbeleg von Stripe, dazu eine Bestätigungsseite in der App. Kein eigener
      Versanddienst; die Einstellung dazu steht in `supabase/functions/_HINWEIS.md`.

> **Gebaut am 21.08.2026.** Offen geblieben und bewusst nicht gebaut: Warteliste,
> Erinnerung an den Restbetrag, Stornoknopf in der App, Teilnehmerliste in der App.
> Alle vier stehen mit Begründung in `docs/KURSBUCHUNG.md`.
>
> **Am 22.08.2026 auf dev durchgezahlt:** Vollzahlung und Anzahlung über den
> echten Weg, `subscriptions` dabei unverändert. Es fehlen noch der Restbetrag
> per Zahlungslink, die „Ausgebucht"-Anzeige und dieselbe Probe im Livemodus —
> Liste in `docs/KURSBUCHUNG.md`.

---

## Nicht in V1

Atem-Tagebuch und Micro Habits (V1.1) · Session-Protokoll (V1.1) · geführte Aufnahmen mit Markern (V1.2) · native Apps, Programme, Coach-Sicht, Offline (V2) · In-App-Redaktionsoberfläche für News/Kurse/Team (vorgemerkt, SAD §11.6 — Supabase Studio reicht vorerst).

Wenn eine Aufgabe eines dieser Themen berührt: nicht anfangen, sondern im SAD §11 nachsehen und die Aufgabe zurückstellen.
