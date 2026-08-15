-- supabase/tests/009_save_exercise.test.sql
--
-- save_exercise() ist der einzige Schreibweg fuer eigene Sequenzen. Sie ist
-- bewusst "security invoker" - die Bezahlschranke bleibt damit die
-- INSERT-Policy auf exercises. Genau das wird hier geprueft, und zwar zuerst
-- als Missbrauchsfall (CLAUDE.md: pro Policy ein Missbrauchstest):
--
--   1. ohne Plus laesst sich nichts anlegen  <- die Bezahlschranke
--   2. fremde Sequenzen lassen sich nicht ueberschreiben
--   3. eigene Sequenzen landen nie im oeffentlichen Katalog
--   4. ein Fehler mittendrin hinterlaesst keine halbe Sequenz
begin;
select plan(12);

delete from public.exercises;

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'ohne-plus@example.at'),
  ('b0000000-0000-0000-0000-000000000002', 'mit-plus@example.at'),
  ('b0000000-0000-0000-0000-000000000003', 'fremder@example.at');

-- Plus nur ueber service_role - der Trigger aus 0001 laesst nichts anderes zu.
set local role service_role;
update public.profiles set has_active_subscription = true
 where id in ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003');
reset role;

-- Eine vollstaendige Sequenz als JSON - zwei Bloecke, damit auch die
-- Reihenfolge und die Pause dazwischen geprueft sind.
create temporary table fixture_steps (payload jsonb);
-- Ohne dieses Grant scheitert schon der Lesezugriff auf die Testdaten, und
-- der erste throws_ok waere aus dem falschen Grund gruen gewesen: 42501 vom
-- Temp-Table sieht genauso aus wie 42501 von der Policy. Deshalb unten auch
-- die Meldung selbst gepinnt, nicht nur der Fehlercode.
grant select on fixture_steps to authenticated;
insert into fixture_steps values ($json$
[
  { "label": "Aufwaermen", "repeat_count": 4, "rest_seconds": 30,
    "phases": [
      { "kind": "inhale",   "duration_seconds": 4, "cue_text": "durch die Nase" },
      { "kind": "hold_in",  "duration_seconds": 4 },
      { "kind": "exhale",   "duration_seconds": 4 },
      { "kind": "hold_out", "duration_seconds": 4 }
    ] },
  { "repeat_count": 6, "rest_seconds": 0,
    "phases": [
      { "kind": "inhale", "duration_seconds": 5.5 },
      { "kind": "exhale", "duration_seconds": 5.5 }
    ] }
]
$json$::jsonb);

-- ---------- 1. Die Bezahlschranke ----------
-- Der wichtigste Test der Datei: ohne Plus scheitert das Anlegen an der
-- INSERT-Policy aus 0007, nicht an einer Pruefung in der Funktion.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ select public.save_exercise(null, 'Ohne Plus', null,
       (select payload from fixture_steps)) $$,
  '42501',
  'new row violates row-level security policy for table "exercises"',
  'ohne Plus scheitert das Anlegen an der INSERT-Policy - nicht an der Funktion'
);

select is(
  (select count(*)::int from public.exercises),
  0,
  'und es bleibt auch keine leere Huelle zurueck'
);

-- ---------- 2. Mit Plus: der Normalfall ----------
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ select public.save_exercise(null, '  Meine Sequenz  ', null,
       (select payload from fixture_steps)) $$,
  'mit Plus laesst sich eine Sequenz anlegen'
);

select is(
  (select title from public.exercises where owner_id = 'b0000000-0000-0000-0000-000000000002'),
  'Meine Sequenz',
  'der Titel wird getrimmt gespeichert'
);

select is(
  (select count(*)::int from public.exercise_steps s
     join public.exercises e on e.id = s.exercise_id
    where e.owner_id = 'b0000000-0000-0000-0000-000000000002'),
  2,
  'beide Bloecke sind da'
);

select is(
  (select count(*)::int from public.exercise_phases p
     join public.exercise_steps s on s.id = p.step_id
     join public.exercises e on e.id = s.exercise_id
    where e.owner_id = 'b0000000-0000-0000-0000-000000000002'),
  6,
  'und alle sechs Phasen'
);

-- ---------- 3. Eigene Sequenzen bleiben aus dem Katalog ----------
-- Sonst haette ein einzelner Nutzer die Startseite aller anderen in der Hand.
select is(
  (select array[visibility::text, is_published::text, type::text]
     from public.exercises where owner_id = 'b0000000-0000-0000-0000-000000000002'),
  array['plus', 'false', 'paced'],
  'eine eigene Sequenz ist nie veroeffentlicht und immer eine Timer-Sequenz'
);

-- ---------- 4. Fremde Sequenzen ----------
-- Die ID muss VON AUSSEN kommen. Ein erster Entwurf hat sie im Test selbst per
-- Unterabfrage geholt - als der Fremde die Sequenz wegen RLS gar nicht sieht,
-- kam dort NULL heraus, die Funktion nahm den Anlege-Zweig, und der Test war
-- gruen, ohne je einen Angriff versucht zu haben. Der echte Angreifer kennt
-- die ID aber, etwa aus einem geteilten Link.
reset role;
create temporary table fremde_id (id uuid);
insert into fremde_id select id from public.exercises where title = 'Meine Sequenz';
grant select on fremde_id to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$ select public.save_exercise(
       (select id from fremde_id),
       'Uebernommen', null, (select payload from fixture_steps)) $$,
  'Diese Sequenz laesst sich nicht speichern',
  'eine fremde Sequenz laesst sich mit bekannter ID nicht ueberschreiben - auch mit Plus nicht'
);

reset role;
select is(
  (select count(*)::int from public.exercises where owner_id = 'b0000000-0000-0000-0000-000000000003'),
  0,
  'und der Angriff legt auch keine neue Sequenz beim Angreifer an'
);
select is(
  (select title from public.exercises where owner_id = 'b0000000-0000-0000-0000-000000000002'),
  'Meine Sequenz',
  'und der Titel des Eigentuemers steht unveraendert da'
);

-- ---------- 5. Ganz oder gar nicht ----------
-- Ein ungueltiger Phasentyp im zweiten Block muss den ganzen Aufruf
-- zuruecknehmen. Bliebe die Uebung stehen, haette der Nutzer eine Sequenz in
-- seiner Liste, die sich oeffnen laesst und nichts abspielt.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$ select public.save_exercise(null, 'Kaputt', null, $json$
       [{ "repeat_count": 1, "rest_seconds": 0,
          "phases": [{ "kind": "gibtesnicht", "duration_seconds": 4 }] }]
     $json$::jsonb) $$,
  '22P02',
  null,
  'ein ungueltiger Phasentyp laesst den Aufruf scheitern'
);

reset role;
select is(
  (select count(*)::int from public.exercises where title = 'Kaputt'),
  0,
  'und hinterlaesst keine halbe Sequenz'
);

select * from finish();
rollback;
