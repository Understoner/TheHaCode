-- supabase/tests/003_courses_team.test.sql
begin;
select plan(10);

insert into public.courses (id, slug, title, description, published_at) values
  ('55555555-5555-5555-5555-555555555555', 'atem-grundkurs', 'Atem-Grundkurs', 'Text', now() - interval '1 day'),
  ('66666666-6666-6666-6666-666666666666', 'entwurf',         'Entwurf',       'Text', null),
  ('77777777-7777-7777-7777-777777777777', 'geplant',         'Noch nicht live', 'Text', now() + interval '1 day');

insert into public.team_members (id, slug, full_name, bio, published_at) values
  ('88888888-8888-8888-8888-888888888888', 'michael', 'Michael', 'Text', now() - interval '1 day'),
  ('99999999-9999-9999-9999-999999999999', 'entwurf',  'Entwurf', 'Text', null);

-- Normalfall: die oeffentliche Seite liest ohne Anmeldung
set local role anon;

select is(
  (select count(*) from public.courses)::int, 1,
  'anon sieht nur den veroeffentlichten, bereits vergangenen Kurs'
);
select is(
  (select slug from public.courses limit 1), 'atem-grundkurs',
  'der sichtbare Kurs ist der tatsaechlich veroeffentlichte'
);

select is(
  (select count(*) from public.team_members)::int, 1,
  'anon sieht nur veroeffentlichte Teammitglieder'
);
select is(
  (select slug from public.team_members limit 1), 'michael',
  'das sichtbare Teammitglied ist tatsaechlich veroeffentlicht'
);

-- Missbrauchsfall: anon darf nicht schreiben (kein Grant)
select throws_ok(
  $$ insert into public.courses (slug, title, description) values ('x', 'x', 'x') $$,
  'permission denied for table courses',
  'anon darf keine Kurse anlegen'
);
select throws_ok(
  $$ insert into public.team_members (slug, full_name) values ('x', 'x') $$,
  'permission denied for table team_members',
  'anon darf keine Teammitglieder anlegen'
);

reset role;

-- Missbrauchsfall: angemeldeter Nutzer ohne Admin-Rolle darf ebenfalls nicht schreiben
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ insert into public.courses (slug, title, description) values ('x', 'x', 'x') $$,
  'new row violates row-level security policy for table "courses"',
  'angemeldeter Nutzer ohne Admin-Rolle darf keine Kurse anlegen'
);

-- UPDATE ohne passende USING-Klausel aendert keine Zeile, wirft aber keinen Fehler
update public.courses set title = 'Fremd geaendert' where slug = 'atem-grundkurs';
select is(
  (select title from public.courses where slug = 'atem-grundkurs'), 'Atem-Grundkurs',
  'angemeldeter Nutzer ohne Admin-Rolle aendert keinen bestehenden Kurs'
);

reset role;

-- Admin (app_metadata.role = 'admin') darf schreiben
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'app_metadata', json_build_object('role', 'admin')
  )::text,
  true
);
set local role authenticated;

update public.courses set title = 'Atem-Grundkurs (neu)' where slug = 'atem-grundkurs';
select is(
  (select title from public.courses where slug = 'atem-grundkurs'), 'Atem-Grundkurs (neu)',
  'Admin darf einen bestehenden Kurs aendern'
);

update public.team_members set full_name = 'Michael Untersteiner' where slug = 'michael';
select is(
  (select full_name from public.team_members where slug = 'michael'), 'Michael Untersteiner',
  'Admin darf ein bestehendes Teammitglied aendern'
);

reset role;

select * from finish();
rollback;
