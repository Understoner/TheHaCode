# Inhalte einpflegen

Redaktionelle Inhalte — Team, News, Kurse — stehen in der Datenbank und werden
über **Supabase Studio** gepflegt, nicht über eine Admin-Oberfläche in der App
(SAD §2.4, CLAUDE.md). Diese Datei sammelt, was dafür fertig vorbereitet ist:
Texte zum Übernehmen und die passenden SQL-Schnipsel.

Gehört zu **T18**.

---

## Team-Seite: Michael Untersteiner

### 1. Foto hochladen

Die Team-Karte zeigt das Bild als **runden Avatar mit 96 px**. Vorbereitet ist
ein quadratischer Zuschnitt mit 384 px Kante (reicht bis zu vierfacher
Pixeldichte) bei 21 KB, aus `DSCF0042 1.jpg`.

**Der Zuschnitt sitzt ganz oben, und das ist Absicht.** Im Original (870 × 1200)
beginnt der Kopf bei etwa 72 px. Ein mittiger Zuschnitt schnitte ihn ab; der
erste Versuch mit 18 % Abstand ließ 13 px Luft — zu wenig, der runde Ausschnitt
hat den Scheitel gekappt. Bei `y = 0` bleiben 72 px, also 8,3 % der Kantenlänge.
Mehr gibt das Original nicht her: darüber ist schlicht kein Bild mehr.

**Studio → Storage → Bucket `public-assets` → Ordner `team` → Upload.**
Dateiname: `michael-untersteiner-v2.jpg`, also Pfad
`team/michael-untersteiner-v2.jpg`.

> **Warum ein neuer Name statt Überschreiben:** Die öffentliche Storage-Adresse
> ist stabil und wird zwischengespeichert. Wer dieselbe Datei ersetzt, sieht im
> Browser womöglich noch tagelang die alte — und sucht den Fehler dann im
> falschen Eck. Ein neuer Name macht die Frage gegenstandslos. Die alte Datei
> kann anschließend gelöscht werden.

Der Ordner ist keine Konvention, sondern erzwungen: Migration 0004 lässt nur
`news`, `courses` und `team` zu. Ein Upload in einen anderen Ordner wird
abgewiesen.

### 2. Zeile anlegen

**Studio → SQL Editor:**

```sql
insert into public.team_members (slug, full_name, role_title, bio, photo_path, sort_order, published_at)
values (
  'michael-untersteiner',
  'Michael Untersteiner',
  'Breathwork-Trainer',
  'Vor fünf Jahren saß ich zwischen Familie, IT-Führungsjob und Dauerstress — '
    || 'und merkte bei meiner ersten Atemmeditation, wie schwer mir Stille fiel. '
    || 'Dass ich über meinen eigenen Atem so wenig wusste, hat mich nicht mehr '
    || 'losgelassen.' || chr(10) || chr(10) ||
  'Seither habe ich gelernt, ihn zu benutzen: für ruhigeren Schlaf, für mehr '
    || 'Belastbarkeit, für den Moment, in dem es eng wird. Aus dieser Erfahrung '
    || 'wurde eine Ausbildung zum Breathwork-Trainer — und daraus das hier.' ,
  'team/michael-untersteiner-v2.jpg',
  0,
  now()
)
on conflict (slug) do update set
  full_name    = excluded.full_name,
  role_title   = excluded.role_title,
  bio          = excluded.bio,
  photo_path   = excluded.photo_path,
  published_at = excluded.published_at;

select slug, full_name, role_title, photo_path, published_at is not null as sichtbar
  from public.team_members;
```

`published_at` ist der Schalter: ohne Zeitstempel bleibt die Zeile unsichtbar
(Lesepolicy aus Migration 0003). Zum Zurückziehen genügt `set published_at = null`.

Ist die Zeile schon angelegt und nur das Bild neu, genügt eine Zeile:

```sql
update public.team_members
   set photo_path = 'team/michael-untersteiner-v2.jpg'
 where slug = 'michael-untersteiner';
```

### Woher der Text kommt

Aus dem Abschnitt „Über mich" auf thehacode.com, deutlich gekürzt. Behalten ist
das, was ihn von einer beliebigen Trainerbiografie unterscheidet: der konkrete
Ausgangspunkt (Familie, IT-Führung, Dauerstress) und der Satz, dass ihm bei der
ersten Meditation auffiel, wie wenig er über den eigenen Atem wusste.

