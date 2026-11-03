-- supabase/tests/040_datenschutz_fassung_7.test.sql
--
-- Migration 0040: Datenschutzerklaerung Fassung 7 und Einwilligung Tagebuch
-- v5 (Uebungswege, Widerruf heisst Loeschen). Missbrauchsfall wie in
-- 027/037/038: die neuen Fassungen nachtraeglich umschreiben oder loeschen -
-- der Nachweis, WOZU jemand zugestimmt hat, waere weg. Dazu: wer v4
-- zugestimmt hat, darf weiter schreiben (keine erneute Zustimmung,
-- Entscheidung 03.11.2026), und nach dem Widerruf bleibt das Schreiben
-- gesperrt.
begin;
select plan(9);

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'privacy' and version = 7 and published_at is not null),
  '541e54325d2ac2c425ad73fb5727688551a0b3b9bb571cff94f96d87a0b58194',
  'Datenschutz Fassung 7 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'health_data' and version = 5 and published_at is not null),
  '583743806a1cb9ad7a9066aae147a17e190e09bc42fc708ac4bfa39237a7b5de',
  'Einwilligung Tagebuch v5 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select version from public.consent_definitions
    where kind = 'privacy' and published_at is not null order by version desc limit 1),
  7,
  'Fassung 7 ist die juengste - neue Konten stimmen ihr zu');

select is(
  (select version from public.consent_definitions
    where kind = 'health_data' and published_at is not null order by version desc limit 1),
  5,
  'v5 ist die juengste Einwilligung Tagebuch');

-- Wer v4 zugestimmt hat, bleibt eingewilligt.
insert into auth.users (id, email) values ('a4000000-0000-0000-0000-000000000001', 'v4@example.at');
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a4000000-0000-0000-0000-000000000001', id, 'health_data', now() - interval '1 minute'
  from public.consent_definitions where kind = 'health_data' and version = 4;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
select ok(public.has_consent('health_data'), 'Zustimmung zu v4 gilt weiter - keine erneute Zustimmung noetig');
reset role;

-- Missbrauchsfall: nach dem Widerruf (neue Zeile mit revoked_at) gilt die
-- Einwilligung nicht mehr, auch wenn die alte Zustimmung noch dasteht.
insert into public.user_consents (user_id, definition_id, kind, revoked_at)
select 'a4000000-0000-0000-0000-000000000001', id, 'health_data', now()
  from public.consent_definitions where kind = 'health_data' and version = 5;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
select ok(not public.has_consent('health_data'), 'Nach dem Widerruf gilt die Einwilligung nicht mehr');
reset role;

set local role service_role;
select throws_ok(
  $$ update public.consent_definitions set body_md = 'Ich habe nichts gelesen.'
      where kind = 'privacy' and version = 7 $$,
  null, null,
  'Fassung 7 laesst sich nicht umschreiben');
select throws_ok(
  $$ update public.consent_definitions set body_md = 'Daten bleiben fuer immer.'
      where kind = 'health_data' and version = 5 $$,
  null, null,
  'v5 laesst sich nicht umschreiben');
select throws_ok(
  $$ delete from public.consent_definitions where kind = 'health_data' and version = 5 $$,
  null, null,
  'und nicht loeschen');
reset role;

select * from finish();
rollback;
