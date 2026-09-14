-- supabase/tests/018_stimme_vorgabe_an.test.sql
--
-- Migration 0018 dreht eine Vorgabe um und stellt bestehende Profile einmalig
-- um. Geprueft wird, dass die Vorgabe dort ankommt, wo sie wirkt - beim
-- Anlegen eines Kontos ueber den Trigger auf auth.users -, und dass eine
-- spaeter gespeicherte Abschaltung bestehen bleibt.
--
-- Das einmalige Umstellen selbst laesst sich hier nicht pruefen: die Tests
-- laufen gegen eine frische Datenbank, in der es vor 0018 keine Profile gab.
-- Die Zugriffsregeln auf voice_enabled prueft weiterhin 016.
begin;
select plan(4);

select col_default_is(
  'public', 'profiles', 'voice_enabled', 'true',
  'voice_enabled hat die Vorgabe true');

insert into auth.users (id, email) values
  ('f1800000-0000-0000-0000-000000000001', 'neu-mit-stimme@example.at');

select is(
  (select voice_enabled from public.profiles where id = 'f1800000-0000-0000-0000-000000000001'),
  true,
  'Ein neues Konto hat die Stimme an');

select is(
  (select sound_enabled from public.profiles where id = 'f1800000-0000-0000-0000-000000000001'),
  true,
  'Der Ton bleibt bei einem neuen Konto an');

-- Der Missbrauchsfall einer Vorgabe ist die stille Rueckkehr: wer die Stimme
-- abgeschaltet hat, darf sie nicht wieder hoeren, nur weil die Zeile spaeter
-- aus anderem Grund geschrieben wird.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1800000-0000-0000-0000-000000000001', true);
update public.profiles set voice_enabled = false where id = 'f1800000-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Umbenannt' where id = 'f1800000-0000-0000-0000-000000000001';
reset role;

select is(
  (select voice_enabled from public.profiles where id = 'f1800000-0000-0000-0000-000000000001'),
  false,
  'Eine abgeschaltete Stimme bleibt aus, auch wenn die Zeile spaeter geschrieben wird');

select * from finish();
rollback;
