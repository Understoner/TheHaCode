-- supabase/tests/024_eigene_habits_und_favoriten.test.sql
--
-- Eigene Habits und Habit-Favoriten (Migration 0024). Je Policy der
-- Missbrauchsfall (CLAUDE.md):
--
--   1. Ohne Plus ein eigenes Habit anlegen
--   2. Sich beim Anlegen Punkte, Vorschau oder eine fremde Identitaet geben
--   3. Das eigene Habit einer anderen Person sehen, waehlen, aendern
--   4. Nach Abo-Ende bearbeiten - Loeschen muss bleiben
--   5. Loeschen nimmt das Habit aus dem Tagebuch, die Eintraege bleiben
--   6. Fremde Favoriten lesen oder fuer andere anlegen
--   7. Kontoloeschung trotz gewaehltem eigenem Habit
begin;
select plan(24);

insert into auth.users (id, email) values
  ('a2400000-0000-0000-0000-000000000001', 'ohne-plus@example.at'),
  ('a2400000-0000-0000-0000-000000000002', 'mit-plus@example.at'),
  ('a2400000-0000-0000-0000-000000000003', 'fremd@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true
 where id in ('a2400000-0000-0000-0000-000000000002', 'a2400000-0000-0000-0000-000000000003');
reset role;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a2400000-cccc-0000-0000-000000000001', 'test-024', 'Test', 30, 150, 500, true);

insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
select 'health_data', 1, 'de', 'x', 'x', now()
 where not exists (select 1 from public.consent_definitions where kind = 'health_data' and published_at is not null);
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select u, d.id, 'health_data', now()
  from public.consent_definitions d,
       unnest(array['a2400000-0000-0000-0000-000000000002'::uuid]) u
 where d.kind = 'health_data' and d.published_at is not null
 limit 1;

-- ============================================================
-- 1. Ohne Plus
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2400000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type)
     values ('a2400000-0000-0000-0000-000000000001', 'a2400000-cccc-0000-0000-000000000001',
             'Ohne Plus', 'done') $$,
  '42501', null,
  'Ohne Plus kein eigenes Habit');

-- ============================================================
-- 2. Mit Plus: was der Client nicht bestimmen darf
-- ============================================================
select set_config('request.jwt.claim.sub', 'a2400000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ insert into public.habit_templates
       (id, owner_id, category_id, title, tracking_type, unit, min_value, max_value)
     values ('a2400000-eeee-0000-0000-000000000001', 'a2400000-0000-0000-0000-000000000002',
             'a2400000-cccc-0000-0000-000000000001', '  Kalt duschen  ', 'number', 'Minuten', 0, 30) $$,
  'Mit Plus entsteht ein eigenes Habit');

select results_eq(
  $$ select points, is_preview, is_published, title, slug
       from public.habit_templates where id = 'a2400000-eeee-0000-0000-000000000001' $$,
  $$ values (0, false, true, 'Kalt duschen', 'eigen-a2400000-eeee-0000-0000-000000000001') $$,
  'Null Punkte, keine Vorschau, veroeffentlicht, Titel getrimmt, Slug vom Server');

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type, points)
     values ('a2400000-0000-0000-0000-000000000002', 'a2400000-cccc-0000-0000-000000000001',
             'Punkte', 'done', 100) $$,
  '42501', null,
  'Punkte kann der Client gar nicht erst nennen');

select throws_ok(
  $$ update public.habit_templates set points = 100
      where id = 'a2400000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'und auch nicht nachtraeglich setzen');

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type)
     values ('a2400000-0000-0000-0000-000000000003', 'a2400000-cccc-0000-0000-000000000001',
             'Untergeschoben', 'done') $$,
  '42501', null,
  'Ein Habit im Namen einer anderen Person anlegen geht nicht');

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type)
     values ('a2400000-0000-0000-0000-000000000002', 'a2400000-cccc-0000-0000-000000000001',
             'Smiley', 'smiley_5') $$,
  '23514', null,
  'Eigene Habits sind "erledigt" oder "Zahl"');

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type)
     values ('a2400000-0000-0000-0000-000000000002', 'a2400000-cccc-0000-0000-000000000001',
             '   ', 'done') $$,
  '23514', null,
  'Ein leerer Titel wird abgelehnt');

