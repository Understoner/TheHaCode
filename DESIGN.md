---
name: TheHaCode
description: Ruhige, klinisch-reduzierte Vertrauens-Oberfläche für Marketing/Browsing, mit Raum für eine zweite, emotional intensivere Stimmung in künftigen Atem-Sessions.
colors:
  forest: "#0F5C4A"
  sage: "#3E8B72"
  paper: "#FFFFFF"
  mist: "#F5F5F5"
  ink: "#3D3D3D"
  clinic-tint: "#F2F7F5"
  caution-wash: "#FDECC8"
  hairline: "#E8EDF1"
  hairline-strong: "#D3DCE3"
typography:
  title:
    fontSize: "28px"
    fontWeight: 600
  headline:
    fontSize: "22px"
    fontWeight: 600
  subtitle:
    fontSize: "18px"
    fontWeight: 600
  body:
    fontSize: "14px"
    fontWeight: 400
  label:
    fontSize: "13px"
    fontWeight: 400
rounded:
  sm: "8px"
  md: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "#0C4A3C"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  nav-link:
    textColor: "{colors.forest}"
    typography: "{typography.label}"
  card-outlined:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "16px"
  card-tinted:
    backgroundColor: "{colors.clinic-tint}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: TheHaCode

## Overview

**Creative North Star: "Vorraum und Tiefenraum"**

Zwei Räume, ein Haus. Der **Vorraum** ist alles, was ein Besucher vor dem eigentlichen Atem-Erlebnis sieht: Startseite, Kurse, Team, Navigation, rechtliche Seiten. Er folgt konsequent dem in SAD §6 festgelegten Prinzip „minimalistisch-medizinisch" — reines Weiß, viel Weißraum, dünne Linien statt Schatten, zwei ruhige Grüntöne, keine Illustrationen, keine Verläufe. Seine Aufgabe ist Vertrauen: sowohl für bestehende Kursteilnehmer:innen als auch für kalte Besucher:innen, die zum ersten Mal über Social Media hereinkommen und noch nichts über die Marke wissen.

