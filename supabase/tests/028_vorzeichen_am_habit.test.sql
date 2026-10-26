-- supabase/tests/028_vorzeichen_am_habit.test.sql
--
-- Migration 0028: das Vorzeichen haengt am Habit. Missbrauchsfall: die
-- Wirkung einer Vorlage der Redaktion umdrehen (aus einem Abzug einen
-- Gewinn machen) oder sie am eigenen Habit ohne Plus aendern.
begin;
select plan(7);

select has_column('public', 'habit_templates', 'is_negative', 'habit_templates hat is_negative');

select col_default_is('public', 'habit_templates', 'is_negative', 'false',
  'Ohne Angabe ist ein Habit positiv - vorhandene Habits aendern sich nicht');

insert into auth.users (id, email) values
  ('a2800000-0000-0000-0000-000000000001', 'vorzeichen@example.at');
set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a2800000-0000-0000-0000-000000000001';
reset role;
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a2800000-0000-0000-0000-000000000001', id, 'health_data', now()
  from public.consent_definitions where kind = 'health_data' and version = 3;

-- Eine Vorlage der Redaktion, die abzieht - angelegt wie im Studio.
insert into public.habit_templates (id, slug, category_id, title, tracking_type, points, is_negative, is_published)
select 'a2800000-dddd-0000-0000-000000000001', 'test-028-abzug', id, 'Test-Abzug', 'done', 6, true, true
  from public.habit_categories where slug = 'schlaf';

create temporary table ids (name text, id uuid);
insert into ids select 'schlaf', id from public.habit_categories where slug = 'schlaf';
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2800000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into public.habit_templates (id, owner_id, category_id, title, tracking_type, points, is_negative)
     select 'a2800000-eeee-0000-0000-000000000001', 'a2800000-0000-0000-0000-000000000001',
            id, 'Nach Mitternacht am Handy', 'done', 4, true
       from ids where name = 'schlaf' $$,
  'Ein eigenes Habit darf abziehen');

select is(
  (select is_negative from public.habit_templates where id = 'a2800000-eeee-0000-0000-000000000001'),
  true,
  'und bleibt dabei negativ');

-- Missbrauchsfall 1: die Vorlage der Redaktion zum Gewinn umdrehen.
select results_eq(
  $$ with u as (update public.habit_templates set is_negative = false
                 where id = 'a2800000-dddd-0000-0000-000000000001' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'Die Wirkung einer Vorlage der Redaktion bleibt unberuehrt');

select set_config('request.jwt.claim.sub', null, true);
reset role;

select is(
  (select is_negative from public.habit_templates where id = 'a2800000-dddd-0000-0000-000000000001'),
  true,
  'Die Vorlage zieht weiter ab');

-- Missbrauchsfall 2: ohne Plus die Wirkung des eigenen Habits umdrehen.
set local role service_role;
update public.profiles set has_active_subscription = false
 where id = 'a2800000-0000-0000-0000-000000000001';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2800000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ update public.habit_templates set is_negative = false
      where id = 'a2800000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'Ohne Plus laesst sich die Wirkung nicht aendern');

select * from finish();
rollback;
