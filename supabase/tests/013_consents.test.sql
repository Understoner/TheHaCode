-- supabase/tests/013_consents.test.sql
--
-- Einwilligungen sind ein Nachweis. Ein Fehler hier scheitert nicht laut - er
-- faellt erst auf, wenn jemand den Nachweis sehen will und er nicht mehr das
-- ist, was er einmal war. Die Missbrauchsfaelle sind deshalb andere als bei
-- Abos und Buchungen (CLAUDE.md: pro Policy ein Missbrauchsfall):
--
--   1. Niemand erklaert eine Einwilligung fuer ein fremdes Konto
--   2. Eine erteilte Einwilligung laesst sich nicht nachtraeglich umschreiben
--   3. Und nicht loeschen
--   4. Niemand willigt in etwas ein, das nie veroeffentlicht wurde
--      <- daran haengt, dass V1 keine Gesundheitsdaten verarbeitet
--   5. Fremde Einwilligungen sind unsichtbar
begin;
select plan(18);

insert into auth.users (id, email) values
  ('b1000000-0000-0000-0000-000000000001', 'einwilliger@example.at'),
  ('b1000000-0000-0000-0000-000000000002', 'fremder@example.at');

-- ---------- Was die Migration mitbringt ----------
select is(
  (select count(*)::int from public.consent_definitions where published_at is not null),
  2,
  'Zwei veroeffentlichte Fassungen: AGB und Datenschutz');

-- Der Kern des Neuschnitts (SAD §5): ohne Definition keine Einwilligung, ohne
-- Einwilligung keine Gesundheitsdaten. Faellt dieser Test, verarbeitet V1
-- moeglicherweise Art.-9-Daten, ohne dass es jemandem auffaellt.
select is(
  (select count(*)::int from public.consent_definitions where kind = 'health_data'),
  0,
  'health_data ist in V1 nicht angelegt - Art. 9 bleibt aussen vor');

-- Die Pruefsumme kommt aus dem Trigger, nicht aus der Eingabe.
select is(
  (select body_sha256 from public.consent_definitions where kind = 'terms' and version = 1),
  encode(extensions.digest(
    (select body_md from public.consent_definitions where kind = 'terms' and version = 1),
    'sha256'), 'hex'),
  'Die Pruefsumme passt zum hinterlegten Wortlaut');

select isnt(
  (select body_sha256 from public.consent_definitions where kind = 'privacy' and version = 1),
  '',
  'Auch die Datenschutzfassung hat eine Pruefsumme');

-- Und sie zieht mit, wenn der Text sich aendert - sonst wuerde eine
-- nachtraegliche Textaenderung den alten Nachweis behalten.
update public.consent_definitions
   set body_md = 'Ein anderer Wortlaut'
 where kind = 'privacy' and version = 1;

select is(
  (select body_sha256 from public.consent_definitions where kind = 'privacy' and version = 1),
  encode(extensions.digest('Ein anderer Wortlaut', 'sha256'), 'hex'),
  'Aendert sich der Text, aendert sich die Pruefsumme mit');

-- ---------- Der Normalfall ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);

select is(public.has_consent('terms'), false, 'Ohne Zeile gibt es keine Einwilligung');

insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'b1000000-0000-0000-0000-000000000001', id, 'terms', now()
  from public.consent_definitions where kind = 'terms' and version = 1;

select is(public.has_consent('terms'), true, 'Nach der Zustimmung ist sie erteilt');
select is(public.has_consent('privacy'), false, 'Und gilt nur fuer die eine Art');

-- Widerruf ist eine neue Zeile, kein UPDATE.
insert into public.user_consents (user_id, definition_id, kind, revoked_at)
select 'b1000000-0000-0000-0000-000000000001', id, 'terms', now()
  from public.consent_definitions where kind = 'terms' and version = 1;

select is(public.has_consent('terms'), false, 'Der Widerruf sticht die Zustimmung');

select is(
  (select count(*)::int from public.user_consents where kind = 'terms'),
  2,
  'Beide Erklaerungen stehen nebeneinander - der Verlauf bleibt nachweisbar');

select ok(
  (select granted_at is not null from public.user_consents
    where kind = 'terms' order by seq limit 1),
  'Die urspruengliche Zustimmung ist unveraendert erhalten');

-- Und wieder erteilen geht auch.
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'b1000000-0000-0000-0000-000000000001', id, 'terms', now()
  from public.consent_definitions where kind = 'terms' and version = 1;

select is(public.has_consent('terms'), true, 'Erneutes Erteilen wirkt wieder');

-- ---------- Missbrauch ----------
select throws_ok(
  $$ insert into public.user_consents (user_id, definition_id, kind, granted_at)
     select 'b1000000-0000-0000-0000-000000000002', id, 'terms', now()
       from public.consent_definitions where kind = 'terms' and version = 1 $$,
  '42501',
  null,
  'Niemand erklaert eine Einwilligung fuer ein fremdes Konto');

-- Der wichtigste Test der Datei. Waere die Zeile aenderbar, waere der Nachweis
-- wertlos: man koennte nach einem Streit eintragen, wozu man gern zugestimmt
-- haette.
select throws_ok(
  $$ update public.user_consents set granted_at = now() - interval '5 years' $$,
  '42501',
  null,
  'Eine erteilte Einwilligung laesst sich nicht umschreiben');

select throws_ok(
  $$ delete from public.user_consents $$,
  '42501',
  null,
  'Und nicht loeschen');

-- Ohne diese Bedingung koennte sich jemand auf eine Fassung berufen, die es
-- noch gar nicht gibt - etwa health_data, bevor das Tagebuch da ist.
--
-- Die ID wird vorher als postgres geholt und gemerkt: als authenticated ist die
-- unveroeffentlichte Zeile durch die Lesepolicy unsichtbar, ein
-- "insert ... select" traefe also gar keine Zeile und liefe folgenlos durch.
-- Geprueft werden soll aber die SCHREIBpolicy - und die sieht man nur, wenn
-- man ihr eine echte definition_id vorlegt.
reset role;
insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
values ('marketing_email', 1, 'de', 'Newsletter', 'Noch nicht veroeffentlicht', null);

create temp table geheime_fassung as
  select id from public.consent_definitions where kind = 'marketing_email' and version = 1;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ insert into public.user_consents (user_id, definition_id, kind, granted_at)
     values ('b1000000-0000-0000-0000-000000000001',
             (select id from geheime_fassung), 'marketing_email', now()) $$,
  '42501',
  null,
  'Auf eine unveroeffentlichte Fassung laesst sich nicht einwilligen');

-- ---------- Fremde Zeilen ----------
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*)::int from public.user_consents), 0,
  'Fremde Einwilligungen sind unsichtbar');

select is(
  public.has_consent('terms'), false,
  'Und faerben nicht auf den eigenen Stand ab');

select * from finish();
rollback;
