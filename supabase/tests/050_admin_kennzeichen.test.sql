-- supabase/tests/050_admin_kennzeichen.test.sql
--
-- Migration 0050. Missbrauchsfaelle zuerst (CLAUDE.md):
--
--   1. Sich als Gast oder angemeldeter Nutzer selbst zum Admin machen
--   2. Das eigene Kennzeichen ueber user_metadata vortaeuschen
--   3. Ohne Admin-Rolle einen News-Text aendern
-- Dann der Normalfall: setzen, wirken, entfernen, ohne andere Daten zu verlieren.
begin;
select plan(10);

insert into auth.users (id, email, raw_app_meta_data) values
  ('a5000000-0000-0000-0000-000000000001', 'nutzer50@example.at', '{"provider": "email"}');
insert into public.news_posts (id, slug, title, body_md, published_at) values
  ('a5000000-aaaa-0000-0000-000000000001', 'test-50', 'Titel', 'Text', now() - interval '1 day');

set local role anon;
select throws_ok(
  $$ select public.set_user_admin('nutzer50@example.at', true) $$,
  '42501', null, 'Gaeste duerfen niemanden zum Admin machen');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_user_admin('nutzer50@example.at', true) $$,
  '42501', null, 'Angemeldete duerfen sich nicht selbst zum Admin machen');

update public.news_posts set body_md = 'Fremd' where slug = 'test-50';
select is((select body_md from public.news_posts where slug = 'test-50'), 'Text',
  'Ohne Admin-Rolle bleibt der News-Text unveraendert');

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated","user_metadata":{"role":"admin"}}';
select is(public.is_admin(), false, 'user_metadata macht niemanden zum Admin');
reset role;

set local role service_role;
select is(public.set_user_admin('Nutzer50@example.at', true), true, 'service_role setzt das Kennzeichen');
reset role;
select is(
  (select raw_app_meta_data from auth.users where id = 'a5000000-0000-0000-0000-000000000001'),
  '{"provider": "email", "role": "admin"}'::jsonb,
  'Das Kennzeichen steht in app_metadata, der Rest bleibt');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}';
update public.news_posts set body_md = 'Neu' where slug = 'test-50';
select is((select body_md from public.news_posts where slug = 'test-50'), 'Neu', 'Ein Admin aendert den Text');
reset role;

set local role service_role;
select is(public.set_user_admin('nutzer50@example.at', false), false, 'service_role entfernt das Kennzeichen');
select throws_ok(
  $$ select public.set_user_admin('gibt-es-nicht@example.at', true) $$,
  'P0002', null, 'Eine unbekannte Adresse meldet einen Fehler');
reset role;
select is(
  (select raw_app_meta_data from auth.users where id = 'a5000000-0000-0000-0000-000000000001'),
  '{"provider": "email"}'::jsonb,
  'Entfernen laesst den Rest stehen');

select * from finish();
rollback;
