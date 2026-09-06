-- supabase/tests/015_course_bookings_guest.test.sql
--
-- Gastbuchungen (Migration 0015). Dieselbe Sorgfalt wie in 011: hier liegt
-- Geld, und ein Fehler scheitert nicht laut, sondern verkauft einen Platz
-- zweimal oder stellt jemanden ohne Zahlung auf die Teilnehmerliste.
--
-- Was diese Datei festhaelt, gruppiert nach dem, was schiefgehen koennte:
--
--   1. Der Client kommt an die Gastreservierung nicht heran     <- die Schranke
--   2. Angemeldete sehen Gastbuchungen nicht
--   3. Eine Buchung gehoert zu einem Konto ODER zu einer Adresse, nie zu beidem
--   4. Eine Adresse haelt je Kurs hoechstens einen Platz
--   5. Gastplaetze zaehlen bei der Kapazitaet mit
--   6. Ohne AGB-Zustimmung entsteht keine Buchung
begin;
select plan(21);

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 'mit-konto@example.at');

insert into public.courses
  (id, slug, title, description, published_at, booking_enabled,
   price_cents, deposit_cents, capacity, starts_at)
values
  ('e1000000-0000-0000-0000-000000000001', 'online-gast', 'Online als Gast', 'Text',
   now() - interval '1 day', true, 9000, null, 2, now() + interval '6 weeks'),
  ('e1000000-0000-0000-0000-000000000002', 'gast-eng', 'Nur ein Platz', 'Text',
   now() - interval '1 day', true, 9000, null, 1, now() + interval '6 weeks');

-- ---------- Der Normalfall: die Edge Function reserviert fuer einen Gast ----------
set local role service_role;

select lives_ok(
  $$ select public.reserve_course_seat_for_guest(
       'e1000000-0000-0000-0000-000000000001',
       '  Gast@Example.AT  ', '  Gerda Gast  ', true) $$,
  'Ein Gast reserviert ohne Konto');

select is(
  (select user_id from public.course_bookings
    where course_id = 'e1000000-0000-0000-0000-000000000001'),
  null,
  'Eine Gastbuchung haengt an keinem Konto');

-- Klein und ohne Leerzeichen gespeichert - sonst waere "Gast@..." ein anderer
-- Gast als "gast@..." und der Index gegen Doppelbuchungen liefe ins Leere.
select is(
  (select guest_email from public.course_bookings
    where course_id = 'e1000000-0000-0000-0000-000000000001'),
  'gast@example.at',
  'Die Adresse wird klein und ohne Leerzeichen abgelegt');

select is(
  (select guest_name from public.course_bookings
    where course_id = 'e1000000-0000-0000-0000-000000000001'),
  'Gerda Gast',
  'Der Name wird ohne Leerzeichen abgelegt');

select is(
  (select status::text from public.course_bookings
    where course_id = 'e1000000-0000-0000-0000-000000000001'),
  'reserved',
  'Reserviert, nicht bestaetigt - bestaetigt wird erst mit der Zahlung');

-- Wer im Browser zurueckgeht und neu bucht, belegt keinen zweiten Platz.
select lives_ok(
  $$ select public.reserve_course_seat_for_guest(
       'e1000000-0000-0000-0000-000000000001',
       'gast@example.at', null, true) $$,
  'Dieselbe Adresse bekommt ihre laufende Reservierung zurueck');

