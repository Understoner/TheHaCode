# Vorbereitung — von null bis zur ersten Claude-Code-Sitzung

Ausgangslage: ein Windows-PC ohne Entwicklungswerkzeuge, keine Cloud-Konten.
Ziel: `claude` startet im Projektverzeichnis und `/task T01` kann losgehen.

**Realistischer Aufwand:** ein bis zwei Arbeitstage. Der reine Klickaufwand liegt bei etwa vier Stunden — der Rest ist Warten auf Verifizierungen und DNS.

---

## Teil 0 — Zuerst lesen: was Geld kostet und was Zeit braucht

| Posten | Kosten | Wartezeit | Wann starten |
|---|---|---|---|
| Claude Pro oder Max | ab ~20 USD/Monat | keine | Teil A |
| Hostinger Business | ~4–8 EUR/Monat, Jahresvorauszahlung üblich | keine | Teil A |
| Stripe-Konto | keine Grundgebühr | **1–3 Tage Verifizierung** | **sofort** |
| DNS-Umstellung | keine | **bis 48 Stunden** | **sofort** |
| GitHub | kostenlos | keine | Teil A |
| Supabase (2 Projekte) | kostenlos | keine | Teil C |
| Google Cloud (OAuth) | kostenlos | keine | Teil C |

**Alles zusammen für den Start: etwa 25–30 EUR im ersten Monat.**

### Zwei Dinge, die du dir sparen kannst

**Apple Developer Program (99 USD im Jahr): nicht nötig.**
V1 ist eine PWA ohne App Store. „Anmelden mit Apple" im Web bräuchte trotzdem eine kostenpflichtige Mitgliedschaft samt Service-ID und Schlüsselverwaltung — für eine dritte Anmeldeoption neben E-Mail und Google ist das im MVP unverhältnismäßig. Das SAD nennt Apple SSO, weil es ab V2 mit der nativen App ohnehin Pflicht wird. **Meine Empfehlung: in V1 weglassen**, in T04 nur E-Mail und Google umsetzen. Falls du anders entscheidest, plane drei zusätzliche Tage ein.

**Vimeo, Sentry, Analytics: später.**
Videos sind in V1 verzichtbar (SAD §2.3), Fehler-Monitoring und Produktanalytik kommen nach dem Launch. Jeder Dienst, den du jetzt anlegst, ist einer, den du jetzt schon konfigurierst und dokumentierst.

---

## Teil A — Sofort starten, weil es wartet

### A1 · Stripe-Konto ⏱30 Min + Wartezeit

1. Konto auf `stripe.com` anlegen, Land **Österreich**
2. Unternehmensdaten: Einzelunternehmen, deine Steuernummer, Geschäftsadresse
3. Ausweisdokument hochladen
4. IBAN für Auszahlungen hinterlegen

Solange die Verifizierung läuft, funktioniert der **Testmodus vollständig** — die Entwicklung wird dadurch nicht blockiert. Nur echte Zahlungen brauchen den Livemodus, und der wird erst in Sprintblock 6 gebraucht.

### A2 · Hostinger Business + Domain ⏱45 Min + DNS-Wartezeit

1. **Business Web Hosting** kaufen — Node.js gibt es erst ab dieser Stufe
2. Bestehende Domain verbinden:
   - Domain bei Hostinger registriert? Dann ist nichts zu tun.
   - Domain woanders? Beim aktuellen Registrar die Nameserver auf Hostinger umstellen — oder nur die Subdomains `app` und `staging` per A-Record auf Hostingers IP zeigen lassen. **Die zweite Variante ist die sichere:** Die bestehende Website bleibt unangetastet, du riskierst nichts.
3. In hPanel unter **Domains** die Subdomains `app` und `staging` anlegen
4. DNS-Änderung kontrollieren: `nslookup app.deine-domain.at` — sie ist durch, wenn Hostingers IP zurückkommt

> Mach diesen Schritt heute, auch wenn du erst nächste Woche entwickelst. DNS ist der einzige Teil, den man nicht beschleunigen kann.

### A3 · Claude-Abo ⏱5 Min

Auf `claude.ai` ein **Pro**- oder **Max**-Abo abschließen. **Die kostenlose Stufe enthält Claude Code nicht.**

Pro reicht zum Anfangen. Wenn ihr zu zweit viel damit arbeitet und regelmäßig an Nutzungsgrenzen stoßt, ist Max die Alternative — das lässt sich nach zwei Wochen Erfahrung besser entscheiden als vorher.

