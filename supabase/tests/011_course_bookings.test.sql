-- supabase/tests/011_course_bookings.test.sql
--
-- Hier liegt Geld. Ein Fehler in Migration 0011 scheitert nicht laut - er
-- verkauft einen Platz zweimal oder stellt jemanden ohne Zahlung auf die
-- Teilnehmerliste. Deshalb steht der Missbrauchsfall vorn (CLAUDE.md: pro
-- Policy ein Missbrauchstest, nicht nur der Normalfall):
--
--   1. Niemand legt sich selbst eine Buchung an        <- die Zahlungsschranke
--   2. Niemand bestaetigt seine eigene Buchung
--   3. Fremde Buchungen sind unsichtbar, auch ueber course_seats()
--   4. Der Client kommt nicht an reserve_course_seat() heran
--   5. Eine Kursbuchung erzeugt unter keinen Umstaenden ein Abo
--
-- Der Wettlauf um den letzten Platz - zwei gleichzeitige Buchungen - steht in
-- 012_course_booking_race.test.sql. Er braucht zwei echte Verbindungen und
-- passt deshalb nicht in eine Transaktion.
begin;
select plan(28);

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'bucher@example.at'),
  ('d0000000-0000-0000-0000-000000000002', 'zweiter@example.at'),
  ('d0000000-0000-0000-0000-000000000003', 'dritter@example.at');

-- Vier Kurse, jeder fuer genau eine Frage:
--   ein-platz    Kapazitaet 1  -> Ausbuchen
--   anzahlung    faengt in 12 Wochen an, Anzahlung hinterlegt
--   bald         faengt in 2 Wochen an, Anzahlung hinterlegt -> trotzdem voll
--   nur-extern   booking_enabled = false -> nicht buchbar
insert into public.courses
  (id, slug, title, description, published_at, booking_enabled,
   price_cents, deposit_cents, capacity, starts_at)
values
  ('e0000000-0000-0000-0000-000000000001', 'ein-platz', 'Ein Platz', 'Text',
   now() - interval '1 day', true, 20000, null, 1, now() + interval '10 weeks'),
  ('e0000000-0000-0000-0000-000000000002', 'anzahlung', 'Mit Anzahlung', 'Text',
   now() - interval '1 day', true, 40000, 20000, 10, now() + interval '12 weeks'),
  ('e0000000-0000-0000-0000-000000000003', 'bald', 'Faengt bald an', 'Text',
   now() - interval '1 day', true, 40000, 20000, 10, now() + interval '2 weeks'),
  ('e0000000-0000-0000-0000-000000000004', 'nur-extern', 'Nur extern', 'Text',
   now() - interval '1 day', false, null, null, null, null);

-- ---------- Die Redaktionsschranken aus dem Studio ----------
select throws_ok(
  $$ update public.courses set booking_enabled = true
      where slug = 'nur-extern' $$,
  '23514',
  null,
  'Buchbar ohne Preis und Termin laesst die Datenbank nicht zu');

select throws_ok(
  $$ update public.courses set deposit_cents = 50000
      where slug = 'anzahlung' $$,
  '23514',
  null,
  'Eine Anzahlung ueber dem Gesamtpreis laesst die Datenbank nicht zu');

-- ---------- Der Normalfall: die Edge Function reserviert ----------
-- Unter service_role, weil genau das create-course-checkout tut.
set local role service_role;

select ok(
  (select id from public.reserve_course_seat(
     'e0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000001', true)) is not null,
  'reserve_course_seat legt eine Buchung an');

select is(
  (select status::text from public.course_bookings
    where user_id = 'd0000000-0000-0000-0000-000000000001'
      and course_id = 'e0000000-0000-0000-0000-000000000002'),
  'reserved',
  'Die frische Buchung ist reserviert, nicht bestaetigt');

select is(
  (select amount_paid_cents from public.course_bookings
    where user_id = 'd0000000-0000-0000-0000-000000000001'
      and course_id = 'e0000000-0000-0000-0000-000000000002'),
  0,
  'Bezahlt ist noch nichts');

-- § 11 AGB: 50 % Anzahlung, Rest spaetestens vier Wochen vor Beginn.
select is(
  (select deposit_cents from public.course_bookings
    where user_id = 'd0000000-0000-0000-0000-000000000001'
      and course_id = 'e0000000-0000-0000-0000-000000000002'),
  20000,
  'Die Anzahlung wird aus dem Kurs uebernommen');

select ok(
  (select balance_due_at from public.course_bookings
    where user_id = 'd0000000-0000-0000-0000-000000000001'
      and course_id = 'e0000000-0000-0000-0000-000000000002')
  between now() + interval '55 days' and now() + interval '57 days',
  'Der Restbetrag ist vier Wochen vor Beginn faellig');

-- Wer spaeter als vier Wochen vor Beginn bucht, zahlt voll - eine Anzahlung,
-- deren Rest schon faellig waere, ist keine.
select is(
  (select deposit_cents from public.reserve_course_seat(
     'e0000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000001', true)),
  null,
  'Kurz vor Beginn gibt es keine Anzahlung mehr, sondern Vollzahlung');

-- Zweimal reservieren gibt denselben Platz zurueck, keinen zweiten. Sonst
-- wuerde ein Klick auf "zurueck" im Browser Plaetze auffressen.
select is(
  (select count(*) from public.course_bookings
    where user_id = 'd0000000-0000-0000-0000-000000000001'
      and course_id = 'e0000000-0000-0000-0000-000000000002'),
  1::bigint,
  'Eine zweite Reservierung desselben Kurses legt keine zweite Zeile an');