select throws_ok(
  $$ update public.habit_templates set tracking_type = 'done'
      where id = 'a2400000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'Die Art des Eintrags ist nicht aenderbar');

select lives_ok(
  $$ insert into public.user_habits (user_id, template_id)
     values ('a2400000-0000-0000-0000-000000000002', 'a2400000-eeee-0000-0000-000000000001') $$,
  'Das eigene Habit laesst sich ins Tagebuch aufnehmen');

select lives_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     select 'a2400000-0000-0000-0000-000000000002', id, current_date, 5
       from public.user_habits where template_id = 'a2400000-eeee-0000-0000-000000000001' $$,
  'und eintragen');

-- ============================================================
-- 3. Eine andere Person
-- ============================================================
select set_config('request.jwt.claim.sub', 'a2400000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::int from public.habit_templates where id = 'a2400000-eeee-0000-0000-000000000001'),
  0,
  'Ein fremdes eigenes Habit ist unsichtbar');

select throws_ok(
  $$ insert into public.user_habits (user_id, template_id)
     values ('a2400000-0000-0000-0000-000000000003', 'a2400000-eeee-0000-0000-000000000001') $$,
  '42501', null,
  'und laesst sich auch ueber seine ID nicht waehlen - trotz Plus');

select results_eq(
  $$ with u as (update public.habit_templates set title = 'Gekapert'
                 where id = 'a2400000-eeee-0000-0000-000000000001' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'Ein fremdes Habit laesst sich nicht umbenennen');

select throws_ok(
  $$ insert into public.habit_favorites (user_id, template_id)
     values ('a2400000-0000-0000-0000-000000000003', 'a2400000-eeee-0000-0000-000000000001') $$,
  '42501', null,
  'und nicht als Favorit markieren');

-- ============================================================
-- 6. Favoriten
-- ============================================================
select set_config('request.jwt.claim.sub', 'a2400000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ insert into public.habit_favorites (user_id, template_id)
     values ('a2400000-0000-0000-0000-000000000002', 'a2400000-eeee-0000-0000-000000000001') $$,
  'Das eigene Habit wird Favorit');

select set_config('request.jwt.claim.sub', 'a2400000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::int from public.habit_favorites),
  0,
  'Fremde Favoriten sind unsichtbar');

select throws_ok(
  $$ insert into public.habit_favorites (user_id, template_id)
     select 'a2400000-0000-0000-0000-000000000002', id from public.habit_templates limit 1 $$,
  '42501', null,
  'Ein Favorit fuer jemand anderen geht nicht');

-- ============================================================
-- 4./5. Abo-Ende: bearbeiten nein, loeschen ja
-- ============================================================
reset role;
set local role service_role;
update public.profiles set has_active_subscription = false
 where id = 'a2400000-0000-0000-0000-000000000002';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2400000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ update public.habit_templates set title = 'Neu'
      where id = 'a2400000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'Nach Abo-Ende ist Bearbeiten gesperrt');

select lives_ok(
  $$ update public.habit_templates set deleted_at = now()
      where id = 'a2400000-eeee-0000-0000-000000000001' $$,
  'Loeschen geht auch ohne Abo');

select is(
  (select is_active from public.user_habits where template_id = 'a2400000-eeee-0000-0000-000000000001'),
  false,
  'Das geloeschte Habit ist aus dem Tagebuch genommen');

select is(
  (select count(*)::int from public.habit_logs hl
     join public.user_habits uh on uh.id = hl.user_habit_id
    where uh.template_id = 'a2400000-eeee-0000-0000-000000000001'),
  1,
  'Die Eintraege bleiben lesbar');

select throws_ok(
  $$ insert into public.user_habits (user_id, template_id)
     values ('a2400000-0000-0000-0000-000000000002', 'a2400000-eeee-0000-0000-000000000001') $$,
  '42501', null,
  'Ein geloeschtes Habit laesst sich nicht wieder waehlen');

select set_config('request.jwt.claim.sub', null, true);
reset role;

-- ============================================================
-- 7. Kontoloeschung
-- ============================================================
-- restrict auf user_habits.template_id haette hier geknallt (siehe 0024).
select lives_ok(
  $$ delete from auth.users where id = 'a2400000-0000-0000-0000-000000000002' $$,
  'Ein Konto mit eigenem, gewaehltem Habit laesst sich loeschen');

select * from finish();
rollback;
