# Einrichtung & Deployment

Einmalig durchzuführen, in dieser Reihenfolge. Rechne mit einem halben Tag.

---

> **Kein Spike mehr nötig.** Frühere Fassungen begannen hier mit einem Test, ob
> serverseitiges Rendern über Express auf Hostinger trägt. Seit V1 statisch
> ausgeliefert wird, entfällt diese Frage — statische Dateien auf Hostinger sind
> ein gelöstes Problem, kein Experiment.

## 1. Supabase — zwei Projekte

Beide in der Region **EU (Frankfurt)**.

| Projekt | Zweck | Tarif |
|---|---|---|
| `thehacode-staging` | Testsystem | Free |
| `thehacode-prod` | Livesystem | Free bis zur ersten Zahlung, dann Pro |

> **Upgrade auf Pro am Tag der ersten Zahlung, nicht später.** Der Free-Tarif hat keine täglichen Backups und keine Point-in-Time-Recovery. Ab dem ersten zahlenden Kunden ist ein Datenverlust kein Ärgernis mehr.

Je Projekt notieren: Project Ref, Datenbank-Passwort, Project URL, anon key.

### Auth einrichten (Supabase übernimmt die gesamte Nutzerverwaltung)

Unter **Authentication → Providers**:

- **Email** aktivieren, „Confirm email" **an**
- **Google und Apple: in V1 bewusst nicht.** Die App bietet keine Fremdanmeldung an — sie einzuschalten allein bewirkt hier deshalb nichts, dazu bräuchte es auch wieder Code. Apple hätte zusätzlich eine kostenpflichtige Developer-Mitgliedschaft vorausgesetzt und wird ohnehin erst mit einer nativen App im Store zur Pflicht (Richtlinie 4.8) — native Apps sind nicht in V1 (CLAUDE.md).

Unter **Authentication → URL Configuration**:

```
Site URL (Staging):     https://staging.deine-domain.at
Site URL (Production):  https://app.deine-domain.at

Redirect URLs (je Projekt):
  https://<host>/passwort-neu
  http://localhost:8081/**                nur im Staging-Projekt
```

> **`/passwort-neu` ist nicht optional.** Dorthin schickt
> `resetPasswordForEmail` den Nutzer, und Supabase weist ein Rücksprungziel ab,
> das nicht in dieser Liste steht. Fehlt der Eintrag, landet jeder, der sein
> Passwort zurücksetzen will, ohne Sitzung auf der Seite und bekommt „Der Link
> geht nicht mehr" zu sehen — obwohl der Link in Ordnung war.
>
> Frühere Fassungen dieser Datei nannten hier `/auth/callback`. Diese Route hat
> es in der App nie gegeben; sie stammte aus einem Entwurf mit Fremdanmeldung.

Unter **Authentication → Emails** die Vorlagen auf Deutsch umstellen: Bestätigung, Magic Link, Passwort zurücksetzen, E-Mail-Änderung. Der Standardtext ist Englisch und wirkt bei einem deutschsprachigen Coaching-Produkt wie ein Fremdkörper.

> Der Rest der Nutzerverwaltung — Sitzungen, Token-Erneuerung, Kontoverknüpfung, Passwort-Zurücksetzen, Löschung — kommt aus Supabase und wird nicht selbst gebaut. Fachliche Daten liegen in `public.profiles`, verknüpft über `auth.users.id` (SAD §3.3).

### Plus vergeben, solange es keine Bezahlung gibt

Der Sequenz-Konfigurator ist die bezahlte Funktion, und die Schranke steht
bereits: die `INSERT`-Policy auf `exercises` verlangt `has_plus_access()`
(Migration `0007`, Missbrauchsfall in `009_save_exercise.test.sql`). Ohne Plus
zeigt die App den Hinweis statt des Editors — geprüft wird aber in der
Datenbank, nicht im Browser.

Bis Stripe steht, vergebt ihr Zugang von Hand:

**Supabase Studio → Table Editor → `profiles` → `has_active_subscription` auf `true`.**

Der Weg über den **SQL-Editor funktioniert nicht** — der läuft als `postgres`,
und der Trigger `protect_entitlement_columns` lässt ausschließlich
`service_role` an diese Spalte. Der Table Editor arbeitet mit `service_role`
und darf es. Das ist Absicht: die Spalte gehört später allein dem
Stripe-Trigger.

