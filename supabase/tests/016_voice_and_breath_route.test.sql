-- supabase/tests/016_voice_and_breath_route.test.sql
--
-- Zwei kleine Ergaenzungen aus Migration 0016, und beide beruehren eine
-- Stelle, an der ein Fehler still bliebe:
--
--   1. voice_enabled steht in profiles - derselben Zeile, in der auch der
--      Zugriff steht. Eine neue Spalte darf die Entitlement-Sperre nicht
--      aufweichen und keinen Weg auf fremde Zeilen oeffnen.
--   2. route ist ein Enum. Ein Tippfehler im Studio soll scheitern, nicht
--      still eine unbekannte Angabe ablegen.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'stimme@example.at'),
  ('f0000000-0000-0000-0000-000000000002', 'fremde@example.at');

-- ---------- 1. Die Vorgabe ----------
-- Aus, nicht an: eine Ansage bei jedem Phasenwechsel ist eine Entscheidung,
-- keine Grundeinstellung. Der Ton bleibt dagegen an.
select is(
  (select voice_enabled from public.profiles where id = 'f0000000-0000-0000-0000-000000000001'),
  false,
  'Die Stimme ist bei einem neuen Konto aus');

select is(
  (select sound_enabled from public.profiles where id = 'f0000000-0000-0000-0000-000000000001'),
  true,
  'Der Ton ist bei einem neuen Konto an');

-- ---------- 2. Der Normalfall: den eigenen Schalter umlegen ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ update public.profiles set voice_enabled = true
      where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'Den eigenen Stimmschalter darf jeder umlegen');

select is(
  (select voice_enabled from public.profiles where id = 'f0000000-0000-0000-0000-000000000001'),
  true,
  'Und der Wert steht danach da');

-- ---------- Missbrauch ----------
-- Die neue Spalte darf die Entitlement-Sperre nicht aufweichen: wer seinen
-- Stimmschalter umlegen darf, darf sich damit noch lange kein Plus schalten.
select throws_ok(
  $$ update public.profiles
        set voice_enabled = false, has_active_subscription = true
      where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'P0001',
  null,
  'Der Zugriff laesst sich nicht im Windschatten des Stimmschalters mitschalten');

-- Und sie darf keinen Weg auf fremde Zeilen oeffnen. RLS laesst das UPDATE
-- nicht scheitern, es trifft schlicht keine Zeile - deshalb wird der Wert
-- geprueft und nicht die Ausnahme.
select lives_ok(
  $$ update public.profiles set voice_enabled = true
      where id = 'f0000000-0000-0000-0000-000000000002' $$,
  'Ein UPDATE auf ein fremdes Profil laeuft ins Leere, statt zu scheitern');

reset role;

select is(
  (select voice_enabled from public.profiles where id = 'f0000000-0000-0000-0000-000000000002'),
  false,
  'Und hat den fremden Schalter nicht angefasst');

-- ---------- 3. Der Atemweg ----------
-- default_round_count ist bei type = 'paced' Pflicht (chk_paced_needs_rounds).
insert into public.exercises (slug, type, title, visibility, is_published, default_round_count)
  values ('test-atemweg', 'paced', 'Testsequenz', 'free', false, 1);
insert into public.exercise_steps (exercise_id, position, repeat_count)
  select id, 1, 1 from public.exercises where slug = 'test-atemweg';

select lives_ok(
  $$ insert into public.exercise_phases (step_id, position, kind, duration_seconds, route)
     select s.id, 1, 'inhale', 4, 'nose'
       from public.exercise_steps s
       join public.exercises e on e.id = s.exercise_id
      where e.slug = 'test-atemweg' $$,
  'Nase, Mund und Lippenbremse sind gueltige Atemwege');

-- Haltephasen bekommen keinen Atemweg: dort stroemt nichts. Das ist der Grund,
-- warum die Spalte nullable ist - null heisst "kein Luftstrom", nicht
-- "unbekannt".
select lives_ok(
  $$ insert into public.exercise_phases (step_id, position, kind, duration_seconds, route)
     select s.id, 2, 'hold_in', 4, null
       from public.exercise_steps s
       join public.exercises e on e.id = s.exercise_id
      where e.slug = 'test-atemweg' $$,
  'Eine Haltephase darf ohne Atemweg dastehen');

-- Der eigentliche Grund fuer ein Enum statt eines Textfelds: die Redaktion
-- arbeitet im Studio ohne Formularvalidierung (SAD §2.4).
select throws_ok(
  $$ insert into public.exercise_phases (step_id, position, kind, duration_seconds, route)
     select s.id, 3, 'exhale', 4, 'naseee'
       from public.exercise_steps s
       join public.exercises e on e.id = s.exercise_id
      where e.slug = 'test-atemweg' $$,
  '22P02',
  null,
  'Ein vertippter Atemweg kommt gar nicht erst hinein');

select * from finish();
rollback;
