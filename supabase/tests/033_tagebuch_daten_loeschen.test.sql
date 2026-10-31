-- supabase/tests/033_tagebuch_daten_loeschen.test.sql
--
-- delete_my_diary_data() (Migration 0033). Missbrauchsfaelle zuerst
-- (CLAUDE.md):
--
--   1. Ohne Anmeldung aufrufen
--   2. Als angemeldete Person die Daten einer anderen loeschen
--   3. Redaktionelle Vorlagen mitloeschen
-- Dann der Normalfall: alles Eigene aus dem Tagebuch ist weg, Protokoll,
-- Profil und Einwilligungsnachweis bleiben.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('a3300000-0000-0000-0000-000000000001', 'loescht@example.at'),
  ('a3300000-0000-0000-0000-000000000002', 'bleibt@example.at');

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a3300000-cccc-0000-0000-000000000001', 'test-033', 'Test', 30, 150, 500, true);

-- Eine Vorlage der Redaktion und je ein eigenes Habit
insert into public.habit_templates (id, slug, owner_id, category_id, title, tracking_type, is_published) values
  ('a3300000-eeee-0000-0000-000000000000', 'test-033-redaktion', null,
   'a3300000-cccc-0000-0000-000000000001', 'Redaktion', 'done', true),
  ('a3300000-eeee-0000-0000-000000000001', 'eigen-a3300000-eeee-0000-0000-000000000001',
   'a3300000-0000-0000-0000-000000000001', 'a3300000-cccc-0000-0000-000000000001', 'Eigenes A', 'done', true),
  ('a3300000-eeee-0000-0000-000000000002', 'eigen-a3300000-eeee-0000-0000-000000000002',
   'a3300000-0000-0000-0000-000000000002', 'a3300000-cccc-0000-0000-000000000001', 'Eigenes B', 'done', true);

-- Ein schon "geloeschtes" eigenes Habit von A: auch das muss weg
insert into public.habit_templates (id, slug, owner_id, category_id, title, tracking_type, is_published, deleted_at)
values ('a3300000-eeee-0000-0000-000000000003', 'eigen-a3300000-eeee-0000-0000-000000000003',
        'a3300000-0000-0000-0000-000000000001', 'a3300000-cccc-0000-0000-000000000001', 'Altes A', 'done', true, now());

insert into public.user_habits (id, user_id, template_id) values
  ('a3300000-aaaa-0000-0000-000000000001', 'a3300000-0000-0000-0000-000000000001', 'a3300000-eeee-0000-0000-000000000000'),
  ('a3300000-aaaa-0000-0000-000000000002', 'a3300000-0000-0000-0000-000000000001', 'a3300000-eeee-0000-0000-000000000001'),
  ('a3300000-aaaa-0000-0000-000000000003', 'a3300000-0000-0000-0000-000000000002', 'a3300000-eeee-0000-0000-000000000000'),
  ('a3300000-aaaa-0000-0000-000000000004', 'a3300000-0000-0000-0000-000000000002', 'a3300000-eeee-0000-0000-000000000002');

insert into public.habit_logs (user_id, user_habit_id, log_date) values
  ('a3300000-0000-0000-0000-000000000001', 'a3300000-aaaa-0000-0000-000000000001', current_date),
  ('a3300000-0000-0000-0000-000000000001', 'a3300000-aaaa-0000-0000-000000000002', current_date),
  ('a3300000-0000-0000-0000-000000000002', 'a3300000-aaaa-0000-0000-000000000003', current_date),
  ('a3300000-0000-0000-0000-000000000002', 'a3300000-aaaa-0000-0000-000000000004', current_date);

insert into public.habit_favorites (user_id, template_id) values
  ('a3300000-0000-0000-0000-000000000001', 'a3300000-eeee-0000-0000-000000000000'),
  ('a3300000-0000-0000-0000-000000000002', 'a3300000-eeee-0000-0000-000000000000');

insert into public.exercise_sessions (user_id, started_at) values
  ('a3300000-0000-0000-0000-000000000001', now());

insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
select 'health_data', 1, 'de', 'x', 'x', now()
 where not exists (select 1 from public.consent_definitions where kind = 'health_data' and published_at is not null);
insert into public.user_consents (user_id, definition_id, kind, revoked_at)
select 'a3300000-0000-0000-0000-000000000001', d.id, 'health_data', now()
  from public.consent_definitions d
 where d.kind = 'health_data' and d.published_at is not null
 limit 1;

-- ============================================================
-- 1. Ohne Anmeldung
-- ============================================================
set local role anon;
select throws_ok(
  $$ select public.delete_my_diary_data() $$,
  '42501', null,
  'anon darf die Funktion nicht aufrufen');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select public.delete_my_diary_data() $$,
  '42501', null,
  'Ohne Nutzerkennung bricht die Funktion ab');

-- ============================================================
-- 2. A loescht - B bleibt unberuehrt
-- ============================================================
select set_config('request.jwt.claim.sub', 'a3300000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.delete_my_diary_data() $$,
  'A loescht die eigenen Tagebuch-Daten');
reset role;

select is((select count(*)::int from public.habit_logs where user_id = 'a3300000-0000-0000-0000-000000000001'),
          0, 'Alle Eintraege von A sind weg');
select is((select count(*)::int from public.user_habits where user_id = 'a3300000-0000-0000-0000-000000000001'),
          0, 'Die Auswahl von A ist weg');
select is((select count(*)::int from public.habit_favorites where user_id = 'a3300000-0000-0000-0000-000000000001'),
          0, 'Die Habit-Favoriten von A sind weg');
select is((select count(*)::int from public.habit_templates where owner_id = 'a3300000-0000-0000-0000-000000000001'),
          0, 'Eigene Habits von A sind weg, auch die schon geloeschten');

select is((select count(*)::int from public.habit_logs where user_id = 'a3300000-0000-0000-0000-000000000002'),
          2, 'Die Eintraege von B bleiben');
select is((select count(*)::int from public.user_habits where user_id = 'a3300000-0000-0000-0000-000000000002'),
          2, 'Die Auswahl von B bleibt');
select is((select count(*)::int from public.habit_templates where owner_id = 'a3300000-0000-0000-0000-000000000002'),
          1, 'Das eigene Habit von B bleibt');

-- ============================================================
-- 3. Redaktion, Protokoll, Profil und Nachweis bleiben
-- ============================================================
select is((select count(*)::int from public.habit_templates where id = 'a3300000-eeee-0000-0000-000000000000'),
          1, 'Die Vorlage der Redaktion bleibt');
select is((select count(*)::int from public.exercise_sessions where user_id = 'a3300000-0000-0000-0000-000000000001'),
          1, 'Das Uebungsprotokoll von A bleibt');
select is((select count(*)::int from public.user_consents
            where user_id = 'a3300000-0000-0000-0000-000000000001' and kind = 'health_data'),
          1, 'Der Nachweis des Widerrufs bleibt');

select * from finish();
rollback;
