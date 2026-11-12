-- supabase/tests/055_rechte_ausdruecklich.test.sql
--
-- Migration 0055 (Review 11.11.2026, S2 und S11). Die Migration prueft sich
-- beim Einspielen selbst; dieser Test haelt dasselbe fuer die oertliche
-- Datenbank fest und probiert die Missbrauchsfaelle wirklich aus, statt nur
-- den Katalog zu fragen:
--
--   1. Ohne Konto einen Kursplatz fuer ein fremdes Konto reservieren
--   2. Als angemeldeter Nutzer dasselbe
--   3. Die Vorlage eines Habits tauschen (Plus-Schranke umgehen)
--   4. Eine Tabelle leeren (TRUNCATE umgeht RLS)
-- Und die Gegenprobe: was die App braucht, geht weiterhin.
begin;
select plan(13);

-- ---------- 1. und 2. Kursreservierung nur fuer service_role ----------
set local role anon;
select throws_ok(
  $$ select public.reserve_course_seat(
       gen_random_uuid(), gen_random_uuid(), true, 40, null) $$,
  '42501', null, 'anon kann keinen Kursplatz reservieren');
select throws_ok(
  $$ select public.reserve_course_seat_for_guest(
       gen_random_uuid(), 'gast@example.at', 'Gast', true, 40, null) $$,
  '42501', null, 'anon kann keinen Gastplatz reservieren');
select throws_ok(
  $$ select public.reserve_course_seat_any(
       gen_random_uuid(), null, 'gast@example.at', 'Gast', true, 40, null) $$,
  '42501', null, 'anon erreicht die gemeinsame Reservierungsfunktion nicht');
reset role;

set local role authenticated;
select throws_ok(
  $$ select public.reserve_course_seat(
       gen_random_uuid(), gen_random_uuid(), true, 40, null) $$,
  '42501', null, 'Ein angemeldeter Nutzer kann nicht fuer ein beliebiges Konto reservieren');

-- ---------- 3. Spaltenrechte halten ----------
select throws_ok(
  $$ update public.user_habits set template_id = gen_random_uuid() $$,
  '42501', null, 'Die Vorlage eines Habits laesst sich nicht tauschen');
select throws_ok(
  $$ update public.habit_templates set is_preview = true $$,
  '42501', null, 'Eine eigene Vorlage laesst sich nicht zur Vorschau erklaeren');
select throws_ok(
  $$ update public.challenge_slots set due_on = current_date $$,
  '42501', null, 'Termine eines Uebungswegs lassen sich nicht aendern');

-- ---------- 4. TRUNCATE ----------
select throws_ok(
  $$ truncate public.habit_logs $$,
  '42501', null, 'Ein angemeldeter Nutzer kann keine Tabelle leeren');
reset role;

set local role anon;
select throws_ok(
  $$ truncate public.news_posts $$,
  '42501', null, 'anon kann keine Tabelle leeren');
reset role;

-- ---------- Gegenprobe: was die App braucht ----------
select ok(
  has_column_privilege('authenticated', 'public.user_habits', 'target_value', 'update')
  and has_column_privilege('authenticated', 'public.user_habits', 'deleted_at', 'update'),
  'Eigene Habits lassen sich weiter aendern und entfernen');
select ok(
  has_column_privilege('authenticated', 'public.habit_templates', 'title', 'insert')
  and has_column_privilege('authenticated', 'public.habit_templates', 'title', 'update'),
  'Eigene Habit-Vorlagen lassen sich weiter anlegen und aendern');
select ok(
  has_column_privilege('authenticated', 'public.challenges', 'title', 'insert')
  and has_column_privilege('authenticated', 'public.challenge_slots', 'due_on', 'insert'),
  'Uebungswege lassen sich weiter planen');
select ok(
  has_table_privilege('service_role', 'public.course_bookings', 'insert')
  and has_function_privilege(
        'service_role',
        'public.reserve_course_seat(uuid, uuid, boolean, integer, uuid)', 'execute'),
  'Die Edge Function (service_role) kann weiter reservieren');

select * from finish();
rollback;