### A4 · GitHub ⏱10 Min

Konto anlegen, Zwei-Faktor-Authentifizierung aktivieren. Ein **privates** Repository `thehacode-app` erstellen — leer, ohne README, ohne .gitignore (das kommt aus dem vorbereiteten Paket).

Deinen Entwicklungspartner als **Collaborator** einladen.

---

## Teil B — Der Windows-Rechner

> **Grundsatzentscheidung: Es wird in WSL2 entwickelt, nicht in Windows direkt.**
>
> Drei Gründe: Docker braucht WSL2 ohnehin, das Repository enthält Shell-Skripte, und die CI läuft unter Linux. Die häufigste Fehlerquelle bei Windows-Entwicklung sind Zeilenumbrüche, die Bash-Skripte unbrauchbar machen — dieses Problem entsteht in WSL gar nicht erst. Claude Code selbst empfiehlt WSL2 für Windows, unter anderem weil die abgesicherte Befehlsausführung nur dort verfügbar ist.

### B1 · WSL2 und Ubuntu ⏱20 Min, ein Neustart

PowerShell **als Administrator**:

```powershell
wsl --install -d Ubuntu
```

Neustart. Danach startet Ubuntu automatisch und fragt nach Benutzername und Passwort — **das sind neue Linux-Zugangsdaten**, nicht deine Windows-Anmeldung. Merk sie dir, du brauchst sie für `sudo`.

Wenn die Installation mit einem Virtualisierungsfehler abbricht: Im BIOS/UEFI **Intel VT-x** beziehungsweise **AMD-V** einschalten. Bei vielen Fertig-PCs ist das ab Werk deaktiviert.

Prüfen:

```powershell
wsl -l -v      # muss "Ubuntu    Running    2" zeigen — Version 2, nicht 1
```

### B2 · Docker Desktop ⏱15 Min

Docker Desktop for Windows installieren. Bei der Installation **„Use WSL 2 based engine"** aktiviert lassen.

Nach dem Start unter **Settings → Resources → WSL Integration** die Ubuntu-Distribution einschalten.

> Docker Desktop ist für Einzelunternehmen unterhalb der Umsatz- und Mitarbeitergrenzen kostenlos nutzbar. Prüf die aktuellen Lizenzbedingungen kurz selbst — sie ändern sich gelegentlich.

Wozu Docker überhaupt: `supabase start` betreibt eine vollständige Postgres-Instanz lokal. Ohne sie könnt ihr weder Migrationen testen noch die pgTAP-Tests ausführen, und beides ist die Grundlage der ganzen Absicherung.

Prüfen — **alles Folgende im Ubuntu-Terminal**, nicht in PowerShell:

```bash
docker run --rm hello-world
```

### B3 · Node.js, Git und Werkzeuge ⏱20 Min

Im Ubuntu-Terminal:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl jq unzip

# Node über nvm — nie über apt, das liefert veraltete Versionen
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22

