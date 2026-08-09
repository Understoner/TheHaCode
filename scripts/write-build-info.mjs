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
