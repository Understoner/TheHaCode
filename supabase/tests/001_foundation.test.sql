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
-- exercises traegt owner_id -> auth.users on delete cascade: eigene Sequenzen
-- muessen mit dem Konto verschwinden. Die Kindtabellen exercise_steps und
-- exercise_phases haengen ihrerseits per cascade an exercises und sind damit
-- mit abgedeckt.
insert into public.exercises (owner_id, type, playback_mode, visibility, title, default_round_count)
values ('11111111-1111-1111-1111-111111111111', 'paced', 'timer', 'plus', 'Eigene Sequenz', 4);

-- subscriptions (0010) haengt ebenfalls per cascade an auth.users. Der Insert
-- laeuft unter service_role, weil der Entitlement-Trigger aus 0010 als
-- security invoker arbeitet und der Schutztrigger oben alles andere abweist -
-- als postgres scheitert diese Zeile mit genau der Meldung aus Test 3.
set local role service_role;
insert into public.subscriptions (user_id, plan, status, current_period_end)
values ('11111111-1111-1111-1111-111111111111', 'yearly', 'active', now() + interval '1 year');
reset role;

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is((
  select count(*) from (
    select id as user_id from public.profiles where id = '11111111-1111-1111-1111-111111111111'
    union all
    select owner_id from public.exercises where owner_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.subscriptions where user_id = '11111111-1111-1111-1111-111111111111'
  ) x), 0::bigint, 'Loeschkaskade hinterlaesst keine Datenreste');

select * from finish();
rollback;
