#!/usr/bin/env node
// Security-Scan fuer TheHaCode (Entscheidung 30.10.2026).
//
// Fuehrt die lokalen Open-Source-Werkzeuge aus und schreibt einen Bericht nach
// security-reports/<zeitstempel>/BERICHT.md (plus die Rohdaten je Werkzeug).
// Der Bericht ist die Grundlage fuer die Auswertung durch Claude - auf Zuruf,
// und Umsetzung erst nach Absprache. Der Scan selbst aendert nichts am Code.
//
//   npm run security:scan                      alles ausser ZAP
//   npm run security:scan -- --zap https://dev.deratemcode.at/
//   npm run security:scan -- --skip zap,splinter --base origin/main
//   npm run security:scan -- --strict          Exit-Code 1 bei Blockern
//
// Ohne --strict endet der Scan immer mit 0: er berichtet, er sperrt nicht.
// Ein Werkzeug, das nicht laeuft (kein Docker, keine lokale Datenbank), steht
// im Bericht als "nicht gelaufen" - nie still als "keine Funde".
//
// Keine npm-Abhaengigkeiten: nur Node, git, Docker und das gepinnte
// Opengrep-Binary. Versionen und Pruefsummen stehen in security/tools.json.

import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const TOOLS = JSON.parse(readFileSync(join(ROOT, 'security/tools.json'), 'utf8'));
const POLICY = JSON.parse(readFileSync(join(ROOT, 'security/policy.json'), 'utf8'));
const REVIEWED = JSON.parse(readFileSync(join(ROOT, 'security/guarddog-reviewed.json'), 'utf8'));
const CACHE = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'thehacode-security');

// --------------------------------------------------------------- Argumente
const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const strict = args.includes('--strict');
const skip = new Set((opt('skip', '') ?? '').split(',').filter(Boolean));
const zapTarget = opt('zap');
const baseRef = opt('base', 'origin/main');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = resolve(opt('out', join(ROOT, 'security-reports', stamp)));
mkdirSync(OUT, { recursive: true });
// Die Container laufen nicht unbedingt mit unserer UID (ZAP: uid 1000).
chmodSync(OUT, 0o777);

// --------------------------------------------------------------- Hilfen
/** Ein Fund. level: BLOCKER | WARNUNG | INFO */
const findings = [];
/** Je Werkzeug: ok | funde | fehler | uebersprungen, mit Notiz. */
const steps = [];

function add(tool, level, title, detail = '') {
  findings.push({ tool, level, title, detail });
}

function run(cmd, cmdArgs, options = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  return { code: res.status, out: res.stdout ?? '', err: res.stderr ?? '', error: res.error };
}

const pulled = new Set();
function docker(image, dockerArgs, toolArgs, options) {
  // Erst holen, mit Wiederholung: grosse Images (ZAP) brechen beim Download
  // gelegentlich ab, und ein Netzwerkfehler soll kein Werkzeug ausfallen lassen.
  if (!pulled.has(image)) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (run('docker', ['image', 'inspect', image]).code === 0) break;
      if (run('docker', ['pull', '--quiet', image]).code === 0) break;
      if (attempt === 3) throw new Error(`Image nicht ladbar: ${image}`);
    }
    pulled.add(image);
  }
  return run('docker', ['run', '--rm', ...dockerArgs, image, ...toolArgs], options);
}

