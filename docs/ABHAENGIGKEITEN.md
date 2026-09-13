# Abhängigkeiten und gemeldete Schwachstellen

Hostinger scannt die installierten Pakete der ausgerollten App und meldet
verwundbare Versionen im hPanel. Was dort auftaucht, ist fast nie eine unserer
19 direkten Abhängigkeiten, sondern etwas, das drei Ebenen darunter hängt.

Diese Datei hält fest, **was gepinnt ist und warum** — und vor allem, was
bewusst **nicht** gepinnt ist. Ohne das wird beim nächsten Scan dieselbe
Abwägung noch einmal von vorn angestellt.

---

## Was gepinnt ist

In `package.json` unter `overrides`. npm zwingt damit jede verschachtelte Kopie
auf die genannte Version, egal was das Elternpaket verlangt.

| Paket | Von | Auf | Grund |
|---|---|---|---|
| `uuid` | 7.0.3 | ^11.1.1 | CVE-2026-41907, fehlende Bereichsprüfung in v3/v5/v6 |
| `@xmldom/xmldom` | 0.8.13 / 0.9.10 | ^0.9.12 | 13.09.2026 — rund zwanzig Meldungen, „hoch": Injection, ReDoS, quadratischer Speicher |
| `fast-uri` | 3.1.5 | ^3.1.7 | 13.09.2026 — SSRF und Host-Verwechslung, „hoch" |
| `js-yaml` | 4.3.1 | ^4.3.2 | 13.09.2026 — `maxTotalMergeKeys` begrenzt die CPU-Last nicht, „hoch" |

`uuid` kommt **nicht** aus unserem Code:

```
uuid  <-  expo  ->  @expo/config-plugins  ->  xcode
```

Also die Erzeugung nativer iOS-Projekte. Im ausgelieferten Bundle steckt sie
nicht — auf dem Server liegt sie trotzdem, weil dort `npm install` läuft, und
deshalb sieht der Scanner sie.

### Warum ein Override und kein Update

Weil es nichts zu updaten gibt: `xcode@3` verlangt `uuid@^7`, und `xcode` hängt
an einer expo-Version, die wir nicht bestimmen. `npm audit fix --force` schlägt
als „Lösung" einen Rücksprung auf `expo@53` vor — vier Hauptversionen zurück,
um ein Werkzeug zu reparieren, das wir nie ausführen. Das ist der schlechtere Tausch.

### Was daran gefährlich ist

Ein Override kann eine Bibliothek unter einem Elternpaket austauschen, das eine
ganz andere API erwartet. Bricht das laut, merkt man es. Bricht es leise, nicht:
ein kaputtes Muster-Matching in `minimatch` würde dazu führen, dass der Linter
Dateien **überspringt**, statt zu scheitern — und niemand sähe es.

Nachgemessen wird deshalb die tatsächliche Funktion, nicht nur „Build läuft":

```bash
# uuid v4 liefert weiterhin eine gültige v4-UUID, xcode lädt
node -e "console.log(require('uuid').v4()); require('xcode')"
```

**Und zwar an der Kopie, die das Elternpaket wirklich lädt.** Das ist die
Lehre aus dem Fehlschlag weiter unten: ein `require('minimatch')` aus dem
Projektstamm trifft eine ganz andere Kopie als die unter
`node_modules/@eslint/config-array/node_modules/`. Im Zweifel den vollen Pfad
angeben.

---

## `@xmldom/xmldom` — der Pin mit einem Preis

Der Scanner meldet hier am lautesten: rund zwanzig Einträge, alle „hoch",
alle aus zwei Wurzeln:

```
@xmldom/xmldom 0.8.13  <-  expo  ->  @expo/cli  ->  @expo/plist
@xmldom/xmldom 0.9.10  <-  expo  ->  @expo/config-plugins  ->  xcode -> simple-plist -> plist
```

Beide Wege bearbeiten `Info.plist` und Xcode-Projekte, also die Erzeugung
nativer iOS-Projekte. Im ausgelieferten Bundle steckt nichts davon
(`grep -r xmldom dist/` ist leer), und das Projekt parst an keiner Stelle XML.

**Der Preis ist echt und steht hier, damit ihn niemand später sucht.**

Eine reparierte 0.8er-Reihe gibt es nicht — die Meldungen decken `<=0.8.14` ab,
korrigiert ist erst 0.9.12. `@expo/plist` verlangt aber `^0.8.8`, und zwar
**auch in seiner neuesten Fassung 0.9.0** (am 13.09.2026 alle Versionen
nachgesehen). Der Override zwingt es also über seine erklärte Spanne hinaus,
und in 0.9 ist `parseFromString` nicht mehr ohne MIME-Typ aufrufbar:

```bash
node -e "const p=require('@expo/plist').default;
         p.build({a:1});          # laeuft
         p.parse('<plist/>')"     # DOMParser.parseFromString: mimeType 'undefined' is not valid
```

