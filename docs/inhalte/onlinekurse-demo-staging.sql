-- docs/inhalte/onlinekurse-demo-staging.sql
--
-- NUR TESTSYSTEM (Staging). NICHT IM LIVESYSTEM AUSFUEHREN.
--
-- Vier Demo-Onlinekurse, je einer pro Zugangsart (V1.2, SAD §11.2), damit
-- sich Zugang, Kauf, Fortschritt und Zertifikat im Testsystem durchspielen
-- lassen. Alle Titel beginnen mit "Demo:".
--
-- Voraussetzung: Migration 0042 ist auf Staging ausgerollt (passiert mit dem
-- Merge nach develop).
--
-- Ausfuehren: Supabase Studio -> Projekt Staging -> SQL Editor -> diese Datei
-- einfuegen -> Run. Laeuft mehrfach ohne Schaden (ersetzt die Demo-Kurse).
--
-- Dateien danach hochladen: Studio -> Storage -> Bucket course-media ->
-- Ordner = Kurs-ID (unten), Dateiname exakt wie in den Pfaden:
--   de000000-0000-4000-8000-000000000001/vorteile-auf-einen-blick.pdf
--   de000000-0000-4000-8000-000000000004/atemprotokoll-7-tage.pdf
--     (beide liegen im Repo unter docs/inhalte/onlinekurse-demo/)
--   de000000-0000-4000-8000-000000000001/erste-atemrunde.mp3
--   de000000-0000-4000-8000-000000000003/478-im-liegen.mp3
--   de000000-0000-4000-8000-000000000004/box-atmung.mp3
--     (beliebige eigene Aufnahme als MP3 oder M4A; bei M4A den Pfad unten
--      anpassen. Fehlt die Datei, zeigt die App den Block ohne Ton.)
-- Videos: video_external_id ist leer, bis eine eigene Vimeo-ID eingetragen
-- wird (update public.online_course_block_contents set video_provider =
-- 'vimeo', video_external_id = '<ID>' where block_id = '<Block-ID>').
--
-- Quizfragen kommen mit Schritt 7 (eigene Tabellen) dazu.

begin;

-- Sicherheitsnetz, aber nur ein schwaches: bricht ab, sobald es im Projekt
-- echte Kaeufe gibt. Solange Live noch keinen Onlinekurs verkauft hat, greift
-- es dort NICHT - vor dem Ausfuehren also oben im Studio pruefen, dass das
-- Projekt Staging ausgewaehlt ist.
do $$
begin
  if exists (select 1 from public.course_access where source = 'stripe'
               and course_id not in (select id from public.online_courses where slug like 'demo-%')) then
    raise exception 'Es gibt echte Kaeufe in diesem Projekt - ist das wirklich Staging?';
  end if;
end;
$$;

-- Vorherige Demo-Fassung entfernen (Kaeufe von Demo-Kursen zuerst, wegen
-- on delete restrict).
delete from public.course_access
 where course_id in (select id from public.online_courses where slug like 'demo-%');
delete from public.online_courses where slug like 'demo-%';

-- ===================================================================
-- Kurse
-- ===================================================================
insert into public.online_courses
  (id, slug, title, subtitle, summary_md, description_md, access, price_cents, suggested_days, is_published, sort_order)
values
  ('de000000-0000-4000-8000-000000000001', 'demo-atmung-verstehen',
   'Demo: Atmung verstehen', 'Der Basiskurs für alle',
   'Was beim Atmen passiert, warum es so viel verändert und wie du es für dich nutzt.',
   'Ein Onlinekurs on demand: alle Inhalte sind aufgezeichnet und jederzeit abrufbar, es gibt keinen Live-Unterricht. Die Tage im Zeitverlauf sind ein Vorschlag, alle Blöcke sind sofort offen.',
   'public', null, 4, true, 1),
  ('de000000-0000-4000-8000-000000000002', 'demo-atempausen',
   'Demo: Atempausen im Alltag', 'Eine Woche, drei Anker',
   'Kurze Atempausen, die du an Dinge hängst, die ohnehin passieren.',
   'Ein Onlinekurs on demand, kein Live-Unterricht. Kostenlos mit Konto.',
   'account', null, 7, true, 2),
  ('de000000-0000-4000-8000-000000000003', 'demo-besser-einschlafen',
   'Demo: Besser einschlafen', 'Abendroutine in 10 Tagen',
   'Wie du den Tag mit dem Atem abschließt.',
   'Ein Onlinekurs on demand, kein Live-Unterricht. In Plus enthalten.',
   'plus', null, 10, true, 3),
  ('de000000-0000-4000-8000-000000000004', 'demo-ruhig-atmen',
   'Demo: Ruhig atmen', 'Grundkurs in 14 Tagen',
   'In zwei Wochen fünf Atemmuster, die du danach ohne Anleitung nutzen kannst.',
   'Ein Onlinekurs on demand, kein Live-Unterricht. Einmal kaufen, ein Jahr Zugang, mit Plus 15 % günstiger.',
   'paid', 8900, 14, true, 4);

