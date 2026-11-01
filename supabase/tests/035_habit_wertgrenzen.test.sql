-- supabase/tests/035_habit_wertgrenzen.test.sql
--
-- Wertgrenzen fuer Zahlen-Habits (Migration 0035). Missbrauchsfaelle zuerst
-- (CLAUDE.md):
--
--   1. Grenzen an einem Gesundheits-Messwert (BOLT) setzen - auch als Redaktion
--   2. Grenzen an einem "erledigt"- oder Abzugs-Habit
--   3. Grenzen in falscher Reihenfolge
--   4. Ein eigenes Habit zum Gesundheits-Messwert machen oder mehr als 10
--      Punkte abziehen lassen
--   5. Grenzen ohne Plus aendern - Loeschen muss bleiben
-- Dann der Normalfall: eigenes Habit mit Grenzen, Schlafdauer der Redaktion.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('a3500000-0000-0000-0000-000000000001', 'plus@example.at'),
  ('a3500000-0000-0000-0000-000000000002', 'ohne-plus@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a3500000-0000-0000-0000-000000000001';
reset role;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a3500000-cccc-0000-0000-000000000001', 'test-035', 'Test', 30, 150, 500, true);

insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
select 'health_data', 1, 'de', 'x', 'x', now()
 where not exists (select 1 from public.consent_definitions where kind = 'health_data' and published_at is not null);
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select u, d.id, 'health_data', now()
  from public.consent_definitions d,
       unnest(array['a3500000-0000-0000-0000-000000000001'::uuid,
                    'a3500000-0000-0000-0000-000000000002'::uuid]) u
 where d.kind = 'health_data' and d.published_at is not null;

-- Vorlagen der Redaktion: ein BOLT-Wert, ein Messwert, ein "erledigt", ein Abzug
-- Den BOLT-Wert gibt es lokal womoeglich schon (docs/inhalte); dann zaehlt
-- der vorhandene, mit zurueckgesetztem Messwert-Kennzeichen.
insert into public.habit_templates (id, slug, category_id, title, tracking_type, unit, points, is_published)
select 'a3500000-eeee-0000-0000-000000000001', 'bolt-wert', 'a3500000-cccc-0000-0000-000000000001', 'BOLT', 'number', 's', 10, true
 where not exists (select 1 from public.habit_templates where slug = 'bolt-wert');
update public.habit_templates set is_health_measure = false where slug = 'bolt-wert';

insert into public.habit_templates (id, slug, category_id, title, tracking_type, unit, points, is_published, is_health_measure, is_negative) values
  ('a3500000-eeee-0000-0000-000000000002', 'test-035-messwert', 'a3500000-cccc-0000-0000-000000000001', 'Messwert', 'number', 'x', 4, true, true, false),
  ('a3500000-eeee-0000-0000-000000000003', 'test-035-erledigt', 'a3500000-cccc-0000-0000-000000000001', 'Erledigt', 'done', null, 4, true, false, false),
  ('a3500000-eeee-0000-0000-000000000004', 'test-035-abzug', 'a3500000-cccc-0000-0000-000000000001', 'Abzug', 'number', 'h', 4, true, false, true),
  ('a3500000-eeee-0000-0000-000000000005', 'test-035-schlaf', 'a3500000-cccc-0000-0000-000000000001', 'Schlaf', 'number', 'h', 8, true, false, false);

-- ============================================================
-- 1.-3. Die Datenbank sperrt unzulaessige Grenzen - auch fuer die Redaktion
-- ============================================================
select throws_ok(
  $$ update public.habit_templates set points_from = 30 where slug = 'bolt-wert' $$,
  '23514', null,
  'Der BOLT-Wert bekommt nie Wertgrenzen (SAD §5.7), selbst ohne Messwert-Kennzeichen');

select throws_ok(
  $$ update public.habit_templates set penalty_from = 3, penalty_points = 4
      where id = 'a3500000-eeee-0000-0000-000000000002' $$,
  '23514', null,
  'Ein Gesundheits-Messwert bekommt keine Grenzen');

select throws_ok(
  $$ update public.habit_templates set points_from = 1 where id = 'a3500000-eeee-0000-0000-000000000003' $$,
  '23514', null,
  'Ein "erledigt"-Habit hat keine Wertgrenzen');

select throws_ok(
  $$ update public.habit_templates set points_from = 1 where id = 'a3500000-eeee-0000-0000-000000000004' $$,
  '23514', null,
  'Ein Abzugs-Habit hat keine Wertgrenzen - das Vorzeichen traegt schon das Habit');

select throws_ok(
  $$ update public.habit_templates set points_from = 6, penalty_from = 7, penalty_points = 8
      where id = 'a3500000-eeee-0000-0000-000000000005' $$,
  '23514', null,
  'Die Minus-Grenze liegt nicht ueber der Plus-Grenze, wenn mehr besser ist');

select throws_ok(
  $$ update public.habit_templates set penalty_from = 6 where id = 'a3500000-eeee-0000-0000-000000000005' $$,
  '23514', null,
  'Eine Minus-Grenze ohne Minuspunkte gibt es nicht');

select lives_ok(
  $$ update public.habit_templates set points_from = 7, penalty_from = 6, penalty_points = 8
      where id = 'a3500000-eeee-0000-0000-000000000005' $$,
  'Schlafdauer: Plus ab 7, Minus unter 6 - so lassen sich die Grenzen setzen');

-- ============================================================
-- 4. Eigene Habits
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3500000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type, unit, points, points_from, penalty_from, penalty_points)
     values ('a3500000-0000-0000-0000-000000000001', 'a3500000-cccc-0000-0000-000000000001',
             'Zu viel Abzug', 'number', 'h', 5, 7, 6, 50) $$,
  '23514', null,
  'Ein eigenes Habit zieht hoechstens 10 Punkte ab');

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type, is_health_measure)
     values ('a3500000-0000-0000-0000-000000000001', 'a3500000-cccc-0000-0000-000000000001',
             'Messwert', 'number', true) $$,
  '42501', null,
  'is_health_measure kann der Client gar nicht nennen');

select lives_ok(
  $$ insert into public.habit_templates (id, owner_id, category_id, title, tracking_type, unit, points, points_from, penalty_from, penalty_points)
     values ('a3500000-eeee-0000-0000-000000000010', 'a3500000-0000-0000-0000-000000000001',
             'a3500000-cccc-0000-0000-000000000001', 'Schritte', 'number', 'Schritte', 6, 8000, 4000, 4) $$,
  'Mit Plus: eigenes Zahlen-Habit mit Grenzen');

select results_eq(
  $$ select points_from, penalty_from, penalty_points, is_health_measure
       from public.habit_templates where id = 'a3500000-eeee-0000-0000-000000000010' $$,
  $$ values (8000::numeric, 4000::numeric, 4, false) $$,
  'Die Grenzen stehen so, wie sie gesetzt wurden');

-- ============================================================
-- 5. Nach Abo-Ende: Grenzen aendern nicht, loeschen schon
-- ============================================================
reset role;
set local role service_role;
update public.profiles set has_active_subscription = false
 where id = 'a3500000-0000-0000-0000-000000000001';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3500000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ update public.habit_templates set points_from = 10000
      where id = 'a3500000-eeee-0000-0000-000000000010' $$,
  '42501', null,
  'Ohne Plus lassen sich die Grenzen nicht aendern');

select lives_ok(
  $$ update public.habit_templates set deleted_at = now()
      where id = 'a3500000-eeee-0000-0000-000000000010' $$,
  'Loeschen geht weiter');

select * from finish();
rollback;
