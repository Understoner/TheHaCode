-- ---------------------------------------------------------------------------
-- Zwei News-Beitraege zu den Kursen (Herbst/Winter 2026)
-- ---------------------------------------------------------------------------
-- Ausfuehren in Supabase Studio -> SQL Editor. Inhalt, kein Schema - deshalb
-- KEINE Migration (CLAUDE.md: Schemaaenderungen nur als Migration, Redaktion
-- laeuft ueber Studio).
--
-- Mehrfach ausfuehrbar: bei gleichem slug werden die Texte aktualisiert, es
-- entstehen keine Doubletten. published_at bleibt dabei stehen - sonst
-- sprangen die Beitraege bei jeder Textkorrektur wieder an die Spitze der
-- Liste, obwohl sich nichts Wesentliches geaendert hat.
--
-- BILDER: beide verweisen auf bereits vorhandene Dateien im Bucket
-- public-assets. Es ist NICHTS hochzuladen.
--   courses/online-energy.png    - dasselbe Bild wie beim Online-Kurs Energy
--   courses/besser-atmen-vhs.jpg - dasselbe Bild wie bei den VHS-Kursen
--
-- Eine eigene Detailseite braucht es nicht: /news/<slug> gibt es bereits, und
-- body_md IST die Detailseite. Beide Beitraege verweisen von dort mit einem
-- Link auf /kurse, wo die Termine mit Datum und Buchung stehen.
--
-- ACHTUNG, EINE ZEILE MIT VORBEDINGUNG
-- ------------------------------------
-- Im Online-Beitrag steht "ein Konto brauchst du dafuer nicht". Das gilt erst,
-- wenn die Gastbuchung (PR #62) in der jeweiligen Umgebung ausgerollt ist -
-- auf Staging seit dem 06.09.2026, auf Live erst nach der Befoerderung. Wer
-- diese Datei vorher auf Live ausfuehrt, verspricht etwas, das dort noch nicht
-- geht. Dann entweder die Befoerderung abwarten oder den Halbsatz streichen.
-- ---------------------------------------------------------------------------

insert into public.news_posts
  (slug, title, category, cover_image_path, visibility, is_pinned, published_at, excerpt, body_md)
values

-- --------------------------------------------------------------- 1. ONLINE
(
  'online-kurse-2026',
  'DER ATEMCODE ONLINE: jeden Montag eine Stunde für deinen Atem',
  'kurs',
  'courses/online-energy.png',
  'free',
  false,
  now(),
  'Vier Themen im Wechsel — Funktionale Atmung, Balance, Energy und Relax. Jeden Montag um 20:00 Uhr, eine Stunde, von zu Hause aus. Jeder Abend steht für sich: du kannst einsteigen, wann du willst, und musst keine Reihe von Anfang an mitmachen.',
$md$## Eine Stunde, ein Thema, kein Vorwissen

Der Online-Kurs läuft als Videokonferenz — du brauchst nur einen ruhigen Platz,
eine Matte oder einen Stuhl und Kopfhörer, wenn im Haushalt noch jemand wach
ist. Kamera an oder aus, wie es dir lieber ist.

Wir starten mit einer kurzen Einordnung, üben dann gemeinsam und schließen mit
Zeit für Fragen. Nach einer Stunde bist du fertig, und du hast etwas dabei, das
du am nächsten Tag allein wiederholen kannst.

## Die vier Themen

Sie laufen im Kreis, immer ein Thema je Termin. Wer alle vier mitnimmt, hat
einen vollständigen Durchgang — nötig ist das aber nicht.

### Funktionale Atmung

Zurück zu einer Atmung, die von selbst wieder tut, was sie soll. Wir erhöhen
das nutzbare Lungenvolumen und sprechen alle Bereiche der Lunge an — vom
Zwerchfell bis in die Spitzen.

### Balance

Sympathikus und Parasympathikus wieder in Einklang. Eine Stunde für das
Nervensystem — und für den Wechsel zwischen Anspannung und Erholung, der im
Alltag oft verloren geht.

### Energy

Atemsessions, die den Körper wieder spürbar machen. Raus aus dem Kopf, hinein
in den Körper — mit einer Atmung, die wach macht statt müde.

### Relax

Mit dem Atem wieder zur Ruhe kommen — mitten in der stressigen Situation und
abends, wenn der Tag nicht aufhören will und der Schlaf nicht kommt.

## Das Praktische

- **Wann:** montags, 20:00 Uhr, rund eine Stunde
- **Wo:** online, den Zugangslink bekommst du nach der Buchung per E-Mail
- **Preis:** 9,99 € je Abend
- **Voraussetzungen:** keine. Wer atmet, kann mitmachen.

Gebucht wird direkt hier in der App — ein Konto brauchst du dafür nicht. Name,
E-Mail-Adresse, bezahlen, fertig.

> Wenn du schwanger bist, an Epilepsie oder einer Herz-Kreislauf-Erkrankung
> leidest, sprich vorher bitte mit deiner Ärztin oder deinem Arzt. Manche
> Atemtechniken sind dann nicht geeignet.

## Termine ansehen und buchen

Welche Themen als Nächstes dran sind, steht mit Datum auf der Kursseite.

[Zu den Kursterminen](/kurse)
$md$
),

-- ------------------------------------------------------------------ 2. VHS
(
  'vhs-kurse-2026-27',
  'Besser atmen – besser leben: die Kurse an der Volkshochschule',
  'kurs',
  'courses/besser-atmen-vhs.jpg',
  'free',
  false,
  now() - interval '1 minute',
  'Vier Abende Breathwork an der VHS Oberösterreich — in Vöcklabruck, Buchkirchen und Ampflwang. Dazu ein kostenloser Infoabend für alle, die erst einmal hineinschnuppern wollen. Anmeldung läuft über die VHS, nicht über diese App.',
$md$## Vier Abende, aufeinander aufgebaut

Anders als die Online-Stunden sind die VHS-Kurse eine **Reihe**: vier Abende,
die aufeinander aufbauen. Das gibt Zeit, die Übungen nicht nur einmal zu
probieren, sondern sie zwischen den Terminen im Alltag zu erproben und beim
nächsten Mal nachzujustieren.

Es geht darum, was gesunde Atmung ausmacht und wie Sie über Tiefe, Frequenz und
Pausen Ihr Nervensystem beeinflussen — für weniger Stress und mehr Energie im
Alltag.

### Was wir uns ansehen

- wie sich ungesunde Atemmuster überhaupt einschleichen, meist über Jahre
- Zwerchfell statt Brustkorb: was sich ändert, wenn unten Platz entsteht
- Nasenatmung, und warum sie mehr ist als eine Geschmacksfrage
- die Pause zwischen den Atemzügen — der am meisten unterschätzte Teil
- Übungen für den Abend, für den Stau und für die Minute vor dem Termin

Mitzubringen sind bequeme Kleidung und eine Decke. Matten sind vor Ort.

## Erst einmal hineinschnuppern

Am **Dienstag, 29. September 2026 um 19:00 Uhr** gibt es in der
Arbeiterkammer Vöcklabruck einen **kostenlosen Infoabend**: warum sich so viele
Menschen ungesunde Atemmuster aneignen — und wie einfache Übungen sofort
spürbar wirken. Ohne Vorkenntnisse, ohne Verpflichtung.

## Die Termine

Alle Reihen starten um 19:00 Uhr und umfassen vier Abende.

- **Vöcklabruck** — ab Dienstag, 13. Oktober 2026, Arbeiterkammer
- **Buchkirchen** — ab Dienstag, 10. November 2026, Mittelschule
- **Ampflwang** — ab Dienstag, 19. Januar 2027, Musikschule
- **Buchkirchen** — ab Dienstag, 2. März 2027, Mittelschule

## Anmeldung

Die VHS-Kurse werden **über die Volkshochschule Oberösterreich** gebucht, nicht
über diese App — dort stehen auch die Kursgebühren und etwaige Ermäßigungen.
Auf der Kursseite führt bei jedem VHS-Termin ein Link direkt ins Kursbuch.

[Zu den Kursterminen](/kurse)
$md$
)

on conflict (slug) do update set
  title            = excluded.title,
  category         = excluded.category,
  cover_image_path = excluded.cover_image_path,
  visibility       = excluded.visibility,
  is_pinned        = excluded.is_pinned,
  excerpt          = excluded.excerpt,
  body_md          = excluded.body_md,
  -- Bewusst NICHT excluded: eine Textkorrektur soll den Beitrag nicht wieder
  -- an die Spitze der Liste heben.
  published_at     = coalesce(public.news_posts.published_at, excluded.published_at);
