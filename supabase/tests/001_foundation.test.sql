-- supabase/tests/001_foundation.test.sql
-- UNION-Liste aller Nutzertabellen (CLAUDE.md) — kuenftige Nutzertabellen
-- tragen sich unten beim Loeschkaskade-Test per UNION ALL nach.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 't@example.at');

select isnt(
  (select id from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null,
  'Trigger legt beim Signup automatisch eine profiles-Zeile an'
);

select is(
  (select has_active_subscription from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  false,
  'Neuer Nutzer hat kein Plus'
);

select is(
  public.has_plus_access(),
  false,
  'has_plus_access() ohne angemeldeten Nutzer liefert false'
);

-- Missbrauchsfall: der Nutzer selbst darf sein Entitlement nicht setzen —
-- das ist ausschliesslich dem Stripe-Trigger vorbehalten (SAD §3.8).
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

-- Sanity-Check fuer den Testaufbau selbst: ohne echten Rollenwechsel waere
-- der folgende throws_ok ohnehin bedeutungslos.
select is(current_user::text, 'authenticated', 'SET ROLE hat gewirkt');

select throws_ok(
  $$ update public.profiles set has_active_subscription = true
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'has_active_subscription und plus_until sind nur per service_role aenderbar'
);

reset role;

-- Loeschkaskade: nach dem Loeschen darf in keiner Nutzertabelle eine Zeile
-- uebrig bleiben.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is((
  select count(*) from (
    select id as user_id from public.profiles where id = '11111111-1111-1111-1111-111111111111'
  ) x), 0::bigint, 'Loeschkaskade hinterlaesst keine Datenreste');

select * from finish();
rollback;
