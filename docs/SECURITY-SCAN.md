# Security-Scan

Stand 30.10.2026. Lokale Open-Source-Werkzeuge prüfen die App, ein Bericht
fasst die Funde zusammen, Claude wertet ihn **auf Zuruf** aus, und umgesetzt
wird **erst nach Absprache**. Der Scan selbst ändert nichts.

## Wann er läuft

- **Vor jeder Auslieferung nach Live, automatisch:** Job `security` in
  `.github/workflows/deploy.yml`, nach dem Staging-Deploy und vor „Nach main
  befördern“. Der Bericht steht in der Zusammenfassung des Laufs und als
  Artifact `security-report` (30 Tage).
- **Auf Wunsch:** „Security-Scan“ zu Claude sagen, oder selbst:

```bash
supabase start                     # für Splinter
npm run security:scan                                  # ohne ZAP
npm run security:scan -- --zap https://dev.deratemcode.at/
npm run security:scan -- --skip guarddog,zap --base origin/main
npm run security:scan -- --strict  # Exit-Code 1 bei Blockern
```

Der Bericht landet unter `security-reports/<zeitstempel>/BERICHT.md`
(gitignored), daneben die Rohdaten je Werkzeug.

## Die Werkzeuge

| Werkzeug | Prüft | Einstufung |
|---|---|---|
| Gitleaks | Schlüssel in der gesamten Git-Historie, mit eigenen Regeln für Supabase (`sb_secret_`, service_role-JWT) und Stripe-Webhook-Secrets (`security/gitleaks.toml`) | jeder Fund ein Blocker |
| OSV-Scanner | alle Pakete im Lockfile: bekannte Lücken, als Schadcode gemeldete Versionen (`MAL-`), Lizenzen | Schadcode, kritisch, hoch: Blocker |
| Lizenzen | über OSV-Scanner, Regeln in `security/policy.json` | nicht erlaubt oder fehlend: Blocker; Copyleft: Warnung |
| Edge Functions | `npm:`/`jsr:`-Angaben in `supabase/functions`: exakt gepinnt? Lücken laut OSV? | nicht gepinnt: Warnung |
| Abhängigkeiten | neue direkte Abhängigkeiten gegenüber Live, Pakete kostenpflichtiger Dienste | Warnung |
| GuardDog | Quelltext neuer oder geänderter Paketversionen gegenüber Live auf Schadcode-Muster (Heuristik) | Warnung |
| npm | Registry-Signaturen (`npm audit signatures`), Wartezeit für neue Versionen aktiv? | ungültige Signatur: Blocker |
| zizmor | GitHub-Workflows: ungepinnte Actions, Rechte, Einschleusen über Ausdrücke | hoch: Blocker |
| Opengrep | Code gegen die Verbote aus CLAUDE.md (`security/opengrep/rules.yml`) | ERROR: Blocker |
| Splinter | Sicherheitsregeln der Datenbank aus den Migrationen (wie der Security Advisor im Supabase Dashboard) | ERROR: Blocker |
| OWASP ZAP | Baseline, passiv, gegen Staging: Header, CSP, Cookies | hoch: Blocker |

**Lizenzen:** Erlaubt sind nur MIT, ISC, BSD-2-Clause, BSD-3-Clause,
Apache-2.0 und, seit dem ersten Bericht, MIT-0, 0BSD, Unlicense, CC0-1.0,
BlueOak-1.0.0, Python-2.0 und CC-BY-4.0. Copyleft (GPL, LGPL, AGPL, MPL, …)
ergibt eine Warnung, alles andere einen Verstoß zur Besprechung. Ausnahmen
kommen nach Absprache in `security/policy.json`.

## Bewusst Hingenommenes

Nichts verschwindet still aus dem Bericht. Was nach Absprache bleiben darf,
steht mit Begründung und **Ablaufdatum** in einer Datei. Bis zum Ablauf
erscheint es als Hinweis, danach wieder in seiner echten Stufe:

- `security/policy.json` → `acceptedVulns`: Lücken, z. B. in Build-Werkzeugen
  von Expo ohne verfügbaren Fix.
- `security/policy.json` → `acceptedZap`: ZAP-Meldungen, z. B.
  `style-src 'unsafe-inline'` (react-native-web).
- `security/guarddog-reviewed.json`: von Hand geprüfte GuardDog-Treffer, je
  exakte Paketversion. Eine neue Version wird wieder gemeldet.

**Kostenpflichtige Dienste:** Eine Lizenz sagt nichts über Betriebskosten. Die
Liste `paidServices` in `security/policy.json` nennt Pakete, die an bezahlte
Dienste gebunden sind. Abgestimmt sind Supabase, Stripe und Sentry.

## Gegen kompromittierte Pakete

1. **Wartezeit:** `.npmrc` setzt `min-release-age=7`. npm installiert keine
   Version, die jünger als 7 Tage ist. Die meisten Schadversionen sind bis dahin
   gemeldet. Das braucht npm ab 11.10. Für ein dringendes Sicherheitsupdate:
   `npm install --min-release-age=0 paket@version`.
2. **Bekannter Schadcode:** OSV-Scanner gleicht mit den OpenSSF Malicious Packages ab.
3. **Unbekannter Schadcode:** GuardDog prüft, was sich gegenüber Live geändert hat.
4. **Echtheit:** `npm audit signatures`.

## Die Werkzeuge selbst

Alle Images sind per Digest gepinnt, Opengrep und Splinter per sha256
(`security/tools.json`). Ein verschobener Tag, wie bei der Trivy-Kompromittierung
im März 2026, ändert nichts. Der CI-Job läuft ohne Secrets und nur mit
Leserechten. Neue Versionen der Werkzeuge erst, wenn sie mindestens 7 Tage alt
sind: Version und Digest in `security/tools.json` ändern, lokal einmal laufen
lassen, committen.

Splinter liegt nicht im Repo, weil sein Repository keine Lizenz nennt. Der Scan
lädt die Datei zur Laufzeit und prüft die Prüfsumme.

## Strenger Modus

Heute berichtet der Scan nur. Zum Scharfschalten in `deploy.yml` an den Aufruf
`--strict` anhängen. Dann sperrt jeder Blocker die Beförderung nach Live.
