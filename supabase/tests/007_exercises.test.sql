-- supabase/tests/007_exercises.test.sql
--
-- Missbrauchsfaelle zuerst (CLAUDE.md: pro Policy ein Missbrauchstest, nicht
-- nur der Normalfall). Drei Wege fuehren hier an Inhalte, die nicht jeder
-- sehen darf, und alle drei werden geprueft:
--   1. direkt ueber exercises
--   2. ueber die Kindtabellen exercise_steps / exercise_phases
--   3. ueber die View v_exercise_duration
-- Der dritte Weg ist der leiseste: eine View laeuft ohne security_invoker mit
-- den Rechten ihres Eigentuemers und umgeht damit die RLS der Tabellen
-- darunter. Genau das prueft Test 6.
begin;
select plan(12);

-- ---------- Fixtures (als postgres, RLS greift hier nicht) ----------
-- seed.sql legt vier Beispielsequenzen an. Die sind Redaktionsdaten und
-- duerfen sich jederzeit aendern - ein Test, der ihre Anzahl mitzaehlt, waere
-- ab der ersten Aenderung rot. Deshalb hier ein definierter Ausgangszustand;
-- das Ganze laeuft in einer Transaktion und wird am Ende zurueckgerollt.
delete from public.exercises;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ohne-plus@example.at'),
  ('a0000000-0000-0000-0000-000000000002', 'mit-plus@example.at');

-- Plus nur ueber service_role - der Trigger aus 0001 laesst nichts anderes zu
set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a0000000-0000-0000-0000-000000000002';
reset role;

insert into public.exercises (id, slug, type, visibility, title, default_round_count, is_published) values
  ('e0000000-0000-0000-0000-000000000001', 'frei-veroeffentlicht', 'paced', 'free', 'Frei',        4, true),
  ('e0000000-0000-0000-0000-000000000002', 'entwurf',              'paced', 'free', 'Entwurf',     4, false),
  ('e0000000-0000-0000-0000-000000000003', 'nur-plus',             'paced', 'plus', 'Nur fuer Plus', 4, true);

insert into public.exercise_steps (id, exercise_id, position, repeat_count) values
  ('50000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 4),
  ('50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 1, 4),
  ('50000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 1, 4);

insert into public.exercise_phases (step_id, position, kind, duration_seconds) values
  ('50000000-0000-0000-0000-000000000001', 1, 'inhale', 4),
  ('50000000-0000-0000-0000-000000000002', 1, 'inhale', 4),
  ('50000000-0000-0000-0000-000000000003', 1, 'inhale', 4);

-- ---------- anon: der oeffentliche Katalog ----------
set local role anon;

select is(
  (select count(*)::int from public.exercises),
  1,
  'anon sieht nur die veroeffentlichte freie Uebung'
);

select is(
  (select slug from public.exercises),
  'frei-veroeffentlicht',
  'und zwar die richtige - weder Entwurf noch Plus-Inhalt'
);

-- Missbrauchsfall: der Umweg ueber die Kindtabellen
select is(
  (select count(*)::int from public.exercise_steps
    where exercise_id <> 'e0000000-0000-0000-0000-000000000001'),
  0,
  'anon kommt ueber exercise_steps nicht an Entwurf oder Plus-Inhalt'
);

select is(
  (select count(*)::int from public.exercise_phases
    where step_id <> '50000000-0000-0000-0000-000000000001'),
  0,
  'anon kommt ueber exercise_phases nicht an Entwurf oder Plus-Inhalt'
);

-- Normalfall: die Bloecke der sichtbaren Uebung sind lesbar
select is(
  (select count(*)::int from public.exercise_steps),
  1,
  'die Bloecke der sichtbaren Uebung bleiben lesbar'
);

-- Missbrauchsfall: die View als Hintertuer. Ohne security_invoker = true
-- lieferte sie hier drei Zeilen statt einer.
select is(
  (select count(*)::int from public.v_exercise_duration),
  1,
  'v_exercise_duration verraet anon keine Dauer gesperrter Uebungen'
);

-- Missbrauchsfall: anon darf nichts anlegen (kein Grant)
select throws_ok(
  $$ insert into public.exercises (slug, type, visibility, title, default_round_count)
     values ('x', 'paced', 'free', 'x', 4) $$,
  'permission denied for table exercises',
  'anon darf keine Uebung anlegen'
);

reset role;

-- ---------- angemeldet, aber ohne Plus ----------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-0000-0000-000000000001')::text,
  true
);
set local role authenticated;

select is(
  (select count(*)::int from public.exercises where slug = 'nur-plus'),
  0,
  'ohne Plus bleibt der Plus-Inhalt unsichtbar'
);

-- Der Kern des Geschaeftsmodells: die Pruefung sitzt am INSERT, nicht am
-- SELECT (CLAUDE.md §Zugriff). Ohne Plus keine eigene Sequenz.
select throws_ok(
  $$ insert into public.exercises (owner_id, type, playback_mode, visibility, title, default_round_count, is_published)
     values ('a0000000-0000-0000-0000-000000000001', 'paced', 'timer', 'plus', 'Meine', 4, false) $$,
  'new row violates row-level security policy for table "exercises"',
  'ohne Plus laesst sich keine eigene Sequenz speichern'
);

reset role;

-- ---------- angemeldet mit Plus ----------
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-0000-0000-000000000002')::text,
  true
);
set local role authenticated;

select is(
  (select count(*)::int from public.exercises where slug = 'nur-plus'),
  1,
  'mit Plus wird der Plus-Inhalt sichtbar'
);

select lives_ok(
  $$ insert into public.exercises (owner_id, type, playback_mode, visibility, title, default_round_count, is_published)
     values ('a0000000-0000-0000-0000-000000000002', 'paced', 'timer', 'plus', 'Meine Sequenz', 4, false) $$,
  'mit Plus laesst sich eine eigene Sequenz speichern'
);

-- Missbrauchsfall: eigene Sequenzen duerfen nie im oeffentlichen Katalog
-- landen. Ohne diese Bedingung koennte sich jeder Plus-Nutzer selbst
-- veroeffentlichen.
select throws_ok(
  $$ insert into public.exercises (owner_id, type, playback_mode, visibility, title, default_round_count, is_published)
     values ('a0000000-0000-0000-0000-000000000002', 'paced', 'timer', 'plus', 'Ins Schaufenster', 4, true) $$,
  'new row violates row-level security policy for table "exercises"',
  'auch mit Plus laesst sich keine eigene Sequenz veroeffentlichen'
);

reset role;

select * from finish();
rollback;
