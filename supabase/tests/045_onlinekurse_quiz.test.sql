-- supabase/tests/045_onlinekurse_quiz.test.sql
--
-- Migration 0045: Wissensquiz. Missbrauchsfaelle:
--   1. Die Loesung (is_correct) oder die Erklaerung vor der Abgabe lesen
--   2. Sich ein bestandenes Ergebnis selbst eintragen
--   3. Ohne Zugang zum Kurs abgeben
--   4. Mit unvollstaendigen oder fremden Antworten "bestehen"
--   5. Fremde Versuche sehen
begin;
select plan(17);

insert into auth.users (id, email) values
  ('a4500000-0000-0000-0000-00000000000a', 'a@example.at'),
  ('a4500000-0000-0000-0000-00000000000b', 'b@example.at');

insert into public.online_courses (id, slug, title, access, price_cents, is_published) values
  ('c4500000-0000-0000-0000-000000000001', 'frei45', 'Frei', 'account', null, true),
  ('c4500000-0000-0000-0000-000000000002', 'kauf45', 'Kauf', 'paid', 100, true);

insert into public.online_course_blocks (id, course_id, kind, title) values
  ('b4500000-0000-0000-0000-000000000001', 'c4500000-0000-0000-0000-000000000001', 'quiz', 'Quiz'),
  ('b4500000-0000-0000-0000-000000000002', 'c4500000-0000-0000-0000-000000000002', 'quiz', 'Quiz Kauf'),
  ('b4500000-0000-0000-0000-000000000003', 'c4500000-0000-0000-0000-000000000001', 'text', 'Text');

-- Fuenf Fragen, je eine richtige Antwort ('r') und eine falsche ('f').
insert into public.online_quiz_questions (id, block_id, sort_order, question, explanation)
select ('e4500000-0000-0000-0000-00000000000' || n)::uuid, 'b4500000-0000-0000-0000-000000000001', n,
       'Frage ' || n, 'Weil ' || n
  from generate_series(1, 5) n;
insert into public.online_quiz_options (id, question_id, sort_order, label, is_correct)
select ('f4500000-0000-0000-0000-0000000000' || n || '1')::uuid, ('e4500000-0000-0000-0000-00000000000' || n)::uuid, 1, 'richtig', true
  from generate_series(1, 5) n
union all
select ('f4500000-0000-0000-0000-0000000000' || n || '2')::uuid, ('e4500000-0000-0000-0000-00000000000' || n)::uuid, 2, 'falsch', false
  from generate_series(1, 5) n;

insert into public.online_quiz_questions (id, block_id, question)
values ('e4500000-0000-0000-0000-000000000009', 'b4500000-0000-0000-0000-000000000002', 'Kauf-Frage');

-- ---------- Regeln der Redaktion ----------
select throws_ok(
  $$ insert into public.online_quiz_questions (block_id, question)
     values ('b4500000-0000-0000-0000-000000000003', 'An einen Textblock') $$,
  '23514', null, 'Quizfragen nur an Quiz-Bloecke');
select throws_ok(
  $$ insert into public.online_quiz_options (question_id, label, is_correct)
     values ('e4500000-0000-0000-0000-000000000001', 'zweite richtige', true) $$,
  '23505', null, 'Genau eine richtige Antwort je Frage');

select set_config('request.jwt.claim.sub', 'a4500000-0000-0000-0000-00000000000a', true);
set local role authenticated;

-- ---------- Loesung nicht lesbar ----------
select is((select count(*)::int from public.online_quiz_options o
            join public.online_quiz_questions q on q.id = o.question_id
           where q.block_id = 'b4500000-0000-0000-0000-000000000001'), 10,
  'Mit Zugang sind Fragen und Antworten lesbar');
select throws_ok($$ select is_correct from public.online_quiz_options $$,
  '42501', null, 'is_correct ist nicht lesbar');
select throws_ok($$ select explanation from public.online_quiz_questions $$,
  '42501', null, 'Die Erklaerung ist vor der Abgabe nicht lesbar');
select is((select count(*)::int from public.online_quiz_questions
           where block_id = 'b4500000-0000-0000-0000-000000000002'), 0,
  'Fragen eines Kurses ohne Zugang sind unsichtbar');

