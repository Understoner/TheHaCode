-- supabase/tests/042_onlinekurse.test.sql
--
-- Migration 0042: Onlinekurse, Inhalte und Zugang. Die Missbrauchsfaelle:
--   1. Inhalt eines Kurses lesen, fuer den man keinen Zugang hat
--      (Gast bei account, Konto ohne Plus bei plus, ohne Kauf bei paid)
--   2. Einen abgelaufenen Kauf weiter nutzen
--   3. Sich selbst einen Kauf eintragen oder verlaengern
--   4. Fremde Kaeufe sehen
--   5. Einen Inhalt an einen fremden Kurs haengen, um ihn freizuschalten
--   6. Dateien im privaten Bucket ohne Zugang lesen
--   7. Unveroeffentlichte Kurse sehen
begin;
select plan(28);

insert into auth.users (id, email) values
  ('a4200000-0000-0000-0000-00000000000a', 'konto@example.at'),
  ('a4200000-0000-0000-0000-00000000000b', 'plus@example.at'),
  ('a4200000-0000-0000-0000-00000000000c', 'kaeufer@example.at'),
  ('a4200000-0000-0000-0000-00000000000d', 'abgelaufen@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a4200000-0000-0000-0000-00000000000b';
reset role;

insert into public.online_courses (id, slug, title, access, price_cents, is_published) values
  ('c4200000-0000-0000-0000-000000000001', 'frei',     'Frei',     'public',  null, true),
  ('c4200000-0000-0000-0000-000000000002', 'konto',    'Konto',    'account', null, true),
  ('c4200000-0000-0000-0000-000000000003', 'plus',     'Plus',     'plus',    null, true),
  ('c4200000-0000-0000-0000-000000000004', 'kauf',     'Kauf',     'paid',    8900, true),
  ('c4200000-0000-0000-0000-000000000005', 'entwurf',  'Entwurf',  'public',  null, false);

insert into public.online_course_blocks (id, course_id, kind, title) values
  ('b4200000-0000-0000-0000-000000000001', 'c4200000-0000-0000-0000-000000000001', 'text', 'T1'),
  ('b4200000-0000-0000-0000-000000000002', 'c4200000-0000-0000-0000-000000000002', 'text', 'T2'),
  ('b4200000-0000-0000-0000-000000000003', 'c4200000-0000-0000-0000-000000000003', 'text', 'T3'),
  ('b4200000-0000-0000-0000-000000000004', 'c4200000-0000-0000-0000-000000000004', 'text', 'T4'),
  ('b4200000-0000-0000-0000-000000000005', 'c4200000-0000-0000-0000-000000000005', 'text', 'T5'),
  ('b4200000-0000-0000-0000-000000000006', 'c4200000-0000-0000-0000-000000000004', 'quiz', 'Quiz');

insert into public.online_course_block_contents (block_id, course_id, body_md)
select id, course_id, 'Inhalt ' || title from public.online_course_blocks where kind = 'text';

insert into public.course_access (user_id, course_id, purchased_at, expires_at) values
  ('a4200000-0000-0000-0000-00000000000c', 'c4200000-0000-0000-0000-000000000004', now(), now() + interval '365 days'),
  ('a4200000-0000-0000-0000-00000000000d', 'c4200000-0000-0000-0000-000000000004',
   now() - interval '400 days', now() - interval '35 days');

insert into storage.objects (bucket_id, name) values
  ('course-media', 'c4200000-0000-0000-0000-000000000001/frei.pdf'),
  ('course-media', 'c4200000-0000-0000-0000-000000000004/kauf.mp3'),
  ('course-media', 'kein-kurs/datei.pdf');

-- ---------- Regeln der Redaktion ----------
select throws_ok(
  $$ insert into public.online_courses (slug, title, access) values ('ohne-preis', 'x', 'paid') $$,
  '23514', null, 'Ein Einzelkauf-Kurs ohne Preis wird abgewiesen');
select throws_ok(
  $$ insert into public.online_courses (slug, title, access, price_cents) values ('frei-mit-preis', 'x', 'public', 100) $$,
  '23514', null, 'Ein freier Kurs mit Preis wird abgewiesen');
select throws_ok(
  $$ insert into public.online_course_blocks (course_id, kind, title)
     values ('c4200000-0000-0000-0000-000000000004', 'quiz', 'Zweites Quiz') $$,
  '23505', null, 'Je Kurs genau ein Quiz');

-- Missbrauchsfall 5: der Inhalt eines Bezahlkurs-Blocks mit der course_id
-- eines freien Kurses - der Trigger setzt die echte course_id.
insert into public.online_course_block_contents (block_id, course_id, body_md)
values ('b4200000-0000-0000-0000-000000000006', 'c4200000-0000-0000-0000-000000000001', 'Loesung');
select is(
  (select course_id from public.online_course_block_contents
    where block_id = 'b4200000-0000-0000-0000-000000000006'),
  'c4200000-0000-0000-0000-000000000004'::uuid,
  'Ein Inhalt bekommt immer den Kurs seines Blocks, nicht den angegebenen');

-- ---------- Gast ----------
set local role anon;
select is((select count(*)::int from public.online_courses), 4,
  'Gaeste sehen die vier veroeffentlichten Kurse, nicht den Entwurf');
select is((select count(*)::int from public.online_course_blocks), 5,
  'Gaeste sehen die Gliederung veroeffentlichter Kurse, auch von Bezahlkursen');
select is((select array_agg(body_md order by body_md) from public.online_course_block_contents),
  array['Inhalt T1'],
  'Gaeste lesen nur den Inhalt des Kurses fuer alle');
select is(public.can_open_course('c4200000-0000-0000-0000-000000000002'), false,
  'Gaeste oeffnen keinen Konto-Kurs');
select is((select array_agg(name) from storage.objects where bucket_id = 'course-media'),
  array['c4200000-0000-0000-0000-000000000001/frei.pdf'],
  'Gaeste sehen im privaten Bucket nur Dateien des freien Kurses');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('course-media', 'c4200000-0000-0000-0000-000000000001/x.pdf') $$,
  'new row violates row-level security policy for table "objects"',
  'Gaeste laden nichts hoch');