`build()` läuft weiter, **`parse()` ist kaputt**. Für V1 ohne Belang: das ist
der iOS-Prebuild-Pfad, `/ios/` ist nicht einmal im Repo, und `verify`,
`build:web` und die Smoke-Tests sind grün.

**Vor den nativen Builds in V2 muss dieser Override wieder raus.** Nachzusehen
ist dann, ob `@expo/plist` inzwischen auf `^0.9` verlangt:

```bash
npm view @expo/plist dependencies.@xmldom/xmldom
```

Steht dort `^0.9.x`, ist der Override überflüssig und gehört gelöscht. Steht
dort weiter `^0.8.8`, ist er zu entfernen und die Meldung hinzunehmen, solange
native Builds laufen — ein kaputtes `parse()` bricht den Prebuild lauter, als
diese Lücken jemals wehtun.

`fast-uri` und `js-yaml` sind dagegen der einfache Fall aus der Liste unten:
die Korrektur liegt im selben Hauptversionszweig und **innerhalb** der Spanne,
die das Elternpaket ohnehin verlangt (`ajv` will `^3.0.1`, eslint will `^4`).
Nachgemessen:

```bash
node -e "const Ajv=require('ajv'); const v=new Ajv().compile({type:'string'}); console.log(v('x'), v(1))"
node -e "console.log(require('js-yaml').load('a: 1'))"
```

---

## Was bewusst offen bleibt: `decode-uri-component`

```
decode-uri-component@0.2.2  <-  expo-router  ->  query-string
```

**Das einzige der gemeldeten Pakete, das wirklich im Browser landet.** Nachweis
im gebauten Bundle über eine Zeichenkette aus seiner Ersetzungstabelle:

```bash
grep -c "%FE%FF" dist/_expo/static/js/web/*.js    # 1
```

DoS über exponentielles Dekodieren missgebildeter Prozentkodierung. Der Schaden
träfe den Tab dessen, der die kaputte Adresse selbst aufruft — kein fremder
Zugriff, keine Daten.

**Nicht gepinnt, und das ist eine Entscheidung.** Korrigiert ist erst 0.5.0, und
die Reihe ist ab 0.3.0 **reines ESM** (`"type": "module"`, nur ein
Default-Export). `query-string@7.1.3` lädt sie so:

```js
const decodeComponent = require('decode-uri-component');   // Zeile 3
return decodeComponent(value);                             // Zeile 233
```

Ein `require()` auf ein ESM-Paket liefert den Namensraum, keine Funktion — am
13.09.2026 gegengeprüft, `d is not a function`. Der Override bräche damit das
Auflösen der Query-Parameter im Router, also die Navigation. Genau die Sorte
Bruch, vor der der Abschnitt „Was daran gefährlich ist" oben warnt, nur eben
zur Laufzeit beim Besucher statt im Linter.

**Wann geht es weg?** Wenn `expo-router` auf ein `query-string@8+` wechselt, das
ESM lädt. Nachzusehen mit `npm ls decode-uri-component`.

## Was bewusst offen bleibt: `@vitest/mocker`

Eine `devDependency`, sonst nichts — sie wird nie ausgeliefert und läuft nur in
`npm test`.

Korrigiert wäre sie mit `vitest@4.1.11`, einer Patch-Anhebung innerhalb unserer
Spanne `^4.1.10`. **Die bringt `npm install` zum Absturz:**

```
npm error Cannot read properties of null (reading 'edgesOut')
  at #loadPeerSet (.../arborist/lib/arborist/build-ideal-tree.js:1289:38)
```

Ein Fehler in npm 10.9.8 beim Auflösen der Peers von
`@vitest/browser-playwright`, nicht in vitest selbst. Am 13.09.2026 zweimal
isoliert gegengeprobt: mit der Anhebung rot, ohne sie grün, sonst nichts
verändert.

**Wann geht es weg?** Mit einer npm-Fassung, die den Peer-Satz auflösen kann,
oder mit dem nächsten vitest-Sprung. Vor einem erneuten Versuch lohnt
`npm --version`.

---

## Zurückgenommen: `brace-expansion` — und warum

Am 21.08.2026 meldete Hostinger `brace-expansion@1.1.18` als hoch, CVE-2026-14257,
mit dem Rat „Upgrade auf 5.0.8". Das Paket wurde daraufhin auf `^5.0.9` gepinnt.
**Beides war falsch — der Rat und die Umsetzung.**

### Der Pin hat den Linter zerlegt

`minimatch@3` schreibt `const expand = require('brace-expansion')` und erwartet
die Funktion selbst. Ab Version 4 exportiert das Paket ein Objekt:

```
brace-expansion@5 exportiert: { EXPANSION_MAX, EXPANSION_MAX_LENGTH, expand }
-> TypeError: expand is not a function
   at Minimatch.braceExpand (@eslint/config-array/node_modules/minimatch)
```