-- ---------- Selbst eintragen ----------
select throws_ok(
  $$ insert into public.quiz_attempts (user_id, course_id, block_id, answers, score, total, passed)
     values ('a4500000-0000-0000-0000-00000000000a', 'c4500000-0000-0000-0000-000000000001',
             'b4500000-0000-0000-0000-000000000001', '{}', 5, 5, true) $$,
  '42501', null, 'Niemand traegt sich ein bestandenes Ergebnis selbst ein');

-- ---------- Abgaben ----------
select throws_ok(
  $$ select public.submit_quiz('b4500000-0000-0000-0000-000000000001',
       '{"e4500000-0000-0000-0000-000000000001": "f4500000-0000-0000-0000-000000000011"}'::jsonb) $$,
  '22023', null, 'Unvollstaendige Antworten werden abgewiesen');

select throws_ok(
  $$ select public.submit_quiz('b4500000-0000-0000-0000-000000000001', jsonb_build_object(
       'e4500000-0000-0000-0000-000000000001', 'f4500000-0000-0000-0000-000000000021',
       'e4500000-0000-0000-0000-000000000002', 'f4500000-0000-0000-0000-000000000021',
       'e4500000-0000-0000-0000-000000000003', 'f4500000-0000-0000-0000-000000000031',
       'e4500000-0000-0000-0000-000000000004', 'f4500000-0000-0000-0000-000000000041',
       'e4500000-0000-0000-0000-000000000005', 'f4500000-0000-0000-0000-000000000051')) $$,
  '22023', null, 'Eine Antwort einer anderen Frage zaehlt nicht');

select throws_ok(
  $$ select public.submit_quiz('b4500000-0000-0000-0000-000000000002',
       '{"e4500000-0000-0000-0000-000000000009": "f4500000-0000-0000-0000-000000000011"}'::jsonb) $$,
  '42501', null, 'Ohne Zugang zum Kurs keine Abgabe');

-- 3 von 5 = 60 %: nicht bestanden.
select is(
  (public.submit_quiz('b4500000-0000-0000-0000-000000000001', jsonb_build_object(
     'e4500000-0000-0000-0000-000000000001', 'f4500000-0000-0000-0000-000000000011',
     'e4500000-0000-0000-0000-000000000002', 'f4500000-0000-0000-0000-000000000021',
     'e4500000-0000-0000-0000-000000000003', 'f4500000-0000-0000-0000-000000000031',
     'e4500000-0000-0000-0000-000000000004', 'f4500000-0000-0000-0000-000000000042',
     'e4500000-0000-0000-0000-000000000005', 'f4500000-0000-0000-0000-000000000052')) ->> 'passed'),
  'false', '3 von 5 (60 %) reicht nicht');
select is((select count(*)::int from public.course_progress
            where block_id = 'b4500000-0000-0000-0000-000000000001'), 0,
  'Ein nicht bestandenes Quiz gilt nicht als erledigt');

-- 4 von 5 = 80 %: bestanden, mit Erklaerung danach.
create temp table res as
select public.submit_quiz('b4500000-0000-0000-0000-000000000001', jsonb_build_object(
     'e4500000-0000-0000-0000-000000000001', 'f4500000-0000-0000-0000-000000000011',
     'e4500000-0000-0000-0000-000000000002', 'f4500000-0000-0000-0000-000000000021',
     'e4500000-0000-0000-0000-000000000003', 'f4500000-0000-0000-0000-000000000031',
     'e4500000-0000-0000-0000-000000000004', 'f4500000-0000-0000-0000-000000000041',
     'e4500000-0000-0000-0000-000000000005', 'f4500000-0000-0000-0000-000000000052')) as r;
select is((select r ->> 'passed' from res), 'true', '4 von 5 (80 %) besteht');
select is((select r -> 'results' -> 0 ->> 'explanation' from res), 'Weil 1',
  'Nach der Abgabe gibt es die Erklaerung');
select is((select count(*)::int from public.course_progress
            where block_id = 'b4500000-0000-0000-0000-000000000001'), 1,
  'Ein bestandenes Quiz gilt als erledigt');
select is((select count(*)::int from public.quiz_attempts), 2,
  'Beide eigenen Versuche sind sichtbar');
reset role;

select set_config('request.jwt.claim.sub', 'a4500000-0000-0000-0000-00000000000b', true);
set local role authenticated;
select is((select count(*)::int from public.quiz_attempts), 0, 'Fremde Versuche sind unsichtbar');
reset role;

select * from finish();
rollback;
