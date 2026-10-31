-- supabase/tests/034_datenschutz_fassung_5.test.sql
--
-- Migration 0034: Datenschutzerklaerung Fassung 5. Missbrauchsfall wie in
-- 027: die neue Fassung nachtraeglich umschreiben - der Nachweis, WOZU
-- jemand zugestimmt hat, waere weg.
begin;
select plan(5);

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'privacy' and version = 5 and published_at is not null),
  '75729c2c8503994ae1968154fe168f2bee19c747204dc948d01fe7c33b31efe1',
  'Datenschutz Fassung 5 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select version from public.consent_definitions
    where kind = 'privacy' and published_at is not null
    order by version desc limit 1),
  5,
  'Fassung 5 ist die juengste - neue Konten stimmen ihr zu');

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
