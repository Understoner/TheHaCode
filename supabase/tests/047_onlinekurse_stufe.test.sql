-- supabase/tests/047_onlinekurse_stufe.test.sql
--
-- Migration 0047: Stufe und Hervorhebung. Kein neuer Zugriffsweg (die
-- Spalten haengen an online_courses mit den Policies aus 0042); geprueft
-- wird, dass die Redaktion keine zweite Hervorhebung und keine erfundene
-- Stufe eintragen kann - und dass niemand ohne Admin-Rolle umstellt.
begin;
select plan(4);

insert into public.online_courses (id, slug, title, access, is_published, is_featured, level) values
  ('c4700000-0000-0000-0000-000000000001', 'stufe47a', 'A', 'public', true, true, 'einsteiger'),
  ('c4700000-0000-0000-0000-000000000002', 'stufe47b', 'B', 'public', true, false, null);

select throws_ok(
  $$ update public.online_courses set is_featured = true where id = 'c4700000-0000-0000-0000-000000000002' $$,
  '23505', null, 'Hoechstens ein hervorgehobener Kurs');
select throws_ok(
  $$ update public.online_courses set level = 'profi' where id = 'c4700000-0000-0000-0000-000000000002' $$,
  '23514', null, 'Nur die drei Stufen');

insert into auth.users (id, email) values ('a4700000-0000-0000-0000-00000000000a', 'a@example.at');
select set_config('request.jwt.claim.sub', 'a4700000-0000-0000-0000-00000000000a', true);
set local role authenticated;
select throws_ok(
  $$ update public.online_courses set is_featured = false where id = 'c4700000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Ohne Admin-Rolle laesst sich die Hervorhebung nicht umstellen');
select is((select level from public.online_courses where id = 'c4700000-0000-0000-0000-000000000001'),
  'einsteiger', 'Die Stufe ist fuer alle lesbar');
reset role;

select * from finish();
rollback;
