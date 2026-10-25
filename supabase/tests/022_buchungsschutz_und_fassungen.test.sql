-- supabase/tests/022_buchungsschutz_und_fassungen.test.sql
--
-- Migration 0022. Geprueft wird jeweils der Missbrauchsfall:
--
--   1. Ein Client kommt an den Gastzaehler nicht heran
--   2. Ein Absender kann nicht beliebig oft reservieren
--   3. Gaeste koennen einen Kurs nicht mit offenen Reservierungen fuellen
--   4. Kontoloeschung: Buchung bleibt, Person verschwindet, offener Platz frei
--   5. Eine veroeffentlichte Fassung laesst sich weder aendern noch loeschen
begin;
select plan(17);

insert into auth.users (id, email) values
  ('f2200000-0000-0000-0000-000000000001', 'bucher@example.at'),
  ('f2200000-0000-0000-0000-000000000002', 'zahler@example.at');

insert into public.courses
  (id, slug, title, description, published_at, booking_enabled,
   price_cents, capacity, starts_at)
values
  ('f2200000-0000-0000-0000-0000000000c1', 'vier-plaetze', 'Vier Plaetze', 'Text',
   now() - interval '1 day', true, 9000, 4, now() + interval '6 weeks'),
  ('f2200000-0000-0000-0000-0000000000c2', 'ein-platz', 'Ein Platz', 'Text',
   now() - interval '1 day', true, 9000, 1, now() + interval '6 weeks');

-- ---------- 1. Der Zaehler ist nur fuer service_role ----------
set local role anon;
select throws_ok(
  $$ select public.take_guest_booking_slot(repeat('a', 64)) $$,
  '42501', null,
  'anon kann den Gastzaehler nicht aufrufen');
select throws_ok(
  $$ select * from public.guest_booking_attempts $$,
  '42501', null,
  'anon kann die Versuche nicht lesen');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2200000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.take_guest_booking_slot(repeat('a', 64)) $$,
  '42501', null,
  'Auch Angemeldete kommen nicht an den Zaehler');
select throws_ok(
  $$ delete from public.guest_booking_attempts $$,
  '42501', null,
  'und koennen ihn nicht zuruecksetzen');
select set_config('request.jwt.claim.sub', null, true);
reset role;

-- ---------- 2. Pro Absender ----------
set local role service_role;

select is(
  (select bool_and(public.take_guest_booking_slot(repeat('b', 64), 3))
     from generate_series(1, 3)),
  true,
  'Die ersten drei Versuche gehen durch');
select is(
  public.take_guest_booking_slot(repeat('b', 64), 3),
  false,
  'Der vierte innerhalb der Stunde nicht');
select is(
  public.take_guest_booking_slot(repeat('c', 64), 3),
  true,
  'Ein anderer Absender ist davon nicht betroffen');
select throws_ok(
  $$ select public.take_guest_booking_slot('kurz') $$,
  '22023', null,
  'Eine zu kurze Kennung wird abgelehnt');

-- ---------- 3. Pro Kurs: hoechstens die Haelfte der Plaetze ----------
select lives_ok(
  $$ select public.reserve_course_seat_for_guest(
       'f2200000-0000-0000-0000-0000000000c1', 'eins@example.at', null, true) $$,
  'Erster Gast reserviert');
select lives_ok(
  $$ select public.reserve_course_seat_for_guest(
       'f2200000-0000-0000-0000-0000000000c1', 'zwei@example.at', null, true) $$,
  'Zweiter Gast reserviert (2 von 4)');
select throws_ok(
  $$ select public.reserve_course_seat_for_guest(
       'f2200000-0000-0000-0000-0000000000c1', 'drei@example.at', null, true) $$,
  'PT006', null,
  'Ein dritter Gast wuerde mehr als die Haelfte halten');
select lives_ok(
  $$ select public.reserve_course_seat(
       'f2200000-0000-0000-0000-0000000000c1', 'f2200000-0000-0000-0000-000000000001', true) $$,
  'Mit Konto geht es trotzdem - die Grenze trifft nur Gaeste');

-- Ein Kurs mit einem Platz bleibt fuer genau einen Gast buchbar.
select lives_ok(
  $$ select public.reserve_course_seat_for_guest(
       'f2200000-0000-0000-0000-0000000000c2', 'solo@example.at', null, true) $$,
  'Bei einem einzigen Platz darf ein Gast ihn halten');

-- ---------- 4. Kontoloeschung ----------
-- Konto 2 hat bezahlt, Konto 1 reserviert nur (aus Abschnitt 3).
insert into public.course_bookings (user_id, course_id, amount_total_cents, amount_paid_cents, status, confirmed_at)
values ('f2200000-0000-0000-0000-000000000002', 'f2200000-0000-0000-0000-0000000000c1',
        9000, 9000, 'confirmed', now());
reset role;

delete from auth.users where id in ('f2200000-0000-0000-0000-000000000001',
                                    'f2200000-0000-0000-0000-000000000002');

select is(
  (select count(*)::int from public.course_bookings
    where course_id = 'f2200000-0000-0000-0000-0000000000c1'
      and user_id is null and guest_email is null and anonymized_at is not null),
  2,
  'Beide Buchungen bleiben stehen, ohne Bezug zur Person');
select is(
  (select array_agg(status::text order by status::text) from public.course_bookings
    where course_id = 'f2200000-0000-0000-0000-0000000000c1' and anonymized_at is not null),
  array['confirmed', 'expired'],
  'Die bezahlte bleibt bestaetigt, die offene Reservierung gibt ihren Platz frei');

-- ---------- 5. Veroeffentlichte Fassungen sind fest ----------
select throws_ok(
  $$ update public.consent_definitions set body_md = 'Nachtraeglich geaendert'
      where kind = 'privacy' and version = 2 $$,
  '42501', null,
  'Der Wortlaut einer veroeffentlichten Fassung laesst sich nicht aendern - auch nicht als postgres');
select throws_ok(
  $$ delete from public.consent_definitions where kind = 'privacy' and version = 2 $$,
  '42501', null,
  'und sie laesst sich nicht loeschen');

select * from finish();
rollback;