function save(name, content) {
  writeFileSync(join(OUT, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function download(url, expectedSha, target) {
  if (existsSync(target) && sha256(readFileSync(target)) === expectedSha) return target;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  // Stimmt die Pruefsumme nicht, wird NICHTS ausgefuehrt - genau der Fall,
  // gegen den das Pinnen schuetzt.
  if (got !== expectedSha) throw new Error(`Pruefsumme stimmt nicht fuer ${url}: ${got}`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(target, buf);
  return target;
}

function gitShow(ref, path) {
  const res = run('git', ['show', `${ref}:${path}`]);
  return res.code === 0 ? res.out : null;
}

async function step(name, fn) {
  if (skip.has(name)) {
    steps.push({ name, status: 'uebersprungen', note: 'per --skip' });
    return;
  }
  const before = findings.length;
  process.stderr.write(`[security] ${name} ...\n`);
  try {
    const note = (await fn()) ?? '';
    steps.push({ name, status: findings.length > before ? 'funde' : 'ok', note });
  } catch (e) {
    steps.push({ name, status: 'fehler', note: String(e.message ?? e).slice(0, 400) });
  }
}

const dockerOk = run('docker', ['version', '--format', '{{.Server.Version}}']).code === 0;
function needDocker() {
  if (!dockerOk) throw new Error('Docker laeuft nicht - Werkzeug nicht ausgefuehrt.');
}

// --------------------------------------------------------------- 1 Gitleaks
await step('gitleaks', () => {
  needDocker();
  // Die ganze Git-Historie: ein einmal committeter Schluessel bleibt
  // abrufbar, auch wenn er im aktuellen Stand geloescht ist.
  const res = docker(
    TOOLS.images.gitleaks,
    ['-v', `${ROOT}:/repo:ro`, '-v', `${OUT}:/out`],
    [
      'git', '/repo', '--config', '/repo/security/gitleaks.toml', '--redact',
      '--report-format', 'json', '--report-path', '/out/gitleaks.json', '--exit-code', '0', '--no-banner',
    ],
  );
  if (res.code !== 0) throw new Error(res.err || res.out);
  const hits = JSON.parse(readFileSync(join(OUT, 'gitleaks.json'), 'utf8'));
  for (const h of hits) {
    add('gitleaks', 'BLOCKER', `${h.RuleID} in ${h.File}:${h.StartLine}`, `Commit ${String(h.Commit).slice(0, 8)} (${h.Date?.slice(0, 10) ?? ''}), ${h.Description}`);
  }
  return `${hits.length} Funde in der Git-Historie`;
});

// --------------------------------------------------------------- 2 OSV-Scanner
function severityOf(vuln) {
  const db = vuln.database_specific?.severity;
  if (db) return String(db).toUpperCase();
  return 'UNBEKANNT';
}

// Bewusst hingenommene Luecken (security/policy.json, acceptedVulns): bis
// zum Ablaufdatum ein Hinweis mit Begruendung, danach wieder ihre echte Stufe.
const today = new Date().toISOString().slice(0, 10);
function accepted(vulnId, pkgName) {
  const hit = (POLICY.acceptedVulns ?? []).find((a) => a.id === vulnId && a.package === pkgName);
  return hit && hit.until >= today ? hit : null;
}

function licenseLevel(licenses) {
  if (!licenses || licenses.length === 0) return { level: 'BLOCKER', why: 'keine Lizenzangabe' };
  // Eine Angabe kann ein SPDX-Ausdruck sein ("MIT OR Apache-2.0"). Erlaubt,
  // wenn sich eine erlaubte Lizenz waehlen laesst.
  const terms = licenses.flatMap((l) => String(l).split(/\s+(?:OR|AND)\s+|[()]/)).map((s) => s.trim()).filter(Boolean);
  const allowed = POLICY.allowedLicenses;
  const isOr = licenses.some((l) => / OR /.test(l));
  if (isOr ? terms.some((t) => allowed.includes(t)) : terms.every((t) => allowed.includes(t))) return null;
  const copyleft = terms.find((t) => POLICY.copyleftPrefixes.some((p) => t.toUpperCase().startsWith(p)));
  if (copyleft) return { level: 'WARNUNG', why: `Copyleft (${licenses.join(', ')})` };
  return { level: 'BLOCKER', why: `nicht freigegeben (${licenses.join(', ')})` };
}

await step('osv-scanner', () => {
  needDocker();
  const res = docker(
    TOOLS.images.osvScanner,
    ['-v', `${ROOT}:/src:ro`],
    [
      'scan', 'source', '--lockfile', '/src/package-lock.json', '--format', 'json',
      `--licenses=${POLICY.allowedLicenses.join(',')}`,
    ],
  );
  // Exit 1 heisst "Funde", alles darueber ein Fehler des Werkzeugs.
  if (res.code > 1 || !res.out.trim().startsWith('{')) throw new Error(res.err || res.out || `Exit ${res.code}`);
  const data = JSON.parse(res.out);
  save('osv.json', data);

  let packages = 0;
  const licenseHits = new Map();
  for (const result of data.results ?? []) {
    for (const pkg of result.packages ?? []) {
      packages += 1;
      const name = `${pkg.package.name}@${pkg.package.version}`;
      for (const vuln of pkg.vulnerabilities ?? []) {
        // MAL-: als Schadcode gemeldet (OpenSSF Malicious Packages).
        if (vuln.id.startsWith('MAL-')) {
          add('osv-scanner', 'BLOCKER', `SCHADCODE gemeldet: ${name}`, `${vuln.id} ${vuln.summary ?? ''}`);
          continue;
        }
        const sev = severityOf(vuln);
        const fixed = (vuln.affected ?? [])
          .flatMap((a) => a.ranges ?? [])
          .flatMap((r) => r.events ?? [])
          .map((e) => e.fixed)
          .filter(Boolean);
        const detail = `${vuln.id}${fixed.length ? `, behoben in ${fixed.join(', ')}` : ', noch kein Fix'}`;
        const ok = accepted(vuln.id, pkg.package.name);
        if (ok) {
          add('osv-scanner', 'INFO', `Akzeptiert bis ${ok.until}: ${sev} in ${name}`, `${detail} - ${ok.reason}`);
          continue;
        }
        const level = sev === 'CRITICAL' || sev === 'HIGH' ? 'BLOCKER' : 'WARNUNG';
        add('osv-scanner', level, `${sev} in ${name}: ${vuln.summary ?? vuln.id}`, detail);
      }
      const verdict = licenseLevel(pkg.licenses);
      if (verdict) {
        const key = `${verdict.level}|${verdict.why}`;
        licenseHits.set(key, [...(licenseHits.get(key) ?? []), name]);
      }
    }
  }
  // Je Lizenz eine Zeile statt je Paket - sonst geht das Wichtige unter.
  for (const [key, names] of licenseHits) {
    const [level, why] = key.split('|');
    add('lizenzen', level, `Lizenz ${why}: ${names.length} Paket(e)`, names.slice(0, 25).join(', ') + (names.length > 25 ? ', ...' : ''));
  }
  // OSV listet nur Pakete mit Funden; geprueft wurde das ganze Lockfile.
  const total = Object.keys(JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')).packages ?? {}).filter(Boolean).length;
  return `${total} Pakete im Lockfile geprueft (Luecken, gemeldeter Schadcode, Lizenzen), ${packages} mit Funden`;
});

// --------------------------------------------------------------- 3 Edge Functions
async function osvQuery(name, version) {
  const res = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ package: { name, ecosystem: 'npm' }, version }),
  });
  if (!res.ok) throw new Error(`OSV-API ${res.status}`);
  return (await res.json()).vulns ?? [];
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|js|mjs)$/.test(entry)) out.push(p);
  }
  return out;
}

