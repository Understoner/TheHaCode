-- supabase/tests/021_habit_score_tracker.test.sql
--
-- Atem-Tagebuch, Habit Score Tracker und Session-Protokoll (Migration 0021).
-- Hier entstehen zum ersten Mal Gesundheitsdaten nach Art. 9 DSGVO. Ein
-- Fehler in diesen Policies scheitert nicht laut - er gibt still Daten preis
-- oder Plus umsonst her. Deshalb je Policy der Missbrauchsfall (CLAUDE.md):
--
--   1. Ohne Plus ein Plus-Habit auswaehlen (Vorschau-Schranke)
--   2. Ein gewaehltes Vorschau-Habit per UPDATE in ein Plus-Habit umbauen
--   3. Ohne Einwilligung einen Eintrag schreiben
--   4. In ein fremdes Habit schreiben, fremde Eintraege lesen oder loeschen
--   5. Nach Abo-Ende weiterschreiben - Lesen und Loeschen muessen bleiben
--   6. Nach Widerruf weiterschreiben - Lesen und Loeschen muessen bleiben
--   7. Sessions fuer andere oder fuer unsichtbare Sequenzen protokollieren
--   8. Vorlagen und Kategorien selbst anlegen
begin;
select plan(36);

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'vorschau@example.at'),
  ('d0000000-0000-0000-0000-000000000002', 'plus@example.at'),
  ('d0000000-0000-0000-0000-000000000003', 'fremder@example.at');

-- Plus nur ueber service_role - der Schutztrigger aus 0001 laesst nichts
-- anderes zu.
set local role service_role;
update public.profiles set has_active_subscription = true
 where id in ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003');
reset role;

-- Die Einwilligung ist nach 0021 nur ein Entwurf. Fuer den Test wird sie
-- veroeffentlicht - in den echten Umgebungen geschieht das von Hand.
update public.consent_definitions set published_at = now()
 where kind = 'health_data' and version = 1;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('d0000000-cccc-0000-0000-000000000001', 'test-atmung', 'Atmung', 30, 150, 500, true);

insert into public.habit_templates
  (id, slug, category_id, title, tracking_type, unit, min_value, max_value, points, is_preview, is_published)
values
  ('d0000000-eeee-0000-0000-000000000001', 'test-bolt', 'd0000000-cccc-0000-0000-000000000001',
   'BOLT', 'number', 's', 0, 120, 10, true, true),
  ('d0000000-eeee-0000-0000-000000000002', 'test-einschlafen', 'd0000000-cccc-0000-0000-000000000001',
   'Einschlafen', 'done', null, null, null, 10, false, true),
  ('d0000000-eeee-0000-0000-000000000003', 'test-entwurf', 'd0000000-cccc-0000-0000-000000000001',
   'Entwurf', 'done', null, null, null, 10, true, false);

insert into public.exercises (slug, type, title, visibility, is_published, default_round_count)
values
  ('test-session-frei', 'paced', 'Frei', 'free', true, 1),
  ('test-session-plus', 'paced', 'Plus', 'plus', true, 1);

-- IDs von aussen, wie in 017: holt der Angreifer sie selbst per Unterabfrage,
-- liefert RLS ihm NULL und der Test waere gruen, ohne je angegriffen zu haben.
create temporary table ids (name text, id uuid);
insert into ids
  select 'frei', id from public.exercises where slug = 'test-session-frei'
  union all
  select 'plus', id from public.exercises where slug = 'test-session-plus'
  union all
  select 'health', id from public.consent_definitions where kind = 'health_data' and version = 1;
grant select on ids to authenticated, anon;

-- ============================================================
-- 0. Was jeder sehen darf
-- ============================================================
set local role anon;

select is(
  (select count(*)::int from public.habit_templates where slug like 'test-%'),
  2,
  'Ohne Konto sind die veroeffentlichten Vorlagen sichtbar, der Entwurf nicht');

select throws_ok(
  $$ insert into public.user_habits (user_id, template_id)
     values ('d0000000-0000-0000-0000-000000000001', 'd0000000-eeee-0000-0000-000000000001') $$,
  '42501', null,
  'Ohne Konto laesst sich kein Habit waehlen');

-- ============================================================
-- 1. Vorschau ohne Plus
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::int from public.habit_templates where slug like 'test-%'),
  2,
  'Angemeldet ohne Plus sind auch die gesperrten Vorlagen sichtbar - als Ausblick');

select lives_ok(
  $$ insert into public.user_habits (id, user_id, template_id)
     values ('d0000000-1111-0000-0000-000000000001',
             'd0000000-0000-0000-0000-000000000001', 'd0000000-eeee-0000-0000-000000000001') $$,
  'Ohne Plus laesst sich das Vorschau-Habit waehlen');

