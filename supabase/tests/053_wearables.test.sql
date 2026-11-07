-- supabase/tests/053_wearables.test.sql
--
-- Geraete-Anbindung (Migration 0053). Je Policy und Funktion der
-- Missbrauchsfall (CLAUDE.md):
--
--   1. Fremde Verbindungen oder Tageswerte lesen
--   2. Schluessel lesen, Tageswerte oder Verbindungen selbst schreiben
--   3. save/apply/remove als angemeldete Person aufrufen (fremde Tagebuecher)
--   4. Einen eigenen Eintrag als "vom Geraet" tarnen
--   5. Ohne Verbindung, ohne Einwilligung oder ohne Plus fuellen
-- Dann die Normalfaelle: Durchschnitt zweier Anbieter, Handeintrag bleibt,
-- Grenzen des Habits, Trennen mittelt neu, Widerruf loescht.
begin;
select plan(24);

-- A: Plus + Einwilligung, B: Plus + Einwilligung, C: Einwilligung ohne Plus,
-- D: Plus ohne Einwilligung
insert into auth.users (id, email) values
  ('a5300000-0000-0000-0000-00000000000a', 'a@example.at'),
  ('a5300000-0000-0000-0000-00000000000b', 'b@example.at'),
  ('a5300000-0000-0000-0000-00000000000c', 'c@example.at'),
  ('a5300000-0000-0000-0000-00000000000d', 'd@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true
 where id in ('a5300000-0000-0000-0000-00000000000a', 'a5300000-0000-0000-0000-00000000000b',
              'a5300000-0000-0000-0000-00000000000d');
reset role;

insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
select 'health_data', 1, 'de', 'x', 'x', now()
 where not exists (select 1 from public.consent_definitions where kind = 'health_data' and published_at is not null);
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select u, d.id, 'health_data', now()
  from (select id from public.consent_definitions
         where kind = 'health_data' and published_at is not null
         order by version limit 1) d,
       unnest(array['a5300000-0000-0000-0000-00000000000a'::uuid,
                    'a5300000-0000-0000-0000-00000000000b'::uuid,
                    'a5300000-0000-0000-0000-00000000000c'::uuid]) u;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a5300000-cccc-0000-0000-000000000001', 'test-053', 'Test', 30, 150, 500, true);

-- T1: Schritte (Plus), T2: Schlafdauer (Plus)
insert into public.habit_templates (id, slug, category_id, title, tracking_type, unit,
                                    min_value, max_value, points, is_preview, is_published, wearable_metric) values
  ('a5300000-eeee-0000-0000-000000000001', 'test-053-schritte', 'a5300000-cccc-0000-0000-000000000001',
   'Schritte', 'number', 'Schritte', 0, 60000, 5, false, true, 'steps'),
  ('a5300000-eeee-0000-0000-000000000002', 'test-053-schlaf', 'a5300000-cccc-0000-0000-000000000001',
   'Schlafdauer', 'number', 'Stunden', 0, 14, 5, false, true, 'sleep_hours');

insert into public.user_habits (id, user_id, template_id, started_on) values
  ('a5300000-aaaa-0000-0000-0000000000a1', 'a5300000-0000-0000-0000-00000000000a', 'a5300000-eeee-0000-0000-000000000001', current_date - 30),
  ('a5300000-aaaa-0000-0000-0000000000a2', 'a5300000-0000-0000-0000-00000000000a', 'a5300000-eeee-0000-0000-000000000002', current_date - 30),
  ('a5300000-aaaa-0000-0000-0000000000c1', 'a5300000-0000-0000-0000-00000000000c', 'a5300000-eeee-0000-0000-000000000001', current_date - 30),
  ('a5300000-aaaa-0000-0000-0000000000d1', 'a5300000-0000-0000-0000-00000000000d', 'a5300000-eeee-0000-0000-000000000001', current_date - 30);

insert into public.wearable_connections (user_id, provider) values
  ('a5300000-0000-0000-0000-00000000000a', 'oura'),
  ('a5300000-0000-0000-0000-00000000000a', 'garmin'),
  ('a5300000-0000-0000-0000-00000000000b', 'oura'),
  ('a5300000-0000-0000-0000-00000000000c', 'oura'),
  ('a5300000-0000-0000-0000-00000000000d', 'oura');

insert into public.wearable_secrets (connection_id, user_id, provider, access_token)
select id, user_id, provider, 'verschluesselt' from public.wearable_connections
 where user_id = 'a5300000-0000-0000-0000-00000000000b';

insert into public.wearable_daily (user_id, provider, metric, day, value) values
  ('a5300000-0000-0000-0000-00000000000b', 'oura', 'steps', current_date - 1, 4321);

-- Ein Handeintrag von A fuer die Schlafdauer gestern.
insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
values ('a5300000-0000-0000-0000-00000000000a', 'a5300000-aaaa-0000-0000-0000000000a2', current_date - 1, 6.5);

-- ===================================================================
-- 1.-4. Als angemeldete Person A
-- ===================================================================
select set_config('request.jwt.claim.sub', 'a5300000-0000-0000-0000-00000000000a', true);
set local role authenticated;

select is(
  (select count(*)::int from public.wearable_connections
    where user_id = 'a5300000-0000-0000-0000-00000000000b'),
  0, 'A sieht die Verbindungen von B nicht');

select is(
  (select count(*)::int from public.wearable_connections),
  2, 'A sieht ihre eigenen zwei Verbindungen');

select is(
  (select count(*)::int from public.wearable_daily
    where user_id = 'a5300000-0000-0000-0000-00000000000b'),
  0, 'A sieht die Tageswerte von B nicht');

select throws_ok(
  $$ select * from public.wearable_secrets $$,
  '42501', null, 'Schluessel sind fuer angemeldete Personen nicht lesbar');

select throws_ok(
  $$ insert into public.wearable_daily (user_id, provider, metric, day, value)
     values ('a5300000-0000-0000-0000-00000000000a', 'oura', 'steps', current_date, 99999) $$,
  '42501', null, 'Tageswerte schreibt nur der Abgleich, nicht der Client');

select throws_ok(
  $$ insert into public.wearable_connections (user_id, provider)
     values ('a5300000-0000-0000-0000-00000000000a', 'oura') $$,
  '42501', null, 'Verbindungen legt nur die Edge Function an');

select throws_ok(
  $$ delete from public.wearable_connections where user_id = 'a5300000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'Trennen geht nur ueber die Edge Function (Widerruf beim Anbieter)');

select throws_ok(
  $$ select public.save_wearable_days('a5300000-0000-0000-0000-00000000000b', 'oura',
       '[{"metric":"steps","day":"2026-01-01","value":1}]'::jsonb) $$,
  '42501', null, 'save_wearable_days ist fuer authenticated nicht ausfuehrbar');

select throws_ok(
  $$ select public.apply_wearable_days('a5300000-0000-0000-0000-00000000000b', current_date - 7, current_date) $$,
  '42501', null, 'apply_wearable_days ist fuer authenticated nicht ausfuehrbar');

select throws_ok(
  $$ select public.remove_wearable('a5300000-0000-0000-0000-00000000000b', 'oura') $$,
  '42501', null, 'remove_wearable ist fuer authenticated nicht ausfuehrbar');

-- Ein eigener Eintrag, als "vom Geraet" getarnt, waere beim naechsten
-- Abgleich ueberschreibbar - und saehe in der Auswertung wie gemessen aus.
insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric, source)
values ('a5300000-0000-0000-0000-00000000000a', 'a5300000-aaaa-0000-0000-0000000000a1', current_date - 5, 1234, 'wearable');

select is(
  (select source from public.habit_logs
    where user_habit_id = 'a5300000-aaaa-0000-0000-0000000000a1' and log_date = current_date - 5),
  null, 'Der Client kann source nicht setzen');

reset role;

-- ===================================================================
-- 5. Abgleich als service_role
-- ===================================================================
set local role service_role;

select is(
  public.save_wearable_days('a5300000-0000-0000-0000-00000000000b', 'garmin',
    jsonb_build_array(jsonb_build_object('metric', 'steps', 'day', current_date - 1, 'value', 5000))),
  0, 'Ohne Verbindung zum Anbieter wird nichts gespeichert');

select is(
  public.save_wearable_days('a5300000-0000-0000-0000-00000000000d', 'oura',
    jsonb_build_array(jsonb_build_object('metric', 'steps', 'day', current_date - 1, 'value', 5000))),
  0, 'Ohne Einwilligung health_data wird nichts gespeichert');

select is(
  public.save_wearable_days('a5300000-0000-0000-0000-00000000000c', 'oura',
    jsonb_build_array(jsonb_build_object('metric', 'steps', 'day', current_date - 1, 'value', 5000))),
  1, 'Mit Einwilligung ohne Plus: der Tageswert wird gespeichert');

reset role;
select is(
  (select count(*)::int from public.habit_logs where user_id = 'a5300000-0000-0000-0000-00000000000c'),
  0, 'aber ohne Plus fuellt er kein Plus-Habit (can_use_habit_template)');
set local role service_role;

-- A: Oura und Garmin fuer gestern, dazu ein unbekannter Wert und ein Tag in der Zukunft.
select is(
  public.save_wearable_days('a5300000-0000-0000-0000-00000000000a', 'oura',
    jsonb_build_array(
      jsonb_build_object('metric', 'steps',       'day', current_date - 1, 'value', 8000),
      jsonb_build_object('metric', 'sleep_hours', 'day', current_date - 1, 'value', 7.25),
      jsonb_build_object('metric', 'unbekannt',   'day', current_date - 1, 'value', 1),
      jsonb_build_object('metric', 'steps',       'day', current_date + 3, 'value', 1),
      jsonb_build_object('metric', 'steps',       'day', current_date - 2, 'value', 70000))),
  3, 'Unbekannte Werte und Tage in der Zukunft werden uebergangen');

select is(
  public.save_wearable_days('a5300000-0000-0000-0000-00000000000a', 'garmin',
    jsonb_build_array(
      jsonb_build_object('metric', 'steps',  'day', current_date - 1, 'value', 9001),
      jsonb_build_object('metric', 'floors', 'day', current_date - 1, 'value', 12))),
  2, 'Garmin-Werte gespeichert');

reset role;

select is(
  (select value_numeric from public.habit_logs
    where user_habit_id = 'a5300000-aaaa-0000-0000-0000000000a1' and log_date = current_date - 1),
  8501::numeric, 'Schritte = Durchschnitt aus Oura und Garmin, gerundet');

select is(
  (select source from public.habit_logs
    where user_habit_id = 'a5300000-aaaa-0000-0000-0000000000a1' and log_date = current_date - 1),
  'wearable', 'und als Geraetewert gekennzeichnet');

select is(
  (select value_numeric from public.habit_logs
    where user_habit_id = 'a5300000-aaaa-0000-0000-0000000000a2' and log_date = current_date - 1),
  6.5::numeric, 'Der Handeintrag der Schlafdauer bleibt stehen');

select is(
  (select count(*)::int from public.habit_logs
    where user_habit_id = 'a5300000-aaaa-0000-0000-0000000000a1' and log_date = current_date - 2),
  0, '70.000 Schritte liegen ueber der Grenze des Habits und fuellen nichts');

-- Trennen von Garmin: neu gemittelt nur aus Oura.
set local role service_role;
select public.remove_wearable('a5300000-0000-0000-0000-00000000000a', 'garmin');
reset role;

select is(
  (select value_numeric from public.habit_logs
    where user_habit_id = 'a5300000-aaaa-0000-0000-0000000000a1' and log_date = current_date - 1),
  8000::numeric, 'Nach dem Trennen von Garmin zaehlt nur noch Oura');

select is(
  (select count(*)::int from public.wearable_daily
    where user_id = 'a5300000-0000-0000-0000-00000000000a' and provider = 'garmin'),
  0, 'Trennen loescht die Tageswerte des Anbieters');

-- Widerruf heisst Loeschen (0040): auch die Geraetedaten.
select set_config('request.jwt.claim.sub', 'a5300000-0000-0000-0000-00000000000b', true);
set local role authenticated;
select public.delete_my_diary_data();
reset role;

select is(
  (select count(*)::int from public.wearable_daily where user_id = 'a5300000-0000-0000-0000-00000000000b')
  + (select count(*)::int from public.wearable_connections where user_id = 'a5300000-0000-0000-0000-00000000000b')
  + (select count(*)::int from public.wearable_secrets where user_id = 'a5300000-0000-0000-0000-00000000000b'),
  0, 'delete_my_diary_data loescht Tageswerte, Verbindungen und Schluessel');

select * from finish();
rollback;
