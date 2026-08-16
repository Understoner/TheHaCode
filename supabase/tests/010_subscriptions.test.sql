-- supabase/tests/010_subscriptions.test.sql
--
-- Hier haengt der Zugriff auf die bezahlte Funktion. Ein Fehler in dieser
-- Migration scheitert nicht laut, sondern schaltet still frei oder still nicht
-- frei - deshalb steht der Missbrauchsfall vorn (CLAUDE.md: pro Policy ein
-- Missbrauchstest, nicht nur der Normalfall):
--
--   1. Niemand kann sich selbst ein Abo anlegen           <- die Bezahlschranke
--   2. Fremde Abos sind unsichtbar
--   3. Das Roh-Event von Stripe kommt an keinen Client
--   4. Der Trigger nimmt Zugriff zurueck, sobald er faellig ist
--   5. has_plus_access() laesst abgelaufene Perioden auffliegen, auch wenn
--      das Stripe-Event ausgeblieben ist
begin;
select plan(18);

delete from public.subscriptions;

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'abonnent@example.at'),
  ('c0000000-0000-0000-0000-000000000002', 'fremder@example.at'),
  ('c0000000-0000-0000-0000-000000000003', 'altbestand@example.at');

-- ---------- Der Normalfall: der Webhook legt ein Abo an ----------
-- Unter service_role, weil genau das der Webhook tut. Ein anderer Weg in diese
-- Tabelle ist nicht vorgesehen und wird weiter unten geprueft.
set local role service_role;

insert into public.subscriptions
  (user_id, stripe_subscription_id, plan, status, current_period_end, country)
values
  ('c0000000-0000-0000-0000-000000000001', 'sub_test_001',
   'yearly', 'active', now() + interval '1 year', 'AT'),
  ('c0000000-0000-0000-0000-000000000002', 'sub_test_002',
   'monthly', 'active', now() + interval '1 month', 'DE');

insert into public.stripe_events (id, type, payload)
values ('evt_test_001', 'checkout.session.completed', '{"geheim": true}'::jsonb);

reset role;

select is(
  (select has_active_subscription from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'),
  true,
  'Trigger setzt has_active_subscription auf true');

select ok(
  (select plus_until from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001') > now() + interval '360 days',
  'Trigger uebernimmt das Periodenende nach plus_until');

-- ---------- Missbrauch ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.subscriptions), 1::bigint,
  'Angemeldete sehen ausschliesslich das eigene Abo, nicht das fremde');

select is(
  (select user_id from public.subscriptions),
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'Und zwar genau das eigene');

-- Der wichtigste Test der Datei. Gaebe es hier eine Schreibpolicy oder ein
-- Grant, koennte sich jeder Angemeldete mit einer Zeile Plus verschaffen - der
-- Trigger wuerde es bereitwillig nach profiles uebernehmen.
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, status, current_period_end)
     values ('c0000000-0000-0000-0000-000000000001', 'yearly', 'active', now() + interval '99 years') $$,
  '42501',
  null,
  'Niemand kann sich selbst ein Abo anlegen');

select throws_ok(
  $$ update public.subscriptions set current_period_end = now() + interval '99 years' $$,
  '42501',
  null,
  'Ein bestehendes Abo laesst sich nicht verlaengern');

select throws_ok(
  $$ delete from public.subscriptions $$,
  '42501',
  null,
  'Ein Abo laesst sich nicht wegloeschen');

-- payload enthaelt Rohdaten von Stripe inklusive E-Mail und Rechnungsland.
select throws_ok(
  $$ select count(*) from public.stripe_events $$,
  '42501',
  null,
  'Die Stripe-Rohevents kommen an keinen Client');

select is(public.has_plus_access(), true,
  'Mit laufendem Abo gewaehrt has_plus_access Zugriff');

reset role;

-- ---------- Der Trigger nimmt Zugriff auch wieder zurueck ----------
set local role service_role;
update public.subscriptions set status = 'canceled', canceled_at = now()
 where stripe_subscription_id = 'sub_test_001';
reset role;

select is(
  (select has_active_subscription from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'),
  false,
  'Kuendigung mit sofortiger Wirkung entzieht das Entitlement');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select is(public.has_plus_access(), false,
  'Und has_plus_access folgt sofort');
reset role;

-- Abgelaufene Periode bei weiterhin aktivem Status: kann vorkommen, wenn das
-- Verlaengerungs-Event ausbleibt. Zaehlt nicht (SAD §8.2).
set local role service_role;
update public.subscriptions
   set status = 'active', canceled_at = null, current_period_end = now() - interval '1 day'
 where stripe_subscription_id = 'sub_test_001';
reset role;

select is(
  (select has_active_subscription from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'),
  false,
  'Abgelaufene Periode zaehlt nicht, auch bei status = active');

-- deleted_at ist keine Zierspalte: eine weggeraeumte Zeile darf keinen Zugriff
-- mehr gewaehren, sonst waere die Spalte eine Falle.
set local role service_role;
update public.subscriptions
   set current_period_end = now() + interval '1 year', deleted_at = now()
 where stripe_subscription_id = 'sub_test_001';
reset role;

select is(
  (select has_active_subscription from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'),
  false,
  'Eine mit deleted_at weggeraeumte Zeile gewaehrt keinen Zugriff');

-- ---------- has_plus_access() ersetzt den pg_cron-Job ----------
-- Nutzer 03 hat gar kein Abo; sein Profil wird direkt gesetzt. Das bildet
-- zweierlei ab: den Altbestand aus der Zeit vor dieser Migration (plus_until
-- null) und den Fall, dass die Periode abgelaufen ist, ohne dass jemals ein
-- Stripe-Event kam.
set local role service_role;
update public.profiles set has_active_subscription = true, plus_until = null
 where id = 'c0000000-0000-0000-0000-000000000003';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', true);
select is(public.has_plus_access(), true,
  'Handfreischaltung ohne plus_until bleibt gueltig (Altbestand)');
reset role;

set local role service_role;
update public.profiles set plus_until = now() - interval '1 day'
 where id = 'c0000000-0000-0000-0000-000000000003';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', true);
select is(public.has_plus_access(), false,
  'Abgelaufenes plus_until entzieht Zugriff auch ohne Stripe-Event');
reset role;

-- ---------- Mehrere Abos ----------
-- Wer vom Monats- aufs Jahresabo wechselt, hat zwei Zeilen. Entscheidend ist
-- nicht die zuletzt geaenderte, sondern ob irgendeine traegt.
set local role service_role;
insert into public.subscriptions
  (user_id, stripe_subscription_id, plan, status, current_period_end)
values
  ('c0000000-0000-0000-0000-000000000001', 'sub_test_003',
   'monthly', 'active', now() + interval '30 days');
reset role;

select is(
  (select has_active_subscription from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'),
  true,
  'Ein zweites, laufendes Abo stellt den Zugriff wieder her');

-- ---------- Kaskade ----------
delete from auth.users where id = 'c0000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.subscriptions
    where user_id = 'c0000000-0000-0000-0000-000000000001'), 0::bigint,
  'Kontoloeschung raeumt die Abos mit weg');

-- Das Stripe-Event ueberlebt die Kontoloeschung bewusst: sonst koennte
-- dasselbe Event danach ein zweites Mal verarbeitet werden.
select is(
  (select count(*) from public.stripe_events where id = 'evt_test_001'), 1::bigint,
  'Das Stripe-Event bleibt als Idempotenzsperre bestehen');

select * from finish();
rollback;
