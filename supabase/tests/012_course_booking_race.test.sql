-- supabase/tests/012_course_booking_race.test.sql
--
-- DER WETTLAUF UM DEN LETZTEN PLATZ (Migration 0011, Abnahmekriterium T20).
--
-- Zwei Personen buchen gleichzeitig den letzten Platz. Genau dieser Fall ist
-- der Grund, warum reserve_course_seat() die Kurszeile mit "for update"
-- sperrt - und ein Test, der die beiden nacheinander laufen laesst, wuerde die
-- Sperre gar nicht beruehren. Er wuerde auch dann gruen bleiben, wenn jemand
-- das "for update" entfernt.
--
-- Deshalb braucht diese Datei zwei echte, gleichzeitig offene Transaktionen.
-- Sie kommen ueber dblink, und daraus folgen zwei Besonderheiten:
--
--   1. DIE TESTDATEN WERDEN COMMITTET. Die beiden Wettlaeufer sitzen auf
--      eigenen Verbindungen und koennen nichts sehen, was in der Transaktion
--      dieser Datei steckt. Angelegt und wieder aufgeraeumt wird deshalb ueber
--      eine dritte Verbindung ('setup'). Bricht der Test mittendrin ab,
--      bleiben Zeilen stehen - "supabase db reset" raeumt sie weg.
--   2. DIE VERBINDUNG GEHT NICHT UEBER 127.0.0.1. Fuer Loopback steht in
--      pg_hba "trust"; dblink verweigert aber den Dienst, wenn ein
--      Nicht-Superuser - und postgres ist bei Supabase keiner - sein Passwort
--      gar nicht vorzeigen muss. Ueber die Netzwerkadresse des Servers greift
--      scram-sha-256, und damit ist dblink zufrieden.
--
-- Die Erweiterung dblink wird hier in der Transaktion angelegt und mit ihr
-- zurueckgerollt. Sie landet nie in einer Migration und damit nie in
-- Staging oder Production.
begin;
select plan(5);

create extension if not exists dblink;

-- Das Passwort ist das feste Kennwort der lokalen Entwicklungsdatenbank aus
-- supabase/config.toml. Es steht hier, weil dieser Test ausschliesslich lokal
-- und in der CI gegen "supabase start" laeuft.
create function pg_temp.conninfo() returns text language sql as $$
  select format(
    'host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()), inet_server_port(), current_database()
  )
$$;

select dblink_connect('setup', pg_temp.conninfo());
select dblink_connect('a', pg_temp.conninfo());
select dblink_connect('b', pg_temp.conninfo());

-- ---------- Ein Kurs mit genau einem Platz ----------
select dblink_exec('setup', $$
  insert into auth.users (id, email) values
    ('f0000000-0000-0000-0000-00000000000a', 'wettlauf-a@example.at'),
    ('f0000000-0000-0000-0000-00000000000b', 'wettlauf-b@example.at')
$$);

select dblink_exec('setup', $$
  insert into public.courses
    (id, slug, title, description, published_at,
     booking_enabled, price_cents, capacity, starts_at)
  values
    ('f0000000-0000-0000-0000-0000000000c1', 'wettlauf-letzter-platz',
     'Letzter Platz', 'Text', now() - interval '1 day',
     true, 12000, 1, now() + interval '9 weeks')
$$);

-- ---------- A greift zu und haelt die Sperre ----------
select dblink_exec('a', 'begin');

select isnt(
  (select booking_id from dblink('a', $$
     select id::text from public.reserve_course_seat(
       'f0000000-0000-0000-0000-0000000000c1',
       'f0000000-0000-0000-0000-00000000000a', true)
   $$) as t(booking_id text)),
  null,
  'A bekommt den letzten Platz - Transaktion noch offen');

-- ---------- B versucht dasselbe, waehrend A noch offen ist ----------
-- Asynchron, sonst wuerde diese Sitzung selbst an der Sperre haengen bleiben.
select is(
  dblink_send_query('b', $$
    select id::text from public.reserve_course_seat(
      'f0000000-0000-0000-0000-0000000000c1',
      'f0000000-0000-0000-0000-00000000000b', true)
  $$),
  1,
  'B stellt seine Anfrage, waehrend A noch nicht committet hat');

-- Kurz warten, damit B ueberhaupt bis zur Sperre kommt, dann nachsehen: B
-- haengt. Das IST die Serialisierung - ohne "for update" wuerde B hier
-- munter durchlaufen und denselben Platz ein zweites Mal vergeben.
select pg_sleep(0.5);

select is(
  dblink_is_busy('b'),
  1,
  'B wartet an der Sperre, statt denselben Platz noch einmal zu vergeben');

-- ---------- A committet, B darf weiter - und geht leer aus ----------
select dblink_exec('a', 'commit');

select throws_ok(
  $$ select * from dblink_get_result('b') as t(booking_id text) $$,
  'PT002',
  null,
  'B bekommt "ausgebucht", sobald A committet hat');

-- Nach einem Fehler muss die Verbindung leergeraeumt werden, bevor sie wieder
-- benutzbar ist.
select dblink_get_result('b') is not distinct from null;
select dblink_exec('b', 'rollback');

-- ---------- Das Ergebnis, auf das es ankommt ----------
select is(
  (select belegt from dblink('setup', $$
     select count(*) from public.course_bookings
      where course_id = 'f0000000-0000-0000-0000-0000000000c1'
        and deleted_at is null
        and status in ('reserved', 'confirmed')
   $$) as t(belegt bigint)),
  1::bigint,
  'Ein Platz, eine Buchung - der Kurs ist nicht ueberbucht');

-- ---------- Aufraeumen ----------
select dblink_exec('setup', $$
  delete from public.course_bookings
   where course_id = 'f0000000-0000-0000-0000-0000000000c1'
$$);
select dblink_exec('setup', $$
  delete from public.courses where id = 'f0000000-0000-0000-0000-0000000000c1'
$$);
select dblink_exec('setup', $$
  delete from auth.users where id in (
    'f0000000-0000-0000-0000-00000000000a',
    'f0000000-0000-0000-0000-00000000000b')
$$);

select dblink_disconnect('setup');
select dblink_disconnect('a');
select dblink_disconnect('b');

select * from finish();
rollback;
