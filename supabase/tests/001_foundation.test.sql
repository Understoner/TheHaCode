-- supabase/tests/001_foundation.test.sql
-- UNION-Liste aller Nutzertabellen (CLAUDE.md) — kuenftige Nutzertabellen
-- tragen sich unten beim Loeschkaskade-Test per UNION ALL nach.
begin;
select plan(7);

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

-- course_bookings (0011) haengt seit 0022 NICHT mehr per cascade, sondern per
-- set null an auth.users: die Buchung bleibt als Zahlungsaufzeichnung
-- (§ 132 BAO), aber ohne Bezug zur Person - siehe den Test nach der Kaskade.
-- Auch hier service_role: der Client hat auf dieser Tabelle keinerlei
-- Schreibrecht.
insert into public.courses
  (id, slug, title, description, published_at,
   booking_enabled, price_cents, capacity, starts_at)
values
  ('11111111-2222-3333-4444-555555555555', 'kaskadenkurs', 'Kaskadenkurs', 'Text',
   now() - interval '1 day', true, 9900, 5, now() + interval '8 weeks');

insert into public.course_bookings (user_id, course_id, amount_total_cents)
values ('11111111-1111-1111-1111-111111111111',
        '11111111-2222-3333-4444-555555555555', 9900);
reset role;

-- user_consents (0012) haengt ebenfalls per cascade an auth.users. Der Insert
-- laeuft als authenticated, weil genau das die Policy erlaubt - der Nutzer
-- erklaert seine Einwilligung selbst.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select '11111111-1111-1111-1111-111111111111', id, 'terms', now()
  from public.consent_definitions where kind = 'terms' and version = 1;

-- exercise_favorites (0017) haengt ebenfalls per cascade an auth.users. Auch
-- hier authenticated: einen Stern setzt der Nutzer selbst, genau das erlaubt
-- die Policy. Er steht auf der eigenen Sequenz von oben - der Stern gilt fuer
-- eigene wie fuer redaktionelle Sequenzen gleichermassen.
insert into public.exercise_favorites (user_id, exercise_id)
select '11111111-1111-1111-1111-111111111111', id
  from public.exercises where owner_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claim.sub', null, true);
reset role;

-- user_habits, habit_logs und exercise_sessions (0021) haengen ebenfalls per
-- cascade an auth.users. Als postgres angelegt: der Weg ueber Einwilligung
-- und Plus ist Sache von 021_habit_score_tracker.test.sql, hier zaehlt nur,
-- dass nach dem Loeschen nichts uebrig bleibt.
insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('11111111-aaaa-0000-0000-000000000001', 'kaskade', 'Kaskade', 10, 50, 200, true);
insert into public.habit_templates (id, slug, category_id, title, tracking_type, points, is_published)
values ('11111111-aaaa-0000-0000-000000000002', 'kaskade-habit',
        '11111111-aaaa-0000-0000-000000000001', 'Kaskade', 'done', 5, true);
insert into public.user_habits (id, user_id, template_id)
values ('11111111-aaaa-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
        '11111111-aaaa-0000-0000-000000000002');
insert into public.habit_logs (user_id, user_habit_id, log_date)
values ('11111111-1111-1111-1111-111111111111', '11111111-aaaa-0000-0000-000000000003', current_date);
insert into public.exercise_sessions (user_id, exercise_id)
select '11111111-1111-1111-1111-111111111111', id
  from public.exercises where owner_id = '11111111-1111-1111-1111-111111111111';

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is((
  select count(*) from (
    select id as user_id from public.profiles where id = '11111111-1111-1111-1111-111111111111'
    union all
    select owner_id from public.exercises where owner_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.subscriptions where user_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.course_bookings where user_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.user_consents where user_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.exercise_favorites where user_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.user_habits where user_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.habit_logs where user_id = '11111111-1111-1111-1111-111111111111'
    union all
    select user_id from public.exercise_sessions where user_id = '11111111-1111-1111-1111-111111111111'
  ) x), 0::bigint, 'Loeschkaskade hinterlaesst keine Datenreste');

select is(
  (select count(*) from public.course_bookings
    where course_id = '11111111-2222-3333-4444-555555555555'
      and user_id is null and guest_email is null and anonymized_at is not null),
  1::bigint,
  'Die Buchung bleibt anonymisiert als Zahlungsaufzeichnung stehen (0022)');

select * from finish();
rollback;
