-- ---------------------------------------------------------------------------
-- DER ATEMCODE - ONLINE: zwoelf Termine, vier Themen (Herbst/Winter 2026)
-- ---------------------------------------------------------------------------
-- Ausfuehren in Supabase Studio -> SQL Editor. Inhalt, kein Schema - deshalb
-- KEINE Migration (CLAUDE.md: Schemaaenderungen nur als Migration, Redaktion
-- laeuft ueber Studio).
--
-- Mehrfach ausfuehrbar: bei gleichem slug werden die Texte aktualisiert, es
-- entstehen keine Doubletten. Bereits gebuchte Termine behalten dabei ihre id,
-- die Buchungen bleiben also gueltig.
--
-- AUFBAU: die vier Thementexte stehen genau EINMAL (Tabelle "thema"), die
-- zwoelf Termine nur als Datum plus Thema (Tabelle "termin"). Das Kreuzprodukt
-- macht daraus die Kurszeilen. Wer einen Text aendert, aendert ihn an einer
-- Stelle - nicht zwoelfmal.
--
-- ZEITEN: starts_at ist timestamptz in UTC. 20:00 Wiener Zeit sind bis zum
-- 25.10.2026 18:00 UTC (Sommerzeit) und danach 19:00 UTC. Das ist unten
-- ausgerechnet und nicht dem Zufall ueberlassen - eine Stunde Versatz waere
-- genau die Art Fehler, die erst der erste Teilnehmer bemerkt.
--
-- AUSGENOMMENE MONTAGE (auf Wunsch frei): 12.10., 21.12., 28.12.2026.
--
-- REIHENFOLGE DER THEMEN: sie laufen ueber die STATTFINDENDEN Termine im
-- Kreis, nicht ueber den Kalender - faellt ein Termin aus, rueckt sein Thema
-- auf den naechsten nach. Deshalb folgt auf Energy (05.10.) direkt Relax
-- (19.10.) und nicht wieder Funktionale Atmung. So gehen genau drei volle
-- Durchlaeufe auf. Vom Nutzer am 23.08.2026 ausdruecklich so bestaetigt.
-- ---------------------------------------------------------------------------