reset role;

-- ---------- Konto ohne Plus ----------
select set_config('request.jwt.claim.sub', 'a4200000-0000-0000-0000-00000000000a', true);
set local role authenticated;
select is((select array_agg(body_md order by body_md) from public.online_course_block_contents),
  array['Inhalt T1', 'Inhalt T2'],
  'Mit Konto: frei und Konto-Kurs, nicht Plus und nicht Kauf');
select is(public.can_open_course('c4200000-0000-0000-0000-000000000003'), false,
  'Ohne Plus kein Plus-Kurs');
select is(public.can_open_course('c4200000-0000-0000-0000-000000000004'), false,
  'Ohne Kauf kein Bezahlkurs');
select is(public.can_open_course('c4200000-0000-0000-0000-000000000005'), false,
  'Entwuerfe oeffnet niemand ausser Admins');

-- Missbrauchsfall 3: sich selbst freischalten.
select throws_ok(
  $$ insert into public.course_access (user_id, course_id, expires_at)
     values ('a4200000-0000-0000-0000-00000000000a', 'c4200000-0000-0000-0000-000000000004',
             now() + interval '10 years') $$,
  '42501', null, 'Niemand traegt sich selbst einen Kauf ein');
select is((select count(*)::int from public.course_access), 0,
  'Fremde Kaeufe sind unsichtbar');
reset role;

-- ---------- Plus ----------
select set_config('request.jwt.claim.sub', 'a4200000-0000-0000-0000-00000000000b', true);
set local role authenticated;
select is(public.can_open_course('c4200000-0000-0000-0000-000000000003'), true,
  'Mit Plus ist der Plus-Kurs offen');
select is(public.can_open_course('c4200000-0000-0000-0000-000000000004'), false,
  'Plus schaltet keinen Bezahlkurs frei (dort gibt es nur Rabatt)');
reset role;

-- Plus endet: gesperrt (Entscheidung 03.11.2026).
set local role service_role;
update public.profiles set has_active_subscription = false
 where id = 'a4200000-0000-0000-0000-00000000000b';
reset role;
set local role authenticated;
select is(public.can_open_course('c4200000-0000-0000-0000-000000000003'), false,
  'Endet Plus, ist der Plus-Kurs gesperrt');
reset role;

-- ---------- Kaeufer ----------
select set_config('request.jwt.claim.sub', 'a4200000-0000-0000-0000-00000000000c', true);
set local role authenticated;
select is(public.can_open_course('c4200000-0000-0000-0000-000000000004'), true,
  'Mit gueltigem Kauf ist der Bezahlkurs offen');
select ok((select 'Inhalt T4' = any(array_agg(body_md)) from public.online_course_block_contents),
  'und sein Inhalt lesbar');
select is((select count(*)::int from storage.objects
            where bucket_id = 'course-media' and name like 'c4200000-0000-0000-0000-000000000004/%'), 1,
  'und seine Dateien im privaten Bucket');
select is((select count(*)::int from public.course_access), 1,
  'Der eigene Kauf ist sichtbar');
select throws_ok(
  $$ update public.course_access set expires_at = now() + interval '10 years' $$,
  '42501', null, 'Ein Kauf laesst sich nicht selbst verlaengern');
select is((select count(*)::int from storage.objects
            where bucket_id = 'course-media' and name = 'kein-kurs/datei.pdf'), 0,
  'Dateien ausserhalb eines Kursordners sind fuer niemanden lesbar');
reset role;

-- ---------- Abgelaufener Kauf ----------
select set_config('request.jwt.claim.sub', 'a4200000-0000-0000-0000-00000000000d', true);
set local role authenticated;
select is(public.can_open_course('c4200000-0000-0000-0000-000000000004'), false,
  'Ein abgelaufener Kauf oeffnet nichts mehr');
reset role;

-- Erneuter Kauf nach Ablauf ist erlaubt (Entscheidung 03.11.2026): eine neue Zeile.
insert into public.course_access (user_id, course_id, expires_at)
values ('a4200000-0000-0000-0000-00000000000d', 'c4200000-0000-0000-0000-000000000004',
        now() + interval '365 days');
set local role authenticated;
select is(public.can_open_course('c4200000-0000-0000-0000-000000000004'), true,
  'Nach erneutem Kauf ist der Kurs wieder offen');
reset role;

-- ---------- Admin ----------
select set_config('request.jwt.claims',
  json_build_object('sub', 'a4200000-0000-0000-0000-00000000000a',
                    'app_metadata', json_build_object('role', 'admin'))::text, true);
set local role authenticated;
select is(public.can_open_course('c4200000-0000-0000-0000-000000000005'), true,
  'Admins sehen auch Entwuerfe (Vorschau fuer die Redaktion)');
reset role;

select * from finish();
rollback;
