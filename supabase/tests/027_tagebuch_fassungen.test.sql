-- supabase/tests/027_tagebuch_fassungen.test.sql
--
-- Migration 0027: neue Fassungen unter dem Namen Tagebuch. Missbrauchsfall:
-- eine veroeffentlichte Fassung nachtraeglich umschreiben, statt eine neue
-- Version anzulegen - der Nachweis, WOZU jemand eingewilligt hat, waere weg.
begin;
select plan(5);

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'privacy' and version = 4 and published_at is not null),
  '46a9499d7cc9a9b92d23003e8aea91b23174cc3d8716b86328da22f60fbd8327',
  'Datenschutz Fassung 4 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'health_data' and version = 3 and published_at is not null),
  '25f8770768abde2276078eeb83c97ff2961ef13af0a27fe6beaeb13d8d942e81',
  'Einwilligung Tagebuch v3 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select count(*)::int from public.consent_definitions
    where kind = 'health_data' and version in (1, 2) and published_at is not null),
  2,
  'v1 und v2 bleiben als Nachweis stehen');

-- Missbrauchsfall: die neue Fassung umschreiben, selbst als service_role.
set local role service_role;
select throws_ok(
  $$ update public.consent_definitions set body_md = 'Ich willige in alles ein.'
      where kind = 'health_data' and version = 3 $$,
  null, null,
  'Eine veroeffentlichte Fassung laesst sich nicht umschreiben');
reset role;

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'health_data' and version = 3),
  '25f8770768abde2276078eeb83c97ff2961ef13af0a27fe6beaeb13d8d942e81',
  'und der Wortlaut ist danach unveraendert');

select * from finish();
rollback;