select throws_ok(
  $$ insert into public.user_habits (user_id, template_id)
     values ('d0000000-0000-0000-0000-000000000001', 'd0000000-eeee-0000-0000-000000000002') $$,
  '42501', null,
  'Ohne Plus laesst sich ein Plus-Habit nicht waehlen');

select throws_ok(
  $$ insert into public.user_habits (user_id, template_id)
     values ('d0000000-0000-0000-0000-000000000001', 'd0000000-eeee-0000-0000-000000000003') $$,
  '42501', null,
  'Ein unveroeffentlichter Entwurf laesst sich nicht waehlen, auch als Vorschau nicht');

select throws_ok(
  $$ insert into public.user_habits (user_id, template_id)
     values ('d0000000-0000-0000-0000-000000000002', 'd0000000-eeee-0000-0000-000000000001') $$,
  '42501', null,
  'Ein Habit laesst sich nicht im Namen eines anderen waehlen');

-- ============================================================
-- 2. Vorschau-Habit per UPDATE zum Plus-Habit machen
-- ============================================================
select throws_ok(
  $$ update public.user_habits set template_id = 'd0000000-eeee-0000-0000-000000000002'
      where id = 'd0000000-1111-0000-0000-000000000001' $$,
  '42501', null,
  'Die Vorlage eines gewaehlten Habits laesst sich nicht tauschen');

select lives_ok(
  $$ update public.user_habits set sort_order = 3, target_value = 30
      where id = 'd0000000-1111-0000-0000-000000000001' $$,
  'Reihenfolge und Ziel lassen sich aendern');

-- ============================================================
-- 3. Ohne Einwilligung kein Eintrag
-- ============================================================
select throws_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     values ('d0000000-0000-0000-0000-000000000001',
             'd0000000-1111-0000-0000-000000000001', current_date, 32) $$,
  '42501', null,
  'Ohne health_data-Einwilligung ist kein Tagebucheintrag moeglich');

insert into public.user_consents (user_id, definition_id, kind, granted_at)
values ('d0000000-0000-0000-0000-000000000001', (select id from ids where name = 'health'),
        'health_data', now());

select lives_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     values ('d0000000-0000-0000-0000-000000000001',
             'd0000000-1111-0000-0000-000000000001', current_date, 32) $$,
  'Mit Einwilligung laesst sich das Vorschau-Habit eintragen - ohne Plus');

select throws_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     values ('d0000000-0000-0000-0000-000000000001',
             'd0000000-1111-0000-0000-000000000001', current_date, 40) $$,
  '23505', null,
  'Ein Eintrag je Habit und Tag - zweimal messen zaehlt einmal');

select throws_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     values ('d0000000-0000-0000-0000-000000000001',
             'd0000000-1111-0000-0000-000000000001', current_date - 1, 500) $$,
  '23514', null,
  'Ein Wert ueber dem Maximum der Vorlage wird abgewiesen');

select throws_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     values ('d0000000-0000-0000-0000-000000000001',
             'd0000000-1111-0000-0000-000000000001', current_date + 5, 30) $$,
  '23514', null,
  'Eintraege fuer die Zukunft werden abgewiesen');

select lives_ok(
  $$ update public.habit_logs set value_numeric = 34, note = 'nach dem Aufstehen'
      where user_habit_id = 'd0000000-1111-0000-0000-000000000001' and log_date = current_date $$,
  'Der eigene Eintrag laesst sich korrigieren');

-- ============================================================
-- 4. Mit Plus, und fremde Daten
-- ============================================================
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ insert into public.user_habits (id, user_id, template_id)
     values ('d0000000-2222-0000-0000-000000000001',
             'd0000000-0000-0000-0000-000000000002', 'd0000000-eeee-0000-0000-000000000002') $$,
  'Mit Plus laesst sich das Plus-Habit waehlen');

insert into public.user_consents (user_id, definition_id, kind, granted_at)
values ('d0000000-0000-0000-0000-000000000002', (select id from ids where name = 'health'),
        'health_data', now());

insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
values ('d0000000-0000-0000-0000-000000000002', 'd0000000-2222-0000-0000-000000000001',
        current_date, 7);

select is(
  (select value_numeric from public.habit_logs
    where user_habit_id = 'd0000000-2222-0000-0000-000000000001'),
  1::numeric,
  'Bei "erledigt" ist der Eintrag selbst die Aussage - der Wert wird auf 1 gesetzt');

select is(
  (select count(*)::int from public.habit_logs), 1,
  'Die Eintraege eines anderen sind nicht zu sehen');

