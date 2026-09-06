import { expect, test } from '@playwright/test';

test('Startseite laedt und zeigt den Titel', async ({ page }) => {
  await page.goto('/');
  // exact: true pinnt die Ueberschrift selbst. Das Wortzeichen in der NavBar,
  // gegen dessen Doppeltreffer das urspruenglich noetig war, gibt es nicht
  // mehr - die Genauigkeit bleibt trotzdem richtig.
  await expect(page.getByText('DER ATEMCODE', { exact: true })).toBeVisible();
});

// Regressionsschutz fuer die untere Tab-Leiste. Der Fehler, der das noetig
// macht, war in jsdom nicht zu sehen: expo-routers <Link> rendert im Web ein
// <Text>, dessen Grundstil display: inline ist. Als Flex-Kind wurde daraus
// block statt flex - alignItems, justifyContent und gap liefen ins Leere, und
// nur die drei Link-Eintraege standen linksbuendig und nebeneinander statt
// zentriert untereinander. Das faellt erst mit echtem Layout auf, deshalb hier
// und nicht in Vitest.
test('Mobile: alle Eintraege der Tab-Leiste stehen gleich aufgebaut da', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const bar = page.getByRole('navigation');
  await expect(bar).toBeVisible();

  const items = bar.locator(':scope > *');
  const count = await items.count();
  expect(count).toBeGreaterThan(1);

  for (let i = 0; i < count; i += 1) {
    const item = items.nth(i);
    const label = await item.innerText();

    const box = await item.boundingBox();
    const glyph = await item.locator(':scope > *').first().boundingBox();
    const text = await item.locator(':scope > *').last().boundingBox();
    if (!box || !glyph || !text) throw new Error(`Kein Layout fuer "${label}"`);

    const itemCenter = box.x + box.width / 2;
    // Symbol mittig ueber der Beschriftung, beide auf derselben Achse
    expect(Math.abs(glyph.x + glyph.width / 2 - itemCenter), `Symbol von "${label}" mittig`).toBeLessThan(1.5);
    expect(Math.abs(text.x + text.width / 2 - itemCenter), `Beschriftung von "${label}" mittig`).toBeLessThan(1.5);
    // ... und untereinander, nicht nebeneinander
    expect(text.y, `Beschriftung von "${label}" unter dem Symbol`).toBeGreaterThanOrEqual(glyph.y + glyph.height);
  }
});

// Der Fussbereich muss auf dem Handy EINE Zeile bleiben. Vorher brach er um,
// und die zweite Zeile kostete Platz direkt ueber der Tab-Leiste - dort, wo es
// am engsten ist. Behoben ueber kuerzere Beschriftungen UND einen waagrecht
// schiebbaren Streifen; geprueft wird hier nur das Ergebnis, nicht der Weg.
//
// Wie beim Test der Tab-Leiste geht das nur mit echtem Layout: in jsdom haben
// alle Kaesten die Groesse null, ein Umbruch waere dort unsichtbar. 320 px ist
// das schmalste Geraet, das noch vorkommt (iPhone SE der ersten Reihe).
test('Mobile: die Pflichtlinks stehen auf einer Zeile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');

  const links = page.locator('a[href="/impressum"], a[href="/datenschutz"], a[href="/agb"], a[href="/haftungsausschluss"]');
  await expect(links).toHaveCount(4);

  const kaesten = [];
  for (let i = 0; i < 4; i += 1) {
    const box = await links.nth(i).boundingBox();
    if (!box) throw new Error(`Kein Layout fuer Pflichtlink ${i}`);
    kaesten.push(box);
  }

  // Alle vier auf derselben Hoehe: dann ist es eine Zeile. Ein Umbruch
  // verschoebe den dritten oder vierten nach unten.
  const oben = kaesten[0].y;
  for (const [i, box] of kaesten.entries()) {
    expect(Math.abs(box.y - oben), `Pflichtlink ${i} steht auf derselben Zeile`).toBeLessThan(2);
  }

  // Impressum ganz links - es ist der eine, der rechtlich leicht erkennbar
  // sein muss, und links bleibt beim Schieben sichtbar.
  expect(Math.min(...kaesten.map((b) => b.x))).toBe(kaesten[0].x);
});

