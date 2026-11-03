-- supabase/tests/046_onlinekurse_zertifikat.test.sql
--
-- Migration 0046: Zertifikat. Missbrauchsfaelle:
--   1. Ein Zertifikat ausstellen, ohne alle Inhalte erledigt zu haben
--   2. ... oder ohne bestandenes Quiz
--   3. Sich ein Zertifikat selbst eintragen oder den Namen nachtraeglich aendern
--   4. Fremde Zertifikate sehen
--   5. Ueber die Pruefung mehr erfahren als Name, Kurs und Datum
begin;
select plan(12);

insert into auth.users (id, email) values
  ('a4600000-0000-0000-0000-00000000000a', 'a@example.at'),
  ('a4600000-0000-0000-0000-00000000000b', 'b@example.at');

insert into public.online_courses (id, slug, title, access, price_cents, is_published) values
  ('c4600000-0000-0000-0000-000000000001', 'zert46', 'Zertifikatskurs', 'account', null, true);
insert into public.online_course_blocks (id, course_id, kind, title, sort_order) values
  ('b4600000-0000-0000-0000-000000000001', 'c4600000-0000-0000-0000-000000000001', 'text', 'Text', 1),
  ('b4600000-0000-0000-0000-000000000002', 'c4600000-0000-0000-0000-000000000001', 'quiz', 'Quiz', 2);
insert into public.online_quiz_questions (id, block_id, question)
values ('e4600000-0000-0000-0000-000000000001', 'b4600000-0000-0000-0000-000000000002', 'Frage');
insert into public.online_quiz_options (id, question_id, label, is_correct) values
  ('f4600000-0000-0000-0000-000000000001', 'e4600000-0000-0000-0000-000000000001', 'richtig', true),
  ('f4600000-0000-0000-0000-000000000002', 'e4600000-0000-0000-0000-000000000001', 'falsch', false);

select set_config('request.jwt.claim.sub', 'a4600000-0000-0000-0000-00000000000a', true);
set local role authenticated;

-- Nichts erledigt.
select throws_ok(
  $$ select public.issue_certificate('c4600000-0000-0000-0000-000000000001', 'Anna Beispiel') $$,
  '42501', null, 'Ohne erledigte Inhalte kein Zertifikat');

-- Quiz bestanden, Text noch offen.
select public.submit_quiz('b4600000-0000-0000-0000-000000000002',
  '{"e4600000-0000-0000-0000-000000000001": "f4600000-0000-0000-0000-000000000001"}'::jsonb);
select throws_ok(
  $$ select public.issue_certificate('c4600000-0000-0000-0000-000000000001', 'Anna Beispiel') $$,
  '42501', null, 'Mit bestandenem Quiz, aber offenem Inhalt kein Zertifikat');

-- Text erledigt, Quiz-Haken entfernt (Zuruecknehmen ist erlaubt): wieder nicht.
insert into public.course_progress (user_id, course_id, block_id)
values ('a4600000-0000-0000-0000-00000000000a', 'c4600000-0000-0000-0000-000000000001',
        'b4600000-0000-0000-0000-000000000001');
delete from public.course_progress where block_id = 'b4600000-0000-0000-0000-000000000002';
select throws_ok(
  $$ select public.issue_certificate('c4600000-0000-0000-0000-000000000001', 'Anna Beispiel') $$,
  '42501', null, 'Mit erledigten Inhalten, aber ohne bestandenes Quiz kein Zertifikat');

select throws_ok(
  $$ insert into public.certificates (user_id, course_id, code, full_name, score, total)
     values ('a4600000-0000-0000-0000-00000000000a', 'c4600000-0000-0000-0000-000000000001',
             'AC-0000-0000', 'Anna', 1, 1) $$,
  '42501', null, 'Niemand traegt sich ein Zertifikat selbst ein');

-- Quiz erneut bestanden: jetzt geht es.
select public.submit_quiz('b4600000-0000-0000-0000-000000000002',
  '{"e4600000-0000-0000-0000-000000000001": "f4600000-0000-0000-0000-000000000001"}'::jsonb);

select throws_ok(
  $$ select public.issue_certificate('c4600000-0000-0000-0000-000000000001', ' ') $$,
  '22023', null, 'Ohne Namen kein Zertifikat');

create temp table cert as
select * from public.issue_certificate('c4600000-0000-0000-0000-000000000001', '  Anna Beispiel ');
select is((select full_name from cert), 'Anna Beispiel', 'Ausgestellt, mit bereinigtem Namen');
select ok((select code ~ '^AC-[0-9A-F]{4}-[0-9A-F]{4}$' from cert), 'mit Pruefcode');
select is((select full_name from public.issue_certificate('c4600000-0000-0000-0000-000000000001', 'Jemand anderes')),
  'Anna Beispiel', 'Ein zweites Ausstellen liefert dasselbe Zertifikat, der Name bleibt');

select throws_ok(
  $$ update public.certificates set full_name = 'Max Mustermann' $$,
  '42501', null, 'Der Name laesst sich nicht nachtraeglich aendern');
reset role;

select set_config('request.jwt.claim.sub', 'a4600000-0000-0000-0000-00000000000b', true);
set local role authenticated;
select is((select count(*)::int from public.certificates), 0, 'Fremde Zertifikate sind unsichtbar');
reset role;

-- Den Code aus der Testtabelle darf auch anon lesen (nur fuer den Test).
grant select on cert to anon;
set local role anon;
select is(
  (select row(full_name, course_title)::text from public.verify_certificate(lower((select code from cert)))),
  '("Anna Beispiel",Zertifikatskurs)',
  'Die Pruefung zeigt Name und Kurs, auch bei kleingeschriebenem Code');
select is((select count(*)::int from public.verify_certificate('AC-FFFF-FFFF')), 0,
  'Ein unbekannter Code verraet nichts');
reset role;

select * from finish();
rollback;