select lives_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000002',
       'd0000000-0000-0000-0000-000000000001', true) $$,
  'Die laufende Reservierung wird wiederverwendet');

select is(
  (select count(*) from public.course_bookings
    where user_id = 'd0000000-0000-0000-0000-000000000001'
      and course_id = 'e0000000-0000-0000-0000-000000000002'),
  1::bigint,
  'Auch nach dem zweiten Aufruf gibt es genau eine Buchung');

-- ---------- Nicht buchbare Kurse ----------
select throws_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000004',
       'd0000000-0000-0000-0000-000000000002', true) $$,
  'PT001',
  null,
  'Ein Kurs ohne booking_enabled laesst sich nicht buchen');

select throws_ok(
  $$ select public.reserve_course_seat(
       '00000000-0000-0000-0000-0000000000ff',
       'd0000000-0000-0000-0000-000000000002', true) $$,
  'PT001',
  null,
  'Ein Kurs, den es nicht gibt, auch nicht');

-- ---------- Ohne AGB keine Buchung ----------
-- § 11 AGB macht die Anmeldung erst mit der Bestaetigung verbindlich, und das
-- traegt nur, wenn die AGB einbezogen wurden. Die Pruefung sitzt deshalb in
-- der Datenbank und nicht nur im Formular.
select throws_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000002', false) $$,
  'PT004',
  null,
  'Ohne Zustimmung zu den AGB wird nicht reserviert');

select ok(
  (select agb_accepted_at from public.course_bookings
    where user_id = 'd0000000-0000-0000-0000-000000000001'
      and course_id = 'e0000000-0000-0000-0000-000000000002') is not null,
  'Die Zustimmung wird mit Zeitpunkt festgehalten');

-- ---------- Kapazitaet ----------
select lives_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000002', true) $$,
  'Der einzige Platz wird vergeben');

select throws_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000003', true) $$,
  'PT002',
  null,
  'Der zweite Interessent bekommt "ausgebucht" - auch wenn nur reserviert ist');

-- Eine verfallene Reservierung gibt den Platz zurueck. Ohne das waere ein
-- abgebrochener Checkout ein fuer immer verlorener Platz.
update public.course_bookings
   set reserved_until = now() - interval '1 minute'
 where course_id = 'e0000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000003', true) $$,
  'Nach Ablauf der Reservierung ist der Platz wieder zu haben');

select is(
  (select status::text from public.course_bookings
    where course_id = 'e0000000-0000-0000-0000-000000000001'
      and user_id = 'd0000000-0000-0000-0000-000000000002'),
  'expired',
  'Die abgelaufene Reservierung ist als verfallen vermerkt');

-- ---------- Bezahlt heisst bestaetigt - und dann ist Schluss ----------
-- Das macht sonst der Webhook.
update public.course_bookings
   set status = 'confirmed',
       amount_paid_cents = 20000,
       confirmed_at = now(),
       reserved_until = null
 where user_id = 'd0000000-0000-0000-0000-000000000001'
   and course_id = 'e0000000-0000-0000-0000-000000000002';

select throws_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000002',
       'd0000000-0000-0000-0000-000000000001', true) $$,
  'PT003',
  null,
  'Ein bereits gebuchter Kurs laesst sich nicht ein zweites Mal buchen');

-- ---------- Die wichtigste Abgrenzung: kein Abo aus einer Kursbuchung ----------
select is(
  (select count(*) from public.subscriptions), 0::bigint,
  'Eine Kursbuchung erzeugt keine einzige Zeile in subscriptions');

select is(
  (select has_active_subscription from public.profiles
    where id = 'd0000000-0000-0000-0000-000000000001'),
  false,
  'Und verschafft niemandem Plus');

-- Ein Kurs, auf den bezahlt wurde, laesst sich nicht wegloeschen.
select throws_ok(
  $$ delete from public.courses where id = 'e0000000-0000-0000-0000-000000000002' $$,
  '23503',
  null,
  'Ein Kurs mit Buchungen laesst sich nicht loeschen');

reset role;

-- ---------- Missbrauch ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.course_bookings), 2::bigint,
  'Angemeldete sehen ausschliesslich die eigenen Buchungen');

-- Der wichtigste Test der Datei. Gaebe es hier eine Schreibpolicy oder ein
-- Grant, stuende jeder Angemeldete ohne Zahlung auf der Teilnehmerliste - und
-- haette obendrein einen Platz belegt, der jemand anderem gehoert.
select throws_ok(
  $$ insert into public.course_bookings (user_id, course_id, amount_total_cents, status)
     values ('d0000000-0000-0000-0000-000000000001',
             'e0000000-0000-0000-0000-000000000001', 1, 'confirmed') $$,
  '42501',
  null,
  'Niemand legt sich selbst eine Buchung an');

select throws_ok(
  $$ update public.course_bookings set status = 'confirmed', amount_paid_cents = 0 $$,
  '42501',
  null,
  'Niemand bestaetigt seine eigene Buchung');

-- Der Client darf nicht selbst reservieren: sonst koennte einer alle Plaetze
-- aller Kurse halten, ohne einen Cent zu zahlen.
select throws_ok(
  $$ select public.reserve_course_seat(
       'e0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000001', true) $$,
  '42501',
  null,
  'Der Client kommt an reserve_course_seat() nicht heran');

-- course_seats() ist security definer und muss deshalb selbst darauf achten,
-- nichts durchzureichen: Summen ja, Zeilen nein.
select is(
  (select seats_left from public.course_seats()
    where course_id = 'e0000000-0000-0000-0000-000000000001'),
  0,
  'course_seats() zaehlt auch fremde Buchungen mit - ohne sie zu zeigen');

select * from finish();
rollback;
