-- supabase/tests/014_consent_at_signup.test.sql
--
-- Der Trigger aus Migration 0013. Was hier schiefgehen kann, geht leise
-- schief: ein Konto ohne Zustimmung faellt niemandem auf, bis jemand danach
-- fragt - und dann ist die Registrierung Monate her.
--
--   1. Mit Zeitstempel entstehen Zeilen, und zwar je Pflichtfassung eine
--   2. Ohne Zeitstempel entsteht keine - das Konto aber schon
--   3. Die Fassung bestimmt der Trigger, nicht der Client
--   4. Nur veroeffentlichte Pflichtfassungen zaehlen
begin;
select plan(9);

-- ---------- 1. Der Normalfall: Registrierung mit Zustimmung ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000001', 'mitzustimmung@example.at',
   jsonb_build_object('full_name', 'Mit Zustimmung',
                      'consented_at', '2026-08-21T12:00:00Z'));

select is(
  (select count(*)::int from public.user_consents
    where user_id = 'e1000000-0000-0000-0000-000000000001'),
  2,
  'Je Pflichtfassung eine Zeile - AGB und Datenschutz');

select is(
  (select count(*)::int from public.user_consents
    where user_id = 'e1000000-0000-0000-0000-000000000001'
      and granted_at = '2026-08-21T12:00:00Z'),
  2,
  'Beide tragen den Zeitpunkt aus der Registrierung');

select is(
  (select array_agg(kind::text order by kind::text) from public.user_consents
    where user_id = 'e1000000-0000-0000-0000-000000000001'),
  array['privacy', 'terms'],
  'Und zwar genau die beiden Arten');

-- Der Trigger legt trotzdem das Profil an - die beiden Trigger sind getrennt.
select is(
  (select count(*)::int from public.profiles
    where id = 'e1000000-0000-0000-0000-000000000001'),
  1,
  'Das Profil entsteht wie bisher');

-- ---------- 2. Ohne Zustimmung ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000002', 'ohne@example.at',
   jsonb_build_object('full_name', 'Ohne Zustimmung'));

select is(
  (select count(*)::int from public.user_consents
    where user_id = 'e1000000-0000-0000-0000-000000000002'),
  0,
  'Ohne consented_at entsteht keine Einwilligung');

select is(
  (select count(*)::int from public.profiles
    where id = 'e1000000-0000-0000-0000-000000000002'),
  1,
  'Das Konto entsteht trotzdem - die Zustimmung wird spaeter nachgeholt');

-- Ein unbrauchbarer Wert darf die Registrierung nicht scheitern lassen: sonst
-- koennte ein kaputter Client niemanden mehr anlegen.
insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000003', 'kaputt@example.at',
   jsonb_build_object('consented_at', 'gestern vielleicht'));

select is(
  (select count(*)::int from public.profiles
    where id = 'e1000000-0000-0000-0000-000000000003'),
  1,
  'Ein unlesbarer Zeitstempel verhindert die Registrierung nicht');

select is(
  (select count(*)::int from public.user_consents
    where user_id = 'e1000000-0000-0000-0000-000000000003'),
  0,
  'Er erzeugt aber auch keine Einwilligung');

-- ---------- 3. Die Fassung bestimmt der Trigger ----------
-- Eine neuere Fassung der AGB, und eine unveroeffentlichte dazu. Ein neues
-- Konto muss die neueste VEROEFFENTLICHTE bekommen - nicht die neueste
-- ueberhaupt, und schon gar nicht eine, die der Client nennt.
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values
  ('terms', 2, 'de', 'AGB, zweite Fassung', 'Zweite Fassung', true, now()),
  ('terms', 3, 'de', 'AGB, Entwurf',        'Entwurf',        true, null);

insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000004', 'neu@example.at',
   jsonb_build_object('consented_at', now()::text));

select is(
  (select d.version from public.user_consents uc
     join public.consent_definitions d on d.id = uc.definition_id
    where uc.user_id = 'e1000000-0000-0000-0000-000000000004' and uc.kind = 'terms'),
  2,
  'Zugestimmt wird der juengsten veroeffentlichten Fassung, nicht dem Entwurf');

select * from finish();
rollback;