> **Was sich beim Umstieg auf Stripe ändert: nichts an der App.** Der Webhook
> schreibt dieselbe Spalte, die ihr heute von Hand setzt. Keine Policy, kein
> Screen, kein Deployment — nur die Hand wird durch den Trigger ersetzt.
> Käme statt dessen ein Gutschein oder eine Aktion dazu, ändert sich genau
> `has_plus_access()` und keine einzige Policy (CLAUDE.md §Zugriff).

### Function Secrets

```bash
supabase secrets set --project-ref <ref> \
  STRIPE_SECRET_KEY=sk_...             \
  STRIPE_WEBHOOK_SECRET=whsec_...      \
  APP_URL=https://app.deine-domain.at
```

`SUPABASE_SERVICE_ROLE_KEY` setzt Supabase in Edge Functions automatisch. **Dieser Schlüssel gehört nirgendwo sonst hin** — nicht in GitHub, nicht in hPanel, nicht auf einen Laptop.

---

## 2. Hostinger — zwei Websites auf einem Business-Tarif

Der Business-Tarif erlaubt mehrere Websites. Staging und Production teilen sich CPU- und RAM-Kontingent; für ein Testsystem, das zwei Personen benutzen, ist das unkritisch.

Je Website: **Websites → Add Website → Node.js Apps → Import Git Repository**.

Beim ersten Mal autorisiert ihr die Hostinger-GitHub-App. **Ein Hosting-Tarif kann nur mit einem GitHub-Konto verbunden sein** — beide Websites nutzen dasselbe.

### Build-Einstellungen

| Feld | Staging | Production |
|---|---|---|
| Repository | `thehacode-app` | `thehacode-app` |
| **Branch** | `develop` | `main` |
| Framework | Other | Other |
| Node-Version | 22.x | 22.x |
| Build-Befehl | `npm run build:web` | `npm run build:web` |
| Output-Verzeichnis | `dist` | `dist` |
| Entry-File | *leer lassen* | *leer lassen* |
| Domain | `staging.deine-domain.at` | `app.deine-domain.at` |

> Build-Befehl ist ein Dropdown mit den Scripts aus `package.json`, kein
> freier Shell-Befehl — `npm ci`/`npm install` läuft davor automatisch als
> eigener Schritt.

> **Der wichtigste Punkt der ganzen Einrichtung: die Branch-Auswahl.**
> Die Branch-Auswahl steht **nicht** im Import-Assistenten selbst, sondern
> erst danach in den Website-Einstellungen der neu angelegten Seite. Bis
> dahin klont der Import den GitHub-Default-Branch — steht dort `main` und
> fehlt dort `package.json` (weil `develop` noch nicht befördert wurde),
> bricht der Import mit genau dieser Fehlermeldung ab. Abhilfe: den
> GitHub-Default-Branch kurzzeitig auf `develop` stellen, importieren, dann
> in den Website-Einstellungen auf den richtigen Branch fixieren und den
> GitHub-Default-Branch wieder auf `main` zurückstellen.
>
> **Wenn keine Branch-Auswahl vorhanden ist**, gibt es zwei Auswege: bei Hostinger-Support nachfragen, ob die Einstellung in den Settings der Website liegt — oder Production über Hostingers öffentliche API (`developers.hostinger.com`) aus dem `production`-Job in `deploy.yml` heraus auslösen statt über die Git-Automatik. Der Rest der Pipeline bleibt unverändert.

### Umgebungsvariablen (je Website unter Node.js → Environment Variables)

```
EXPO_PUBLIC_SUPABASE_URL       https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY  eyJhbGciOi...
EXPO_PUBLIC_APP_ENV            staging  |  production
```

Der **Database Connect Wizard** im Node.js-Dashboard trägt die beiden Supabase-Werte auf Wunsch selbst ein. `EXPO_PUBLIC_APP_ENV` müsst ihr von Hand setzen — davon hängt ab, ob der Staging-Hinweisbalken erscheint.

