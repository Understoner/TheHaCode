// Schreibt dist/build-info.json und dist/robots.txt ans Ende von `npm run build:web`.
//
// V1 ist statischer Export (SAD §2.5) — es gibt keinen Server, der einen
// Zeitstempel zur Laufzeit ausliefern koennte. build-info.json ist deshalb
// eine gewoehnliche statische Datei neben den uebrigen Build-Artefakten,
// wird per Hostinger wie jede andere Datei ausgeliefert und ist der einzige
// Wartepunkt der Deploy-Pipeline (scripts/wait-for-deploy.sh, DEPLOYMENT.md §4).
//
// robots.txt sperrt Staging fuer Suchmaschinen (DEPLOYMENT.md §2, "Nach dem
// ersten Deployment") — Hostingers Passwortschutz fuer Verzeichnisse greift
// bei Node.js Web Apps nicht, deshalb dieser Weg statt hPanel-Konfiguration.
//
// Aufruf: node scripts/write-build-info.mjs (nach dem eigentlichen Build,
// bevor dist/ hochgeladen wird — siehe Build-Befehl in DEPLOYMENT.md §2).

import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function commitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

const buildInfo = {
  builtAt: new Date().toISOString(),
  commit: commitSha(),
  env: process.env.EXPO_PUBLIC_APP_ENV ?? 'unknown',
};

writeFileSync(join(distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
console.log(`[thehacode] dist/build-info.json geschrieben: ${JSON.stringify(buildInfo)}`);

const robotsTxt =
  buildInfo.env === 'staging'
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nDisallow:\n';

writeFileSync(join(distDir, 'robots.txt'), robotsTxt);
console.log(`[thehacode] dist/robots.txt geschrieben (env: ${buildInfo.env})`);

// .htaccess — die zwei Schutzmassnahmen, die per <meta> nicht gehen.
//
// Die CSP der App steht als <meta http-equiv> in src/app/+html.tsx. Zwei
// Dinge lassen sich dort grundsaetzlich nicht ausdruecken, weil Browser sie
// nur als echten Antwort-Header auswerten:
//
//   frame-ancestors        verhindert das Einbetten in ein fremdes <iframe>
//                          (Clickjacking). In einem <meta>-CSP ignorieren
//                          Browser die Direktive ausdruecklich.
//   X-Content-Type-Options verhindert, dass der Browser den Inhaltstyp einer
//                          Datei errät statt ihn zu glauben.
//
// V1 hat keinen eigenen Serverprozess (statischer Export, SAD §2.5, Entry-File
// in hPanel bleibt leer) — es gibt also keinen Code, der Header setzen
// koennte. Bleibt der Weg ueber den ausliefernden Webserver. Der <IfModule>-
// Rahmen sorgt dafuer, dass die Datei folgenlos bleibt, falls der Hoster sie
// gar nicht auswertet: dann fehlen die Header, aber nichts geht kaputt.
//
// OB Hostinger die Datei bei einer Node.js Web App auswertet, laesst sich nur
// am ausgerollten System feststellen — genau das prueft der Smoke-Test
// "Schutz-Header" in e2e/smoke.spec.ts. Schlaegt er fehl, greift dieser Weg
// nicht und die Header muessen in hPanel gesetzt werden (docs/DEPLOYMENT.md §2).
const htaccess = `# Erzeugt von scripts/write-build-info.mjs — nicht von Hand aendern.
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Content-Security-Policy "frame-ancestors 'none'"
</IfModule>
`;

writeFileSync(join(distDir, '.htaccess'), htaccess);
console.log('[thehacode] dist/.htaccess geschrieben (Schutz-Header)');