await step('edge-functions', async () => {
  // Die Edge Functions laufen in Deno und laden ihre Pakete beim Deploy ueber
  // npm:/jsr:-Angaben - das Lockfile der App deckt sie nicht ab.
  const specs = new Map();
  for (const file of walk(join(ROOT, 'supabase/functions'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/['"](npm|jsr):(@?[^@'"]+)@([^'"/]+)/g)) {
      specs.set(`${m[1]}:${m[2]}@${m[3]}`, { kind: m[1], name: m[2], range: m[3], file: relative(ROOT, file) });
    }
  }
  for (const spec of specs.values()) {
    const exact = /^\d+\.\d+\.\d+$/.test(spec.range);
    if (!exact) {
      add('edge-functions', 'WARNUNG', `${spec.kind}:${spec.name}@${spec.range} nicht exakt gepinnt`, `${spec.file} - jeder Deploy kann eine neue, ungepruefte Version laden.`);
    }
    // JSR-Pakete von Supabase gibt es gleichnamig auf npm; OSV kennt npm.
    const npmName = spec.name;
    let version = spec.range;
    if (!exact) {
      const view = run('npm', ['view', `${npmName}@${spec.range}`, 'version', '--json']);
      const versions = view.code === 0 ? [].concat(JSON.parse(view.out || '[]')) : [];
      version = versions.at(-1);
      if (!version) continue;
    }
    for (const vuln of await osvQuery(npmName, version)) {
      const level = vuln.id.startsWith('MAL-') ? 'BLOCKER' : (severityOf(vuln) === 'HIGH' || severityOf(vuln) === 'CRITICAL') ? 'BLOCKER' : 'WARNUNG';
      add('edge-functions', level, `${npmName}@${version}: ${vuln.summary ?? vuln.id}`, vuln.id);
    }
  }
  return `${specs.size} Paketangaben in supabase/functions`;
});