> **Wichtig, hat schon einmal zu falschen Werten auf Production geführt:** Diese
> Variablen werden zur **Build-Zeit** in den statischen Export eingebacken
> (SAD §2.5) — ein bloßes Ändern in hPanel bewirkt nichts, solange nicht neu
> gebaut wird. „Deployments → vorherige Version erneut ausrollen" ist dafür
> **nicht** geeignet, das rollt nur einen bereits gebauten Stand erneut aus
> (siehe „Wenn Production rot wird" unten). Um geänderte Umgebungsvariablen
> wirksam werden zu lassen, braucht es einen echten neuen Push auf den
> verbundenen Branch — Hostinger baut nur dann neu.

> Diese Werte landen im Client-Bundle, und das ist so vorgesehen: Der anon key ist ohne RLS wertlos, und RLS steht (SAD §3.8).

### Nach dem ersten Deployment

- [ ] SSL-Zertifikat für beide Domains ausgestellt
- [ ] `https://staging.deine-domain.at/build-info.json` liefert einen Zeitstempel
- [x] **Staging vor Suchmaschinen schützen** — `scripts/write-build-info.mjs` schreibt bei `EXPO_PUBLIC_APP_ENV=staging` automatisch ein sperrendes `dist/robots.txt`. Hostingers Passwortschutz für Verzeichnisse (hPanel → Advanced) steht bei Node.js Web Apps nicht zur Auswahl, deshalb dieser Weg statt manueller hPanel-Konfiguration.
- [ ] Unter **Security → Vulnerabilities** den Schwachstellen-Scan ansehen; Korrektur-Pull-Requests kommen automatisch
- [x] **Content Security Policy** — steht als `<meta http-equiv>` in `src/app/+html.tsx` und wird beim Build mitgeliefert. Sie erlaubt Verbindungen und Bilder nur zur eigenen Domain und zum Supabase-Projekt; selbst eingeschleuster Code hätte damit kein Ziel, an das er etwas ausleiten könnte.
- [x] **Zwei Header, die per `<meta>` nicht gehen** — `X-Content-Type-Options: nosniff` und `frame-ancestors 'none'` (gegen Clickjacking) wertet ein Browser nur als echten Antwort-Header aus. V1 hat keinen eigenen Serverprozess, der sie setzen könnte, deshalb schreibt `scripts/write-build-info.mjs` bei jedem Build ein `dist/.htaccess` — derselbe Weg wie beim Staging-`robots.txt`.

  **Am 14.08.2026 auf Staging bestätigt:** Hostinger wertet die Datei aus, alle drei Header liegen an. Der Smoke-Test *„Schutz-Header, die per `<meta>` nicht gehen, sind gesetzt"* hält das fest. Sollte er später rot werden, ist die Ursache eine Änderung an der Hosting-Konfiguration, nicht am Repo.

---

## 3. GitHub

### Branches

```
main       Livesystem. Nur über die Beförderung aus develop.
develop    Testsystem. Integrationsbranch.
feature/*  Arbeit. PR nach develop.
```

**Branch Protection** auf `main` und `develop`: Pull Request erforderlich, Status-Check `verify` erforderlich, keine Force-Pushes. Ohne diese Einstellung ist die Pipeline Dekoration.

Ausnahme: Der Job `promote` pusht direkt auf `main` — dafür braucht `github-actions[bot]` eine Ausnahme in der Branch-Protection-Regel („Allow specified actors to bypass").

### Environments

| Environment | Secrets | Variables | Schutz |
|---|---|---|---|
| `staging` | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | `STAGING_URL` | keiner |
| `production` | dieselben, mit Prod-Werten | `PRODUCTION_URL` | **Required reviewer: du** |

> **Zur Freigaberegel.** Ihr wolltet die Auslieferung nach erfolgreichem Test automatisiert. Genau das tut die Pipeline — mit einer Ausnahme, die ich empfehle: einen hinterlegten Reviewer im Environment `production`. Damit wird die Beförderung ein Klick statt eines Automatismus.
>
> Der Grund ist nicht technisches Misstrauen, sondern die Art der Anwendung: Ab Sprintblock 6 verarbeitet sie Zahlungen. Smoke-Tests fangen ab, dass die App lebt und die Zugriffstrennung greift — sie fangen nicht ab, dass ein Preis falsch, ein Text peinlich oder ein Rabattcode zu großzügig ist.
>
> Wollt ihr es vollautomatisch: Reviewer entfernen, sonst ändert sich nichts. Die Entscheidung ist reversibel und kostet einen Haken.

> **Die Freigabe wird zweimal verlangt, nicht einmal.** Erst für die Beförderung
> `develop → main`, dann noch einmal für den Production-Job selbst — beide Jobs
> hängen am Environment `production`. Das ist keine Fehlfunktion: Nach der ersten
> Freigabe steht der neue Stand auf `main` und Hostinger beginnt zu bauen; die
> zweite Freigabe erlaubt Migration und Prüfung dagegen. Wer nur die erste
> erteilt, hat den Code live, aber die Datenbank nicht migriert und nichts
> geprüft — also unbedingt beide geben.
>
> Am 16.08.2026 beim ersten vollständigen Durchlauf so bestätigt.

> **Eine wartende Beförderung blockiert nichts mehr.** Bis dahin hatte der ganze
> Workflow eine gemeinsame `concurrency`-Gruppe: eine nicht freigegebene
> Beförderung hielt jeden weiteren Staging-Rollout auf, stumm und ohne Meldung —
> der neue Lauf stand einfach auf `pending`. Seit dem 16.08.2026 hat jeder Job
> seine eigene Gruppe. Ausrollen bleibt serialisiert (zwei Migrationsläufe gegen
> dieselbe Datenbank können sich nicht überholen), aber Warten hält niemanden
> mehr auf.

---

## 4. Der Ablauf im Alltag

```
1. git checkout -b feature/sequenz-editor
2. Arbeiten, committen
3. PR nach develop                → CI: Typecheck, Lint, Vitest, pgTAP, Build
4. Merge nach develop             → Supabase Staging migriert
                                  → Hostinger baut Staging (automatisch)
                                  → Pipeline wartet auf build-info.json
                                  → Smoke-Tests gegen staging.deine-domain.at
5. Smoke grün                     → Freigabe anklicken
                                  → develop wird nach main gemergt
6. main                           → Supabase Production migriert
                                  → Hostinger baut Production
                                  → Smoke-Tests gegen app.deine-domain.at
```

Von Merge nach `develop` bis Livegang: etwa 12 bis 18 Minuten, davon die Hälfte Wartezeit auf Hostinger.

### Warum die Pipeline auf `/build-info.json` wartet

Hostinger baut unabhängig von GitHub Actions. Ohne Wartepunkt würden die Smoke-Tests die **alte** Version prüfen und fälschlich grün melden — der gefährlichste denkbare Fehlerfall, weil er Vertrauen erzeugt, wo keines hingehört.

`scripts/wait-for-deploy.sh` fragt die Datei ab, bis ihr Zeitstempel nach dem Start des Workflows liegt. Sie entsteht in `scripts/write-build-info.mjs` am Ende des Builds und wird als gewöhnliche statische Datei ausgeliefert.

### Wenn der Wartepunkt rot wird

Der Schritt „Auf Hostinger-Deployment warten" kann aus mehreren grundverschiedenen
Gründen scheitern. Der Log unterscheidet sie seit dem 14.08.2026 ausdrücklich —
entscheidend ist der **curl-Exitcode** in den Wartezeilen:

| Meldung | Bedeutung | Was zu tun ist |
|---|---|---|
| `curl-Exitcode 22: … 403` bei **jedem** Abruf | Der Server antwortet, weist den Runner aber ab. Bot-Schutz. Der Build kann längst fertig sein. | hPanel → CDN/Bot-Schutz für die Subdomain. Nicht im Build-Protokoll suchen. |
| `curl-Exitcode 28: Connection timed out` bei jedem Abruf | Vom Runner aus gar nicht erreichbar. Dieselbe Ursache wie 403, nur eine stille Abweisung statt einer gesprochenen — **am 21.08.2026 auf der Hauptdomain erlebt**, siehe unten. | Wie oben, plus DNS der Subdomain prüfen. |
| `noch die vorherige Version (builtAt=…)` | Die Seite antwortet, Hostinger hat aber nicht neu gebaut. | hPanel → Deployments, Build-Protokoll ansehen. |
| `curl-Exitcode 22: … 404` | Erreichbar, aber `build-info.json` fehlt — Build unvollständig oder falsches Output-Verzeichnis. | Build-Einstellungen prüfen (Output `dist`). |

**Erlebt am 14.08.2026:** der erste Fall, zweimal hintereinander.
`dev.deratemcode.at` lieferte den neuen Commit jeweils binnen 20 bis 45 Sekunden
nach Workflow-Start korrekt aus, inklusive aller Schutz-Header — der Runner
bekam 59-mal in Folge ein **403**. Von einer gewöhnlichen Adresse aus antwortete
dieselbe URL mit 200, und zwar mit jeder Client-Kennung (curl-Standard,
Chrome-Kennung, eigene Kennung). Es lag also **an der IP-Adresse, nicht am
Client**: Hostingers Bot-Schutz blockte die GitHub-Runner. Die Antwort trägt
`server: hcdn`. Am 10.08. hatte derselbe Schritt noch 11 Sekunden gebraucht.

**Erlebt am 21.08.2026:** derselbe Vorgang, aber als **Timeout** und auf der
**Hauptdomain**. Beim Ausrollen von T20 (`349ed11`) lief der Wartepunkt gegen
`https://deratemcode.at/build-info.json` 24-mal in Folge in `curl-Exitcode 28`
und gab nach 600 Sekunden auf. Von einer gewöhnlichen Adresse aus antwortete
dieselbe URL sofort — und zwar bereits mit dem neuen Commit, gebaut um 08:29:13,
also rund drei Minuten **bevor** der Wartepunkt aufgab. Hostinger hatte den
Build längst fertig.

Drei Dinge unterscheiden diesen Fall vom 14.08. und sind der Grund, warum er
hier eigens steht:

- **Es traf die Hauptdomain**, nicht die dev-Subdomain. Wer den Abschnitt oben
  liest und „Subdomain" wörtlich nimmt, sucht sonst an der falschen Stelle.
- **Es kam als Timeout, nicht als 403.** Die Tabelle oben legt beim Timeout
  „Firewall oder DNS" nahe; DNS war hier nachweislich in Ordnung, die Seite
  war von außen ja erreichbar. Ein stilles Verwerfen der Pakete ist bei
  Bot-Schutz genauso üblich wie eine 403 — der Exitcode sagt also etwas über
  die *Art* der Abweisung, nicht über ihre Ursache.
- **Staging war im selben Rollout unauffällig.** Der Staging-Wartepunkt und die
  Staging-Smoke-Tests liefen wenige Minuten vorher grün durch. Es ist also
  nichts, was „gerade allgemein kaputt" wäre; es trifft einzelne Hosts.

**Und noch einmal am selben Tag, diesmal auf dev.** Beim Ausrollen von
`b443f46` traf es `dev.deratemcode.at`, wieder als Timeout. Die Seite lieferte
den erwarteten Commit **22 Sekunden** nach Beginn des Wartepunkts aus; der
Runner lief trotzdem zehn Minuten ins Leere. Es trifft also **beide Hosts**,
nicht nur die Hauptdomain — und offenbar in Wellen: der Production-Lauf eine
Stunde vorher und der Neustart eine Viertelstunde später gingen beide glatt
durch.

### Das Erste, was zu tun ist: den Job neu starten

```bash
gh run rerun <run-id> --failed
```

Das genügt in diesem Fall, und zwar aus einem bestimmten Grund: Die
Hauptprüfung ist seit dem 15.08.2026 der **Commit**, nicht der Zeitstempel
(siehe den Kopf von `scripts/wait-for-deploy.sh`). Der ausgelieferte Stand ist
also bereits der richtige — es fehlt allein ein Durchlauf, bei dem der Runner
die Seite erreicht. Am 21.08.2026 war der zweite Anlauf grün, Wartepunkt und
Smoke-Tests inklusive.

Erst wenn auch der Neustart scheitert, lohnt der Weg über die nachgeholten
Smoke-Tests unten.

Die Smoke-Tests gegen Production sind damit ausgefallen und wurden von einer
gewöhnlichen Verbindung aus nachgeholt:

```bash
BASE_URL=https://deratemcode.at npx playwright test
```

5 von 5 grün. **Das gehört nach jedem roten Wartepunkt gemacht.** Ein roter
Lauf lässt zwei Möglichkeiten offen — die Seite ist kaputt, oder sie war bloß
nicht prüfbar — und von selbst klärt sich das nicht auf. Ohne die nachgeholten
Tests steht am Ende eine ausgerollte Version, die niemand geprüft hat.

> **Der Wartepunkt ist dabei nur das erste Opfer.** Die Smoke-Tests laufen von
> denselben Adressen. Blockt der Bot-Schutz die Runner, ist die gesamte
> Prüfung von GitHub aus betroffen, nicht bloß dieser eine Schritt — auch wenn
> ein echter Browser andere Signale sendet als curl und deshalb unter Umständen
> durchkommt, wo curl scheitert.

Die GitHub-Adressen freizugeben ist **kein** gangbarer Weg: das sind über 7.000
CIDR-Bereiche, die sich laufend ändern. Entweder der Bot-Schutz für die
betroffene Domain fällt weg, oder `/build-info.json` bekommt eine Ausnahme — oder die
Pipeline stößt den Build über Hostingers API an und fragt den Status dort ab,
statt die Seite abzufragen (siehe §2, „Wenn keine Branch-Auswahl vorhanden ist").

Wichtig für die Einordnung: Ein roter Wartepunkt heißt **nicht**, dass die
ausgerollte Seite kaputt ist. Er heißt, dass die Pipeline sie nicht prüfen
konnte — und sich deshalb weigert, grün zu melden. Genau dafür ist er da.
Ein schneller Gegencheck von außen:

```bash
curl -sI https://dev.deratemcode.at/ | head -1
curl -s  https://dev.deratemcode.at/build-info.json
```

### Wenn Production rot wird

Kein automatischer Rollback. In hPanel unter **Deployments** liegt die vorherige Version zum erneuten Ausrollen bereit — ein Klick. Das ist Absicht: Ein automatischer Rollback, der eine bereits gelaufene Migration nicht rückgängig machen kann, richtet mehr Schaden an als er verhindert. Genau deshalb sind Migrationen additiv (SAD §2.6): Die alte App-Version läuft mit dem neuen Schema weiter.

---

## 5. Checkliste vor dem allerersten Livegang

- [x] Beide Supabase-Projekte angelegt (Migrationen/Seeds laufen ab jetzt über die Pipeline)
- [x] Anmeldung steht: Registrierung, Anmeldung, Passwort zuruecksetzen, Kontoloeschung — ueber E-Mail und Passwort. Fremdanmeldung (Google/Apple) ist nicht Teil von V1
- [x] `https://<host>/passwort-neu` in den Redirect URLs beider Supabase-Projekte eingetragen — ohne den Eintrag scheitert das Zuruecksetzen (siehe §1). Am 16.08.2026 in beiden Projekten geprüft, mit Gegenprobe über `/auth/v1/verify`
- [ ] E-Mail-Vorlagen auf Deutsch (Bestaetigung, Passwort zuruecksetzen) — **blockiert:** eigene Vorlagen sind erst ab Supabase Pro änderbar. Fertig im Repo unter `supabase/templates/`, wartet als T17a
- [x] Staging-Website auf Hostinger läuft, Branch `develop` bestätigt — Production-Website ebenfalls, seit dem Livegang am 16.08.2026
- [x] Staging gegen Indexierung geschützt (automatisches `robots.txt`, kein Passwortschutz — der steht bei Node.js Web Apps in hPanel nicht zur Auswahl)
- [x] GitHub Environments `staging`/`production` mit Secrets und Variables befüllt, `production` hat einen Required Reviewer
- [ ] Branch Protection — **jetzt möglich, aber nicht eingerichtet.** Die ursprüngliche Sperre (GitHub Free auf privatem Repo) ist weg, seit das Repo öffentlich ist; die Reviewer-Pflicht auf `production` greift seitdem wieder. Der Schutz von `main`/`develop` gegen Direkt-Commits fehlt weiterhin und bleibt Disziplin.
- [x] Ein vollständiger Durchlauf feature → develop → main erfolgreich — seit 16.08.2026 mehrfach, zuletzt mit T17 am 21.08.2026
- [ ] Supabase Production auf Pro (spätestens am Tag der ersten Zahlung) — hängt mit T17a zusammen: mit Pro kommen auch die deutschen E-Mail-Vorlagen
- [ ] Auftragsverarbeitungsverträge: Supabase, Hostinger, Stripe (SAD §5.5)
- [x] Impressum und Datenschutzerklärung online — seit 21.08.2026, dazu AGB und Haftungsausschluss