node -v      # v22.x — muss zur Node-Version in hPanel passen
git --version
jq --version # wird vom Deployment-Warteskript gebraucht
```

Git einrichten:

```bash
git config --global user.name "Michael"
git config --global user.email "deine@mail.at"
git config --global init.defaultBranch main
git config --global core.autocrlf false      # wichtig: keine Windows-Zeilenumbrüche
```

**Das Supabase-CLI musst du nicht installieren** — es liegt als Projektabhängigkeit im Repository und wird über die npm-Skripte aufgerufen.

### B4 · Claude Code ⏱10 Min

Im Ubuntu-Terminal:

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

Der native Installer braucht kein Node.js und hält sich selbst aktuell. Beim ersten `claude`-Start öffnet sich eine Browser-Anmeldung mit deinem Claude-Konto.

```bash
claude doctor     # prüft die Installation
```

### B5 · Editor ⏱10 Min, optional aber empfohlen

Visual Studio Code unter Windows installieren, dazu die Erweiterung **WSL**. Danach lässt sich aus Ubuntu heraus `code .` aufrufen und der Editor läuft in Windows, arbeitet aber auf den Linux-Dateien.

Claude Code braucht das nicht — es läuft im Terminal. Aber Dateien anzusehen, während der Assistent arbeitet, hilft beim Mitdenken.

### B6 · Projektverzeichnis anlegen ⏱2 Min

```bash
mkdir -p ~/projekte && cd ~/projekte
```

> **Nicht unter `/mnt/c/...` arbeiten.** Zugriffe zwischen Windows- und Linux-Dateisystem sind spürbar langsam — Installationen und Builds dauern dann ein Vielfaches. Das Repository gehört ins Linux-Dateisystem, also unter `~`.

---

## Teil C — Cloud-Dienste einrichten

### C1 · Supabase ⏱40 Min

Konto auf `supabase.com` anlegen, dann **zwei Projekte**, beide Region **Central EU (Frankfurt)**:

| Projekt | Zweck |
|---|---|
| `thehacode-staging` | Testsystem |
| `thehacode-prod` | Livesystem |

Je Projekt notieren — du brauchst alle vier Werte mehrfach:

- Project Ref (der Teil vor `.supabase.co`)
- Datenbank-Passwort (wird nur einmal angezeigt)
- Project URL
- anon public key

Zusätzlich unter **Account → Access Tokens** einen persönlichen Token erzeugen. Den braucht GitHub Actions.

**Authentication → Providers:** E-Mail aktivieren, „Confirm email" einschalten.
**Authentication → Emails:** Vorlagen auf Deutsch umstellen. Der englische Standardtext wirkt bei einem deutschsprachigen Coaching-Produkt wie ein Fremdkörper.

Alles Weitere zu Auth steht in `docs/DEPLOYMENT.md` Abschnitt 1 — das machst du erst, wenn das Repository steht.

### C2 · Google Cloud für die Google-Anmeldung ⏱25 Min

1. `console.cloud.google.com`, neues Projekt „TheHaCode"
2. **APIs & Services → OAuth consent screen**: External, App-Name, Support-Mail, Logo
3. Scopes: nur `email`, `profile`, `openid` — dabei bleiben, sonst wird eine Überprüfung durch Google nötig
4. **Credentials → Create OAuth client ID → Web application**
5. Authorized redirect URIs — **beide Supabase-Projekte eintragen**:
   ```
   https://<staging-ref>.supabase.co/auth/v1/callback
   https://<prod-ref>.supabase.co/auth/v1/callback
   ```
6. Client ID und Secret in beide Supabase-Projekte unter **Authentication → Providers → Google** eintragen

### C3 · Hostinger vorbereiten ⏱15 Min

Nur die Vorbereitung — die eigentlichen Websites werden erst angelegt, wenn Code im Repository liegt (`docs/DEPLOYMENT.md` Abschnitt 2).

- In hPanel unter **Websites** prüfen, dass **Add Website → Node.js Apps** angeboten wird. Fehlt der Punkt, ist der Tarif nicht Business.
- Die Subdomains `app` und `staging` existieren und lösen auf

### C4 · Stripe konfigurieren ⏱30 Min

Im **Testmodus**, alles Weitere kommt in Sprintblock 6:

1. **Produkt** „TheHaCode Plus" anlegen mit zwei Preisen: Monat und Jahr
2. Alle Preise als **Bruttopreise** mit `tax_behavior: inclusive`
3. **Stripe Tax deaktiviert lassen** — Kleinunternehmerregelung
4. **Settings → Invoice template**, Fußzeile:
   *„Umsatzsteuerbefreit — Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG."*
5. Beide Price-IDs notieren
6. **Kundenportal** aktivieren: Kündigung erlauben, Zahlungsmittel ändern erlauben

> Ich bin kein Steuerberater. Der Punkt zur Kleinunternehmerregelung und besonders zu Kunden außerhalb Österreichs gehört einmal über einen fachkundigen Schreibtisch — siehe SAD §4.5.

---

## Teil D — Repository befüllen ⏱30 Min

Die vorbereiteten Dateien nach `~/projekte/thehacode-app` entpacken, dann:

```bash
cd ~/projekte/thehacode-app

git init
git add .
git commit -m "Grundgerüst: Schema, Pipeline, Dokumentation"
git branch -M main
git remote add origin git@github.com:<konto>/thehacode-app.git
git push -u origin main

git checkout -b develop
git push -u origin develop
```

Lokal prüfen, ob alles läuft:

```bash
npm ci
cp .env.example .env.local        # Supabase-Werte des Staging-Projekts eintragen

