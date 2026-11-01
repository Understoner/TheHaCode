-- supabase/tests/037_datenschutz_fassung_5.test.sql
--
-- Migration 0037: Datenschutzerklaerung Fassung 5. Missbrauchsfall wie in
-- 027: die neue Fassung nachtraeglich umschreiben - der Nachweis, WOZU
-- jemand zugestimmt hat, waere weg.
begin;
select plan(5);

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'privacy' and version = 5 and published_at is not null),
  '75729c2c8503994ae1968154fe168f2bee19c747204dc948d01fe7c33b31efe1',
  'Datenschutz Fassung 5 ist veroeffentlicht, im freigegebenen Wortlaut');

-- Seit 0038 ist Fassung 6 die juengste; hier zaehlt nur noch, dass 5 steht.
select is(
  (select count(*)::int from public.consent_definitions
    where kind = 'privacy' and version = 5 and published_at is not null),
  1,
  'Fassung 5 bleibt als Nachweis stehen');

select is(
  (select count(*)::int from public.consent_definitions
    where kind = 'privacy' and version = 4 and published_at is not null),
  1,
  'Fassung 4 bleibt als Nachweis stehen');

set local role service_role;
select throws_ok(
  $$ update public.consent_definitions set body_md = 'Ich habe nichts gelesen.'
      where kind = 'privacy' and version = 5 $$,
  null, null,
  'Fassung 5 laesst sich nicht umschreiben');
select throws_ok(
  $$ delete from public.consent_definitions where kind = 'privacy' and version = 5 $$,
  null, null,
  'und nicht loeschen');
reset role;

select * from finish();
rollback;
