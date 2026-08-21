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
