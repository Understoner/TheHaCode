// Erzeugt alles, was die Seite braucht, wenn sie auf dem Startbildschirm
// eines Telefons landet: die Bilder unter public/icons/ und das Manifest
// public/manifest.json. Einmal ausgefuehrt, die Ergebnisse liegen im Repo.
//
//   node scripts/write-app-icons.mjs
//
// Kein Teil des Builds - die Dateien aendern sich nur, wenn sich das Motiv
// oder die Marke aendert, und dann soll man das Ergebnis im Diff sehen.
//
// WARUM GEZEICHNET UND NICHT GESUCHT
// ----------------------------------
// Ein Bild aus dem Netz brauchte eine Lizenz, eine Quellenangabe und einen
// Menschen, der beides im Blick behaelt. Das Motiv steht ohnehin schon im
// Projekt: der Atemring aus ui/references/03_atem_animation.svg, in den Farben
// aus src/design/tokens.ts. Zwei Kreise und ein Punkt - das laesst sich
// rechnen, und es bleibt bei jeder Groesse scharf.
//
// Der Punkt sitzt auf 6 Uhr. Das ist im Player der Ankerpunkt, an dem das
// Einatmen beginnt (BreathCircle.tsx) - wer die App kennt, erkennt das Icon
// daran wieder.
//
// KEINE NEUE ABHAENGIGKEIT
// ------------------------
// PNG ist zlib plus vier Bloecke mit einer Pruefsumme davor; node:zlib bringt
// den schwierigen Teil mit. Eine Bildbibliothek fuer zwei Kreise waere eine
// Abhaengigkeit, die niemand pflegen will (CLAUDE.md §Stack).
//
// Die Kantenglaettung laeuft ueber die Deckung statt ueber Ueberabtastung:
// fuer Kreise ist der Abstand zum Mittelpunkt exakt bekannt, ein Pixel direkt
// auf der Kante ist also halb bedeckt und nicht "vielleicht". Das ist
// schneller und sauberer als vierfach zu rechnen und danach zu mitteln.

import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

// ---------- Farben kommen aus den Tokens, nicht aus diesem Skript ----------
// Sonst laege die Markenfarbe an zwei Orten und liefe frueher oder spaeter
// auseinander. Fehlt ein Name, bricht das Skript ab - lieber laut als mit
// einem stillen Schwarz.
function tokenColors() {
  const quelle = readFileSync(join(root, 'src', 'design', 'tokens.ts'), 'utf8');
  const lies = (name) => {
    const treffer = quelle.match(new RegExp(`\\b${name}:\\s*'(#[0-9A-Fa-f]{6})'`));
    if (!treffer) throw new Error(`tokens.ts kennt kein ${name} - Icons nicht erzeugt`);
    return hex(treffer[1]);
  };
  return {
    ocean700: lies('ocean700'),
    ocean800: lies('ocean800'),
    ocean500: lies('ocean500'),
    oceanTint: lies('oceanTint'),
    surface: lies('surface'),
    background: lies('background'),
  };
}

function rgb([r, g, b]) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Der Name der App kommt aus der Uebersetzungsdatei, nicht aus diesem Skript.
 * Deutsche Strings gehoeren nach i18next (CLAUDE.md) - und das Manifest ist
 * die eine Stelle, an der derselbe Name noch einmal auftaucht.
 */
function markenname() {
  const quelle = JSON.parse(
    readFileSync(join(root, 'src', 'i18n', 'locales', 'de', 'common.json'), 'utf8')
  );
  const name = quelle['home.title'];
  if (!name) throw new Error('common.json kennt kein home.title - Manifest nicht erzeugt');
  return name;
}

function hex(value) {
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}

/** Deckung eines Pixels, dessen Mittelpunkt `abstand` von der Kante entfernt ist. */
function deckung(abstand) {
  // Ein Pixel ist eine Flaeche, keine Stelle: eine halbe Pixelbreite um die
  // Kante herum geht es weich hinueber.
  return Math.min(1, Math.max(0, 0.5 - abstand));
}

function mische(unten, oben, alpha) {
  return [
    Math.round(unten[0] + (oben[0] - unten[0]) * alpha),
    Math.round(unten[1] + (oben[1] - unten[1]) * alpha),
    Math.round(unten[2] + (oben[2] - unten[2]) * alpha),
  ];
}

/**
 * Das Motiv, in Anteilen der Kantenlaenge gerechnet - damit sieht es bei 32
 * Pixeln genauso aus wie bei 512.
 *
 * ringRadius steuert den Sicherheitsabstand: Android schneidet aus einem
 * "maskable"-Icon je nach Geraet einen Kreis oder ein Kleeblatt heraus und
 * garantiert nur die mittleren 80 Prozent. Deshalb gibt es dieselbe Zeichnung
 * zweimal, einmal enger.
 */
