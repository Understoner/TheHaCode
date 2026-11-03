-- supabase/tests/043_onlinekurse_fortschritt.test.sql
--
-- Migration 0043: Fortschritt in Onlinekursen. Missbrauchsfaelle:
--   1. Fortschritt fuer ein fremdes Konto eintragen
--   2. Bloecke eines Kurses erledigen, den man nicht oeffnen darf
--   3. Einen Bezahlkurs-Block unter der ID eines freien Kurses eintragen
--   4. Das Quiz per Klick als erledigt markieren (Zertifikat umgehen)
--   5. Einen erledigten Block nachtraeglich umschreiben
--   6. Fremden Fortschritt sehen oder loeschen
--   7. Ohne Konto Fortschritt speichern
begin;
select plan(13);

insert into auth.users (id, email) values
  ('a4300000-0000-0000-0000-00000000000a', 'a@example.at'),
  ('a4300000-0000-0000-0000-00000000000b', 'b@example.at');

insert into public.online_courses (id, slug, title, access, price_cents, is_published) values
  ('c4300000-0000-0000-0000-000000000001', 'frei43', 'Frei', 'public', null, true),
  ('c4300000-0000-0000-0000-000000000002', 'kauf43', 'Kauf', 'paid', 100, true);

insert into public.online_course_blocks (id, course_id, kind, title) values
  ('b4300000-0000-0000-0000-000000000001', 'c4300000-0000-0000-0000-000000000001', 'text', 'Frei Text'),
  ('b4300000-0000-0000-0000-000000000002', 'c4300000-0000-0000-0000-000000000001', 'quiz', 'Frei Quiz'),
  ('b4300000-0000-0000-0000-000000000003', 'c4300000-0000-0000-0000-000000000002', 'text', 'Kauf Text'),
  ('b4300000-0000-0000-0000-000000000004', 'c4300000-0000-0000-0000-000000000001', 'pdf',  'Frei PDF');

-- B hat einen erledigten Block (als postgres angelegt).
insert into public.course_progress (user_id, course_id, block_id)
values ('a4300000-0000-0000-0000-00000000000b', 'c4300000-0000-0000-0000-000000000001',
        'b4300000-0000-0000-0000-000000000001');

-- ---------- Ohne Konto ----------
set local role anon;
select throws_ok(
  $$ insert into public.course_progress (user_id, course_id, block_id)
     values ('a4300000-0000-0000-0000-00000000000a', 'c4300000-0000-0000-0000-000000000001',
             'b4300000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Ohne Konto wird kein Fortschritt gespeichert');
reset role;

-- ---------- A ----------
select set_config('request.jwt.claim.sub', 'a4300000-0000-0000-0000-00000000000a', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.course_progress (user_id, course_id, block_id)
     values ('a4300000-0000-0000-0000-00000000000a', 'c4300000-0000-0000-0000-000000000001',
             'b4300000-0000-0000-0000-000000000001') $$,
  'Normalfall: einen Block eines offenen Kurses erledigen');

select throws_ok(
  $$ insert into public.course_progress (user_id, course_id, block_id)
     values ('a4300000-0000-0000-0000-00000000000b', 'c4300000-0000-0000-0000-000000000001',
             'b4300000-0000-0000-0000-000000000004') $$,
  '42501', null, 'Kein Fortschritt fuer ein fremdes Konto');

select throws_ok(
  $$ insert into public.course_progress (user_id, course_id, block_id)
     values ('a4300000-0000-0000-0000-00000000000a', 'c4300000-0000-0000-0000-000000000002',
             'b4300000-0000-0000-0000-000000000003') $$,
  '42501', null, 'Kein Fortschritt in einem Kurs ohne Zugang');

select throws_ok(
  $$ insert into public.course_progress (user_id, course_id, block_id)
     values ('a4300000-0000-0000-0000-00000000000a', 'c4300000-0000-0000-0000-000000000001',
             'b4300000-0000-0000-0000-000000000003') $$,
  '42501', null, 'Ein Bezahlkurs-Block wird nicht unter der ID eines freien Kurses angenommen');

select throws_ok(
  $$ insert into public.course_progress (user_id, course_id, block_id)
     values ('a4300000-0000-0000-0000-00000000000a', 'c4300000-0000-0000-0000-000000000001',
             'b4300000-0000-0000-0000-000000000002') $$,
  '42501', null, 'Das Quiz laesst sich nicht per Klick erledigen');

select throws_ok(
  $$ update public.course_progress set completed_at = now() - interval '1 year' $$,
  '42501', null, 'Erledigte Bloecke lassen sich nicht umschreiben');

select is((select count(*)::int from public.course_progress), 1,
  'Nur der eigene Fortschritt ist sichtbar');

delete from public.course_progress where user_id = 'a4300000-0000-0000-0000-00000000000b';
reset role;
select is((select count(*)::int from public.course_progress
            where user_id = 'a4300000-0000-0000-0000-00000000000b'), 1,
  'Fremder Fortschritt laesst sich nicht loeschen');

set local role authenticated;
select lives_ok(
  $$ delete from public.course_progress where block_id = 'b4300000-0000-0000-0000-000000000001' $$,
  'Den eigenen Haken zuruecknehmen geht');
select is((select count(*)::int from public.course_progress), 0,
  'und er ist danach weg');
reset role;

-- ---------- Zugang endet: Erreichtes bleibt lesbar ----------
insert into public.course_access (user_id, course_id, purchased_at, expires_at)
values ('a4300000-0000-0000-0000-00000000000a', 'c4300000-0000-0000-0000-000000000002',
        now() - interval '2 days', now() - interval '1 day');
insert into public.course_progress (user_id, course_id, block_id)
values ('a4300000-0000-0000-0000-00000000000a', 'c4300000-0000-0000-0000-000000000002',
        'b4300000-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.course_progress
            where course_id = 'c4300000-0000-0000-0000-000000000002'), 1,
  'Nach Ablauf des Kaufs bleibt der Fortschritt sichtbar');
reset role;

-- Der Kurs-Trigger korrigiert eine falsche course_id auch fuer postgres.
insert into public.course_progress (user_id, course_id, block_id)
values ('a4300000-0000-0000-0000-00000000000b', 'c4300000-0000-0000-0000-000000000001',
        'b4300000-0000-0000-0000-000000000003');
select is((select course_id from public.course_progress
            where user_id = 'a4300000-0000-0000-0000-00000000000b'
              and block_id = 'b4300000-0000-0000-0000-000000000003'),
  'c4300000-0000-0000-0000-000000000002'::uuid,
  'course_id kommt immer aus dem Block');

select * from finish();
rollback;
