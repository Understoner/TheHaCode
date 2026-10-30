-- supabase/tests/032_habit_bereiche.test.sql
--
-- Migration 0032: Habit-Bereiche je Person. Missbrauchsfaelle: die Bereiche
-- eines fremden Kontos aendern; Unsinn statt Slugs in die Spalte schreiben.
begin;
select plan(6);

select has_column('public', 'profiles', 'habit_categories', 'profiles hat habit_categories');

insert into auth.users (id, email) values
  ('a3200000-0000-0000-0000-000000000001', 'bereiche-a@example.at'),
  ('a3200000-0000-0000-0000-000000000002', 'bereiche-b@example.at');

select is(
  (select habit_categories from public.profiles where id = 'a3200000-0000-0000-0000-000000000001'),
  array['atmung']::text[],
  'Ein neues Konto startet nur mit Atmung');

select set_config('request.jwt.claims',
  json_build_object('sub', 'a3200000-0000-0000-0000-000000000001')::text, true);
set local role authenticated;

select lives_ok(
  $$ update public.profiles set habit_categories = array['atmung', 'schlaf']
      where id = 'a3200000-0000-0000-0000-000000000001' $$,
  'Die eigenen Bereiche lassen sich aendern');

-- Missbrauchsfall 1: fremdes Konto - RLS laesst die Zeile nicht sehen.
update public.profiles set habit_categories = array['fasten']
 where id = 'a3200000-0000-0000-0000-000000000002';
reset role;
select is(
  (select habit_categories from public.profiles where id = 'a3200000-0000-0000-0000-000000000002'),
  array['atmung']::text[],
  'Die Bereiche eines fremden Kontos bleiben unveraendert');

-- Missbrauchsfall 2: Unsinn statt Slugs.
set local role authenticated;
select throws_ok(
  $$ update public.profiles set habit_categories = array['<script>']
      where id = 'a3200000-0000-0000-0000-000000000001' $$,
  '23514', null,
  'Nur Slugs werden angenommen');
select throws_ok(
  $$ update public.profiles set habit_categories = array_fill('atmung'::text, array[21])
      where id = 'a3200000-0000-0000-0000-000000000001' $$,
  '23514', null,
  'Hoechstens 20 Bereiche');
reset role;

select * from finish();
rollback;