with thema (key, thema_titel, bild, kurz, lang) as (values

-- ---------------------------------------------------------------- 1. Funktion
('funktionale-atmung', 'Funktionale Atmung', 'courses/online-funktionale-atmung.png',
 'Zurück zu einer Atmung, die von selbst wieder tut, was sie soll. Wir erhöhen das nutzbare Lungenvolumen und sprechen alle Bereiche der Lunge an — vom Zwerchfell bis in die Spitzen.',
$md$## Zurück zu einer gesunden Atmung

Atmen passiert von selbst — aber nicht von selbst richtig. Viele von uns atmen
flach, schnell und fast nur in den oberen Brustkorb. Oft seit Jahren, und ohne
es zu bemerken. Dieser Abend kümmert sich um alles, was uns zurück zu einer
gesunden Atmung bringt.

## Was wir üben

- **Das nutzbare Lungenvolumen erhöhen.** Nicht die Lunge wird größer, sondern
  der Anteil, den du tatsächlich benutzt. Zwerchfell, Zwischenrippenmuskulatur
  und die Beweglichkeit des Brustkorbs entscheiden darüber — und alle drei
  lassen sich üben.
- **Alle Bereiche der Lunge ansprechen.** Bauch, Flanken, Rücken und Spitzen:
  wir gehen die Räume der Reihe nach durch, damit am Ende keiner davon
  ungenutzt bleibt.
- **Ruhig, durch die Nase, ins Zwerchfell.** Die Grundlage, auf der alles
  Weitere in dieser Reihe aufbaut.

## Für wen

Für alle, die mit der Atmung anfangen wollen — und für alle, die schon weiter
sind und die Grundlage wieder sauber haben möchten. Vorkenntnisse braucht es
keine.

## Wie es abläuft

Wir treffen uns in **Microsoft Teams** — den Link bekommst du vor dem Termin
zugeschickt. Du brauchst eine Stunde ungestörte Zeit, eine Matte oder Decke und
die Möglichkeit, dich hinzulegen. Kopfhörer sind angenehm, aber kein Muss.$md$),

-- ----------------------------------------------------------------- 2. Balance
('balance', 'Balance', 'courses/online-balance.png',
 'Sympathikus und Parasympathikus wieder in Einklang. Eine Stunde für das Nervensystem — und für den Wechsel zwischen Anspannung und Erholung, der im Alltag oft verloren geht.',
$md$## Das Nervensystem in Einklang bringen

Dein vegetatives Nervensystem hat zwei Seiten: den **Sympathikus**, der
aktiviert, und den **Parasympathikus**, der erholt. Gesund ist nicht die eine
oder die andere — gesund ist der Wechsel zwischen beiden. Genau der gerät im
Alltag aus dem Takt und bleibt es dann oft über Wochen.

## Was wir üben

- **Beide Seiten kennenlernen.** Wie fühlt sich Aktivierung im eigenen Körper
  an, wie Beruhigung? Wer den Unterschied bemerkt, kann ihn beeinflussen.
- **Die Atmung als Schalter.** Die Ausatmung beruhigt, die Einatmung aktiviert.
  Über Länge, Tempo und Pausen lässt sich das gezielt nutzen statt zu hoffen.
- **Den Wechsel üben.** Nicht dauerhaft ruhig werden ist das Ziel, sondern
  beweglich sein: hinauf, wenn es gebraucht wird, und wieder herunter.

## Für wen

Für alle, die viel im Anspannungsmodus unterwegs sind — und für alle, die
umgekehrt schwer in Schwung kommen. Beides sind zwei Seiten derselben
fehlenden Beweglichkeit.

## Wie es abläuft

Wir treffen uns in **Microsoft Teams** — den Link bekommst du vor dem Termin
zugeschickt. Du brauchst eine Stunde ungestörte Zeit, eine Matte oder Decke und
die Möglichkeit, dich hinzulegen.$md$),

-- ------------------------------------------------------------------ 3. Energy
('energy', 'Energy', 'courses/online-energy.png',
 'Atemsessions, die den Körper wieder spürbar machen. Raus aus dem Kopf, hinein in den Körper — mit einer Atmung, die wach macht statt müde.',
$md$## Vom Kopf in den Körper

Es gibt Tage, an denen man von früh bis spät denkt und den Körper dabei kaum
bemerkt. Dieser Abend dreht das um. Es geht um Atemsessions, die den Körper
wieder spürbar machen — und darum, aus dem Kopf herauszukommen und im Körper
anzukommen.

## Was wir üben

- **Aktivierende Atmung.** Kräftiger, getragener als sonst, über längere
  Strecken. Der Körper meldet sich dabei von selbst zurück.
- **Wahrnehmung statt Leistung.** Kribbeln, Wärme, Weite: das sind keine
  Nebenwirkungen, das ist der Inhalt. Es geht nicht darum, etwas zu schaffen.
- **Zurückkommen.** Jede Session endet in der Ruhe, nicht im Aufruhr. Das
  Nachspüren am Ende ist der wichtigste Teil.

## Für wen

Für alle, die den Zugang zum eigenen Körper wiederfinden wollen.
Vorkenntnisse braucht es keine, Neugier schon.

## Gut zu wissen

Aktivierende Atmung ist kräftig und kann sich ungewohnt anfühlen. Wenn du
schwanger bist, Herz-Kreislauf-Beschwerden, Epilepsie oder eine akute
Erkrankung hast, halte bitte vorher Rücksprache mit uns oder deiner Ärztin
beziehungsweise deinem Arzt. Geübt wird ausschließlich im Liegen oder Sitzen —
nie im Wasser, nie beim Autofahren.

## Wie es abläuft

Wir treffen uns in **Microsoft Teams** — den Link bekommst du vor dem Termin
zugeschickt. Du brauchst eine Stunde ungestörte Zeit, eine Matte oder Decke und
die Möglichkeit, dich hinzulegen.$md$),

-- ------------------------------------------------------------------- 4. Relax
('relax', 'Relax', 'courses/online-relax.png',
 'Mit dem Atem wieder zur Ruhe kommen — mitten in der stressigen Situation und abends, wenn der Tag nicht aufhören will und der Schlaf nicht kommt.',
$md$## Wieder zur Ruhe kommen

Zur Ruhe kommen braucht man an zwei ganz verschiedenen Stellen: **mitten in
einer stressigen Situation**, wenn es gerade viel ist — und **abends nach einem
stressigen Tag**, wenn der Kopf nicht aufhört und der Schlaf nicht kommt. Für
beides gibt es eigene Techniken, und beide üben wir an diesem Abend.

## Was wir üben

- **Für den Moment.** Kurze Techniken, die unauffällig funktionieren: im Büro,
  vor einem Gespräch, im Auto vor der Einfahrt. Niemand sieht dir dabei etwas
  an.
- **Für den Abend.** Längere Übungen zum Herunterfahren, die den Tag beenden
  statt ihn im Kopf weiterlaufen zu lassen — und die den Weg in einen guten
  Schlaf frei machen.
- **Warum das wirkt.** Ein kurzer Blick darauf, was eine verlängerte Ausatmung
  im Körper auslöst. Wer es versteht, wendet es eher an.

## Für wen

Für alle, die abschalten wollen und es nicht auf Kommando können. Vorkenntnisse
braucht es keine.

## Wie es abläuft

Wir treffen uns in **Microsoft Teams** — den Link bekommst du vor dem Termin
zugeschickt. Du brauchst eine Stunde ungestörte Zeit, eine Matte oder Decke und
die Möglichkeit, dich hinzulegen. Diese Einheit eignet sich gut, um danach
direkt schlafen zu gehen.$md$)

),