// --------------------------------------------------------------- 4 Neue Abhaengigkeiten, Kostenpflichtiges
function directDeps(pkgJson) {
  const p = JSON.parse(pkgJson);
  return { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) };
}

await step('abhaengigkeiten', () => {
  const now = directDeps(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const baseJson = gitShow(baseRef, 'package.json');
  const before = baseJson ? directDeps(baseJson) : null;
  const matches = (list, name) => list.some((re) => new RegExp(re).test(name));

  for (const name of Object.keys(now)) {
    const isNew = before !== null && !(name in before);
    if (isNew) add('abhaengigkeiten', 'WARNUNG', `Neue direkte Abhaengigkeit: ${name}@${now[name]}`, `Gegenueber ${baseRef} - laut CLAUDE.md nur nach Ruecksprache.`);
    if (matches(POLICY.paidServices, name) && !matches(POLICY.approvedPaidServices, name)) {
      add('abhaengigkeiten', 'WARNUNG', `Kostenpflichtiger Dienst: ${name}`, 'An einen bezahlten Dienst gebunden und nicht als abgestimmt eingetragen (security/policy.json).');
    }
  }
  return before ? `${Object.keys(now).length} direkte Abhaengigkeiten, verglichen mit ${baseRef}` : `${baseRef} nicht gefunden - kein Vergleich`;
});

// --------------------------------------------------------------- 5 GuardDog (neue Paketversionen)
function lockVersions(lockJson) {
  const map = new Map();
  for (const [path, info] of Object.entries(JSON.parse(lockJson).packages ?? {})) {
    if (!path || !info.version || info.link) continue;
    const name = info.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    map.set(`${name}@${info.version}`, { name, version: info.version });
  }
  return map;
}

await step('guarddog', () => {
  needDocker();
  const baseLock = gitShow(baseRef, 'package-lock.json');
  if (!baseLock) throw new Error(`${baseRef}:package-lock.json nicht gefunden - keine Vergleichsbasis.`);
  const before = lockVersions(baseLock);
  const changed = [...lockVersions(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')).entries()]
    .filter(([key]) => !before.has(key))
    .map(([, v]) => v);
  if (changed.length === 0) return `keine neuen oder geaenderten Paketversionen gegenueber ${baseRef}`;

  const max = TOOLS.guarddog.maxPackages;
  const batch = changed.slice(0, max);
  if (changed.length > max) {
    add('guarddog', 'WARNUNG', `${changed.length - max} geaenderte Pakete nicht geprueft`, `Obergrenze ${max} je Lauf (security/tools.json).`);
  }
  const results = {};
  const capabilityOnly = [];
  const reviewedHits = [];
  const binaryOnly = [];
  for (const { name, version } of batch) {
    const res = docker(TOOLS.images.guarddog, [], ['npm', 'scan', name, '--version', version, '--output-format', 'json']);
    let data = null;
    try {
      data = JSON.parse(res.out.slice(res.out.indexOf('{')));
    } catch {
      add('guarddog', 'WARNUNG', `${name}@${version} nicht pruefbar`, (res.err || res.out).slice(0, 200));
      continue;
    }
    results[`${name}@${version}`] = data;
    const hits = Object.entries(data.results ?? {})
      .filter(([, v]) => v && (Array.isArray(v) ? v.length : typeof v === 'object' ? Object.keys(v).length : v))
      .map(([k]) => k);
    // GuardDog trennt Faehigkeiten (capability-*: liest Dateien, oeffnet
    // Netzverbindungen - fuer Build-Werkzeuge wie Metro voellig normal) von
    // Bedrohungsmustern (threat-*, und die klassischen Regeln ohne Praefix:
    // Umgebung abgreifen, Code nachladen, verschleiern). Nur Letztere sind
    // eine Warnung wert.
    const threats = hits.filter((k) => !k.startsWith('capability-'));
    const key = `${name}@${version}`;
    if (threats.length > 0 && REVIEWED.reviewed?.[key]) {
      reviewedHits.push(`${key} (${REVIEWED.reviewed[key]})`);
      continue;
    }
    // Plattform-Pakete (rolldown-, lightningcss-Bindings, Hermes) bestehen
    // aus einer Binaerdatei - das ist ihr Zweck, kein Befund fuer sich.
    if (threats.length === 1 && threats[0] === 'bundled_binary') {
      binaryOnly.push(key);
      continue;
    }
    if (threats.length > 0) {
      const where = threats.map((k) => `${k} (${[].concat(data.results[k])[0]?.location ?? '?'})`);
      add('guarddog', 'WARNUNG', `Verdaechtig: ${name}@${version}`, `${where.join(', ')} - Heuristik, Quelltext von Hand pruefen.`);
    } else if (hits.length > 0) {
      capabilityOnly.push(`${name}@${version}`);
    }
  }
  if (reviewedHits.length > 0) {
    add('guarddog', 'INFO', `${reviewedHits.length} Treffer von Hand geprueft (security/guarddog-reviewed.json, ${REVIEWED.geprueftAm})`, reviewedHits.join('; '));
  }
  if (binaryOnly.length > 0) {
    add('guarddog', 'INFO', `${binaryOnly.length} Plattform-Paket(e) mit mitgelieferter Binaerdatei`, binaryOnly.join(', '));
  }
  if (capabilityOnly.length > 0) {
    add('guarddog', 'INFO', `${capabilityOnly.length} Paket(e) nur mit Faehigkeiten (Dateien, Netz, Prozesse), ohne Bedrohungsmuster`, capabilityOnly.slice(0, 30).join(', '));
  }
  save('guarddog.json', results);
  return `${batch.length} neue/geaenderte Paketversionen gegenueber ${baseRef} geprueft`;
});

// --------------------------------------------------------------- 6 npm: Signaturen und Wartezeit
await step('npm', () => {
  const version = run('npm', ['-v']).out.trim();
  const [a, b] = version.split('.').map(Number);
  const [ma, mb] = TOOLS.npm.minVersion.split('.').map(Number);
  if (a < ma || (a === ma && b < mb)) {
    // In der CI installiert npm ci exakt das Lockfile - die Wartezeit wirkt
    // dort, wo Pakete hinzukommen: am Rechner im Team. Deshalb dort nur ein
    // Hinweis.
    add('npm', process.env.CI ? 'INFO' : 'WARNUNG', `npm ${version} kennt keine Wartezeit fuer neue Versionen`, `Ab ${TOOLS.npm.minVersion} greift min-release-age aus .npmrc.${process.env.CI ? ' In der CI ohne Belang (npm ci).' : ''}`);
  }
  const npmrc = existsSync(join(ROOT, '.npmrc')) ? readFileSync(join(ROOT, '.npmrc'), 'utf8') : '';
  if (!/^min-release-age\s*=\s*\d+/m.test(npmrc)) {
    add('npm', 'WARNUNG', 'Keine Wartezeit fuer neue Paketversionen konfiguriert', `.npmrc: min-release-age=${TOOLS.npm.minReleaseAgeDays}`);
  }
  if (!existsSync(join(ROOT, 'node_modules'))) throw new Error('node_modules fehlt - erst npm ci.');
  const sig = run('npm', ['audit', 'signatures', '--json']);
  save('npm-signatures.json', sig.out || sig.err);
  let data = {};
  try {
    data = JSON.parse(sig.out);
  } catch {
    throw new Error((sig.err || sig.out).slice(0, 300));
  }
  for (const item of data.invalid ?? []) {
    add('npm', 'BLOCKER', `Ungueltige Registry-Signatur: ${item.name}@${item.version}`, 'Paket stimmt nicht mit dem ueberein, was npm signiert hat.');
  }
  const missing = (data.missing ?? []).length;
  if (missing > 0) add('npm', 'INFO', `${missing} Paket(e) ohne Registry-Signatur`, 'Meist aeltere Versionen oder andere Registry.');
  return `npm ${version}, Signaturen geprueft`;
});

// --------------------------------------------------------------- 7 zizmor
await step('zizmor', () => {
  needDocker();
  const res = docker(TOOLS.images.zizmor, ['-v', `${ROOT}:/repo:ro`], ['--offline', '--format', 'json', '/repo']);
  if (!res.out.trim().startsWith('[')) throw new Error(res.err || res.out || `Exit ${res.code}`);
  const data = JSON.parse(res.out);
  save('zizmor.json', data);
  for (const f of data) {
    const sev = String(f.determinations?.severity ?? '').toLowerCase();
    const level = sev === 'high' ? 'BLOCKER' : sev === 'medium' ? 'WARNUNG' : 'INFO';
    const loc = f.locations?.[0];
    const path = String(loc?.symbolic?.key?.Local?.verbatim_path ?? loc?.symbolic?.key?.Local?.given_path ?? '').replace(/^\/repo\//, '');
    const row = loc?.concrete?.location?.start_point?.row;
    const where = `${path}${row !== undefined ? `:${row + 1}` : ''} \`${String(loc?.concrete?.feature ?? '').trim()}\`${loc?.symbolic?.annotation ? ` - ${loc.symbolic.annotation}` : ''}`;
    add('zizmor', level, `${f.ident}: ${f.desc}`, where);
  }
  return `${data.length} Funde in .github/workflows`;
});

// --------------------------------------------------------------- 8 Opengrep
await step('opengrep', async () => {
  const bin = await download(TOOLS.opengrep.url, TOOLS.opengrep.sha256, join(CACHE, `opengrep-${TOOLS.opengrep.version}`));
  chmodSync(bin, 0o755);
  const res = run(bin, [
    'scan', '--config', 'security/opengrep/rules.yml', '--json', '--quiet',
    '--exclude', '*.test.ts', '--exclude', '*.test.tsx', 'src', 'supabase',
  ]);
  if (!res.out.trim().startsWith('{')) throw new Error(res.err || `Exit ${res.code}`);
  const data = JSON.parse(res.out);
  save('opengrep.json', data);
  const map = { ERROR: 'BLOCKER', WARNING: 'WARNUNG', INFO: 'INFO' };
  // INFO-Treffer (z. B. jede security-definer-Funktion) je Regel buendeln.
  const infos = new Map();
  for (const r of data.results ?? []) {
    const id = r.check_id.split('.').at(-1);
    const level = map[r.extra.severity] ?? 'INFO';
    if (level === 'INFO') {
      infos.set(id, [...(infos.get(id) ?? []), `${r.path}:${r.start.line}`]);
      continue;
    }
    add('opengrep', level, `${id} in ${r.path}:${r.start.line}`, r.extra.message.trim());
  }
  for (const [id, locs] of infos) add('opengrep', 'INFO', `${id}: ${locs.length} Stelle(n)`, locs.slice(0, 15).join(', '));
  for (const e of data.errors ?? []) add('opengrep', 'INFO', 'Opengrep-Hinweis', String(e.message ?? '').slice(0, 200));
  return `Regeln aus security/opengrep/rules.yml`;
});

// --------------------------------------------------------------- 9 Splinter
await step('splinter', async () => {
  needDocker();
  const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(join(ROOT, 'supabase/config.toml'), 'utf8'))?.[1];
  const container = `supabase_db_${projectId}`;
  if (run('docker', ['inspect', container]).code !== 0) {
    throw new Error(`Lokale Datenbank (${container}) laeuft nicht - erst "supabase start".`);
  }
  const file = await download(TOOLS.splinter.url, TOOLS.splinter.sha256, join(CACHE, `splinter-${TOOLS.splinter.version}.sql`));
  const sql = readFileSync(file, 'utf8');
  // Vorspann (set local + do-Block) bleibt, die eigentliche Abfrage wird als
  // Unterabfrage zu JSON gebuendelt. In einer Transaktion, die zurueckrollt.
  const cut = sql.indexOf('end $$;') + 'end $$;'.length;
  // jsonb statt json: json_agg trennt die Elemente mit Zeilenumbruechen.
  const wrapped = `begin;\n${sql.slice(0, cut)}\nselect coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s)), '[]'::pg_catalog.jsonb)::text from (\n${sql.slice(cut)}\n) s;\nrollback;\n`;
  const res = run('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: wrapped });
  if (res.code !== 0) throw new Error(res.err.slice(0, 400));
  const line = res.out.split('\n').find((l) => l.startsWith('['));
  const lints = JSON.parse(line ?? '[]');
  save('splinter.json', lints);
  const map = { ERROR: 'BLOCKER', WARN: 'WARNUNG', INFO: 'INFO' };
  for (const l of lints.filter((x) => (x.categories ?? []).includes('SECURITY'))) {
    add('splinter', map[l.level] ?? 'INFO', `${l.name}: ${l.title}`, l.detail);
  }
  return `Splinter ${TOOLS.splinter.version} gegen die lokale Datenbank aus den Migrationen`;
});

// --------------------------------------------------------------- 10 ZAP Baseline
if (!zapTarget && !skip.has('zap')) {
  steps.push({ name: 'zap', status: 'uebersprungen', note: 'kein Ziel - mit --zap <url> gegen Staging' });
} else {
  await step('zap', () => {
    needDocker();
    // Baseline = passiv: Seiten abrufen und Antworten pruefen, kein Angriff.
    const res = docker(
      TOOLS.images.zap,
      ['-v', `${OUT}:/zap/wrk:rw`],
      ['zap-baseline.py', '-t', zapTarget, '-m', '1', '-J', 'zap.json', '-I'],
    );
    if (!existsSync(join(OUT, 'zap.json'))) throw new Error((res.err || res.out).slice(-400));
    const data = JSON.parse(readFileSync(join(OUT, 'zap.json'), 'utf8'));
    const map = { '3': 'BLOCKER', '2': 'WARNUNG', '1': 'INFO', '0': 'INFO' };
    for (const site of data.site ?? []) {
      for (const alert of site.alerts ?? []) {
        const urls = (alert.instances ?? []).slice(0, 3).map((i) => i.uri).join(', ');
        const ok = (POLICY.acceptedZap ?? []).find((a) => a.alert === alert.name && a.until >= today);
        if (ok) {
          add('zap', 'INFO', `Akzeptiert bis ${ok.until}: ${alert.name}`, ok.reason);
          continue;
        }
        add('zap', map[alert.riskcode] ?? 'INFO', `${alert.name} (${alert.riskdesc})`, `${alert.count ?? alert.instances?.length ?? 0}x, z. B. ${urls}`);
      }
    }
    return `Baseline-Scan gegen ${zapTarget}`;
  });
}

// --------------------------------------------------------------- Bericht
const order = { BLOCKER: 0, WARNUNG: 1, INFO: 2 };
findings.sort((a, b) => order[a.level] - order[b.level] || a.tool.localeCompare(b.tool));
const count = (lvl) => findings.filter((f) => f.level === lvl).length;
const commit = run('git', ['rev-parse', '--short', 'HEAD']).out.trim();
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
const icon = { ok: 'ok', funde: 'Funde', fehler: '**nicht gelaufen**', uebersprungen: 'übersprungen' };

const md = [
  `# Security-Bericht ${stamp.slice(0, 10)}`,
  '',
  `Stand: \`${branch}\` @ \`${commit}\` · Vergleichsbasis: \`${baseRef}\`${zapTarget ? ` · ZAP-Ziel: ${zapTarget}` : ''} · Modus: ${strict ? 'streng' : 'nur Bericht'}`,
  '',
  `**${count('BLOCKER')} Blocker · ${count('WARNUNG')} Warnungen · ${count('INFO')} Hinweise**`,
  '',
  'Blocker würden im strengen Modus die Auslieferung nach Live sperren. Umgesetzt wird erst nach Absprache.',
  '',
  '## Werkzeuge',
  '',
  '| Werkzeug | Ergebnis | Notiz |',
  '|---|---|---|',
  ...steps.map((s) => `| ${s.name} | ${icon[s.status]} | ${s.note.replace(/\|/g, '/').replace(/\n/g, ' ')} |`),
  '',
  ...['BLOCKER', 'WARNUNG', 'INFO'].flatMap((lvl) => {
    const list = findings.filter((f) => f.level === lvl);
    if (list.length === 0) return [];
    const title = { BLOCKER: 'Blocker', WARNUNG: 'Warnungen', INFO: 'Hinweise' }[lvl];
    return [
      `## ${title} (${list.length})`,
      '',
      ...list.map((f) => `- **[${f.tool}]** ${f.title}${f.detail ? `  \n  ${f.detail.replace(/\n/g, ' ')}` : ''}`),
      '',
    ];
  }),
  `Rohdaten je Werkzeug liegen neben diesem Bericht (${relative(ROOT, OUT)}).`,
  '',
].join('\n');

save('BERICHT.md', md);
save('summary.json', { stamp, commit, branch, baseRef, zapTarget, strict, steps, counts: { blocker: count('BLOCKER'), warnung: count('WARNUNG'), info: count('INFO') }, findings });
process.stdout.write(`${md}\n`);
process.stderr.write(`[security] Bericht: ${relative(ROOT, join(OUT, 'BERICHT.md'))}\n`);

if (strict && count('BLOCKER') > 0) process.exit(1);
