-- supabase/tests/051_stimme_waehlen.test.sql
--
-- Migration 0051. Missbrauchsfaelle zuerst (CLAUDE.md):
--
--   1. Die Stimme einer anderen Person aendern
--   2. Einen Pfad oder sonstigen Text statt einer Stimme eintragen
-- Dann der Normalfall: Vorgabe Alexander, eigene Stimme aendern.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('a5100000-0000-0000-0000-000000000001', 'a51@example.at'),
  ('a5100000-0000-0000-0000-000000000002', 'b51@example.at');

select is((select voice_id from public.profiles where id = 'a5100000-0000-0000-0000-000000000001'), 'alexander',
  'Vorgabe ist Alexander');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a5100000-0000-0000-0000-000000000001","role":"authenticated"}';

update public.profiles set voice_id = 'louisa' where id = 'a5100000-0000-0000-0000-000000000002';
select throws_ok(
  $$ update public.profiles set voice_id = '../geheim' where id = 'a5100000-0000-0000-0000-000000000001' $$,
  '23514', null, 'Nur die Form eines Stimmnamens');
update public.profiles set voice_id = 'michael' where id = 'a5100000-0000-0000-0000-000000000001';
reset role;

select is((select voice_id from public.profiles where id = 'a5100000-0000-0000-0000-000000000002'), 'alexander',
  'Fremdes Profil bleibt unveraendert');
select is((select voice_id from public.profiles where id = 'a5100000-0000-0000-0000-000000000001'), 'michael',
  'Die eigene Stimme laesst sich aendern');

select * from finish();
rollback;