select is(
  (select count(*)::int from public.user_habits), 1,
  'Die Habits eines anderen sind nicht zu sehen');

select throws_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     values ('d0000000-0000-0000-0000-000000000002',
             'd0000000-1111-0000-0000-000000000001', current_date - 1, 20) $$,
  '23503', null,
  'In das Habit eines anderen laesst sich nicht schreiben');

select lives_ok(
  $$ delete from public.habit_logs where user_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'Ein DELETE auf fremde Eintraege laeuft ins Leere, statt zu scheitern');

-- ============================================================
-- 5. Abo-Ende: lesen und loeschen ja, schreiben nein
-- ============================================================
reset role;
set local role service_role;
update public.profiles set has_active_subscription = false
 where id = 'd0000000-0000-0000-0000-000000000002';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date)
     values ('d0000000-0000-0000-0000-000000000002',
             'd0000000-2222-0000-0000-000000000001', current_date - 1) $$,
  '42501', null,
  'Nach Abo-Ende entsteht kein neuer Eintrag im Plus-Habit');

select is(
  (select count(*)::int from public.habit_logs), 1,
  'Nach Abo-Ende bleiben die eigenen Eintraege lesbar');

delete from public.habit_logs where user_id = 'd0000000-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.habit_logs), 0,
  'Und loeschbar');

-- ============================================================
-- 6. Widerruf: lesen und loeschen ja, schreiben nein
-- ============================================================
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::int from public.habit_logs), 1,
  'Der fremde DELETE aus Abschnitt 4 hat nichts entfernt');

insert into public.user_consents (user_id, definition_id, kind, revoked_at)
values ('d0000000-0000-0000-0000-000000000001', (select id from ids where name = 'health'),
        'health_data', now());

select throws_ok(
  $$ insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric)
     values ('d0000000-0000-0000-0000-000000000001',
             'd0000000-1111-0000-0000-000000000001', current_date - 1, 30) $$,
  '42501', null,
  'Nach dem Widerruf entsteht kein neuer Eintrag');

select is(
  (select count(*)::int from public.habit_logs), 1,
  'Nach dem Widerruf bleiben die eigenen Eintraege lesbar');

delete from public.habit_logs where user_id = 'd0000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.habit_logs), 0,
  'Und loeschbar');

-- ============================================================
-- 7. Session-Protokoll
-- ============================================================
select lives_ok(
  $$ insert into public.exercise_sessions (user_id, exercise_id)
     values ('d0000000-0000-0000-0000-000000000001', (select id from ids where name = 'frei')) $$,
  'Eine allgemein bereitgestellte Sequenz laesst sich protokollieren - ohne Plus');

select throws_ok(
  $$ insert into public.exercise_sessions (user_id, exercise_id)
     values ('d0000000-0000-0000-0000-000000000001', (select id from ids where name = 'plus')) $$,
  '42501', null,
  'Eine nicht sichtbare Sequenz laesst sich nicht protokollieren');

select throws_ok(
  $$ insert into public.exercise_sessions (user_id, exercise_id)
     values ('d0000000-0000-0000-0000-000000000003', (select id from ids where name = 'frei')) $$,
  '42501', null,
  'Eine Session laesst sich nicht im Namen eines anderen protokollieren');

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::int from public.exercise_sessions), 0,
  'Die Sessions eines anderen sind nicht zu sehen');

-- ============================================================
-- 8. Redaktion bleibt Redaktion
-- ============================================================
select throws_ok(
  $$ insert into public.habit_templates (slug, category_id, title, tracking_type, points, is_preview, is_published)
     values ('test-selbstgemacht', 'd0000000-cccc-0000-0000-000000000001', 'Gratis', 'done', 999, true, true) $$,
  '42501', null,
  'Nutzer legen keine Vorlagen an - auch keine Vorschau mit 999 Punkten');

select throws_ok(
  $$ update public.habit_categories set max_per_day = 9999 where slug = 'test-atmung' $$,
  '42501', null,
  'Nutzer aendern keine Punktelimits');

-- Der Schalter dagegen gehoert der Person.
select lives_ok(
  $$ update public.profiles set habit_score_enabled = true
      where id = 'd0000000-0000-0000-0000-000000000003' $$,
  'Den Habit Score Tracker schaltet jeder fuer sich selbst ein');

reset role;

select throws_ok(
  $$ insert into public.habit_categories (slug, title, max_per_day, max_per_week, max_per_month)
     values ('test-kaputt', 'Kaputt', 50, 20, 500) $$,
  '23514', null,
  'Ein Wochenlimit unter dem Tageslimit faengt die Datenbank ab');

select * from finish();
rollback;
