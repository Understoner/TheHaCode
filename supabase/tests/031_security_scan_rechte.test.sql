-- supabase/tests/031_security_scan_rechte.test.sql
--
-- Migration 0031: Rechte nach dem ersten Security-Scan. Missbrauchsfaelle:
-- ein Besucher ohne Konto stoesst eine security-definer-Funktion an, die er
-- nicht braucht; jemand listet die Dateien des oeffentlichen Buckets auf.
-- Gegenprobe: was die App braucht, geht weiter.
begin;
select plan(15);

-- ---------------------------------------------------------- Funktionen
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  'anon kann handle_new_user() nicht aufrufen');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'authenticated kann handle_new_user() nicht aufrufen');
select ok(not has_function_privilege('anon', 'public.handle_new_user_consents()', 'execute'),
  'anon kann handle_new_user_consents() nicht aufrufen');
select ok(not has_function_privilege('anon', 'public.check_exercise_quota()', 'execute'),
  'anon kann check_exercise_quota() nicht aufrufen');
select ok(not has_function_privilege('anon', 'public.has_consent(public.consent_kind)', 'execute'),
  'anon kann has_consent() nicht aufrufen');
select ok(not has_function_privilege('anon', 'public.can_use_habit_template(uuid)', 'execute'),
  'anon kann can_use_habit_template() nicht aufrufen');

-- Gegenprobe: was Policies und App brauchen.
select ok(has_function_privilege('authenticated', 'public.has_consent(public.consent_kind)', 'execute'),
  'authenticated darf has_consent() weiter (Schreib-Policies im Tagebuch)');
select ok(has_function_privilege('anon', 'public.has_plus_access()', 'execute'),
  'anon darf has_plus_access() weiter (news_read, exercises_read)');

-- Der Trigger laeuft trotz entzogenem Recht: neues Konto, neues Profil.
insert into auth.users (id, email) values
  ('a3100000-0000-0000-0000-000000000001', 'rechte@example.at');
select is(
  (select count(*)::int from public.profiles where id = 'a3100000-0000-0000-0000-000000000001'),
  1,
  'handle_new_user legt das Profil weiterhin an');

-- ---------------------------------------------------------- Storage
insert into storage.objects (bucket_id, name) values ('public-assets', 'courses/test-031.png');

-- Missbrauchsfall: ohne Konto die Dateinamen auflisten.
set local role anon;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'public-assets'),
  0,
  'anon kann public-assets nicht mehr auflisten');
reset role;

-- Missbrauchsfall: mit Konto, aber ohne Admin-Rolle.
select set_config('request.jwt.claims',
  json_build_object('sub', 'a3100000-0000-0000-0000-000000000001')::text, true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'public-assets'),
  0,
  'angemeldet ohne Admin-Rolle: nichts aufzulisten');
reset role;

-- Gegenprobe: Admins sehen den Bestand.
select set_config('request.jwt.claims',
  json_build_object('sub', 'a3100000-0000-0000-0000-000000000001',
                    'app_metadata', json_build_object('role', 'admin'))::text, true);
set local role authenticated;
select ok(
  (select count(*) from storage.objects where bucket_id = 'public-assets' and name = 'courses/test-031.png') = 1,
  'Admin kann public-assets auflisten');
reset role;

-- ---------------------------------------------------------- Kategorien
insert into public.exercise_categories (id, slug, title, is_published) values
  ('a3100000-cccc-0000-0000-000000000001', 'test-031-sichtbar', 'Sichtbar', true),
  ('a3100000-cccc-0000-0000-000000000002', 'test-031-versteckt', 'Versteckt', false);

select policies_are('public', 'exercise_categories',
  array['exercise_categories_read_published', 'exercise_categories_admin_write'],
  'exercise_categories: kein using (true) mehr');

-- Ohne Konto heisst auch: keine Claims mehr aus dem Admin-Test oben.
select set_config('request.jwt.claims', '', true);
set local role anon;
-- Missbrauchsfall: eine zurueckgezogene Kategorie ohne Konto lesen.
select is(
  (select count(*)::int from public.exercise_categories where id = 'a3100000-cccc-0000-0000-000000000002'),
  0,
  'anon sieht keine unveroeffentlichte Kategorie');
select is(
  (select count(*)::int from public.exercise_categories where id = 'a3100000-cccc-0000-0000-000000000001'),
  1,
  'anon sieht die veroeffentlichte Kategorie');
reset role;

select * from finish();
rollback;
