-- supabase/tests/002_news.test.sql
begin;
select plan(6);

insert into public.news_posts (id, slug, title, body_md, visibility, published_at) values
  ('22222222-2222-2222-2222-222222222222', 'ueber-mich', 'Über mich',       'Text', 'free', now() - interval '1 day'),
  ('33333333-3333-3333-3333-333333333333', 'entwurf',    'Entwurf',         'Text', 'free', null),
  ('44444444-4444-4444-4444-444444444444', 'geplant',    'Noch nicht live', 'Text', 'free', now() + interval '1 day');

-- Normalfall: die oeffentliche Startseite liest ohne Anmeldung
set local role anon;

select is(
  (select count(*) from public.news_posts)::int, 1,
  'anon sieht nur den veroeffentlichten, bereits vergangenen Beitrag'
);

select is(
  (select slug from public.news_posts limit 1), 'ueber-mich',
  'der sichtbare Beitrag ist der tatsaechlich veroeffentlichte'
);

-- Missbrauchsfall: anon darf nicht schreiben (kein Grant, keine RLS noetig)
select throws_ok(
  $$ insert into public.news_posts (slug, title, body_md) values ('x', 'x', 'x') $$,
  'permission denied for table news_posts',
  'anon darf keine News anlegen'
);

reset role;

-- Missbrauchsfall: ein angemeldeter Nutzer ohne Admin-Rolle darf ebenfalls nicht schreiben
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ insert into public.news_posts (slug, title, body_md) values ('x', 'x', 'x') $$,
  'new row violates row-level security policy for table "news_posts"',
  'angemeldeter Nutzer ohne Admin-Rolle darf News nicht anlegen'
);

-- UPDATE ohne passende USING-Klausel wirft keinen Fehler, sondern aendert
-- schlicht keine Zeile - deshalb hier ueber den unveraenderten Wert geprueft.
update public.news_posts set title = 'Fremd geaendert' where slug = 'ueber-mich';
select is(
  (select title from public.news_posts where slug = 'ueber-mich'), 'Über mich',
  'angemeldeter Nutzer ohne Admin-Rolle aendert keine bestehende News'
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

update public.news_posts set title = 'Über mich (neu)' where slug = 'ueber-mich';
select is(
  (select title from public.news_posts where slug = 'ueber-mich'), 'Über mich (neu)',
  'Admin darf bestehende News aendern'
);

reset role;

select * from finish();
rollback;
