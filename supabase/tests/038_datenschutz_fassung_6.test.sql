-- supabase/tests/038_datenschutz_fassung_6.test.sql
--
-- Migration 0038: Datenschutzerklaerung Fassung 6 und Einwilligung Tagebuch
-- v4 (Challenges). Missbrauchsfall wie in 027/037: die neuen Fassungen
-- nachtraeglich umschreiben - der Nachweis, WOZU jemand zugestimmt hat, waere
-- weg. Dazu: wer v3 zugestimmt hat, darf weiter schreiben (keine erneute
-- Zustimmung, Entscheidung 01.11.2026).
begin;
select plan(8);

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'privacy' and version = 6 and published_at is not null),
  'b1a541768ea71df58b2521059c7051522ec99c130a4be07e2c4ddbc8da39e5b3',
  'Datenschutz Fassung 6 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'health_data' and version = 4 and published_at is not null),
  '2806eee48899169d264bfd7b874b2d3958fe27997f456ff2669c51ffb88d8ef1',
  'Einwilligung Tagebuch v4 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select version from public.consent_definitions
    where kind = 'privacy' and published_at is not null order by version desc limit 1),
  6,
  'Fassung 6 ist die juengste - neue Konten stimmen ihr zu');

select is(
  (select version from public.consent_definitions
    where kind = 'health_data' and published_at is not null order by version desc limit 1),
  4,
  'v4 ist die juengste Einwilligung Tagebuch');

-- Wer v3 zugestimmt hat, bleibt eingewilligt.
insert into auth.users (id, email) values ('a3800000-0000-0000-0000-000000000001', 'v3@example.at');
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a3800000-0000-0000-0000-000000000001', id, 'health_data', now()
  from public.consent_definitions where kind = 'health_data' and version = 3;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3800000-0000-0000-0000-000000000001', true);
select ok(public.has_consent('health_data'), 'Zustimmung zu v3 gilt weiter - keine erneute Zustimmung noetig');
reset role;

set local role service_role;
select throws_ok(
  $$ update public.consent_definitions set body_md = 'Ich habe nichts gelesen.'
      where kind = 'privacy' and version = 6 $$,
  null, null,
  'Fassung 6 laesst sich nicht umschreiben');
select throws_ok(
  $$ update public.consent_definitions set body_md = 'Alles erlaubt.'
      where kind = 'health_data' and version = 4 $$,
  null, null,
  'v4 laesst sich nicht umschreiben');
select throws_ok(
  $$ delete from public.consent_definitions where kind = 'health_data' and version = 4 $$,
  null, null,
  'und nicht loeschen');
reset role;

select * from finish();
rollback;