select is(
  (select count(*) from public.course_bookings
    where course_id = 'e1000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Und keinen zweiten Platz');

-- Der Name aus dem ersten Anlauf bleibt stehen, wenn der zweite keinen bringt.
select is(
  (select guest_name from public.course_bookings
    where course_id = 'e1000000-0000-0000-0000-000000000001'),
  'Gerda Gast',
  'Ein zweiter Anlauf ohne Namen loescht den vorhandenen nicht');

-- ---------- Ohne AGB keine Buchung (§ 11 AGB) ----------
select throws_ok(
  $$ select public.reserve_course_seat_for_guest(
       'e1000000-0000-0000-0000-000000000002', 'ohne-agb@example.at', null, false) $$,
  'PT004',
  null,
  'Ohne Zustimmung zu den AGB reserviert niemand');

select throws_ok(
  $$ select public.reserve_course_seat_for_guest(
       'e1000000-0000-0000-0000-000000000002', '   ', null, true) $$,
  'PT005',
  null,
  'Ohne Adresse gibt es keine Gastbuchung');

-- ---------- Gastplaetze zaehlen mit ----------
-- Der Kurs hat einen Platz, der Gast nimmt ihn. Danach ist er ausgebucht -
-- auch fuer jemanden mit Konto.
select lives_ok(
  $$ select public.reserve_course_seat_for_guest(
       'e1000000-0000-0000-0000-000000000002', 'schnell@example.at', null, true) $$,
  'Der Gast bekommt den letzten Platz');

select is(
  (select seats_left from public.course_seats()
    where course_id = 'e1000000-0000-0000-0000-000000000002'),
  0,
  'course_seats() zaehlt Gastbuchungen mit');

select throws_ok(
  $$ select public.reserve_course_seat(
       'e1000000-0000-0000-0000-000000000002',
       'd1000000-0000-0000-0000-000000000001', true) $$,
  'PT002',
  null,
  'Ein von Gaesten ausgebuchter Kurs ist auch fuer Konten ausgebucht');

-- ---------- Die Schranken der Tabelle ----------
-- Beides gesetzt: dann waere unklar, wem der Platz gehoert - und der Webhook
-- entscheidet genau daran, ob er eine Zahlung verbuchen darf.
select throws_ok(
  $$ insert into public.course_bookings
       (user_id, guest_email, course_id, amount_total_cents)
     values ('d1000000-0000-0000-0000-000000000001', 'beides@example.at',
             'e1000000-0000-0000-0000-000000000001', 9000) $$,
  '23514',
  null,
  'Konto und Gastadresse zugleich laesst die Datenbank nicht zu');

select throws_ok(
  $$ insert into public.course_bookings (course_id, amount_total_cents)
     values ('e1000000-0000-0000-0000-000000000001', 9000) $$,
  '23514',
  null,
  'Eine Buchung ohne Bucher laesst die Datenbank nicht zu');

select throws_ok(
  $$ insert into public.course_bookings (guest_email, course_id, amount_total_cents)
     values ('Gross@Example.AT', 'e1000000-0000-0000-0000-000000000001', 9000) $$,
  '23514',
  null,
  'Eine Adresse mit Grossbuchstaben kommt gar nicht erst hinein');

-- Der Index gegen die Doppelbuchung, auch am Weg an der Funktion vorbei.
select throws_ok(
  $$ insert into public.course_bookings (guest_email, course_id, amount_total_cents)
     values ('gast@example.at', 'e1000000-0000-0000-0000-000000000001', 9000) $$,
  '23505',
  null,
  'Eine Adresse haelt je Kurs hoechstens eine offene Buchung');

reset role;

-- ---------- Missbrauch ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);

-- Der wichtigste Test der Datei. Waere die Gastreservierung vom Client
-- aufrufbar, koennte jeder mit erfundenen Adressen jeden Kurs ausbuchen - ohne
-- Konto, ohne Zahlung, ohne Spur.
select throws_ok(
  $$ select public.reserve_course_seat_for_guest(
       'e1000000-0000-0000-0000-000000000001', 'boes@example.at', null, true) $$,
  '42501',
  null,
  'Der Client kommt an reserve_course_seat_for_guest() nicht heran');

-- Und auch nicht an den gemeinsamen Kern dahinter.
select throws_ok(
  $$ select public.reserve_course_seat_any(
       'e1000000-0000-0000-0000-000000000001', null, 'boes@example.at', null, true, 35, null) $$,
  '42501',
  null,
  'Der Client kommt an reserve_course_seat_any() erst recht nicht heran');

-- Gastbuchungen gehoeren niemandem, den auth.uid() kennt - also sieht sie auch
-- niemand. Die Select-Policy vergleicht mit user_id, und null ist nie gleich.
select is(
  (select count(*) from public.course_bookings), 0::bigint,
  'Angemeldete sehen Gastbuchungen nicht');

-- Eine Kursbuchung erzeugt unter keinen Umstaenden ein Abo - fuer Gaeste so
-- wenig wie fuer Konten (SAD §3.4).
select is(
  (select count(*) from public.subscriptions), 0::bigint,
  'Eine Gastbuchung erzeugt kein Abo');

select * from finish();
rollback;
