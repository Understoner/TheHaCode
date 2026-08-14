---
name: TheHaCode
description: Warmes Ocean/Salbei-Redaktionssystem für den Vorraum (Marketing), abgeleitet aus ui/references/*.svg, mit Raum für den Tiefenraum (Atem-Sessions).
colors:
  background: "#EFF3F4"
  surface: "#FFFFFF"
  surfaceSubtle: "#FAFBFC"
  ink900: "#16242B"
  ink700: "#5A6B75"
  ink500: "#8C9AA3"
  ocean700: "#3B6C82"
  ocean800: "#2E5768"
  ocean500: "#5B93AC"
  oceanTint: "#F0F6F9"
  oceanImageBg: "#DCE8F0"
  sage700: "#4F6B4C"
  sage500: "#87A582"
  sageTint: "#F2F6F1"
  line: "#E8EDF1"
  lineStrong: "#D3DCE3"
  focusRing: "#B9D4E0"
  warningSurface: "#FDECC8"
  danger: "#B45A5A"
typography:
  title:
    fontSize: "28px"
    fontWeight: 600
  featuredTitle:
    fontSize: "20px"
    fontWeight: 600
  cardTitle:
    fontSize: "16px"
    fontWeight: 600
  body:
    fontSize: "13px"
    fontWeight: 400
  label:
    fontSize: "11px"
    fontWeight: 400
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ocean700}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-primary-active:
    backgroundColor: "{colors.ocean800}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  nav-pill-active:
    backgroundColor: "{colors.ocean700}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "7px 16px"
  nav-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink700}"
    rounded: "{rounded.full}"
    padding: "7px 16px"
  card-featured:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
---

# Design System: TheHaCode

## Overview

**Creative North Star: "Vorraum und Tiefenraum"**

Zwei Räume, ein Haus — das Prinzip bleibt aus der ersten Fassung dieses Dokuments bestehen, aber der **Vorraum** hat jetzt ein eigenes, viel reicheres Gesicht bekommen: abgeleitet aus `ui/references/*.svg`, einem vollständigen, selbst gestalteten Referenzsatz für Navigation, Startseite, Kurse und Team, in Mobile- und Desktop-Fassung. Statt der ersten, sehr zurückhaltenden „minimalistisch-medizinisch"-Linie trägt der Vorraum jetzt ein warmes Redaktions-/Magazin-Gefühl: getönter Seitenhintergrund (`#EFF3F4`, nicht reines Weiß), weiße Karten mit weichen Ecken, ein zweifarbiges Ocean/Salbei-System, Pillenformen für Navigation und Buttons, und abstrakte Ring-Wasserzeichen anstelle fehlender Fotos.

Der **Tiefenraum** — die eigentlichen Atem-Sessions — ist weiterhin nicht gebaut, aber die Referenzen (`03_atem_animation.svg`, `04_konfigurator.svg`) legen seine Farb- und Formsprache bereits fest: derselbe Ocean/Salbei-Ring, Ocean für Einatmen, Salbei für Ausatmen. Vorraum und Tiefenraum teilen sich damit erstmals eine gemeinsame visuelle Grammatik, auch wenn der Tiefenraum selbst noch reine Referenz ist — `[Umsetzung folgt bei Bau der Breathing Engine]`.

**Bewusste Abweichungen von den Referenzdateien**, alle aus bindenden Projektregeln:
- **Kontrast:** `ocean500` (#5B93AC) trägt in den Referenzen weiße Schrift (Buttons, aktive Pills) — das unterschreitet 4,5:1 (~3,4:1). Umgesetzt wird stattdessen `ocean700` als Füllfarbe für alles, was Text trägt; `ocean500` bleibt reine Flächen-/Bildfarbe. Ebenso wurde `sage700` gegenüber der Referenz (#5F7F5B, Kontrast auf Weiß nur knapp über 4,5:1) leicht auf #4F6B4C abgedunkelt.
- **Keine erfundenen Inhalte:** Die Team-Referenz zeigt einen ausformulierten Namen, drei erfundene Zertifikate, Kennzahlen (247 Klienten etc.), eine Ausbildungs-Timeline und zwei benannte Kunden-Testimonials mit BOLT-Werten. Nichts davon ist echt (PRODUCT.md: keine erfundenen Testimonials/Fakten). Übernommen wurde nur die Layout-Idee (Avatar, Name, Rolle, Bio als Karte); Zertifikate, Kennzahlen, Timeline und Testimonials fehlen in der Umsetzung, weil es dafür weder Datenbankfelder noch echte Inhalte gibt.
- **Keine neuen Datenbankfelder in dieser Runde:** Sternebewertung, Teilnehmerzahl, Kategorie-Filter und Warteliste (Kurse) sowie Kategorie-Tags (News) existieren in den Referenzen, aber nicht im Schema. Bewusst nicht mit angelegt — das Design nutzt ausschließlich `courses`/`news_posts`/`team_members`, wie sie heute sind. `is_pinned` (News) und die Reihenfolge nach `sort_order` (Kurse) bestimmen, welcher Eintrag die große „Featured"-Karte bekommt — echte Felder, keine neuen.
- **Kein Emoji/Unicode als Icon:** Die Referenzen nutzen Platzhalter-Glyphen (📖, 👤, ◉) für Navigationssymbole. Craft-Floor verbietet Emoji als Icon-Ersatz; umgesetzt sind stattdessen handgebaute Liniensymbole aus reinen `View`-Formen (kein `react-native-svg`, keine neue Abhängigkeit ohne Rücksprache).
- **Kein „Anmelden"-Button:** Die Referenzen zeigen einen Login-Button in der Navigation. Es gibt noch keinen Auth-Screen — ein Button ohne Ziel wäre eine Attrappe. Weggelassen, bis ein echter Login-Fluss existiert.
- **Systemschrift statt Inter:** Die Referenzen sind in „Inter" gesetzt. Eine neue Font-Bibliothek (`@expo-google-fonts/inter` o. ä.) ist eine neue Abhängigkeit — CLAUDE.md verlangt dafür Rücksprache. Bis dahin bleibt die Systemschrift.

**Key Characteristics:**
- Getönter Seitenhintergrund (`#EFF3F4`), weiße Karten darauf — nicht mehr reines Weiß als Grundfläche
- Ocean (`#3B6C82`/`#5B93AC`) für Einatmen/Primäraktionen, Salbei (`#4F6B4C`/`#87A582`) für Ausatmen/Sekundärakzente
- Pillenform (`radius.full`) für Buttons, Navigation, Chips — weiche Rechtecke (`radius.lg`/`md`) für Karten
- Fehlt ein echtes Foto, erscheint ein Ring-Wasserzeichen in Ocean oder Salbei statt eines leeren grauen Blocks
- Navigation ist responsiv: Pillen-Leiste oben ab 768px, fixe Tab-Bar unten darunter
- Tiefenraum (Atem-Sessions) teilt die Ocean/Salbei-Farblogik, ist aber nicht implementiert

## Colors

Ein zweifarbiges System auf getöntem Grund: Ocean für die primäre Handlung (Einatmen, Buttons, aktive Navigation), Salbei als zweiter, ruhigerer Akzent (Ausatmen, sekundäre Tags).

### Primary
- **Ocean 700** (`#3B6C82`): Die einzige Ocean-Fläche, die Text trägt — gefüllte Buttons, aktive Navigations-Pille, Links. Kontrastsicher auf Weiß (≥5,7:1).
- **Ocean 800** (`#2E5768`): Hover-/Aktiv-Zustand auf Ocean-700-Flächen.
- **Ocean 500** (`#5B93AC`): Reine Flächen-/Bildfarbe — Wasserzeichen-Ringe, Bild-Platzhalterflächen (`oceanImageBg`), Icon-Akzente. Nie mit Text kombinieren.

### Secondary
- **Salbei 700** (`#4F6B4C`): Zweite Textfarbe für Akzente, die sich bewusst von Ocean absetzen sollen (z. B. sekundäre Tags). Gegenüber der Referenz abgedunkelt, siehe Overview.
- **Salbei 500** (`#87A582`): Reine Flächenfarbe, analog zu Ocean 500 — nie für Text.

### Neutral
- **Background** (`#EFF3F4`): Seitenhintergrund, getönt statt reinem Weiß — der sichtbarste Unterschied zur ersten Fassung dieses Systems.
- **Surface** (`#FFFFFF`): Karten, Navigationsleiste, alle Inhaltsflächen, die sich vom Seitenhintergrund abheben sollen.
- **Surface Subtle** (`#FAFBFC`): Sehr helle Fläche für ruhige Infoboxen (kaum sichtbarer Unterschied zu Weiß, mehr Textur als Kontrast).
- **Ink 900** (`#16242B`): Überschriften, Namen, alles mit der höchsten Betonung.
- **Ink 700** (`#5A6B75`): Fließtext, Meta-Angaben, sekundäre Beschriftung — die einzige Textfarbe unterhalb von Ink 900.
- **Ink 500** (`#8C9AA3`): **Nie für Text** (Kontrast auf Weiß ~2,9:1) — nur für Icon-Striche oder andere rein dekorative Linien.
- **Hairline** (`#E8EDF1`) / **Hairline Strong** (`#D3DCE3`): Kartenränder bzw. stärkere Trennkanten (Navigationsleiste unten, Tab-Bar oben).
- **Focus Ring** (`#B9D4E0`): Umrandung der „Featured"-Karte (erster Kurs) — hebt sie ab, ohne eine weitere Vollfarbe einzuführen.

### Semantic
- **Warning Surface** (`#FDECC8`): Staging-Hinweis, Rechtstext-Platzhalter-Warnung — unverändert aus der vorigen Fassung, da die Referenzen dafür keine eigene Farbe vorgeben.
- **Danger** (`#B45A5A`): Destruktive Aktionen (z. B. „Block löschen" im künftigen Konfigurator).

### Named Rules
**Die 700-für-Text-Regel.** Ocean 700 und Salbei 700 dürfen Text tragen, ihre 500er-Geschwister nie — Kontrast unter 4,5:1. Diese Regel hat in dieser Fassung tatsächlich eine Korrektur an der Referenzvorlage erzwungen (siehe Overview), nicht nur an den ursprünglichen Tokens.

## Typography

**Schriftart:** Systemschrift (kein `fontFamily` gesetzt) — die Referenzen sind in „Inter" gesetzt, das bräuchte eine neue Abhängigkeit. Offene Entscheidung, siehe Overview.

### Hierarchy
- **Title** (600, 28px): Seitentitel (Kurse, Team, Impressum, Datenschutz) und die Hero-Überschrift der Startseite.
- **Featured Title** (600, 20px): Titel der großen „Featured"-Karte (erster Kurs nach `sort_order`).
- **Card Title** (600, 16px): Titel in normalen Karten (Kurs-Grid, News-Hero, Team-Name).
- **Body** (400, 13px): Beschreibung, Bio, Anriss-Text.
- **Label** (400, 11px): Meta-Angaben — Datum, Lesezeit, Ort, Preis.

## Layout

Einspaltig auf Mobile, responsives `flexWrap`-Raster ab genug Breite (Kurse-Grid, News-Hero-Karten, Team-Karten: `flexBasis` 300–320px, wächst frei). Kein festes Spaltenraster, keine Breakpoint-Sprünge in der Kartenbreite — die Karten verteilen sich, wie viel Platz sie bekommen.

**Navigation ist der einzige echte Breakpoint-Wechsel:** unter 768px eine fixe Tab-Bar unten (Icon + Label, fünf Ziele) und gar keine Kopfzeile, ab 768px eine Pillen-Leiste oben. Ein Wortzeichen gibt es nicht mehr — die Kopfzeile trüge nur noch die Pillen und entfällt deshalb auf Mobile ganz, statt als leerer Streifen mit Trennlinie stehen zu bleiben.

Der Breakpoint ist **CSS und nicht JavaScript**: beide Fassungen stehen im HTML, ausgeblendet wird per Media Query über `data-thc`-Attribute (`src/design/responsive.ts`). Grund ist der statische Export — `useWindowDimensions()` kennt zur Bauzeit keine Fensterbreite und lieferte deshalb immer die Mobilfassung, die React auf Desktop verwarf und komplett neu baute. Der Breakpoint-Wert und die Tab-Bar-Höhe stehen als Konstanten in `src/design/navigation.ts` (`MOBILE_NAV_BREAKPOINT`, `MOBILE_TAB_BAR_HEIGHT`), der Root-Container reserviert auf Mobile entsprechend `paddingBottom` inklusive `env(safe-area-inset-bottom)`, damit der Footer weder unter der Tab-Bar noch unter dem Home-Indikator verschwindet.

## Elevation & Depth

Weiterhin keine Schatten (CLAUDE.md, projektweit verboten). Tiefe entsteht über den Kontrast zwischen dem getönten Seitenhintergrund und den weißen Karten darauf, verstärkt durch dünne Ränder (`hairline`/`lineStrong`) — die Karten selbst brauchen keinen Schatten, weil sie sich schon farblich vom Grund abheben.

## Shapes

Drei Rundungsstufen plus Pillenform: `sm` (8px, kleine Elemente wie Skeleton-Balken), `md` (12px, normale Karten), `lg` (16px, Featured-Karten und News-Hero-Karten), `full` (999px, Buttons, Navigations-Pillen, Avatare, Icon-Ringe). Die Pillenform ist neu gegenüber der ersten Fassung dieses Systems — sie ist jetzt die Standardform für alles Interaktive, nicht die Ausnahme.

## Components

### Buttons
Gefüllter Pillen-Button (`radius.full`), Ocean-700-Fläche, weißer Text, dunkler (Ocean 800) im Hover-/Aktiv-Zustand. Ersetzt vollständig die Textlink-CTAs der Vorgängerfassung.

### Navigation
**Desktop (≥768px):** eine Reihe Pillen in der Kopfzeile — aktives Ziel gefüllt (Ocean 700, weißer Text), inaktive Ziele als schlichter Text in einer umrandeten Pille. Noch nicht gebaute Ziele (aktuell: Sessions, Konto) tragen den Zusatz „bald verfügbar" und keinen Link. Bewusst **ohne** reduzierte Deckkraft: die drückte Ink 700 auf etwa 2:1 und damit unter die 4,5:1-Regel.
**Mobile (<768px):** keine Kopfzeile, die Navigation sitzt vollständig in der fixen Tab-Bar unten (Icon über Label, fünf Ziele). Aktives Ziel: Icon und Label in Ocean 700, dazu `aria-current="page"`. Noch nicht gebaute Ziele erkennt man am Symbol in Ink 500 — für den Zusatz „bald verfügbar" ist in der Tab-Bar kein Platz, und die Beschriftung bleibt in Ink 700, damit der Kontrast hält.

Alle Tab-Einträge setzen `display: flex` ausdrücklich: die Hälfte ist ein expo-router-`<Link>`, der im Web ein `<Text>` mit `display: inline` rendert — als Flex-Kind wird daraus `block`, und Zentrierung wie Abstand greifen dann nicht.
**Icons:** handgebaute Liniensymbole aus `View`-Formen (Ring, Balken, Kreis+Silhouette) — kein Emoji, keine neue SVG-Bibliothek.

### Cover-Bild (News, Kurse)
Zeigt das echte Bild, wenn `cover_image_path` gesetzt ist. Sonst: getönte Fläche (`oceanImageBg` oder `sageTint`, alternierend) mit einem Ring-plus-Kreuz-Wasserzeichen in der jeweiligen 500er-Farbe bei reduzierter Deckkraft — kein Stockfoto, keine erfundene Illustration, nur Farbe und Form aus den Tokens (`src/components/CoverImage.tsx`).

### Cards
- **Featured-Karte** (erster Kurs nach `sort_order`, gepinnte News-Beiträge): `radius.lg`, `focusRing`-Umrandung (1,5px) bei Kursen, größeres Cover-Bild, größere Titel-Typografie.
- **Grid-Karte** (übrige Kurse, Team-Mitglieder): `radius.md`, `hairline`-Rand, normale Titel-Typografie.
- **News-Listenzeile** (nicht gepinnte Beiträge): kleines quadratisches Cover-Thumbnail links, Titel + Datum rechts, keine Anriss-Zeile — schlanker als die Featured-Karten.

### Team-Avatar
96px-Kreis. Echtes Foto, wenn `photo_path` gesetzt ist; sonst eine Ocean-getönte Fläche mit einer einfachen Kopf-plus-Schulter-Silhouette aus zwei `View`-Formen — dieselbe Formsprache wie das Team-Symbol in der mobilen Tab-Bar, nur größer.

### State Message / Skeleton / Banners
Strukturell unverändert gegenüber der Vorgängerfassung, nur die Farben aktualisiert: Skeleton-Balken jetzt `oceanTint` statt eines separaten Grautons, State-Message-Text in `ink900`/`ink700`, Aktions-Link in `ocean700`.

### Breath Ring (Tiefenraum, geplant)
Noch nicht gebaut. `03_atem_animation.svg` legt die Formsprache fest: ein Ring aus vier Segmenten (Einatmen/Halten-voll/Ausatmen/Halten-leer), Ocean für die linke Hälfte (Einatmen + Halten-voll), Salbei für die rechte (Ausatmen + Halten-leer), Segmentzahl folgt der Anzahl echter Haltephasen. `04_konfigurator.svg` legt zusätzlich die Block-Struktur des Sequenz-Editors fest. Beides bleibt reine Referenz — `[Umsetzung folgt bei Bau der Breathing Engine, eigenes, größeres Vorhaben laut CLAUDE.md]`.

## Do's and Don'ts

### Do:
- **Do** `ocean700`/`sage700` für jede Textfarbe verwenden, nie die 500er-Geschwister — auch wenn eine Referenzdatei etwas anderes zeigt (siehe Overview: das hat hier tatsächlich einen Fehler in der Vorlage korrigiert).
- **Do** fehlende Cover-Bilder über `CoverImage` aus `tokens.ts` lösen (Ring-Wasserzeichen), nie mit einem leeren grauen Block oder einem Stockfoto.
- **Do** `is_pinned` (News) und `sort_order` (Kurse) als alleinige Signale dafür nutzen, welcher Eintrag die große Karte bekommt — keine neue „featured"-Spalte, solange die bestehenden Felder reichen.
- **Do** Icons als eigene `View`-Formen bauen, konsistent 1,6–1,8px „Strichstärke" (Randbreite).
- **Do** die Pillenform (`radius.full`) für alles Interaktive nutzen — Buttons, Navigations-Pillen, Chips.

### Don't:
- **Don't** `ocean500`/`sage500` mit Text kombinieren — beide sind reine Flächenfarben.
- **Don't** Emoji oder Unicode-Glyphen als Icons verwenden.
- **Don't** Inhalte aus den Referenzdateien wörtlich übernehmen, ohne zu prüfen, ob sie echt sind — die Team-Referenz enthält mehrere erfundene Fakten (siehe Overview).
- **Don't** neue Datenbankfelder anlegen, nur um eine Referenz pixelgenau nachzubauen (Sterne, Teilnehmerzahl, Kategorie-Filter, Zertifikate) — erst wenn es dafür echte Inhalte gibt.
- **Don't** einen „Anmelden"-Button oder andere Affordanzen ohne Ziel einbauen.
