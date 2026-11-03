-- supabase/tests/041_agb_fassung_2.test.sql
--
-- Migration 0041: AGB in der Fassung vom 03.11.2026 (terms v2). Missbrauchsfall
-- wie in 027/037/038/040: die neue Fassung nachtraeglich umschreiben oder
-- loeschen - der Nachweis, WELCHEN AGB jemand zugestimmt hat, waere weg.
-- Dazu: wer v1 zugestimmt hat, bleibt ohne erneute Zustimmung im Vertrag.
begin;
select plan(6);

select is(
  (select body_sha256 from public.consent_definitions
    where kind = 'terms' and version = 2 and published_at is not null),
  '815e07c71a05912b7226be032e5a7f541b5fdf93d6d8861ae6208f6159b5389b',
  'AGB Fassung vom 03.11.2026 ist veroeffentlicht, im freigegebenen Wortlaut');

select is(
  (select version from public.consent_definitions
    where kind = 'terms' and published_at is not null order by version desc limit 1),
  2,
  'Fassung 2 ist die juengste - neue Konten stimmen ihr zu');

select ok(
  (select published_at is not null from public.consent_definitions
    where kind = 'terms' and version = 1),
  'Fassung 1 bleibt als Nachweis veroeffentlicht');

insert into auth.users (id, email) values
  ('f4100000-0000-0000-0000-000000000001', 'agb-alt@example.at');
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'f4100000-0000-0000-0000-000000000001', id, 'terms', now()
  from public.consent_definitions where kind = 'terms' and version = 1;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4100000-0000-0000-0000-000000000001', true);

select is(public.has_consent('terms'), true,
  'Wer v1 zugestimmt hat, muss nicht erneut zustimmen');

select throws_ok(
  $$ update public.consent_definitions set body_md = 'Anderer Wortlaut'
      where kind = 'terms' and version = 2 $$,
  null, null,
  'Die veroeffentlichte Fassung 2 laesst sich nicht umschreiben');

select throws_ok(
  $$ delete from public.consent_definitions where kind = 'terms' and version = 2 $$,
  null, null,
  'Und nicht loeschen');
reset role;

select * from finish();
rollback;