// Am 14.08.2026 lieferte jede Route ausser "/" bei DIREKTEM Aufruf einen 404 —
// auf Staging wie auf Production, und zwar unbemerkt: innerhalb der Seite
// navigiert expo-router clientseitig, da funktioniert jeder Link. Betroffen war
// nur, was von aussen kommt: Lesezeichen, geteilter Link, Neuladen auf einer
// Unterseite, Treffer aus einer Suchmaschine. Beim Impressum ist das keine
// Kosmetik. Aufgefallen ist es beim Nachsehen von Hand, nicht durch einen Test —
// deshalb dieser hier.
//
// Der Test ruft bewusst per request statt per page auf: page.goto() wuerde bei
// einer 404-Seite, die trotzdem rendert, gruen bleiben.
// /passwort-neu ist hier besonders wichtig: die Adresse kommt IMMER von
// aussen, naemlich aus dem Link in der E-Mail. Ein 404 waere dort nicht
// unbequem, sondern ein Konto, an das niemand mehr herankommt.
// /sessions und /sequenzen stehen seit dem 06.09.2026 mit drauf, und zwar aus
// genau dem Grund, aus dem diese Liste ueberhaupt existiert: beide liefen in
// eine Endlosschleife aus 301-Antworten, und niemand hat es gemerkt. Sie sind
// die einzigen Routen, die der Export als Verzeichnis mit index.html ablegt
// statt als eigene .html-Datei - eine Form, die diese Liste bis dahin nicht
// abgedeckt hat. Playwright folgt Weiterleitungen von selbst und scheitert an
// der Schleife, der Test faengt sie also.
const ROUTEN = [
  '/',
  '/sessions',
  '/sequenzen',
  '/kurse',
  '/team',
  '/impressum',
  '/datenschutz',
  '/agb',
  '/haftungsausschluss',
  '/konto',
  '/plus',
  '/passwort-neu',
];

test('jede Route ist auch direkt aufrufbar, nicht nur ueber einen Klick', async ({ request }) => {
  for (const route of ROUTEN) {
    const response = await request.get(route);
    expect(response.status(), `${route} direkt aufgerufen`).toBe(200);
  }
});

// Diese beiden Header kann die App nicht selbst setzen (statischer Export,
// kein eigener Serverprozess) - sie kommen aus dist/.htaccess, geschrieben von
// scripts/write-build-info.mjs. Ob der Hoster die Datei bei einer Node.js Web
// App ueberhaupt auswertet, ist nur am ausgerollten System feststellbar,
// deshalb steht die Pruefung hier.
//
// WENN DIESER TEST ROT IST: .htaccess wird nicht ausgewertet. Die Header
// gehoeren dann von Hand in hPanel (docs/DEPLOYMENT.md §2, "Nach dem ersten
// Deployment"). Bis dahin laesst sich die Seite in ein fremdes <iframe>
// einbetten - kein akuter Notstand, solange V1 nichts anbietet, was sich per
// Klick ausloesen liesse, aber vor der ersten Zahlungsfunktion zu erledigen.
test('Schutz-Header, die per <meta> nicht gehen, sind gesetzt', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();

  expect(headers['x-content-type-options'], 'X-Content-Type-Options fehlt').toBe('nosniff');
  expect(
    `${headers['x-frame-options'] ?? ''} ${headers['content-security-policy'] ?? ''}`,
    'weder X-Frame-Options noch frame-ancestors gesetzt'
  ).toMatch(/DENY|frame-ancestors/i);
});

test('build-info.json ist erreichbar', async ({ request }) => {
  const response = await request.get('/build-info.json');
  expect(response.ok()).toBe(true);

  const body = await response.json();
  expect(body.commit).toBeTruthy();
  expect(body.builtAt).toBeTruthy();
});
