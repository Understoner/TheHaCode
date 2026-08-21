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

## News: die drei ersten Beiträge

### Zuerst das Unangenehme: der Fließtext wird nirgends angezeigt

`news_posts.body_md` ist **not null**, wird aber von keiner Ansicht gelesen.
Die Landing Page zeigt je Beitrag: Kategorie, Datum, geschätzte Lesezeit,
**Titel** und **Anriss** (`excerpt`) — mehr nicht. Eine Detailseite gibt es
nicht, und sie steht auch in keiner Aufgabe des Backlogs.

Daraus folgt für alles Weitere: **der Anriss ist der Beitrag.** Zwei bis drei
Sätze, die für sich stehen. Der Fließtext wird trotzdem gefüllt — er ist
Pflichtfeld, er speist die Lesezeit, und er ist da, sobald es eine Detailseite
gibt.

Zwei Wege, wenn dir das zu wenig ist:

1. **So lassen.** „Über mich" steht ohnehin ausführlich auf `/team`, die
   Kontaktdaten stehen im Impressum. Die gepinnten Beiträge sind dann
   Wegweiser, keine Texte — und genau so sind sie unten geschrieben.
2. **Detailseite bauen.** Route `/news/[slug]`, Markdown-Darstellung,
   `QueryBoundary`. Das ist neuer Umfang und keine offene Zusage: T07 verlangt
   die beiden gepinnten Beiträge, nicht die Detailansicht. Sag Bescheid, wenn
   es das werden soll.

> **Bilder sind optional.** Ohne `cover_image_path` zeichnet `CoverImage` eine
> ruhige Fläche in Ocean oder Sage mit dem Titel darin — das sieht bewusst nach
> Absicht aus, nicht nach fehlendem Bild. Wer doch eines will: Storage →
> `public-assets` → Ordner `news`, dann den Pfad `news/<datei>.jpg` eintragen.
> Die Ordner-Allowlist aus Migration 0004 lässt nur `news`, `courses`, `team` zu.

### Reihenfolge auf der Seite

Sortiert wird nach `is_pinned`, dann nach `published_at` absteigend. Die ersten
drei Einträge erscheinen als große Karten, alles Weitere als schlanke Liste.
Mit zwei gepinnten Beiträgen bleibt genau **ein** Platz oben für den jeweils
neuesten echten Beitrag — deshalb sind es hier drei und nicht vier.

### Alle drei anlegen

**Studio → SQL Editor.** Mehrfach ausführbar: `on conflict (slug)` schreibt die
Texte neu, statt an der Eindeutigkeit zu scheitern.

```sql
insert into public.news_posts (slug, title, excerpt, body_md, category, is_pinned, published_at)
values
  (
    'ueber-mich',
    'Wer hinter DER ATEMCODE steht',
    'Vor fünf Jahren saß ich zwischen Familie, IT-Führungsjob und Dauerstress — und merkte bei meiner ersten Atemmeditation, wie schwer mir Stille fiel. Aus dieser Erfahrung wurde eine Ausbildung zum Breathwork-Trainer und daraus das hier. Die ganze Geschichte steht auf der Team-Seite.',
    'Die ausführliche Fassung steht auf der Team-Seite. Dieser Beitrag ist der Wegweiser dorthin.',
    'allgemein',
    true,
    now()
  ),
  (
    'kontakt',
    'Fragen? Schreib mir',
    'Für Fragen zu Kursen, zur App oder zu deinem Konto: office@thehacode.com. Ich antworte selbst, meist innerhalb eines Tages. Anschrift und alle weiteren Angaben stehen im Impressum.',
    'E-Mail: office@thehacode.com · Telefon: +43 664 4252322 · Anschrift und Offenlegung im Impressum.',
    'allgemein',
    true,
    now()
  ),
  (
    'die-app-ist-da',
    'Die App ist da',
    'Getaktete Atemübungen mit einem Kreis, dem man beim Atmen zusieht — kostenlos und ohne Konto. Wer eigene Sequenzen bauen will, findet den Konfigurator unter „Meine Sequenzen". Kurse lassen sich ab sofort direkt hier buchen.',
    'Fünf vorbereitete Sequenzen stehen bereit: Box-Atmung in zwei Längen, 4-7-8, Kohärenzatmung und eine dreiteilige Session. Sie laufen ohne Anmeldung und bleiben dauerhaft kostenlos.' || chr(10) || chr(10) ||
    'Der Sequenz-Konfigurator ist die bezahlte Funktion: Blöcke, Phasen, Runden und Pausen frei zusammenstellen, mit Vorschau und Vorhören. Bedienen kann ihn jeder — gespeichert wird mit Plus.' || chr(10) || chr(10) ||
    'Kurse und Workshops werden nicht mehr über einen externen Link angemeldet, sondern direkt hier gebucht und bezahlt.',
    'allgemein',
    false,
    now()
  )
on conflict (slug) do update set
  title        = excluded.title,
  excerpt      = excluded.excerpt,
  body_md      = excluded.body_md,
  category     = excluded.category,
  is_pinned    = excluded.is_pinned,
  published_at = excluded.published_at;

select slug, category, is_pinned, published_at is not null as sichtbar, title
  from public.news_posts
 order by is_pinned desc, published_at desc;
```

`published_at` ist auch hier der Schalter: ohne Zeitstempel bleibt der Beitrag
unsichtbar. Zum Zurückziehen `set published_at = null`, nicht löschen.

### Bitte gegenlesen

Beim Beitrag „Die App ist da" habe ich die Tonlage gesetzt, nicht du. Er
verspricht nichts, was die App nicht kann — aber ob er nach dir klingt, kann
nur einer beurteilen.

Zwei Angaben stehen so im Text und stimmen hoffentlich noch: die Antwortzeit
(„meist innerhalb eines Tages") und die Telefonnummer im Kontakt-Beitrag. Wenn
du keine Telefonnummer in den News haben willst, streiche sie aus `body_md` —
im Impressum steht sie ohnehin, dort ist sie Pflicht.

---

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
