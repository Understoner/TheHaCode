-- Kurs "Atmung nach Maß" - das individuelle Anfrage-Angebot.
--
-- Inhalt, kein Schema: im Studio unter "SQL Editor" ausfuehren, in Staging und
-- Live je einmal (CLAUDE.md, Redaktion ueber Studio). Mehrfach ausfuehrbar -
-- gleicher slug heisst Aktualisierung statt Doublette.
--
-- ERST DIE MIGRATIONEN, DANN DIESE DATEI. is_pinned und signup_label entstehen
-- in Migration 0019; die Pipeline rollt sie nach dem Merge aus. Die Pruefung
-- gleich unten bricht sonst ab, bevor etwas geaendert wird.
--
-- Was diesen Kurs von den anderen unterscheidet:
--   * kein starts_at, kein Preis, keine Buchung in der App (booking_enabled
--     bleibt auf dem Default false);
--   * is_pinned = true: steht auf /kurse immer als erstes;
--   * signup_url ist eine E-Mail mit vorbereitetem Betreff und den Fragen aus
--     "Das hilft mir bei deiner Anfrage" - wer anfragt, muss nur ausfuellen.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'courses'
       and column_name  = 'is_pinned'
  ) then
    raise exception
      'In dieser Umgebung fehlt Migration 0019 (angeheftete Kurse). Es wurde '
      'nichts geaendert. Erst die Migrationen ausrollen lassen - nach dem Merge '
      'erledigt das die Pipeline von selbst, siehe docs/DEPLOYMENT.md - und '
      'diese Datei danach noch einmal ausfuehren.';
  end if;
end $$;

