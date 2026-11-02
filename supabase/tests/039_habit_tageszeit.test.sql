-- supabase/tests/039_habit_tageszeit.test.sql
--
-- Tageszeit an der Habit-Vorlage (Migration 0039). Missbrauchsfaelle zuerst
-- (CLAUDE.md):
--
--   1. Ein unbekannter Wert - auch von der Redaktion
--   2. Ein Nutzer setzt die Tageszeit an einem eigenen Habit (keine Spaltenrechte)
--   3. Ein Nutzer setzt sie an einer Vorlage der Redaktion
-- Dann der Normalfall: alle drei Werte und NULL; anonym lesbar.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('a3900000-0000-0000-0000-000000000001', 'tageszeit@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a3900000-0000-0000-0000-000000000001';
reset role;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a3900000-cccc-0000-0000-000000000001', 'test-039', 'Test', 30, 150, 500, true);

-- Eigene Habits verlangen Plus und die Einwilligung (0025).
insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
select 'health_data', 1, 'de', 'x', 'x', now()
 where not exists (select 1 from public.consent_definitions where kind = 'health_data' and published_at is not null);
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a3900000-0000-0000-0000-000000000001', d.id, 'health_data', now()
  from public.consent_definitions d
 where d.kind = 'health_data' and d.published_at is not null;

insert into public.habit_templates (id, slug, category_id, title, tracking_type, points, is_published) values
  ('a3900000-eeee-0000-0000-000000000001', 'test-039-redaktion', 'a3900000-cccc-0000-0000-000000000001', 'Redaktion', 'done', 4, true);

-- ============================================================
-- 1. Nur die drei Tageszeiten
-- ============================================================
select throws_ok(
  $$ update public.habit_templates set day_part = 'nachts'
      where id = 'a3900000-eeee-0000-0000-000000000001' $$,
  '23514', null,
  'Eine unbekannte Tageszeit lehnt die Datenbank ab - auch fuer die Redaktion');

-- ============================================================
-- 2./3. Nutzer haben keine Schreibrechte auf die Spalte
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3900000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type, day_part)
     values ('a3900000-0000-0000-0000-000000000001', 'a3900000-cccc-0000-0000-000000000001',
             'Eigenes', 'done', 'morgens') $$,
  '42501', null,
  'Ein Nutzer kann die Tageszeit beim Anlegen nicht nennen');

select lives_ok(
  $$ insert into public.habit_templates (id, owner_id, category_id, title, tracking_type)
     values ('a3900000-eeee-0000-0000-000000000002', 'a3900000-0000-0000-0000-000000000001',
             'a3900000-cccc-0000-0000-000000000001', 'Eigenes', 'done') $$,
  'Ein eigenes Habit entsteht weiter ohne Tageszeit');

select throws_ok(
  $$ update public.habit_templates set day_part = 'abends'
      where id = 'a3900000-eeee-0000-0000-000000000002' $$,
  '42501', null,
  'Auch am eigenen Habit kann ein Nutzer die Tageszeit nicht aendern');

select throws_ok(
  $$ update public.habit_templates set day_part = 'abends'
      where id = 'a3900000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'An einer Vorlage der Redaktion erst recht nicht');

reset role;

-- ============================================================
-- Normalfall
-- ============================================================
select lives_ok(
  $$ update public.habit_templates set day_part = 'morgens'
      where id = 'a3900000-eeee-0000-0000-000000000001' $$,
  'Die Redaktion setzt eine Tageszeit');

select lives_ok(
  $$ update public.habit_templates set day_part = null
      where id = 'a3900000-eeee-0000-0000-000000000001' $$,
  'NULL bleibt erlaubt und heisst "irgendwann am Tag"');

set local role anon;
select is(
  (select count(*)::int from public.habit_templates
    where id = 'a3900000-eeee-0000-0000-000000000001' and day_part is null),
  1,
  'Die Spalte ist mit der Vorlage lesbar');
reset role;

select * from finish();
rollback;