-- ===================================================================
-- Gliederung
-- ===================================================================
insert into public.online_course_blocks (id, course_id, sort_order, day_offset, kind, title, summary, duration_sec) values
  -- Atmung verstehen (für alle)
  ('de000000-0000-4000-8000-000000000101', 'de000000-0000-4000-8000-000000000001', 1, 0, 'video', 'Warum Atmung so viel verändert', 'Einatmen aktiviert, Ausatmen beruhigt.', 360),
  ('de000000-0000-4000-8000-000000000102', 'de000000-0000-4000-8000-000000000001', 2, 0, 'text',  'Zwerchfell, Nase und Rhythmus', 'Die drei Hebel deines Atems.', 300),
  ('de000000-0000-4000-8000-000000000103', 'de000000-0000-4000-8000-000000000001', 3, 1, 'audio', 'Deine erste geführte Atemrunde', 'Gesprochene Anleitung zum Mitatmen.', 360),
  ('de000000-0000-4000-8000-000000000104', 'de000000-0000-4000-8000-000000000001', 4, 2, 'pdf',   'Die Vorteile auf einen Blick', 'Eine Seite zum Ausdrucken.', null),
  ('de000000-0000-4000-8000-000000000105', 'de000000-0000-4000-8000-000000000001', 5, 3, 'quiz',  'Wissensquiz', 'Fünf Fragen, bestanden ab 80 %.', 300),
  -- Atempausen (Konto)
  ('de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000002', 1, 0, 'text',  'Drei Atempausen im Alltag', 'Postfach, Ampel, Zähneputzen.', 240),
  ('de000000-0000-4000-8000-000000000202', 'de000000-0000-4000-8000-000000000002', 2, 3, 'video', 'Ruhe in 30 Sekunden', null, 240),
  ('de000000-0000-4000-8000-000000000203', 'de000000-0000-4000-8000-000000000002', 3, 6, 'quiz',  'Wissensquiz', null, 300),
  -- Besser einschlafen (Plus)
  ('de000000-0000-4000-8000-000000000301', 'de000000-0000-4000-8000-000000000003', 1, 0, 'text',  'Was du am Abend besser lässt', null, 240),
  ('de000000-0000-4000-8000-000000000302', 'de000000-0000-4000-8000-000000000003', 2, 1, 'audio', '4 · 7 · 8 im Liegen', 'Gesprochene Anleitung für den Abend.', 600),
  ('de000000-0000-4000-8000-000000000303', 'de000000-0000-4000-8000-000000000003', 3, 9, 'quiz',  'Wissensquiz', null, 300),
  -- Ruhig atmen (Einzelkauf)
  ('de000000-0000-4000-8000-000000000401', 'de000000-0000-4000-8000-000000000004', 1, 0, 'text',  'Zwerchfell, Nase und Rhythmus', null, 300),
  ('de000000-0000-4000-8000-000000000402', 'de000000-0000-4000-8000-000000000004', 2, 1, 'audio', 'Box-Atmung 4 · 4 · 4 · 4', 'Gesprochene Anleitung.', 480),
  ('de000000-0000-4000-8000-000000000403', 'de000000-0000-4000-8000-000000000004', 3, 2, 'pdf',   'Atemprotokoll für 7 Tage', 'Zum Ausdrucken oder am Tablet ausfüllen.', null),
  ('de000000-0000-4000-8000-000000000404', 'de000000-0000-4000-8000-000000000004', 4, 13, 'quiz', 'Wissensquiz', null, 300);