Aufgefallen ist das erst, als zwei für sich grüne Pull Requests
zusammenkamen — der eine brachte den Pin, der andere eine eslint-Konfiguration
mit `files`-Mustern, die den Codepfad überhaupt erst betritt. Die Prüfung davor
hatte `require('minimatch')` aus dem Projektstamm benutzt und damit eine
neuere, gar nicht betroffene Kopie erwischt.

### Der Rat war auch inhaltlich verkehrt

Die Advisory-Datenbank nennt für dieselbe CVE **vier** korrigierte Stände, einen
je gepflegter Reihe:

| CVE | 1.x | 2.x | 3.x | 5.x |
|---|---|---|---|---|
| CVE-2026-14257 | **1.1.17** | 2.1.3 | 3.0.3 | 5.0.8 |
| CVE-2026-69152 | **1.1.18** | 2.1.4 | 3.0.6 | 5.0.9 |

Installiert war 1.1.18 — also die Fassung, die **beide** CVEs bereits behebt.
Hostingers Scanner vergleicht offenbar nur gegen die 5er-Reihe und meldet alles
darunter, unabhängig von Backports. `npm audit` meldet `brace-expansion` seit
jeher nicht; das war der Hinweis, den man hätte lesen können.

Der Override ist deshalb ersatzlos entfernt.

### Was zu tun ist, wenn der Punkt wieder auftaucht

Hostinger wird ihn vermutlich weiter melden. Bevor irgendetwas gepinnt wird:

```bash
gh api "/advisories?ecosystem=npm&affects=<paket>" \
  --jq '.[]|{cve:.cve_id,ranges:[.vulnerabilities[]|{vulnerable:.vulnerable_version_range,patched:.first_patched_version}]}'
```

Steht die installierte Version über dem korrigierten Stand **ihrer eigenen
Reihe**, ist nichts zu tun. Ein „Upgrade auf X" im Scanner-Bericht ist eine
Empfehlung, kein Befund.

## Was bewusst offen bleibt: `image-size`

Acht Meldungen im `npm audit`, alle aus derselben Wurzel:

```
image-size@1.2.1  <-  expo  ->  @expo/metro  ->  metro
```

DoS über Endlosschleifen in den Parsern für ICNS, JXL und HEIF.

**Nicht gepinnt, und das ist eine Entscheidung, kein Übersehen.**

Der Fix existiert nur in `image-size@2` — eine 1.x mit Korrektur gibt es nicht.
Ein Override auf 2.0.2 wurde am 21.08.2026 ausprobiert und **bricht den Build**:

```
at detector (node_modules/image-size/dist/index.cjs:963:16)
at getAssetData (node_modules/metro/src/Assets.js:177:55)
```

Metro liest damit die Maße jedes Bildes; die 2er-Reihe hat eine andere
Schnittstelle. Der Bundler ist die zentrale Stelle des Web-Builds — dort etwas
zu erzwingen, das nachweislich nicht passt, wäre der schlechtere Handel.

Die Abwägung dazu:

- **Wann läuft der Parser?** Beim Bauen, über Bilder aus unserem eigenen Repo.
  Nicht zur Laufzeit, nicht auf Nutzereingaben. Es gibt in V1 keinen einzigen
  Weg, auf dem ein Fremder ein Bild in diese Verarbeitung bringt — Uploads gibt
  es nur über Supabase Studio, und dort kommt niemand hin.
- **Was wäre der Schaden?** Ein hängender Build in unserer eigenen CI.
  Unangenehm, aber weder Datenverlust noch fremder Zugriff.
- **Wann geht es weg?** Wenn Metro selbst auf `image-size@2` wechselt. Dann
  verschwindet der Punkt ohne unser Zutun.

**Nachzusehen, wenn der Scan wieder anschlägt:** ob Metro inzwischen
nachgezogen hat (`npm ls image-size`). Wenn ja, ist nichts zu tun. Wenn nein,
gilt weiter, was hier steht.

---

## Beim nächsten Mal

```bash
npm audit                    # was ist es, und wie schwer
npm ls <paket>               # wer zieht es herein - fast nie wir selbst
npm view <paket> versions    # gibt es überhaupt eine korrigierte Version?
```

Dann in dieser Reihenfolge:

1. **Direkte Abhängigkeit?** Regulär aktualisieren, fertig.
2. **Indirekt, korrigierte Version im selben Hauptversionszweig?** Override,
   danach `verify` **und** `build:web`, und die eigentliche Funktion des
   Pakets von Hand nachmessen.
3. **Indirekt, Korrektur nur in einer neuen Hauptversion?** Ausprobieren. Geht
   es schief, hier eintragen — mit dem Fehler, der Abwägung und dem, was den
   Punkt eines Tages auflöst.

Was hier nicht steht, wurde nicht bewertet. Ein leerer Eintrag ist kein
„unbedenklich".
