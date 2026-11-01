-- supabase/tests/036_challenges.test.sql
--
-- Challenges (Migration 0036). Je Policy der Missbrauchsfall (CLAUDE.md):
--
--   1. Fremde Challenges sehen oder in sie hineinplanen
--   2. Vergangene Termine loeschen, nachtraeglich planen oder ihr Habit
--      herausnehmen - die Auswertung muss ehrlich bleiben
--   3. Termine ausserhalb des Zeitraums, Start in der Vergangenheit
--   4. Ohne Einwilligung oder ohne Plus starten; mit Vorschau-Vorlage ein
--      Plus-Habit einschmuggeln; unveroeffentlichte Vorlagen sehen oder
--      Vorlagen schreiben
--   5. Eine abgebrochene Challenge weiterplanen
-- Dann die Normalfaelle: speichern in einem Rutsch, abbrechen raeumt die
-- Zukunft ab, ganze Challenge loeschen, alle Tagebuch-Daten loeschen.
begin;
select plan(26);

-- A: Plus + Einwilligung, B: Plus + Einwilligung, C: Einwilligung ohne Plus,
-- D: Plus ohne Einwilligung
insert into auth.users (id, email) values
  ('a3600000-0000-0000-0000-00000000000a', 'a@example.at'),
  ('a3600000-0000-0000-0000-00000000000b', 'b@example.at'),
  ('a3600000-0000-0000-0000-00000000000c', 'c@example.at'),
  ('a3600000-0000-0000-0000-00000000000d', 'd@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true
 where id in ('a3600000-0000-0000-0000-00000000000a', 'a3600000-0000-0000-0000-00000000000b',
              'a3600000-0000-0000-0000-00000000000d');
reset role;

insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
select 'health_data', 1, 'de', 'x', 'x', now()
 where not exists (select 1 from public.consent_definitions where kind = 'health_data' and published_at is not null);
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select u, d.id, 'health_data', now()
  from public.consent_definitions d,
       unnest(array['a3600000-0000-0000-0000-00000000000a'::uuid,
                    'a3600000-0000-0000-0000-00000000000b'::uuid,
                    'a3600000-0000-0000-0000-00000000000c'::uuid]) u
 where d.kind = 'health_data' and d.published_at is not null;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a3600000-cccc-0000-0000-000000000001', 'test-036', 'Test', 30, 150, 500, true);

-- H1: Plus-Habit, H2: Vorschau-Habit
insert into public.habit_templates (id, slug, category_id, title, tracking_type, points, is_preview, is_published) values
  ('a3600000-eeee-0000-0000-000000000001', 'test-036-plus', 'a3600000-cccc-0000-0000-000000000001', 'Plus-Habit', 'done', 5, false, true),
  ('a3600000-eeee-0000-0000-000000000002', 'test-036-vorschau', 'a3600000-cccc-0000-0000-000000000001', 'Vorschau-Habit', 'done', 5, true, true);

insert into public.challenge_templates (id, slug, title, duration_days, is_preview, is_published) values
  ('a3600000-7777-0000-0000-000000000001', 'test-036-vorschau', 'Vorschau', 7, true, true),
  ('a3600000-7777-0000-0000-000000000002', 'test-036-entwurf', 'Entwurf', 7, false, false);

insert into public.user_habits (id, user_id, template_id) values
  ('a3600000-aaaa-0000-0000-00000000000a', 'a3600000-0000-0000-0000-00000000000a', 'a3600000-eeee-0000-0000-000000000001'),
  ('a3600000-aaaa-0000-0000-00000000000b', 'a3600000-0000-0000-0000-00000000000b', 'a3600000-eeee-0000-0000-000000000001');

-- Eine laufende Challenge von A, angelegt als postgres: begonnen vor fuenf
-- Tagen, mit einem vergangenen und einem kuenftigen Termin.
insert into public.challenges (id, user_id, title, starts_on, ends_on) values
  ('a3600000-1111-0000-0000-000000000001', 'a3600000-0000-0000-0000-00000000000a', 'Laeuft',
   current_date - 5, current_date + 5);
insert into public.challenge_items (id, user_id, challenge_id, user_habit_id) values
  ('a3600000-2222-0000-0000-000000000001', 'a3600000-0000-0000-0000-00000000000a',
   'a3600000-1111-0000-0000-000000000001', 'a3600000-aaaa-0000-0000-00000000000a');
insert into public.challenge_slots (id, user_id, challenge_id, item_id, starts_on, due_on) values
  ('a3600000-3333-0000-0000-000000000001', 'a3600000-0000-0000-0000-00000000000a',
   'a3600000-1111-0000-0000-000000000001', 'a3600000-2222-0000-0000-000000000001', current_date - 3, current_date - 3),
  ('a3600000-3333-0000-0000-000000000002', 'a3600000-0000-0000-0000-00000000000a',
   'a3600000-1111-0000-0000-000000000001', 'a3600000-2222-0000-0000-000000000001', current_date + 2, current_date + 2);

-- ============================================================
-- 1. Fremde Challenges
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3600000-0000-0000-0000-00000000000b', true);

select is(
  (select count(*) from public.challenges where id = 'a3600000-1111-0000-0000-000000000001'),
  0::bigint,
  'B sieht die Challenge von A nicht');
select is(
  (select count(*) from public.challenge_slots where challenge_id = 'a3600000-1111-0000-0000-000000000001'),
  0::bigint,
  'und auch ihre Termine nicht');

select throws_ok(
  $$ insert into public.challenge_slots (user_id, challenge_id, item_id, starts_on, due_on)
     values ('a3600000-0000-0000-0000-00000000000b', 'a3600000-1111-0000-0000-000000000001',
             'a3600000-2222-0000-0000-000000000001', current_date + 1, current_date + 1) $$,
  '23503', null,
  'B setzt keinen Termin an ein Habit von A - fuer B gibt es das Habit gar nicht');

select throws_ok(
  $$ insert into public.challenge_slots (user_id, challenge_id, item_id, starts_on, due_on)
     values ('a3600000-0000-0000-0000-00000000000a', 'a3600000-1111-0000-0000-000000000001',
             'a3600000-2222-0000-0000-000000000001', current_date + 1, current_date + 1) $$,
  '23503', null,
  'auch nicht unter dem Namen von A');

select throws_ok(
  $$ insert into public.challenge_items (user_id, challenge_id, user_habit_id)
     values ('a3600000-0000-0000-0000-00000000000b', 'a3600000-1111-0000-0000-000000000001',
             'a3600000-aaaa-0000-0000-00000000000b') $$,
  '23514', null,
  'B haengt kein eigenes Habit in die Challenge von A');

-- ============================================================
-- 2. Die Vergangenheit bleibt
-- ============================================================
select set_config('request.jwt.claim.sub', 'a3600000-0000-0000-0000-00000000000a', true);

select throws_ok(
  $$ delete from public.challenge_slots where id = 'a3600000-3333-0000-0000-000000000001' $$,
  '23514', null,
  'Einen vergangenen Termin loeschen geht nicht');

select throws_ok(
  $$ delete from public.challenge_items where id = 'a3600000-2222-0000-0000-000000000001' $$,
  '23514', null,
  'Ein Habit mit vergangenen Terminen herausnehmen geht nicht');

select throws_ok(
  $$ insert into public.challenge_slots (user_id, challenge_id, item_id, starts_on, due_on)
     values ('a3600000-0000-0000-0000-00000000000a', 'a3600000-1111-0000-0000-000000000001',
             'a3600000-2222-0000-0000-000000000001', current_date - 1, current_date - 1) $$,
  '23514', null,
  'Einen Termin nachtraeglich in die Vergangenheit planen geht nicht');

select throws_ok(
  $$ update public.challenges set starts_on = current_date + 1
      where id = 'a3600000-1111-0000-0000-000000000001' $$,
  '23514', null,
  'Der Start einer begonnenen Challenge ist fest');

-- ============================================================
-- 3. Zeitraum
-- ============================================================
select throws_ok(
  $$ insert into public.challenge_slots (user_id, challenge_id, item_id, starts_on, due_on)
     values ('a3600000-0000-0000-0000-00000000000a', 'a3600000-1111-0000-0000-000000000001',
             'a3600000-2222-0000-0000-000000000001', current_date + 30, current_date + 30) $$,
  '23514', null,
  'Ein Termin nach dem Ende der Challenge geht nicht');

select throws_ok(
  $$ insert into public.challenges (user_id, title, starts_on, ends_on)
     values ('a3600000-0000-0000-0000-00000000000a', 'Rueckwirkend', current_date - 5, current_date + 5) $$,
  '23514', null,
  'Eine neue Challenge beginnt nicht in der Vergangenheit');

select lives_ok(
  $$ delete from public.challenge_slots where id = 'a3600000-3333-0000-0000-000000000002' $$,
  'Einen kuenftigen Termin loeschen geht');

-- ============================================================
-- 4. Zugang
-- ============================================================
select set_config('request.jwt.claim.sub', 'a3600000-0000-0000-0000-00000000000d', true);
select throws_ok(
  $$ select public.save_challenge_plan(
       jsonb_build_object('title', 'Ohne Einwilligung', 'starts_on', current_date, 'ends_on', current_date + 6),
       '[]'::jsonb) $$,
  '42501', null,
  'Ohne Einwilligung keine Challenge, auch mit Plus');

select set_config('request.jwt.claim.sub', 'a3600000-0000-0000-0000-00000000000c', true);
select throws_ok(
  $$ select public.save_challenge_plan(
       jsonb_build_object('title', 'Eigene', 'starts_on', current_date, 'ends_on', current_date + 6),
       '[]'::jsonb) $$,
  '42501', null,
  'Ohne Plus keine eigene Challenge');

select throws_ok(
  $$ select public.save_challenge_plan(
       jsonb_build_object('title', 'Vorschau', 'template_id', 'a3600000-7777-0000-0000-000000000001',
                          'starts_on', current_date, 'ends_on', current_date + 6),
       jsonb_build_array(jsonb_build_object('habit_template_id', 'a3600000-eeee-0000-0000-000000000001'))) $$,
  '42501', null,
  'Auch in einer Vorschau-Challenge kein Plus-Habit ohne Plus');

select lives_ok(
  $$ select public.save_challenge_plan(
       jsonb_build_object('title', 'Vorschau', 'template_id', 'a3600000-7777-0000-0000-000000000001',
                          'starts_on', current_date, 'ends_on', current_date + 6),
       jsonb_build_array(jsonb_build_object(
         'habit_template_id', 'a3600000-eeee-0000-0000-000000000002',
         'plan', '{"daily": true}'::jsonb,
         'slots', jsonb_build_array(
           jsonb_build_object('starts_on', current_date, 'due_on', current_date),
           jsonb_build_object('starts_on', current_date + 1, 'due_on', current_date + 3))))) $$,
  'Ohne Plus mit Vorschau-Vorlage und Vorschau-Habit: die Challenge entsteht');

select is(
  (select count(*) from public.challenge_slots s join public.challenges c on c.id = s.challenge_id
    where c.user_id = 'a3600000-0000-0000-0000-00000000000c'),
  2::bigint,
  'mit ihren zwei Terminen, einer davon ein Block');

select is(
  (select count(*) from public.user_habits
    where user_id = 'a3600000-0000-0000-0000-00000000000c' and is_active),
  1::bigint,
  'und das Habit steht im Tagebuch');

select is(
  (select count(*) from public.challenge_templates where id = 'a3600000-7777-0000-0000-000000000002'),
  0::bigint,
  'Eine unveroeffentlichte Vorlage sieht niemand');

select throws_ok(
  $$ insert into public.challenge_templates (slug, title, duration_days, is_published)
     values ('selbstgemacht', 'Selbst', 7, true) $$,
  '42501', null,
  'Vorlagen schreibt nur die Redaktion');

-- ============================================================
-- 5. Abbrechen
-- ============================================================
select set_config('request.jwt.claim.sub', 'a3600000-0000-0000-0000-00000000000a', true);

select lives_ok(
  $$ select public.save_challenge_plan(
       jsonb_build_object('id', 'a3600000-1111-0000-0000-000000000001', 'title', 'Laeuft weiter',
                          'starts_on', current_date - 5, 'ends_on', current_date + 5),
       jsonb_build_array(jsonb_build_object(
         'habit_template_id', 'a3600000-eeee-0000-0000-000000000001',
         'slots', jsonb_build_array(
           jsonb_build_object('starts_on', current_date - 3, 'due_on', current_date - 3),
           jsonb_build_object('starts_on', current_date + 1, 'due_on', current_date + 1),
           jsonb_build_object('starts_on', current_date + 4, 'due_on', current_date + 4))))) $$,
  'A plant die Zukunft neu');

select results_eq(
  $$ select due_on - current_date from public.challenge_slots
      where challenge_id = 'a3600000-1111-0000-0000-000000000001' order by due_on $$,
  $$ values (-3), (1), (4) $$,
  'Der vergangene Termin bleibt, die kuenftigen sind neu');

update public.challenges set cancelled_at = now() where id = 'a3600000-1111-0000-0000-000000000001';
select results_eq(
  $$ select due_on - current_date from public.challenge_slots
      where challenge_id = 'a3600000-1111-0000-0000-000000000001' order by due_on $$,
  $$ values (-3) $$,
  'Abbrechen raeumt die kuenftigen Termine ab, der vergangene bleibt');

select throws_ok(
  $$ select public.save_challenge_plan(
       jsonb_build_object('id', 'a3600000-1111-0000-0000-000000000001', 'title', 'Doch weiter',
                          'starts_on', current_date - 5, 'ends_on', current_date + 5),
       '[]'::jsonb) $$,
  '42501', null,
  'Eine abgebrochene Challenge laesst sich nicht weiterplanen');

-- ============================================================
-- 6. Loeschen
-- ============================================================
select lives_ok(
  $$ delete from public.challenges where id = 'a3600000-1111-0000-0000-000000000001' $$,
  'Die ganze Challenge loeschen geht immer - mit ihren vergangenen Terminen');

select set_config('request.jwt.claim.sub', 'a3600000-0000-0000-0000-00000000000c', true);
select public.delete_my_diary_data();
reset role;
select is(
  (select count(*) from public.challenges where user_id = 'a3600000-0000-0000-0000-00000000000c'),
  0::bigint,
  'Alle Tagebuch-Daten loeschen nimmt die Challenges mit');

select * from finish();
rollback;