Weggefallen ist die Rahmung: die Begrüßung („Hey, ich bin …, ich freue mich
riesig, dass du hier bist"), die Aufzählung der Beschwerden und die Einladung
zur „transformativen Reise". Auf einer Karte von 260 px Breite liest das
niemand zu Ende, und der Kern trägt sich ohne sie.

> **Bitte einmal gegenlesen.** Zwei Formulierungen sind meine, nicht seine:
> „zwischen Familie, IT-Führungsjob und Dauerstress" verdichtet drei Sätze zu
> einem, und „für den Moment, in dem es eng wird" ist ein Bild, das im Original
> nicht steht. Beides ist inhaltlich gedeckt, aber es ist eine Tonlage — und die
> gehört dem, über den sie spricht.

---

## News: drei Beiträge mit Detailseiten

Seit diesem Stand hat jeder Beitrag eine eigene Seite unter `/news/<slug>`.
Damit ist `body_md` nicht mehr totes Pflichtfeld, sondern der eigentliche
Artikel: Die Startseite zeigt Bild, Titel und Anriss, ein Klick auf
**Weiterlesen** öffnet den ganzen Text.

### Was in `body_md` funktioniert

Die Detailseite liest eine kleine Auswahl an Markdown — bewusst klein, sie ist
im Repo selbst gebaut (`src/features/news/markdown.ts`), damit keine
Bibliothek dazukommt:

| Schreibweise | Ergebnis |
|---|---|
| `## Text` | Zwischentitel |
| `### Text` | kleinerer Zwischentitel |
| Leerzeile | neuer Absatz |
| `- Text` | Aufzählung |
| `> Text` | Zitat hinter einer Linie |
| `---` | Trennlinie |
| `**Text**` | fett |
| `[Text](/kurse)` | Link — interne Route, Website oder `mailto:` |
| `![Alt](news/bild.jpg)` | Bild aus dem Bucket, 16:9 |
| `![Alt](team/foto.jpg "portrait")` | Bild im Hochformat (auch `"square"`) |

Nicht unterstützt: Tabellen, verschachtelte Listen, HTML. Wer das braucht,
schreibt am falschen Ort.

> **Warum die Form beim Bild steht:** React Native muss die Größe kennen,
> **bevor** das Bild geladen ist — anders als ein `<img>` im Browser. Drei
> benannte Formen sind ehrlicher als eine geratene Höhe.

### Die drei Bilder

Alle drei gehören in **Storage → `public-assets` → Ordner `news`**, Dateinamen
unverändert:

| Datei | Beitrag | Herkunft |
|---|---|---|
| `der-atemcode.jpg` | Der Atemcode | Unsplash, Sunny Young — ruhiges Meer, eine Horizontlinie |
| `wer-dahinter-steht.jpg` | Wer dahinter steht | Unsplash, T. Barrow — Morgennebel über einer Baumreihe, rechts ein Weg |
| `besser-atmen-besser-leben.jpg` | Besser atmen, besser leben | **dein eigenes eBook**, Titelillustration (Lunge aus Blättern) |
| `boxatmung.jpg` | im Blog-Beitrag eingebettet | **dein eigenes eBook**, Schaubild der Box-Atmung |

Die beiden Unsplash-Bilder sind [frei auch gewerblich nutzbar](https://unsplash.com/license),
ohne Namensnennung; genannt werden die Fotografen trotzdem am Ende der
jeweiligen Beiträge. Die beiden eBook-Bilder sind deine eigenen — deshalb
stehen sie hier ohne Quellenangabe.

Das Portraitfoto auf der Detailseite von „Wer dahinter steht" ist **dasselbe**
wie auf der Team-Seite (`team/michael-untersteiner-v2.jpg`). Es wird nicht
erneut hochgeladen, der Beitrag verweist nur darauf.

### Reihenfolge auf der Seite

Sortiert wird nach `is_pinned`, dann nach `published_at` absteigend. Beide
gepinnten Beiträge stehen also vorn — und **„Der Atemcode" steht als erster**,
weil sein `published_at` einen Tag später liegt. Das ist der einzige Hebel:
Wer die Reihenfolge ändern will, verschiebt Zeitstempel, nicht Zeilen.

### Alle drei anlegen

**Studio → SQL Editor.** Mehrfach ausführbar. Der Beitrag „Fragen? Schreib
mir" wird dabei zurückgezogen — seine Angaben stehen jetzt im Beitrag über
dich.

```sql
insert into public.news_posts (slug, title, excerpt, body_md, cover_image_path, category, is_pinned, published_at)
values
  (
    'der-atemcode',
    'Der Atemcode — die App zu deiner Atmung',
    'Nutze ohne Anmeldung vordefinierte Box-Atemübungen — einatmen | halten | ausatmen | halten — abgestimmt darauf, was du gerade brauchst. Oder stell dir mit einem Plus-Abo unter „Meine Sequenzen" deine eigenen Atemübungen zusammen. Und schau nach, welche Online- und Live-Kurse gerade angeboten werden: buchen kannst du sie direkt hier.',
    '## Dein Atem ist das einzige Werkzeug, das du immer dabeihast' || chr(10) || chr(10) ||
    'Mehr als 23.000 Mal am Tag. Vollkommen automatisch, meist unbemerkt. Und genau darin liegt das Missverständnis: Weil Atmen von selbst passiert, halten wir es für etwas, das keine Aufmerksamkeit braucht.' || chr(10) || chr(10) ||
    'Der Atem ist die einzige Körperfunktion, die gleichzeitig automatisch abläuft **und** bewusst gesteuert werden kann. Er ist damit der direkteste Zugang zu einem System, das sich sonst jedem Zugriff entzieht: dem vegetativen Nervensystem. Über den Atem lässt sich Anspannung senken, Wachheit erzeugen, Schlaf vorbereiten — ohne Gerät, ohne Substanz, ohne Termin.' || chr(10) || chr(10) ||
    '**Der Atemcode macht daraus ein Werkzeug.** Kein Ratgeber zum Nachlesen, sondern etwas, das du benutzt: einen Takt, dem du folgst, solange du ihn brauchst.' || chr(10) || chr(10) ||
    '---' || chr(10) || chr(10) ||
    '## Ein Kreis, dem du beim Atmen zusiehst' || chr(10) || chr(10) ||
    'Das Schwierigste an einer Atemübung ist nicht die Technik. Es ist das Zählen. Wer im Kopf mitzählt, ist mit dem Kopf beschäftigt — und genau das soll die Übung ja beenden.' || chr(10) || chr(10) ||
    'Deshalb steht in der App ein Ring. Er füllt sich beim Einatmen, hält, leert sich, hält. Du musst nichts mitzählen und nichts entscheiden. Du folgst einer Bewegung, und der Rest deines Kopfes darf ruhig werden.' || chr(10) || chr(10) ||
    '- **Ein Ton je Phasenwechsel**, erzeugt vom Gerät selbst — kein heruntergeladenes Klangfile, keine Ansage, keine Stimme. Abschaltbar mit einem Tippen.' || chr(10) ||
    '- **Der Bildschirm bleibt wach.** Zehn Minuten ohne Berührung sind für ein Telefon Leerlauf; für dich sind sie die Übung.' || chr(10) ||
    '- **Ruhe auch für die Augen:** Wer im System reduzierte Bewegung eingestellt hat, bekommt einen ruhenden Ring und einen Zähler statt einer Animation.' || chr(10) ||
    '- **Deine Musik bleibt deine Musik.** Die App bringt keine mit.' || chr(10) || chr(10) ||
    '## Fünf fertige Sequenzen. Ohne Konto. Dauerhaft.' || chr(10) || chr(10) ||
    'Unter **Sessions** liegen fünf vorbereitete Übungen. Keine Anmeldung, keine Testphase, kein Ablaufdatum:' || chr(10) || chr(10) ||
    '- **Box-Atmung 4-4-4-4** — gleich lange Phasen, der ruhige Einstieg. Wird unter anderem im Einsatztraining verwendet, um in Stresslagen handlungsfähig zu bleiben.' || chr(10) ||
    '- **Box-Atmung 6-6-6-6** — dieselbe Form, länger, für alle, denen vier Sekunden zu kurz geworden sind.' || chr(10) ||
    '- **4-7-8** — betont langes Ausatmen ohne Halten danach. Der Klassiker vor dem Einschlafen.' || chr(10) ||
    '- **Kohärenzatmung 5,5** — nur ein und aus, etwa sechs Atemzüge pro Minute. Die Frequenz, bei der Herzschlag und Atem in einen gemeinsamen Rhythmus finden.' || chr(10) ||
    '- **Dreiteilige Session** — wechselt den Rhythmus mitten im Lauf und zeigt, wozu der Konfigurator gut ist.' || chr(10) || chr(10) ||
    'Jede Übung sagt dir vorher, was sie tut und wann du sie besser lässt. Das gehört dazu.' || chr(10) || chr(10) ||
    '## Und wenn dir keine davon passt: bau dir deine eigene' || chr(10) || chr(10) ||
    'Menschen sind verschieden, Tage sind verschieden. Der **Sequenz-Konfigurator** unter „Meine Sequenzen" stellt dir zusammen, was du brauchst: Blöcke hintereinander, jede Phase auf die Sekunde, Runden, Pausen dazwischen. Mit Vorschau und Vorhören, bevor du startest.' || chr(10) || chr(10) ||
    'Bedienen kann ihn jeder — auch ohne Konto. Gespeichert wird mit **Plus**. Und was einmal gespeichert ist, bleibt dir: Läuft dein Abo aus, kannst du deine Sequenzen weiter abspielen und löschen. Nur das Ändern ruht.' || chr(10) || chr(10) ||
    '## Kurse: buchen, nicht anfragen' || chr(10) || chr(10) ||
    'Workshops, Camps und Online-Kurse stehen unter **Kurse** mit Termin, Preis und freien Plätzen. Der Platz wird beim Buchen reserviert, bezahlt wird über Stripe, die Bestätigung kommt sofort. Kein Formular, kein Warten auf eine Rückmeldung, ob überhaupt noch etwas frei ist.' || chr(10) || chr(10) ||
    '---' || chr(10) || chr(10) ||
    '## Fang klein an' || chr(10) || chr(10) ||
    'Nicht mit einem Vorsatz. Mit fünf Minuten.' || chr(10) || chr(10) ||
    'Öffne [Sessions](/sessions), nimm die Box-Atmung 4-4-4-4 und folge dem Ring, bis er das erste Mal langweilig wird. Das ist der Moment, an dem etwas passiert.' || chr(10) || chr(10) ||
    '> Atmen ist nichts, das man lernt und dann beherrscht. Es ist ein Erinnern — eine Rückkehr zu dem, was du schon immer konntest.' || chr(10) || chr(10) ||
    'Titelbild: Sunny Young via Unsplash.',
    'news/der-atemcode.jpg',
    'allgemein',
    true,
    now()
  ),
  (
    'ueber-mich',
    'Wer hinter DER ATEMCODE steht',
    'Vor fünf Jahren saß ich zwischen Familie, IT-Führungsjob und Dauerstress — und merkte bei meiner ersten Atemmeditation, wie schwer mir Stille fiel. Aus dieser Erfahrung wurde eine Ausbildung zum Breathwork-Trainer, und nun stelle ich euch in dieser App all mein Wissen zur Verfügung.',
    '![Michael Untersteiner](team/michael-untersteiner-v2.jpg "portrait")' || chr(10) || chr(10) ||
    '## Angefangen hat es mit einer Stille, die ich nicht ausgehalten habe' || chr(10) || chr(10) ||
    'Meine Reise mit Breathwork begann vor etwa fünf Jahren, mitten in Stress und Hektik. Familie, ein Führungsjob in der IT, ein Kalender, der keine Lücken mehr hatte. Zur Ruhe kam ich nicht — und irgendwann merkte ich, was das kostet: schlechter Schlaf, Erschöpfung, die auch nach dem Wochenende nicht wegging, und eine Leistungsfähigkeit, die nachließ, obwohl ich mehr arbeitete.' || chr(10) || chr(10) ||
    'Dann saß ich in meiner ersten Atemmeditation. Und stellte fest, wie schwer mir Stille fiel. Wie fremd mir mein eigener Atem war. Dass ich über etwas, das ich 23.000 Mal am Tag tue, praktisch nichts wusste — das hat mich nicht mehr losgelassen.' || chr(10) || chr(10) ||
    '## Ich habe mein Leben lang falsch geatmet' || chr(10) || chr(10) ||
    'Also habe ich es gelernt. Aus Neugier wurde eine Ausbildung, aus der Ausbildung ein Beruf: Ich bin ausgebildeter Breathwork-Trainer. Die unbequemste Erkenntnis dabei war die einfachste — ich hatte über Jahrzehnte falsch geatmet. Flach, in die Brust, oft durch den Mund. Genau so, wie es die meisten Menschen tun, die viel sitzen und wenig Ruhe haben.' || chr(10) || chr(10) ||
    'Was sich änderte, als ich das änderte, ist der Grund, warum es diese Seite gibt: ruhigerer Schlaf, mehr Belastbarkeit, und ein Werkzeug für den Moment, in dem es eng wird.' || chr(10) || chr(10) ||
    '## Was ich weitergebe' || chr(10) || chr(10) ||
    'Ich gebe das, was ich in den letzten Jahren gelernt habe, mit Leidenschaft weiter — an Menschen, die genau dort stehen, wo ich stand.' || chr(10) || chr(10) ||
    '- **Kurse vor Ort und online** — der Einstieg, in der Gruppe, mit Zeit für Fragen' || chr(10) ||
    '- **Workshops und Camps** — mehrere Stunden oder Tage am Stück, dort geht mehr in die Tiefe' || chr(10) ||
    '- **Einzeltraining** — wenn es um deinen Atem geht und um sonst nichts' || chr(10) ||
    '- **Firmenprogramme** für Gruppen von 1 bis 20 Personen — dort, wo der Stress entsteht' || chr(10) || chr(10) ||
    'Die aktuellen Termine stehen unter [Kurse](/kurse) und lassen sich direkt buchen.' || chr(10) || chr(10) ||
    '## Warum es diese App gibt' || chr(10) || chr(10) ||
    'Ein Workshop dauert ein paar Stunden. Was danach kommt, entscheidet, ob sich etwas ändert — und genau dort war bisher nichts: kein Takt, keine Anleitung, kein Werkzeug für den Dienstagabend, an dem niemand mehr danebensitzt.' || chr(10) || chr(10) ||
    'Der Atemcode ist dieses Werkzeug. Was ich sonst in einem Kurs zeige, läuft hier als Sequenz, der du folgen kannst, wann immer du willst. Die Grundübungen sind kostenlos und ohne Konto nutzbar — nicht als Lockangebot, sondern weil ich möchte, dass sie jemand benutzt.' || chr(10) || chr(10) ||
    '---' || chr(10) || chr(10) ||
    '## So erreichst du mich' || chr(10) || chr(10) ||
    'Bei Fragen zu Kursen, zur App oder zu deinem Konto schreib mir einfach. Ich antworte selbst, meist innerhalb eines Tages.' || chr(10) || chr(10) ||
    '- E-Mail: [office@thehacode.com](mailto:office@thehacode.com)' || chr(10) ||
    '- Telefon: [+43 664 4252322](tel:+436644252322)' || chr(10) ||
    '- Anschrift und alle weiteren Angaben stehen im [Impressum](/impressum)' || chr(10) || chr(10) ||
    'Titelbild: T. Barrow via Unsplash.',
    'news/wer-dahinter-steht.jpg',
    'allgemein',
    true,
    now() - interval '1 day'
  ),
  (
    'besser-atmen-besser-leben',
    'Besser atmen, besser leben',
    'Warum flaches Atmen den Körper in Daueralarm hält — und was drei einfache Umstellungen ändern: in den Bauch, durch die Nase, langsam. Die Zusammenfassung meines eBooks: was in deinem Körper passiert, welche Studien dahinterstehen, drei Übungen zum Sofort-Ausprobieren und ein 7-Tage-Plan, der aus Wissen Gewohnheit macht.',
    'Dieser Beitrag fasst mein eBook **Besser atmen, besser leben** zusammen — einen Praxis-Guide für gesunde und natürliche Atmung.' || chr(10) || chr(10) ||
    '## Wir atmen, als wären wir auf der Flucht' || chr(10) || chr(10) ||
    'Wir leben in einer Welt im Schnellvorlauf, und unser Atem hat sich angepasst: flach in die Brust, hastig, oft durch den Mund und meist unbewusst. Viele Menschen atmen, als wären sie ständig auf der Flucht — obwohl sie nur am Schreibtisch sitzen.' || chr(10) || chr(10) ||
    'Der Brustkorb hebt sich hektisch, die Schultern spannen, der Bauch bleibt starr. Der Atem erreicht kaum noch die Tiefe, in der Ruhe, Energie und Regeneration entstehen. Der Körper lebt in Alarmbereitschaft — bereit zu kämpfen oder zu fliehen, aber nie wirklich angekommen.' || chr(10) || chr(10) ||
    '### Was das im Körper auslöst' || chr(10) || chr(10) ||
    'Flache, schnelle Brustatmung aktiviert dauerhaft den Sympathikus: Puls und Blutdruck steigen, Muskeln verhärten, Verdauung und Regeneration treten zurück. Gleichzeitig kippt das Gleichgewicht zwischen Sauerstoff und Kohlendioxid. Sinkt der CO2-Gehalt, verengen sich Blutgefäße und Bronchien — die Sauerstoffversorgung der Zellen nimmt **paradoxerweise ab**. Schwindel, Verspannungen, Herzrasen, kalte Hände und innere Unruhe sind die Folge.' || chr(10) || chr(10) ||
    'Typische Begleiter über die Jahre:' || chr(10) || chr(10) ||
    '- erhöhter Blutdruck und Puls, chronische Stressaktivierung' || chr(10) ||
    '- Schlafstörungen und Tagesmüdigkeit' || chr(10) ||
    '- Konzentrationsprobleme und Reizbarkeit' || chr(10) ||
    '- Verspannungen in Nacken, Schultern und Brust' || chr(10) ||
    '- geschwächtes Immunsystem, träge Verdauung' || chr(10) ||
    '- mehr Anfälligkeit für Angst und Panik' || chr(10) || chr(10) ||
    'Das Tückische daran: Der Körper gewöhnt sich. Die ungesunde Atmung wird zur neuen Normalität.' || chr(10) || chr(10) ||
    '> „Wenn ich meinen Rat für ein gesünderes Leben auf nur einen Tipp beschränken müsste, wäre es: zu lernen, wie man richtig atmet." — Andrew Weil' || chr(10) || chr(10) ||
    '---' || chr(10) || chr(10) ||
    '## Gesund atmen sind drei Dinge' || chr(10) || chr(10) ||
    '### 1. In den Bauch' || chr(10) || chr(10) ||
    'Beim Einatmen senkt sich das Zwerchfell, die Lungen entfalten sich, die Bauchdecke gibt nach. Das Zwerchfell ist der größte und effizienteste Atemmotor des Körpers — Untersuchungen deuten darauf hin, dass es 75 bis 90 Prozent der Atemarbeit übernimmt, und das mit deutlich weniger Aufwand als die Hilfsmuskulatur an Hals und Schultern.' || chr(10) || chr(10) ||
    'Regelmäßige Bauchatmung beruhigt das Nervensystem und senkt den Cortisolspiegel, verbessert den Gasaustausch, wirkt wie eine innere Massage auf die Organe und stärkt nebenbei Haltung, Stimme und Rumpfstabilität.' || chr(10) || chr(10) ||
    '**Probier es sofort:** Eine Hand auf den Bauch, eine auf die Brust. Durch die Nase einatmen — die Hand am Bauch hebt sich, die an der Brust bleibt möglichst ruhig. Ebenso ruhig ausatmen. Ein paar Minuten, am besten täglich.' || chr(10) || chr(10) ||
    '### 2. Durch die Nase' || chr(10) || chr(10) ||
    'Die Nase ist kein Atemrohr, sondern ein Atemorgan: Sie filtert, befeuchtet, erwärmt und reguliert. Sie produziert außerdem Stickstoffmonoxid, das die Gefäße weitet und die Sauerstoffaufnahme verbessert — die Sauerstoffverwertung kann dadurch um 10 bis 20 Prozent effizienter sein als bei Mundatmung.' || chr(10) || chr(10) ||
    'Mundatmung ist dagegen ein Notfallmodus. Die Luft kommt ungefiltert, kalt und trocken an, der Atem wird schneller und flacher, es geht zu viel CO2 verloren — und der Körper antwortet mit Stresssymptomen.' || chr(10) || chr(10) ||
    '**Probier es sofort:** Aufrecht sitzen, Mund zu, ruhig durch die Nase atmen. Spüre, wie die Luft beim Einströmen kühlt und beim Ausströmen wärmt. Ist die Nase anfangs zu, bleib ruhig — oft öffnet sie sich nach ein paar Atemzügen von selbst.' || chr(10) || chr(10) ||
    '### 3. Langsam' || chr(10) || chr(10) ||
    'Ein entspannter, gesunder Mensch atmet sechs bis zehn Mal pro Minute. Viele liegen im Alltag über fünfzehn — ohne es zu merken. Dieses Dauerrauschen hält den Körper in unterschwelliger Stressaktivierung.' || chr(10) || chr(10) ||
    'Langsames Atmen, etwa sechs Atemzüge pro Minute, stimuliert den Vagusnerv, senkt Herzfrequenz und Blutdruck und steigert die Herzfrequenzvariabilität — das Maß dafür, wie anpassungsfähig dein Nervensystem ist. Mehrere klinische Arbeiten zeigen zudem weniger Angst- und Stresssymptome und besseren Schlaf.' || chr(10) || chr(10) ||
    '**Probier es sofort:** Durch die Nase einatmen und bis vier zählen. Ruhig ausatmen und bis sechs oder sieben zählen. Kurze Pause. Fünf bis zehn Minuten.' || chr(10) || chr(10) ||
    '---' || chr(10) || chr(10) ||
    '## Was dabei im Nervensystem passiert' || chr(10) || chr(10) ||
    'Der Sympathikus ist das Gaspedal: Puls hoch, Muskeln angespannt, Atmung schnell und flach — überlebenswichtig, aber im Alltag viel zu oft aktiv. Der Parasympathikus ist das Bremspedal: Regeneration, Verdauung, Heilung, tiefe und langsame Atmung.' || chr(10) || chr(10) ||
    'Ein gesundes Nervensystem ist kein Zustand völliger Ruhe, sondern ein Wechselspiel. Sympathikus und Parasympathikus arbeiten wie zwei Tänzer, die sich abwechseln — **und der Atem ist der Rhythmus, der ihren Tanz steuert.** Er ist die einzige Körperfunktion, die gleichzeitig automatisch abläuft und bewusst steuerbar ist. Genau deshalb funktioniert Atemtraining überhaupt.' || chr(10) || chr(10) ||
    '## Die Box-Atmung: ein Takt für jede Lage' || chr(10) || chr(10) ||
    '![Die vier Phasen der Box-Atmung](news/boxatmung.jpg "square")' || chr(10) || chr(10) ||
    'Vier Phasen — einatmen, halten, ausatmen, halten. Über die Länge der Phasen entscheidest du, wohin es geht. Fünf Minuten sind das Minimum, fünfzehn sind besser:' || chr(10) || chr(10) ||
    '- **4 | 4 | 4 | 4** bringt das Nervensystem in Balance: senkt den Stresspegel, erzeugt ein energetisches Gleichgewicht und eine ausgeglichene Stimmung.' || chr(10) ||
    '- **4 | 7 | 8 | 0** aktiviert den Parasympathikus und wird bei Anspannung, Angst und hohem Stress eingesetzt.' || chr(10) || chr(10) ||
    'Beide liegen fertig in der App unter [Sessions](/sessions) — der Ring zählt für dich.' || chr(10) || chr(10) ||
    '## Sieben Tage, nicht sieben Wochen' || chr(10) || chr(10) ||
    'Wissen ändert nichts. Wiederholung schon. Das eBook enthält deshalb ein 7-Tage-Atemtagebuch nach immer demselben Muster:' || chr(10) || chr(10) ||
    '- **Morgens, noch im Bett:** Augen zu, langsam durch die Nase in den Bauch. Wie ist mein Energielevel, wie war der Schlaf, mit welcher Stimmung starte ich?' || chr(10) ||
    '- **Untertags ein Atemimpuls:** ein Satz, der an einen bewussten Atemzug erinnert — vor jeder neuen Aufgabe, in jeder Pause, bei jeder Unruhe.' || chr(10) ||
    '- **Abends eine Übung zum Loslassen:** verlängertes Ausatmen, 4-7-8, oder ein paar Atemzüge in Dankbarkeit.' || chr(10) || chr(10) ||
    'Nach sieben Tagen steht nicht die perfekte Atmung. Aber du hast Vergleichswerte — und die sind mehr wert als jedes Versprechen.' || chr(10) || chr(10) ||
    '---' || chr(10) || chr(10) ||
    '## Dein stillster Anker' || chr(10) || chr(10) ||
    'In einer Welt, die laut, schnell und fordernd ist, darf dein Atem das bleiben, was er immer war: dein stillster Anker.' || chr(10) || chr(10) ||
    'Wenn du tiefer einsteigen willst, findest du die aktuellen Termine unter [Kurse](/kurse) — und wenn du jetzt anfangen willst, brauchst du nur fünf Minuten und den Ring unter [Sessions](/sessions).' || chr(10) || chr(10) ||
    '### Woher die Zahlen kommen' || chr(10) || chr(10) ||
    'Die Aussagen dieses Beitrags stützen sich auf die im eBook zitierten Arbeiten, unter anderem Zaccaro et al. (2018) zu langsamer Atmung, Russo et al. (2017) zu deren physiologischen Effekten, Ma et al. (2017) und Perciavalle et al. (2017) zur Zwerchfellatmung, Lundberg et al. (1996) zu Stickstoffmonoxid in der Nasenatmung sowie Shao et al. (2024) und Laborde et al. (2019) zu Schlaf und Herz-Kreislauf.' || chr(10) || chr(10) ||
    '> **Kein medizinischer Rat.** Die Übungen dienen der Information und der Gesundheitsförderung, sie ersetzen keine Diagnose und keine Behandlung. Bei Beschwerden, chronischen Erkrankungen, Herz-Kreislauf- oder Atemwegsproblemen, in der Schwangerschaft oder bei anderen Einschränkungen sprich vorher mit einer Ärztin oder einem Arzt. Nie im Wasser oder beim Autofahren üben.' || chr(10) || chr(10) ||
    'Titelbild und Schaubild stammen aus dem eBook „Besser atmen, besser leben".',
    'news/besser-atmen-besser-leben.jpg',
    'blog',
    false,
    now() - interval '2 days'
  )
on conflict (slug) do update set
  title            = excluded.title,
  excerpt          = excluded.excerpt,
  body_md          = excluded.body_md,
  cover_image_path = excluded.cover_image_path,
  category         = excluded.category,
  is_pinned        = excluded.is_pinned,
  published_at     = excluded.published_at;

-- „Fragen? Schreib mir" geht in Rente: die Angaben stehen jetzt im Beitrag
-- ueber Michael. Zurueckziehen statt loeschen - falls doch noch jemand die
-- Adresse kennt, ist sie in einer Minute wieder da.
update public.news_posts set published_at = null where slug = 'kontakt';

-- Der alte Entwurf hiess anders. Falls er schon angelegt wurde:
update public.news_posts set published_at = null where slug = 'die-app-ist-da';

select slug, category, is_pinned, published_at is not null as sichtbar,
       cover_image_path, title
  from public.news_posts
 order by is_pinned desc, published_at desc nulls last;
```

Erwartet: `der-atemcode` ganz oben, darunter `ueber-mich`, dann
`besser-atmen-besser-leben`. `kontakt` steht unsichtbar am Ende.

### Danach einmal ansehen

Die Detailseiten liegen unter:

- `/news/der-atemcode`
- `/news/ueber-mich`
- `/news/besser-atmen-besser-leben`

Wenn eine davon „Diesen Beitrag gibt es nicht" zeigt, fehlt `published_at` —
nicht der Text.

### Bitte gegenlesen

Drei Stellen sind meine Formulierung, nicht deine, und beschreiben dich:

1. **„Ich habe mein Leben lang falsch geatmet"** als Zwischentitel im Beitrag
   über dich — das ist zugespitzt. Auf thehacode.com steht der Gedanke
   sachlicher.
2. **Der Absatz „Warum es diese App gibt"** deutet dein Motiv: dass ein
   Workshop endet und danach nichts trägt. Das steht so nirgends geschrieben,
   es ist aus deiner Geschichte geschlossen.
3. **Die Antwortzeit** („meist innerhalb eines Tages") und die Telefonnummer im
   Kontaktabschnitt — beides stand schon im alten Kontakt-Beitrag, prüf es
   trotzdem noch einmal.

Beim Blog-Beitrag sind alle inhaltlichen Aussagen aus deinem eBook übernommen,
inklusive der Studienangaben und des medizinischen Hinweises. Formuliert habe
ich sie neu, gekürzt und für den Bildschirm sortiert — Zahlen und Quellen sind
unverändert.

## Die freien Sequenzen

Sie stehen **fertig ausgeschrieben** in `supabase/seed.sql`, jeweils mit
Beschreibung, Wirkungen und Gegenanzeigen:

| slug | was es ist |
|---|---|
| `box-4-4-4-4` | Box-Atmung, der Klassiker, 8 Runden |
| `box-6-6-6-6` | dieselbe Form, länger, 6 Runden |
| `atem-4-7-8` | drei Phasen, kein Halten nach dem Ausatmen, 4 Runden |
| `kohaerenz-5-5` | nur Ein- und Ausatmen, 20 Runden |
| `aufbau-dreiteilig` | mehrere Blöcke hintereinander — zeigt, was der Konfigurator kann |

**Es sind fünf, nicht vier.** T18 verlangt vier; die dreiteilige Session ist die
Zugabe und zugleich die einzige, an der man sieht, dass sich der Ring beim
Blockwechsel neu aufteilt. Wer nur vier will, lässt sie weg — die Aufgabe ist
dann trotzdem erfüllt.

Die Datei liegt bewusst nicht als Migration vor — sonst
schriebe sie sich ungefragt auch nach Staging und Production (CLAUDE.md:
redaktionelle Inhalte gehören ins Studio).

**Vorgehen:** Datei öffnen, die Blöcke einzeln in den SQL Editor kopieren,
Texte anpassen, ausführen. Jeder Block ist für sich lauffähig und mehrfach
ausführbar (`on conflict (slug) do nothing`).

Danach prüfen:

```sql
select e.slug, e.title, e.is_published, count(p.id) as phasen
  from public.exercises e
  join public.exercise_steps s  on s.exercise_id = e.id
  join public.exercise_phases p on p.step_id     = s.id
 where e.owner_id is null
 group by e.slug, e.title, e.is_published
 order by e.slug;
```

Eine Zeile je eingespielter Sequenz, alle `is_published = true` — dann steht
T18 bis auf die News.
