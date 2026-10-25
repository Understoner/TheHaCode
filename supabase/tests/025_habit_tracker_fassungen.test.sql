-- supabase/tests/025_habit_tracker_fassungen.test.sql
--
-- Migration 0025: neue Fassungen unter dem Namen Habit Tracker, und eigene
-- Habits nur mit Einwilligung. Missbrauchsfall: ein eigenes Habit - selbst
-- eine Gesundheitsangabe - ohne Einwilligung anlegen oder aendern.
begin;
select plan(9);

-- ---------- Die Fassungen, genau im freigegebenen Wortlaut ----------
select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'privacy' and version = 3 and published_at is not null),
  'e4658322f7442861e184396211de4c655bcf041653ad61a244e270996187229e',
  'Datenschutz Fassung 3 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'health_data' and version = 2 and published_at is not null),
  'f1523ac5e6ce2451b5e2bd695a382f23e591ae2074da0b9c4dd32e1de3ef577f',
  'Einwilligung Habit Tracker v2 ist veroeffentlicht, im freigegebenen Wortlaut');

select isnt(
  (select published_at from public.consent_definitions where kind = 'health_data' and version = 1),
  null,
  'v1 bleibt als Nachweis stehen');

-- ---------- Eigene Habits nur mit Einwilligung ----------
insert into auth.users (id, email) values
  ('a2500000-0000-0000-0000-000000000001', 'plus-ohne-einwilligung@example.at');
set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a2500000-0000-0000-0000-000000000001';
reset role;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a2500000-cccc-0000-0000-000000000001', 'test-025', 'Test', 30, 150, 500, true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2500000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type)
     values ('a2500000-0000-0000-0000-000000000001', 'a2500000-cccc-0000-0000-000000000001',
             'Insulin spritzen', 'done') $$,
  '42501', null,
  'Mit Plus, aber ohne Einwilligung kein eigenes Habit');

-- Einwilligen (v2, die aktuelle Fassung) - dann geht es.
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a2500000-0000-0000-0000-000000000001', id, 'health_data', now()
  from public.consent_definitions where kind = 'health_data' and version = 2;

select lives_ok(
  $$ insert into public.habit_templates (id, owner_id, category_id, title, tracking_type)
     values ('a2500000-eeee-0000-0000-000000000001', 'a2500000-0000-0000-0000-000000000001',
             'a2500000-cccc-0000-0000-000000000001', 'Insulin spritzen', 'done') $$,
  'Mit Plus und Einwilligung entsteht das Habit');

-- Widerrufen: eine neue Zeile, kein Update (0012).
insert into public.user_consents (user_id, definition_id, kind, granted_at, revoked_at)
select 'a2500000-0000-0000-0000-000000000001', id, 'health_data', null, now()
  from public.consent_definitions where kind = 'health_data' and version = 2;

select throws_ok(
  $$ update public.habit_templates set title = 'Neu'
      where id = 'a2500000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'Nach dem Widerruf ist Bearbeiten gesperrt');

select throws_ok(
  $$ insert into public.habit_templates (owner_id, category_id, title, tracking_type)
     values ('a2500000-0000-0000-0000-000000000001', 'a2500000-cccc-0000-0000-000000000001',
             'Noch eins', 'done') $$,
  '42501', null,
  'und Anlegen ebenso');

select lives_ok(
  $$ update public.habit_templates set deleted_at = now()
      where id = 'a2500000-eeee-0000-0000-000000000001' $$,
  'Loeschen geht auch nach dem Widerruf');

select is(
  (select deleted_at is not null from public.habit_templates
    where id = 'a2500000-eeee-0000-0000-000000000001'),
  true,
  'und ist wirklich geschehen');

select * from finish();
rollback;
