-- supabase/tests/048_co2_toleranz.test.sql
--
-- Migration 0048. Missbrauchsfaelle zuerst (CLAUDE.md):
--
--   1. Die CO2-Sessions ohne Plus lesen
--   2. An einer eigenen Sequenz einen Einstieg setzen oder den Pfad verbiegen
--   3. An einem Habit selbst die kleinen Punkte setzen
--   4. Am BOLT-Wert oder CO2 Walk Wertgrenzen setzen
--   5. Ohne Admin-Rolle in den Bucket session-audio hochladen oder auflisten
-- Dann der Normalfall: Werte, Uebungsweg, zurueckgezogene Habits.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('a4800000-0000-0000-0000-000000000001', 'plus48@example.at'),
  ('a4800000-0000-0000-0000-000000000002', 'ohne48@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a4800000-0000-0000-0000-000000000001';
reset role;

insert into public.exercises (id, owner_id, type, title, default_round_count, is_published)
values ('a4800000-eeee-0000-0000-000000000001', 'a4800000-0000-0000-0000-000000000001', 'paced', 'Eigene', 1, false);

-- Eine frische Datenbank kennt diese Inhalte nicht: seed.sql ersetzt den
-- redaktionellen Bestand an Sessions, und die Kategorie Atmung kommt erst nach
-- den Migrationen. Staging und Live bekommen keinen Seed.
insert into public.exercises (slug, type, visibility, title, default_round_count, is_published)
select 'co2-halten-expert', 'paced', 'plus', 'CO2 Toleranz Halten', 1, true
 where not exists (select 1 from public.exercises where slug = 'co2-halten-expert');
insert into public.habit_templates (slug, category_id, title, tracking_type, is_health_measure, is_published)
select 'co2-walk', c.id, 'CO2 Walk', 'number', true, true
  from public.habit_categories c
 where c.slug = 'bewegung'
   and not exists (select 1 from public.habit_templates where slug = 'co2-walk');

-- 1. Lesen nach Stufe
set local role anon;
select is((select count(*)::int from public.exercises where slug like 'co2-ausatmung-%' or slug like 'co2-halten-%'), 0,
  'Gaeste sehen die CO2-Sessions nicht');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a4800000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.exercises where slug like 'co2-ausatmung-%' or slug like 'co2-halten-%'), 0,
  'Ohne Plus sind die CO2-Sessions nicht lesbar');
select is((select count(*)::int from public.exercise_steps s join public.exercises e on e.id = s.exercise_id where e.slug = 'co2-halten-expert'), 0,
  'Ohne Plus auch keine Bloecke');

-- 2. Eigene Sequenz
set local request.jwt.claims = '{"sub":"a4800000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.exercises where slug = 'co2-halten-expert'), 1,
  'Mit Plus ist die Session lesbar');
select throws_ok(
  $$ update public.exercises set intro_audio_path = 'einstieg.mp3' where id = 'a4800000-eeee-0000-0000-000000000001' $$,
  '23514', null, 'Eine eigene Sequenz bekommt keinen Einstieg');
reset role;
select throws_ok(
  $$ update public.exercises set outro_audio_path = '../geheim.mp3' where slug = 'co2-halten-expert' $$,
  '23514', null, 'Kein Pfad aus dem Ordner heraus');
select lives_ok(
  $$ update public.exercises set intro_audio_path = 'einstieg/ankommen.mp3', outro_audio_path = 'ausklang/ruhe.mp3' where slug = 'co2-halten-expert' $$,
  'Die Redaktion setzt Einstieg und Ausklang');

-- 3. Kleine Punkte nur Redaktion
set local role authenticated;
set local request.jwt.claims = '{"sub":"a4800000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ update public.habit_templates set partial_points = 5 where slug = 'schlafdauer' $$,
  '42501', null, 'Kein Schreibrecht auf die kleinen Punkte');
reset role;

-- 4. Sperre fuer Messwerte, falsche Stufe
select throws_ok(
  $$ update public.habit_templates set points_from = 40 where slug = 'co2-walk' $$,
  '23514', null, 'Der CO2 Walk bekommt keine Wertgrenzen');
select throws_ok(
  $$ update public.habit_templates set partial_points = 9 where slug = 'schlafdauer' $$,
  '23514', null, 'Kleine Punkte nie ueber den vollen Punkten');
select throws_ok(
  $$ update public.habit_templates set partial_points = 1 where slug = 'atmen-zum-einschlafen' $$,
  '23514', null, 'Kleine Punkte nur mit Grenzen');

-- 5. Bucket
set local role authenticated;
set local request.jwt.claims = '{"sub":"a4800000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('session-audio', 'boese.mp3') $$,
  '42501', null, 'Ohne Admin-Rolle kein Upload');
select is((select count(*)::int from storage.objects where bucket_id = 'session-audio'), 0,
  'Ohne Admin-Rolle kein Auflisten');
reset role;

-- Normalfall
select results_eq(
  $$ select points, partial_points, points_from::int, penalty_from::int, penalty_points
       from public.habit_templates where slug = 'schlafdauer' $$,
  $$ values (8, 4, 7, 6, 8) $$, 'Schlafdauer in drei Stufen');
select results_eq(
  $$ select points, partial_points, points_from::int, penalty_from::int, penalty_points
       from public.habit_templates where slug = 'schlafqualitaet-wearable' $$,
  $$ values (6, 3, 75, 65, 6) $$, 'Schlafwert in drei Stufen');
select results_eq(
  $$ select points, points_from::int, penalty_from::int, penalty_points
       from public.habit_templates where slug = 'schritte' $$,
  $$ values (6, 5000, 3000, 4) $$, 'Schritte mit neutraler Zone');
select is(
  (select count(*)::int from public.habit_templates
    where slug in ('selbst-gekocht', 'unter-4000-schritte') and is_published),
  0, 'Selbst gekocht und Unter 4.000 sind zurueckgezogen');
select * from finish();
rollback;