insert into public.courses (
  slug, title, description, body_md, location, price_info,
  signup_url, signup_label, is_pinned, sort_order, published_at
) values (
  'atmung-nach-mass',
  'Atmung nach Maß – Dein individuelles Angebot',
  'Du suchst etwas, das genau zu dir, deinem Team oder deinem Unternehmen passt? '
    || 'Ob 1:1-Begleitung, private Gruppensession oder Firmenworkshop: Gemeinsam '
    || 'gestalten wir ein Atemangebot, das auf deine Themen, deinen Rahmen und deine '
    || 'Ziele zugeschnitten ist, online oder live vor Ort.',
  $md$## Dein persönliches Atemangebot, abgestimmt auf deine Bedürfnisse

Jeder Mensch bringt eigene Themen mit, und jede Gruppe hat ihre eigene Dynamik. Deshalb gibt es neben den festen Kursen die Möglichkeit, ein Angebot anzufragen, das ganz auf dich zugeschnitten ist. Du sagst mir, was du brauchst, und ich entwickle daraus ein passendes Format, in Inhalt, Dauer, Ort und Rahmen.

## Diese Formate sind möglich

### 1:1-Sessions: online oder live

In der Einzelbegleitung arbeiten wir gezielt an deinem Thema. Die Atmung ist dabei das Werkzeug, um mehr Ruhe, Klarheit und Energie in deinen Alltag zu bringen. Die Sessions finden bequem online oder persönlich statt, als Einzeltermin oder als begleitende Serie.

### Individuelle Gruppensessions: online oder bei dir vor Ort

Du möchtest mit Freunden, Familie, deinem Verein oder einer Interessensgruppe gemeinsam atmen? Ich gestalte eine Session speziell für eure Gruppe. Online ist das von überall aus möglich. Gerne komme ich auch zu euch in die Nähe, sofern eine geeignete Location zur Verfügung steht (ein ruhiger Raum mit ausreichend Platz, um bequem zu sitzen oder zu liegen).

### Firmenworkshops

Stress, hohe Taktung und ständige Erreichbarkeit gehören für viele Teams zum Arbeitsalltag. In praxisnahen Workshops lernt dein Team einfache Atemtechniken, die sich sofort im Berufsleben anwenden lassen: vor einem wichtigen Meeting, in herausfordernden Situationen oder zum Abschalten nach einem langen Tag. Möglich als Impulsvortrag, Halbtages-Workshop oder als mehrteilige Reihe.

### Im Rahmen der betrieblichen Gesundheitsförderung

Viele Unternehmen unterstützen die Gesundheit ihrer Mitarbeitenden aktiv. Atemworkshops lassen sich hervorragend in bestehende Gesundheitsprogramme einbinden, etwa als regelmäßiges Angebot nach Arbeitsende, mit Unterstützung durch das Unternehmen. So entsteht ein niederschwelliger Zugang zu mehr Entspannung und Resilienz, den ihr im Team gemeinsam erlebt.

## Mögliche Themen

Die Atmung wirkt direkt auf Körper und Nervensystem und lässt sich deshalb für viele Anliegen gezielt einsetzen, zum Beispiel:

- Stressabbau und Entspannung
- Besserer Schlaf und leichteres Abschalten
- Fokus, Konzentration und mentale Klarheit
- Umgang mit Nervosität, Druck und Lampenfieber
- Mehr Energie und Vitalität im Alltag
- Resilienz und emotionale Balance

Dein Thema ist nicht dabei? Sprich mich einfach an.

## So läuft es ab

**1. Anfrage:** Du schilderst kurz dein Anliegen per E-Mail an [office@thehacode.com](mailto:office@thehacode.com?subject=Anfrage%3A%20Atmung%20nach%20Ma%C3%9F).

**2. Kennenlerngespräch:** In einem kostenlosen, unverbindlichen Gespräch klären wir Ziele, Rahmen und Wünsche.

**3. Dein Angebot:** Du erhältst ein konkretes Konzept inklusive Ablauf, Dauer und Kosten.

**4. Umsetzung:** Wir atmen, online oder live, ganz so, wie es für dich passt.

## Das hilft mir bei deiner Anfrage

- Um welches Format geht es (1:1, Gruppe, Firma)?
- Welches Thema oder Ziel steht im Mittelpunkt?
- Wie viele Personen nehmen teil?
- Online oder vor Ort, und falls vor Ort: wo und mit welcher Location?
- Gewünschter Zeitraum bzw. Termine

---

> **Hinweis:** Atemarbeit ersetzt keine ärztliche oder psychotherapeutische Behandlung. Wenn du gesundheitliche Einschränkungen hast (z. B. Herz-Kreislauf-Erkrankungen, Epilepsie, Schwangerschaft), halte bitte vorab Rücksprache mit deiner Ärztin oder deinem Arzt und sag mir im Kennenlerngespräch Bescheid.$md$,
  'Online oder live vor Ort',
  'Individuelles Angebot',
  'mailto:office@thehacode.com?subject=Anfrage%3A%20Atmung%20nach%20Ma%C3%9F&body=Hallo%20Michael%2C%0D%0A%0D%0Aich%20interessiere%20mich%20f%C3%BCr%20ein%20individuelles%20Atemangebot.%0D%0A%0D%0AFormat%20(1%3A1%2C%20Gruppe%2C%20Firma)%3A%0D%0AThema%20oder%20Ziel%3A%0D%0AAnzahl%20der%20Personen%3A%0D%0AOnline%20oder%20vor%20Ort%20(falls%20vor%20Ort%3A%20wo%20und%20mit%20welcher%20Location)%3A%0D%0AGew%C3%BCnschter%20Zeitraum%20bzw.%20Termine%3A%0D%0A%0D%0A',
  'Jetzt individuelles Angebot anfragen',
  true,
  0,
  now()
)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  body_md      = excluded.body_md,
  location     = excluded.location,
  price_info   = excluded.price_info,
  signup_url   = excluded.signup_url,
  signup_label = excluded.signup_label,
  is_pinned    = excluded.is_pinned,
  -- published_at bleibt beim zweiten Lauf, wie es war: wer den Kurs im Studio
  -- zurueckgezogen hat (published_at = null), soll ihn nicht durch ein
  -- erneutes Ausfuehren ungefragt wieder online sehen.
  published_at = coalesce(public.courses.published_at, excluded.published_at);

select slug, title, is_pinned, signup_label, published_at is not null as sichtbar
  from public.courses
 where slug = 'atmung-nach-mass';