-- Nur Datum und Thema. Die Uhrzeit steckt schon in der Zeitangabe: bis zum
-- 25.10.2026 gilt Sommerzeit (+02), danach Normalzeit (+01) - beides so
-- geschrieben, dass Postgres daraus dieselbe absolute Zeit macht, naemlich
-- 20:00 Uhr in Wien.
termin (key, beginn) as (values
  ('funktionale-atmung', timestamptz '2026-09-21 20:00+02'),
  ('balance',            timestamptz '2026-09-28 20:00+02'),
  ('energy',             timestamptz '2026-10-05 20:00+02'),
  -- 12.10.2026 entfaellt
  ('relax',              timestamptz '2026-10-19 20:00+02'),
  ('funktionale-atmung', timestamptz '2026-10-26 20:00+01'),
  ('balance',            timestamptz '2026-11-02 20:00+01'),
  ('energy',             timestamptz '2026-11-09 20:00+01'),
  ('relax',              timestamptz '2026-11-16 20:00+01'),
  ('funktionale-atmung', timestamptz '2026-11-23 20:00+01'),
  ('balance',            timestamptz '2026-11-30 20:00+01'),
  ('energy',             timestamptz '2026-12-07 20:00+01'),
  ('relax',              timestamptz '2026-12-14 20:00+01')
  -- 21.12.2026 und 28.12.2026 entfallen
),

zeile as (
  select
    t.key,
    th.thema_titel,
    th.bild,
    th.kurz,
    th.lang,
    t.beginn,
    -- Die Uebersicht sortiert allein nach sort_order (useCoursesList).
    -- 60 aufwaerts in Zehnerschritten: die fuenf VHS-Kurse liegen auf 10 bis 50
    -- und behalten damit ihre Reihenfolge und die drei grossen Kacheln.
    50 + 10 * row_number() over (order by t.beginn) as sortierung
  from termin t
  join thema th on th.key = t.key
)

insert into public.courses (
  slug, title, description, body_md, location, price_info,
  cover_image_path, sort_order, starts_at,
  price_cents, deposit_cents, capacity, booking_enabled, signup_url,
  published_at
)
select
  'online-' || key || '-' || to_char(beginn at time zone 'Europe/Vienna', 'YYYY-MM-DD'),
  'DER ATEMCODE – ONLINE: ' || thema_titel,
  kurz,
  lang || E'\n\n> Teil der Reihe **DER ATEMCODE – ONLINE**: jeden Montag von '
       || '20:00 bis 21:00, jede Woche ein Thema — Funktionale Atmung, '
       || 'Balance, Energy und Relax. Jeder Abend steht für sich, du kannst '
       || 'einzeln dabei sein. Fällt ein Termin aus, rückt sein Thema auf den '
       || 'nächsten Termin nach; die folgenden Themen verschieben sich '
       || 'entsprechend. Der Teams-Link wird vor jedem Termin ausgesendet.',
  'Online',
  '9,99 €',
  bild,
  sortierung,
  beginn,
  999,        -- 9,99 EUR brutto. Kleinunternehmer: keine Steuer ausgewiesen.
  null,       -- keine Anzahlung, Vollzahlung im Checkout
  null,       -- online: keine Platzbegrenzung
  true,       -- in der App buchbar (verlangt price_cents und starts_at)
  null,       -- kein externer Anmeldelink noetig
  now()       -- sofort veroeffentlicht; null setzen, um sie zurueckzuhalten
from zeile
on conflict (slug) do update set
  title            = excluded.title,
  description      = excluded.description,
  body_md          = excluded.body_md,
  location         = excluded.location,
  price_info       = excluded.price_info,
  cover_image_path = excluded.cover_image_path,
  sort_order       = excluded.sort_order,
  starts_at        = excluded.starts_at,
  price_cents      = excluded.price_cents,
  booking_enabled  = excluded.booking_enabled,
  updated_at       = now();

-- Gegenprobe: zwoelf Zeilen, aufsteigend nach Datum.
select sort_order, slug, title,
       to_char(starts_at at time zone 'Europe/Vienna', 'DD.MM.YYYY HH24:MI') as wiener_zeit
from public.courses
where slug like 'online-%'
order by sort_order;
