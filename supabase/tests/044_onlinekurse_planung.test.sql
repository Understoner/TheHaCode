-- supabase/tests/044_onlinekurse_planung.test.sql
--
-- Migration 0044: Bloecke im Tagebuch einplanen. Missbrauchsfaelle:
--   1. Termine fuer ein fremdes Konto anlegen oder auf eines verschieben
--   2. Bloecke eines Kurses ohne Zugang einplanen
--   3. Einen Bezahlkurs-Block unter der ID eines freien Kurses einplanen
--   4. Fremde Termine sehen, verschieben oder loeschen
--   5. Ohne Konto planen
begin;
select plan(12);

insert into auth.users (id, email) values
  ('a4400000-0000-0000-0000-00000000000a', 'a@example.at'),
  ('a4400000-0000-0000-0000-00000000000b', 'b@example.at');

insert into public.online_courses (id, slug, title, access, price_cents, is_published) values
  ('c4400000-0000-0000-0000-000000000001', 'frei44', 'Frei', 'public', null, true),
  ('c4400000-0000-0000-0000-000000000002', 'kauf44', 'Kauf', 'paid', 100, true);

insert into public.online_course_blocks (id, course_id, kind, title) values
  ('b4400000-0000-0000-0000-000000000001', 'c4400000-0000-0000-0000-000000000001', 'text', 'Frei 1'),
  ('b4400000-0000-0000-0000-000000000002', 'c4400000-0000-0000-0000-000000000001', 'audio', 'Frei 2'),
  ('b4400000-0000-0000-0000-000000000003', 'c4400000-0000-0000-0000-000000000002', 'text', 'Kauf 1');

insert into public.course_plan_slots (user_id, course_id, block_id, planned_on)
values ('a4400000-0000-0000-0000-00000000000b', 'c4400000-0000-0000-0000-000000000001',
        'b4400000-0000-0000-0000-000000000001', current_date + 3);

set local role anon;
select throws_ok(
  $$ insert into public.course_plan_slots (user_id, course_id, block_id, planned_on)
     values ('a4400000-0000-0000-0000-00000000000a', 'c4400000-0000-0000-0000-000000000001',
             'b4400000-0000-0000-0000-000000000001', current_date) $$,
  '42501', null, 'Ohne Konto wird nichts geplant');
reset role;

select set_config('request.jwt.claim.sub', 'a4400000-0000-0000-0000-00000000000a', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.course_plan_slots (user_id, course_id, block_id, planned_on, day_part)
     values ('a4400000-0000-0000-0000-00000000000a', 'c4400000-0000-0000-0000-000000000001',
             'b4400000-0000-0000-0000-000000000001', current_date + 1, 'abends') $$,
  'Normalfall: einen Block eines offenen Kurses einplanen');

select throws_ok(
  $$ insert into public.course_plan_slots (user_id, course_id, block_id, planned_on)
     values ('a4400000-0000-0000-0000-00000000000a', 'c4400000-0000-0000-0000-000000000001',
             'b4400000-0000-0000-0000-000000000001', current_date + 2) $$,
  '23505', null, 'Ein Block hat hoechstens einen Termin');

select throws_ok(
  $$ insert into public.course_plan_slots (user_id, course_id, block_id, planned_on)
     values ('a4400000-0000-0000-0000-00000000000b', 'c4400000-0000-0000-0000-000000000001',
             'b4400000-0000-0000-0000-000000000002', current_date) $$,
  '42501', null, 'Keine Termine fuer ein fremdes Konto');

select throws_ok(
  $$ insert into public.course_plan_slots (user_id, course_id, block_id, planned_on)
     values ('a4400000-0000-0000-0000-00000000000a', 'c4400000-0000-0000-0000-000000000002',
             'b4400000-0000-0000-0000-000000000003', current_date) $$,
  '42501', null, 'Kein Termin in einem Kurs ohne Zugang');

select throws_ok(
  $$ insert into public.course_plan_slots (user_id, course_id, block_id, planned_on)
     values ('a4400000-0000-0000-0000-00000000000a', 'c4400000-0000-0000-0000-000000000001',
             'b4400000-0000-0000-0000-000000000003', current_date) $$,
  '42501', null, 'Ein Bezahlkurs-Block wird nicht unter der ID eines freien Kurses angenommen');

select throws_ok(
  $$ insert into public.course_plan_slots (user_id, course_id, block_id, planned_on, day_part)
     values ('a4400000-0000-0000-0000-00000000000a', 'c4400000-0000-0000-0000-000000000001',
             'b4400000-0000-0000-0000-000000000002', current_date, 'nachts') $$,
  '23514', null, 'Nur die drei Tageszeiten aus 0039');

select is((select count(*)::int from public.course_plan_slots), 1, 'Nur die eigenen Termine sind sichtbar');

select lives_ok(
  $$ update public.course_plan_slots set planned_on = current_date + 5
      where block_id = 'b4400000-0000-0000-0000-000000000001' $$,
  'Den eigenen Termin verschieben');

select throws_ok(
  $$ update public.course_plan_slots set user_id = 'a4400000-0000-0000-0000-00000000000b'
      where block_id = 'b4400000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Einen Termin nicht auf ein fremdes Konto schieben');

update public.course_plan_slots set planned_on = current_date
 where user_id = 'a4400000-0000-0000-0000-00000000000b';
delete from public.course_plan_slots where user_id = 'a4400000-0000-0000-0000-00000000000b';
reset role;

select is((select planned_on from public.course_plan_slots
            where user_id = 'a4400000-0000-0000-0000-00000000000b'), current_date + 3,
  'Fremde Termine bleiben unveraendert');
select is((select count(*)::int from public.course_plan_slots
            where user_id = 'a4400000-0000-0000-0000-00000000000b'), 1,
  'und ungeloescht');

select * from finish();
rollback;
