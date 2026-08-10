-- supabase/tests/004_storage_public_assets.test.sql
begin;
select plan(5);

-- Normalfall: oeffentliches Lesen funktioniert ohne Anmeldung (auch ohne
-- passende Zeilen ist der Zugriff selbst erlaubt, kein Fehler)
set local role anon;

select lives_ok(
  $$ select count(*) from storage.objects where bucket_id = 'public-assets' $$,
  'anon darf den public-assets-Bucket lesen'
);

-- Missbrauchsfall: anon darf nichts hochladen
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('public-assets', 'courses/x.png') $$,
  'new row violates row-level security policy for table "objects"',
  'anon darf keine Datei in public-assets hochladen'
);

reset role;

-- Missbrauchsfall: angemeldeter Nutzer ohne Admin-Rolle darf nichts hochladen
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('public-assets', 'courses/x.png') $$,
  'new row violates row-level security policy for table "objects"',
  'angemeldeter Nutzer ohne Admin-Rolle darf nichts hochladen'
);

reset role;

-- Admin darf nur in die vorgesehenen Ordner hochladen - die Allowlist greift,
-- nicht nur is_admin()
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'app_metadata', json_build_object('role', 'admin')
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('public-assets', 'nicht-erlaubt/x.png') $$,
  'new row violates row-level security policy for table "objects"',
  'auch ein Admin darf nicht ausserhalb der Ordner-Allowlist hochladen'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('public-assets', 'courses/x.png') $$,
  'Admin darf in einen erlaubten Ordner hochladen'
);

reset role;

select * from finish();
rollback;
