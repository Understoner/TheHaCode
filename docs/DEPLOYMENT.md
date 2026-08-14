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
- **Google** aktivieren — Client ID und Secret aus der Google Cloud Console
- **Apple**: in V1 bewusst nicht. Es bräuchte eine kostenpflichtige Developer-Mitgliedschaft für eine dritte Anmeldeoption. Ab V2 mit der nativen App wird es ohnehin Pflicht.

Unter **Authentication → URL Configuration**:

```
Site URL (Staging):     https://staging.deine-domain.at
Site URL (Production):  https://app.deine-domain.at

Redirect URLs (je Projekt):
  https://<host>/auth/callback
  http://localhost:3000/auth/callback     nur im Staging-Projekt
  thehacode://auth/callback               für V2, schadet jetzt nicht
```

Unter **Authentication → Emails** die Vorlagen auf Deutsch umstellen: Bestätigung, Magic Link, Passwort zurücksetzen, E-Mail-Änderung. Der Standardtext ist Englisch und wirkt bei einem deutschsprachigen Coaching-Produkt wie ein Fremdkörper.

> Der Rest der Nutzerverwaltung — Sitzungen, Token-Erneuerung, Kontoverknüpfung, Passwort-Zurücksetzen, Löschung — kommt aus Supabase und wird nicht selbst gebaut. Fachliche Daten liegen in `public.profiles`, verknüpft über `auth.users.id` (SAD §3.3).

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

Der Schritt „Auf Hostinger-Deployment warten" kann aus zwei grundverschiedenen
Gründen scheitern. Der Log unterscheidet sie seit dem 14.08.2026 ausdrücklich —
entscheidend ist der **curl-Exitcode** in den Wartezeilen:

| Meldung | Bedeutung | Was zu tun ist |
|---|---|---|
| `curl-Exitcode 28: Connection timed out` bei **jedem** Abruf | Die Seite ist vom GitHub-Runner aus nicht erreichbar. Der Build kann längst fertig sein. | hPanel → CDN/Bot-Schutz für die Subdomain. Nicht im Build-Protokoll suchen. |
| `noch die vorherige Version (builtAt=…)` | Die Seite antwortet, Hostinger hat aber nicht neu gebaut. | hPanel → Deployments, Build-Protokoll ansehen. |
| `curl-Exitcode 22: … 404` | Erreichbar, aber `build-info.json` fehlt — Build unvollständig oder falsches Output-Verzeichnis. | Build-Einstellungen prüfen (Output `dist`). |

**Erlebt am 14.08.2026:** erster Fall. `dev.deratemcode.at` lieferte den neuen
Commit bereits 44 Sekunden nach Workflow-Start korrekt aus, inklusive aller
Schutz-Header — der Runner kam nur nicht daran, jeder Abruf lief in den
Timeout. Die Antwort trägt `server: hcdn`, es steht ein Hostinger-CDN davor.
Am 10.08. hatte derselbe Schritt noch 11 Sekunden gebraucht.

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
- [ ] Auth-Provider konfiguriert, E-Mail-Vorlagen auf Deutsch
- [x] Staging-Website auf Hostinger läuft, Branch `develop` bestätigt — Production-Website steht noch aus
- [x] Staging gegen Indexierung geschützt (automatisches `robots.txt`, kein Passwortschutz — der steht bei Node.js Web Apps in hPanel nicht zur Auswahl)
- [x] GitHub Environments `staging`/`production` mit Secrets und Variables befüllt, `production` hat einen Required Reviewer
- [ ] Branch Protection — bewusst zurückgestellt: GitHub Free auf privatem Repo unterstützt sie nicht. Reviewer-Pflicht auf `production` übernimmt einen Teil der Absicherung bis dahin.
- [ ] Ein vollständiger Durchlauf feature → develop → main erfolgreich
- [ ] Supabase Production auf Pro (spätestens am Tag der ersten Zahlung)
- [ ] Auftragsverarbeitungsverträge: Supabase, Hostinger, Stripe (SAD §5.5)
- [ ] Impressum und Datenschutzerklärung online