function zeichne(size, { ringRadius }, farben) {
  const px = new Uint8Array(size * size * 4);
  const mitte = size / 2;
  const r = size * ringRadius;
  const strich = Math.max(1, size * 0.055);
  // Der gefuellte Kern sitzt auf dem kleinsten Atemradius aus BreathCircle
  // (RADIUS_MIN = 0,55) - der Ring aussen ist der groesste.
  const kern = r * 0.55;
  const punkt = Math.max(1, strich * 0.85);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - mitte;
      const dy = y + 0.5 - mitte;
      const d = Math.hypot(dx, dy);

      // 1. Vollflaechiger Hintergrund - bei "maskable" wird er beschnitten,
      //    und ein durchsichtiger Rand wuerde dabei weiss aufreissen.
      //    Leichter Verlauf von oben links nach unten rechts.
      const t = (x / size + y / size) / 2;
      let farbe = mische(farben.ocean700, farben.ocean800, t);

      // 2. Der gefuellte Kern: die Luft in der Lunge.
      farbe = mische(farbe, farben.ocean500, deckung(d - kern));

      // 3. Der Ring.
      farbe = mische(farbe, farben.oceanTint, deckung(Math.abs(d - r) - strich / 2));

      // 4. Die Marke auf 6 Uhr - dort beginnt im Player das Einatmen.
      const dp = Math.hypot(dx, dy - r);
      farbe = mische(farbe, farben.surface, deckung(dp - punkt));

      const i = (y * size + x) * 4;
      px[i] = farbe[0];
      px[i + 1] = farbe[1];
      px[i + 2] = farbe[2];
      px[i + 3] = 255;
    }
  }

  return px;
}

// ---------- PNG ----------
const CRC = (() => {
  const tabelle = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabelle[n] = c;
  }
  return tabelle;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const koerper = Buffer.concat([Buffer.from(typ, 'latin1'), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(koerper));
  return Buffer.concat([laenge, koerper, pruef]);
}

function png(size, px) {
  // Je Zeile ein Filterbyte 0 ("keine Vorhersage") - bei Flaechen dieser Art
  // bringt ein Filter nichts, was die Lesbarkeit hier wert waere.
  const roh = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    roh[y * (size * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(roh, y * (size * 4 + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 Bit je Kanal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Was erzeugt wird ----------
const farben = tokenColors();
mkdirSync(outDir, { recursive: true });

const dateien = [
  // Startbildschirm iOS. Apple maskiert nicht, sondern rundet nur die Ecken.
  { name: 'apple-touch-icon.png', size: 180, ringRadius: 0.34 },
  // Startbildschirm Android / Chrome.
  { name: 'icon-192.png', size: 192, ringRadius: 0.34 },
  { name: 'icon-512.png', size: 512, ringRadius: 0.34 },
  // Dieselbe Zeichnung enger gefasst: Android schneidet daraus je nach Geraet
  // einen Kreis oder ein Kleeblatt und garantiert nur die mittleren 80 %.
  { name: 'icon-maskable-512.png', size: 512, ringRadius: 0.28 },
  // Browser-Tab.
  { name: 'favicon-32.png', size: 32, ringRadius: 0.36 },
  { name: 'favicon-192.png', size: 192, ringRadius: 0.36 },
];

for (const { name, size, ringRadius } of dateien) {
  writeFileSync(join(outDir, name), png(size, zeichne(size, { ringRadius }, farben)));
  console.log(`icons/${name} (${size}x${size})`);
}

// ---------- Das Manifest ----------
// .json und nicht .webmanifest: Hostinger liefert unbekannte Endungen schon
// einmal mit dem falschen Content-Type aus (siehe die 403-Geschichte mit den
// Verzeichnisrouten in docs/DEPLOYMENT.md), und ein Manifest mit falschem Typ
// wird von Chrome stillschweigend verworfen. .json kennt jeder Server.
const name = markenname();
const manifest = {
  name,
  // Unter dem Icon ist Platz fuer etwa zwoelf Zeichen.
  short_name: 'Atemcode',
  // Dieselbe Adresse wie ein gewoehnlicher Aufruf - die Startseite.
  start_url: '/',
  scope: '/',
  // Ohne Browserleiste: die Seite hat eine eigene Navigation, eine zweite
  // darueber waere doppelt (src/design/navigation.ts).
  display: 'standalone',
  orientation: 'portrait',
  lang: 'de',
  dir: 'ltr',
  // Beides die Seitenfarbe: so gibt es beim Starten keinen Farbsprung
  // zwischen Ladebild und erster Seite.
  background_color: rgb(farben.background),
  theme_color: rgb(farben.background),
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

writeFileSync(join(root, 'public', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('manifest.json');