-- ===================================================================
-- Inhalte (course_id setzt der Trigger aus dem Block)
-- ===================================================================
insert into public.online_course_block_contents (block_id, course_id, body_md, audio_path, pdf_path) values
  ('de000000-0000-4000-8000-000000000101', 'de000000-0000-4000-8000-000000000001',
   'Warum der Atem die einzige Körperfunktion ist, die du bewusst steuern kannst.', null, null),
  ('de000000-0000-4000-8000-000000000102', 'de000000-0000-4000-8000-000000000001',
   E'Du atmest etwa 20.000 Mal am Tag, fast immer ohne darüber nachzudenken. Trotzdem kannst du jederzeit eingreifen.\n\n## Das Zwerchfell\n\nDer wichtigste Atemmuskel liegt unter der Lunge. Spannt er sich an, senkt er sich und zieht Luft hinein.\n\n## Die Nase\n\nDurch die Nase wird die Luft gewärmt, befeuchtet und gefiltert. Außerdem atmest du automatisch langsamer.\n\n## Der Rhythmus\n\nWie lange du ein- und ausatmest, ist der Hebel. Eine längere Ausatmung bringt dich Richtung Ruhe.',
   null, null),
  ('de000000-0000-4000-8000-000000000103', 'de000000-0000-4000-8000-000000000001',
   'Setz dich bequem hin und lass die Schultern sinken. Atme durch die Nase ein und zähl bis vier …',
   'de000000-0000-4000-8000-000000000001/erste-atemrunde.mp3', null),
  ('de000000-0000-4000-8000-000000000104', 'de000000-0000-4000-8000-000000000001',
   'Die wichtigsten Punkte aus dem Kurs auf einer Seite.', null,
   'de000000-0000-4000-8000-000000000001/vorteile-auf-einen-blick.pdf'),
  ('de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000002',
   E'Ruhe entsteht selten in der einen langen Übung, sondern in kurzen Pausen.\n\n**Vor dem Öffnen des Postfachs:** drei Atemzüge mit langer Ausatmung.\n\n**An jeder roten Ampel:** eine Runde Box-Atmung.\n\n**Beim Zähneputzen am Abend:** bewusst durch die Nase atmen.',
   null, null),
  ('de000000-0000-4000-8000-000000000202', 'de000000-0000-4000-8000-000000000002',
   'Eine Atempause, die in jede Lücke passt.', null, null),
  ('de000000-0000-4000-8000-000000000301', 'de000000-0000-4000-8000-000000000003',
   E'Was du in der letzten Stunde vor dem Schlafen tust, entscheidet mit, wie schnell du zur Ruhe kommst.\n\n## Bildschirm früher weg\n\nLeg das Handy eine halbe Stunde vor dem Schlafen weg und lass die Atemübung den Übergang sein.',
   null, null),
  ('de000000-0000-4000-8000-000000000302', 'de000000-0000-4000-8000-000000000003',
   'Leg dich bequem hin. Vier ein, sieben halten, acht aus …',
   'de000000-0000-4000-8000-000000000003/478-im-liegen.mp3', null),
  ('de000000-0000-4000-8000-000000000401', 'de000000-0000-4000-8000-000000000004',
   E'Der wichtigste Atemmuskel ist das Zwerchfell. Durch die Nase atmest du langsamer, und eine längere Ausatmung bringt dich Richtung Ruhe.',
   null, null),
  ('de000000-0000-4000-8000-000000000402', 'de000000-0000-4000-8000-000000000004',
   'Vier ein, vier halten, vier aus, vier halten …',
   'de000000-0000-4000-8000-000000000004/box-atmung.mp3', null),
  ('de000000-0000-4000-8000-000000000403', 'de000000-0000-4000-8000-000000000004',
   'Nach einer Woche siehst du, welche Übung dir am meisten bringt.', null,
   'de000000-0000-4000-8000-000000000004/atemprotokoll-7-tage.pdf');

commit;

-- Kontrolle: vier Kurse, fünfzehn Blöcke, elf Inhalte.
select (select count(*) from public.online_courses where slug like 'demo-%') as kurse,
       (select count(*) from public.online_course_blocks b join public.online_courses c on c.id = b.course_id where c.slug like 'demo-%') as bloecke,
       (select count(*) from public.online_course_block_contents x join public.online_courses c on c.id = x.course_id where c.slug like 'demo-%') as inhalte;