npx supabase start                # erster Start lädt Images, dauert einige Minuten
npm run db:reset                  # Migrationen und Seeds einspielen
npm run db:test                   # pgTAP — muss grün sein
npm run db:types
```

**Wenn `npm run db:test` grün ist, steht das Fundament.** Ab hier ist alles Weitere Anwendungscode.

### GitHub konfigurieren

**Settings → Branches:** Schutzregeln für `main` und `develop` — Pull Request erforderlich, Status-Check `verify` erforderlich, keine Force-Pushes. Für `main` zusätzlich `github-actions[bot]` als Ausnahme eintragen, sonst scheitert die automatische Beförderung.

**Settings → Environments:** `staging` und `production` anlegen, je mit

| Typ | Name | Wert |
|---|---|---|
| Secret | `SUPABASE_ACCESS_TOKEN` | dein persönlicher Token |
| Secret | `SUPABASE_DB_PASSWORD` | Datenbank-Passwort des jeweiligen Projekts |
| Secret | `SUPABASE_PROJECT_REF` | Project Ref des jeweiligen Projekts |
| Variable | `STAGING_URL` / `PRODUCTION_URL` | `https://staging.deine-domain.at` bzw. `https://app.deine-domain.at` |

Bei `production` zusätzlich **Required reviewers: du selbst**. Begründung in `docs/DEPLOYMENT.md` Abschnitt 3.

---

## Teil E — Läuft nebenher, blockiert nichts

Diese Dinge brauchst du erst gegen Ende, aber sie kosten Zeit, die du nicht am Rechner verbringst:

**Inhalte der alten Website (T18).** „Über mich", Angebot und Kontakt als Texte aufbereiten — sie werden gepinnte Beiträge in der neuen App. Dazu eine Liste aller bisherigen URLs, damit später Weiterleitungen eingerichtet werden können.

**Rechtstexte (T19).** Impressum, Datenschutzerklärung, AGB. Wenn du sie erstellen lässt, sag dazu, dass es um eine Web-App mit Abo, Stripe als Zahlungsdienstleister und Supabase als Auftragsverarbeiter geht — die üblichen Muster für Firmenwebsites passen sonst nicht.

**Auftragsverarbeitungsverträge (T19).** Supabase, Hostinger und Stripe bieten sie zum Abschluss an. Fünf Minuten je Dienst.

---

## Teil F — Bereitschaftsprüfung

Erst wenn jeder Punkt zutrifft, lohnt der Start mit Claude Code.

**Rechner**
- [ ] `wsl -l -v` zeigt Ubuntu mit Version 2
- [ ] `docker run --rm hello-world` läuft im Ubuntu-Terminal
- [ ] `node -v` zeigt v22.x
- [ ] `claude doctor` meldet keine Probleme
- [ ] Projekt liegt unter `~/projekte/`, nicht unter `/mnt/c/`

**Konten**
- [ ] GitHub-Repository angelegt, Partner eingeladen
- [ ] Claude Pro oder Max aktiv
- [ ] Zwei Supabase-Projekte in der EU-Region, Zugangsdaten notiert
- [ ] Google-OAuth-Client angelegt, in beiden Supabase-Projekten hinterlegt
- [ ] Hostinger Business aktiv, `app` und `staging` lösen auf
- [ ] Stripe im Testmodus mit zwei Preisen

**Repository**
- [ ] `npm ci` läuft fehlerfrei
- [ ] `npx supabase start` startet die lokale Datenbank
- [ ] `npm run db:test` ist grün
- [ ] `main` und `develop` sind gepusht und geschützt
- [ ] GitHub Environments mit Secrets und Variables befüllt

Dann:

```bash
cd ~/projekte/thehacode-app
claude
```

```
/task T01
```

**T01 richtet das Projekt ein**, danach folgt T03 mit den Design-Tokens und dem Komponenteninventar. Das ist die Referenzscheibe, an der sich alles Weitere orientiert — sie lohnt besondere Sorgfalt.

---

## Wenn etwas klemmt

| Symptom | Ursache | Abhilfe |
|---|---|---|
| `wsl --install` bricht ab | Virtualisierung im BIOS aus | VT-x bzw. AMD-V einschalten |
| `docker: command not found` in Ubuntu | WSL-Integration nicht aktiviert | Docker Desktop → Settings → Resources → WSL Integration |
| `supabase start` hängt beim ersten Mal | Images werden geladen | Fünf bis zehn Minuten Geduld, danach ist es schnell |
| `npm ci` sehr langsam | Projekt liegt unter `/mnt/c/` | Nach `~/projekte/` verschieben |
| Bash-Skripte scheitern mit `\r` | Windows-Zeilenumbrüche | `git config --global core.autocrlf false`, Repository neu klonen |
| `claude` nicht gefunden | Andere Umgebung als bei der Installation | Im **Ubuntu**-Terminal aufrufen, nicht in PowerShell |