Der **Tiefenraum** ist der noch nicht gebaute zweite Teil des Systems: die eigentlichen Atem-Sessions, inklusive Formaten, die dem holotropen Atmen nahekommen und bewusst tief in emotionale/psychische Erfahrung gehen. Das Team hat bestätigt, dass diese zweite Stimmung **im ganzen System sichtbar** werden soll, nicht nur in der Atem-Ring-Animation selbst — ein spürbar wärmerer, intensiverer Ausdruck für Session-Bildschirme, während der Vorraum ruhig bleibt. Zu diesem Zeitpunkt existiert dafür noch kein Code (`src/features/breathing/` ist laut SAD als „Handarbeit, gut getestet" vorgesehen, aber die Breathing Engine ist noch nicht gebaut). Dieser Abschnitt hält deshalb nur das Prinzip fest, nicht konkrete Tokens — die werden entwickelt, sobald die Breathing Engine gebaut wird, vermutlich mit einem eigenen Surface Brief.

Bestätigte Abgrenzungen für **beide** Räume: keine Pastellverläufe, keine organischen Blob-Illustrationen (die typische Wellness-App-Bildsprache), keine verspielte oder laute Gamification (Badges, Konfetti, übertriebene Erfolgs-Animationen). Der Tiefenraum darf emotional intensiv werden — er darf dabei trotzdem nicht in diese Klischees kippen.

**Key Characteristics:**
- Vorraum: ein Grün-auf-Weiß-System mit zwei Grüntönen, keine dritte Akzentfarbe
- Trennung ausschließlich über 1-px-Linien in zwei Gewichtsstufen, nie über Schatten
- Keine Illustrationen, keine Fotografie außer echten Team-Porträts
- Aktuell keine gefüllten Buttons — Calls-to-Action sind fette Textlinks in Waldgrün (siehe Components; das ist die bestätigte nächste Ausbaustufe, kein Endzustand)
- Tiefenraum: Prinzip bestätigt, Umsetzung offen — `[wird bei Bau der Breathing Engine aufgelöst]`

## Colors

Ein bewusst kleines Grün-auf-Weiß-System. Zwei Grüntöne tragen die gesamte Markenidentität, keine dritte Akzentfarbe existiert.

### Primary
- **Waldgrün** (`#0F5C4A`): Die Markenfarbe. Trägt Fließtext-Links, Navigationslinks, Signup-CTA-Text und wird für den kommenden gefüllten Primär-Button als Flächenfarbe vorgesehen. Dunkel genug, um auch als Text zu funktionieren (≥4,5:1 Kontrast auf Weiß).

### Secondary
- **Salbei** (`#3E8B72`): Hellerer, wärmerer Grünton. Im Code ausdrücklich als „nur für Flächen, nicht für Text" dokumentiert (Kontrast unter 4,5:1) — Badges, Icons, kleine Akzentflächen. Aktuell im gebauten UI noch ungenutzt (definiert, aber kein Screen konsumiert ihn); vorgesehen für Badges/Icon-Akzente, sobald diese gebraucht werden.

### Neutral
- **Paper** (`#FFFFFF`): Seitenhintergrund, durchgängig. Reines Weiß, keine getönten Flächen als Standard.
- **Mist** (`#F5F5F5`): Ladeindikator-Flächen (Skeleton-Balken). Die einzige Verwendung bislang.
- **Clinic Tint** (`#F2F7F5`): Sehr helle, grün-getönte Fläche exklusiv für Kurs-Karten — hebt sie leicht vom reinen Weiß ab, ohne eine zweite Vollfarbe einzuführen.
- **Ink** (`#3D3D3D`): Die einzige Textfarbe im System. Überschriften, Fließtext, Meta-Text — alles nutzt denselben Wert, nur Größe und Gewicht unterscheiden die Hierarchie.
- **Caution Wash** (`#FDECC8`): Warmes, blasses Gelb, ausschließlich für Hinweisbanner (Staging-Hinweis, Platzhalter-Rechtstext-Warnung). Der einzige Nicht-Grün-Akzent im System — bewusst reserviert für „Achtung", nicht für Marketing.
- **Hairline** (`#E8EDF1`) / **Hairline Strong** (`#D3DCE3`): Zwei Abstufungen derselben Trennlinien-Idee, siehe **Die Kantengewicht-Regel** unter Elevation & Depth.

### Named Rules
**Die 700er-für-Text-Regel.** Waldgrün (700er-Ton) darf Text tragen, Salbei (500er-Ton) nie — Kontrast unter 4,5:1. Diese Regel steht wörtlich als Kommentar im Code (`tokens.ts`) und ist projektweit bindend (CLAUDE.md).

## Typography

**Schriftart:** Keine eigene Schriftart geladen — das System rendert aktuell in der jeweiligen Plattform-Standardschrift (Systemschrift von Browser/OS via react-native-web). `fontFamily` ist an keiner Stelle im Code gesetzt.

**Charakter:** Rein funktional, ohne eigene Typografie-Persönlichkeit bisher — die Hierarchie entsteht ausschließlich über Größe und ein einziges verfügbares Gewicht-Paar (600/semibold für Betonung, 400/regular für Fließtext).

### Hierarchy
- **Title** (600, 28px): Die größte Schrift im System. Wird identisch für die Hero-Überschrift der Startseite **und** jede Screen-Überschrift (Kurse, Team, Impressum, Datenschutz) verwendet — es gibt noch keine eigene, größere Hero-/Display-Stufe, die sich von normalen Seitentiteln abhebt.
- **Headline** (600, 22px): Abschnittsüberschrift innerhalb einer Seite. Bisher nur ein Vorkommen: „Neuigkeiten" auf der Startseite.
- **Subtitle** (600, 16–18px): Karten- und Listen-Titel (News-Titel, Kurs-Titel, Team-Name) sowie Sub-Überschriften auf den rechtlichen Seiten. Zwei nahe beieinanderliegende Größen (16px bei State-Message-Titeln, 18px bei Karten-/Listen-Titeln) sind noch nicht auf einen Wert vereinheitlicht.
- **Body** (400, 14–16px): Fließtext — Beschreibungen, Bios, Excerpts, Rechtstext-Absätze.
- **Label** (400/600, 13–15px): Navigationslinks (600, 15px), Footer-Links und Meta-Angaben wie Ort/Preis (400, 13px).

## Layout

Durchgehend einspaltig, kein Grid, kein Breakpoint-System. Jeder Screen ist eine `ScrollView` mit vertikalem Rhythmus über `gap` statt einzelner Margins. Horizontales Padding ist auf allen Content-Bereichen konsistent `spacing.md` (16px). Vertikaler Rhythmus zwischen Sektionen nutzt `spacing.lg` (24px) bis `spacing.xl` (32px). Die Navigationsleiste bricht bei schmaler Breite per `flexWrap` um, statt in ein Hamburger-Menü zu wechseln — es gibt aktuell keine responsive Umschaltung der Navigation selbst.

## Elevation & Depth

Kein einziger Schatten im System (projektweit verboten, CLAUDE.md). Tiefe und Abgrenzung entstehen ausschließlich über 1-px-Linien und Weißraum.

### Named Rules
**Die Kantengewicht-Regel.** Es gibt zwei Trennlinien-Gewichte, nicht eines: `hairline-strong` (`#D3DCE3`) markiert die primäre Chrome-Kante — aktuell nur die untere Kante der Hauptnavigation. `hairline` (`#E8EDF1`), spürbar leiser, trennt alles andere: Footer-Kante, News-Listenzeilen, Karten-Ränder. Die Navigation bekommt damit optisch mehr Gewicht als jede andere Trennlinie im System.

## Shapes

Zwei Radius-Stufen: `sm` (8px) für kleine Elemente, `md` (12px) für Karten. Keine spitzen Ecken, aber auch keine stark gerundeten/organischen Formen — die Rundung ist dezent, nicht Teil der visuellen Aussage. Eine Inkonsistenz aus dem Code: Der Skeleton-Loader nutzt den Literal-Wert `8` statt `radius.sm`, obwohl beide Werte identisch sind (siehe Do's and Don'ts).

## Components

### Buttons / CTAs
**Aktueller Zustand:** Es existiert noch kein echter gefüllter Button. Calls-to-Action sind fette Textlinks in Waldgrün ohne sichtbare Button-Fläche (z. B. „Anmelden" bei Kursen, „Erneut versuchen" bei Fehlerzuständen) — funktional klickbar, aber visuell nicht als Button erkennbar.
**Bestätigte Richtung:** Wichtige Aktionen (Kurs-Anmeldung, später Konfigurator-Speichern) bekommen eine echte gefüllte Waldgrün-Fläche mit weißem Text — siehe `button-primary` im Frontmatter. Das ist die nächste Ausbaustufe, kein Endzustand; die zwölf Bausteine aus Backlog T03 (inkl. Button primär/sekundär/tertiär) sind noch nicht gebaut.

### Cards / Containers
Zwei Karten-Varianten koexistieren aktuell, ohne dass eine als Standard markiert ist:
- **Outlined** (Team-Mitglieder): `paper`-Hintergrund, 1-px `hairline`-Rand, `radius.md`, `spacing.md`-Innenabstand.
- **Tinted** (Kurse): identisch, aber `clinic-tint`-Hintergrund statt `paper` — hebt Kurs-Karten leicht ab.

Beide sind einspaltig gestapelt, kein Grid.

### List Rows
News-Einträge sind **keine** Karten, sondern eine editorial-schlichte Liste: kein Rahmen, keine Fläche, nur eine `hairline`-Trennlinie unter jedem Eintrag. Titel (18px/600) + optionaler Excerpt (14px/400).

### Navigation
**NavBar:** Horizontale, umbrechende Zeile, `hairline-strong`-Unterkante (siehe Kantengewicht-Regel). Aktive Links: 15px/600, Waldgrün, ohne Unterstreichung. „Bald verfügbar"-Einträge: gleiche Größe, `ink` bei 50% Opacity, nicht klickbar, mit Mittelpunkt-Trenner vor dem „bald verfügbar"-Hinweis.
**Footer:** Zentrierte Zeile, `hairline`-Oberkante (leiser als die NavBar), zwei kleine Links (13px) getrennt durch einen Mittelpunkt.

### State Message
Zentrierter Block für Leer- und Fehlerzustände: Titel (16px/600) + optionaler Body (14px/400) + optionale Aktion als Textlink (14px/600, Waldgrün) darunter. Kein visueller Rahmen um den Block.

### Skeleton Loader
Drei gestapelte, flache Balken (`mist`-Hintergrund, 64px Höhe, 8px Radius) ohne Shimmer-Animation. Erscheint bei jedem Ladezustand über `QueryBoundary`.

### Banners (Staging / Rechtlicher Platzhalter)
Identisches Muster für beide Fälle: zentrierter, fetter 14px-Text (`ink`) auf `caution-wash`-Fläche, kein Rahmen. Bewusst der einzige Nicht-Grün-Akzent im System.

### Breath Ring (geplant, Tiefenraum)
Noch nicht gebaut. SAD nennt ihn explizit als den einen Baustein, der die visuelle Dramatik des Systems tragen soll (Backlog T03 listet ihn als zwölften Baustein). Gehört konzeptionell zum Tiefenraum, nicht zum Vorraum — keine Tokens hier, `[wird bei Bau der Breathing Engine aufgelöst]`.

## Do's and Don'ts

### Do:
- **Do** jede Farbe ausschließlich aus `tokens.ts` beziehen — kein Hex-Literal in Komponenten (CLAUDE.md, projektweit erzwungen).
- **Do** Fließtext ausschließlich in `ink`/Waldgrün (den 700er-Werten) setzen — Kontrast ≥4,5:1.
- **Do** Trennung über Linien und Weißraum lösen, nie über Schatten.
- **Do** für neue Primär-Aktionen den kommenden gefüllten `button-primary` (Waldgrün-Fläche, weißer Text) verwenden, sobald er gebaut ist — nicht weiter neue Textlink-CTAs anlegen.
- **Do** die `hairline-strong`/`hairline`-Unterscheidung respektieren: nur primäre Chrome-Kanten (aktuell: Navigation) bekommen das stärkere Gewicht.
- **Do** den Vorraum (Marketing/Browsing) konsequent ruhig halten, auch wenn der Tiefenraum (Sessions) später wärmer/intensiver wird — die beiden Stimmungen bleiben getrennte Räume, nicht ein vermischter Mittelweg.

### Don't:
- **Don't** Salbei (`#3E8B72`) für Text verwenden — nur für Flächen/Badges/Icons.
- **Don't** Pastellverläufe oder organische Blob-Illustrationen einsetzen — bestätigt als Anti-Referenz, typisches Wellness-App-Klischee.
- **Don't** verspielte oder laute Gamification einbauen (Badges, Konfetti, übertriebene Erfolgs-Animationen) — weder im Vorraum noch im Tiefenraum.
- **Don't** Radius- oder Spacing-Werte als Literal schreiben, wenn ein Token existiert (Beispiel im Code: `SkeletonList` nutzt `borderRadius: 8` statt `radius.sm`, obwohl beide identisch sind).
- **Don't** Illustrationen oder Stock-Fotografie einsetzen — echte Team-Fotos sind die einzige erlaubte Bildsprache im Vorraum.
