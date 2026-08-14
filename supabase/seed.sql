-- Wird bei jedem `npm run db:reset` nach den Migrationen eingespielt.
--
-- Vier fertige Atemsequenzen als ARBEITSVORLAGE. Sie stehen hier und nicht in
-- einer Migration, weil redaktionelle Inhalte ueber Supabase Studio gepflegt
-- werden (CLAUDE.md) - eine Migration wuerde sie ungefragt auch nach Staging
-- und Production schreiben.
--
-- FUER DIE ECHTEN UMGEBUNGEN: einen der Bloecke unten im Studio unter
-- "SQL Editor" ausfuehren und die Werte anpassen. Danach laesst sich alles
-- im Table Editor bearbeiten. Absichtlich ohne Hilfsfunktion ausgeschrieben,
-- damit jeder Block fuer sich kopierbar ist.
--
-- Aufbau je Sequenz (SAD §3.4):
--   exercises              die Uebung selbst (type 'paced', playback_mode 'timer')
--    └── exercise_steps         ein Block, repeat_count = Anzahl Runden
--         └── exercise_phases        die Atemphasen in Reihenfolge
--
-- Box-Atmung braucht genau EINEN Block. Mehrere Bloecke sind fuer Protokolle
-- gedacht, die den Rhythmus wechseln (30 schnelle Atemzuege, dann Retention,
-- dann Recovery) - dafuer eine zweite Zeile in exercise_steps mit position 2.
--
-- Phasen mit Dauer 0 werden weggelassen statt mit 0 eingetragen: 4-7-8 hat
-- kein Halten nach dem Ausatmen, und eine Nullphase waere in der Animation
-- ein Sprung.
--
-- "on conflict (slug) do nothing" macht die Datei mehrfach ausfuehrbar: ist
-- der slug schon da, liefert das INSERT keine Zeile zurueck und die
-- nachfolgenden Bloecke legen ebenfalls nichts an.

insert into public.exercise_categories (slug, title, description, sort_order) values
  ('box',       'Box-Atmung', 'Gleich lange Phasen. Der ruhige Einstieg.',              1),
  ('beruhigen', 'Beruhigen',  'Längeres Ausatmen als Einatmen - senkt die Erregung.',  2)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------------
-- 1) Box-Atmung 4-4-4-4 - der Klassiker, 8 Runden
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, sort_order, is_published
  ) values (
    'box-4-4-4-4',
    (select id from public.exercise_categories where slug = 'box'),
    'paced', 'timer', 'free',
    'Box-Atmung 4-4-4-4', 'Der Klassiker',
    'Vier gleich lange Phasen. Der einfachste Einstieg in die getaktete Atmung: einatmen, halten, ausatmen, halten - jeweils vier Sekunden.',
    'Der gleichmäßige Takt verlängert das Ausatmen gegenüber dem Alltagsatem und beruhigt den Puls. Die gleich langen Haltephasen gewöhnen den Körper sanft an einen höheren CO₂-Wert – das ist der Kern des Trainings.',
    '{entspannend,co2_toleranz,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    8, 1, 1, true
  )
  on conflict (slug) do nothing
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 8 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.cue
from s, (values
  (1, 'inhale',   4, 'Ruhig durch die Nase einatmen'),
  (2, 'hold_in',  4, 'Halten, Schultern locker'),
  (3, 'exhale',   4, 'Langsam ausatmen'),
  (4, 'hold_out', 4, 'Leer halten')
) as v(pos, kind, dur, cue);


-- ---------------------------------------------------------------------------
-- 2) Box-Atmung 6-6-6-6 - dieselbe Form, laenger, 6 Runden
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, sort_order, is_published
  ) values (
    'box-6-6-6-6',
    (select id from public.exercise_categories where slug = 'box'),
    'paced', 'timer', 'free',
    'Box-Atmung 6-6-6-6', 'Wenn 4-4-4-4 zu kurz wird',
    'Dieselbe Form wie 4-4-4-4, nur länger. Sinnvoll, sobald sich der Viererrhythmus mühelos anfühlt.',
    'Die längeren Phasen senken die Atemfrequenz auf etwa 2,5 Atemzüge pro Minute. Der Reiz auf die CO₂-Toleranz ist deutlich stärker als bei 4-4-4-4, die beruhigende Wirkung ebenso.',
    '{co2_toleranz,entspannend,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    6, 2, 2, true
  )
  on conflict (slug) do nothing
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 6 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.cue
from s, (values
  (1, 'inhale',   6, 'Ruhig durch die Nase einatmen'),
  (2, 'hold_in',  6, 'Halten, Schultern locker'),
  (3, 'exhale',   6, 'Langsam ausatmen'),
  (4, 'hold_out', 6, 'Leer halten')
) as v(pos, kind, dur, cue);


-- ---------------------------------------------------------------------------
-- 3) Atmung 4-7-8 - kein Halten nach dem Ausatmen, nur 3 Phasen, 4 Runden
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, sort_order, is_published
  ) values (
    'atem-4-7-8',
    (select id from public.exercise_categories where slug = 'beruhigen'),
    'paced', 'timer', 'free',
    'Atmung 4-7-8', 'Zum Herunterkommen',
    'Das Ausatmen dauert doppelt so lang wie das Einatmen. Vier Runden genügen - diese Sequenz ist bewusst kurz.',
    'Das doppelt so lange Ausatmen betont den Teil des Atems, der den Körper herunterfährt. Die lange Haltephase erhöht zusätzlich den CO₂-Wert. Gut vor dem Einschlafen.',
    '{entspannend,stressreduktion,co2_toleranz}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    4, 2, 3, true
  )
  on conflict (slug) do nothing
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 4 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.cue
from s, (values
  (1, 'inhale',  4, 'Ruhig durch die Nase einatmen'),
  (2, 'hold_in', 7, 'Halten, Schultern locker'),
  (3, 'exhale',  8, 'Langsam durch den Mund ausatmen')
) as v(pos, kind, dur, cue);


-- ---------------------------------------------------------------------------
-- 4) Kohärenzatmung 5,5 - nur Ein- und Ausatmen, 20 Runden
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, sort_order, is_published
  ) values (
    'kohaerenz-5-5',
    (select id from public.exercise_categories where slug = 'beruhigen'),
    'paced', 'timer', 'free',
    'Kohärenzatmung 5,5', 'Gleichmäßig, ohne Halten',
    'Ein- und Ausatmen gleich lang, ohne Pause dazwischen. Etwa fünfeinhalb Atemzüge pro Minute.',
    'Ein- und Ausatmen gleich lang bei etwa fünfeinhalb Atemzügen pro Minute – der Bereich, in dem Herzschlag und Atmung in einen gemeinsamen Rhythmus finden. Ohne Halten, deshalb ohne CO₂-Reiz: reine Beruhigung.',
    '{entspannend,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    20, 1, 4, true
  )
  on conflict (slug) do nothing
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 20 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.cue
from s, (values
  (1, 'inhale', 5.5, 'Ruhig durch die Nase einatmen'),
  (2, 'exhale', 5.5, 'Gleichmäßig ausatmen')
) as v(pos, kind, dur, cue);


-- ---------------------------------------------------------------------------
-- 5) Dreiteilige Session - MEHRERE Bloecke hintereinander
--
-- Das ist die Vorlage fuer alles, was den Rhythmus wechselt. Der Unterschied
-- zu den vier Sequenzen oben: hier gibt es DREI Zeilen in exercise_steps
-- statt einer, jede mit eigener Rundenzahl, eigenen Phasen und einer Pause
-- danach (rest_seconds). Der Player zaehlt dann "Block 2 von 3".
--
-- rest_seconds steht hier ueberall auf 0: die Bloecke sollen ohne
-- Unterbrechung ineinander uebergehen. Die Spalte bleibt trotzdem nutzbar -
-- wer eine Pause will, traegt dort Sekunden ein, und der Player zeigt sie als
-- eigenen Abschnitt an.
--
-- Zum Erweitern: eine weitere Zeile in exercise_steps mit position 4 und die
-- zugehoerigen Phasen. Die Reihenfolge steuert position, nicht die
-- Einfuegereihenfolge.
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, sort_order, is_published
  ) values (
    'aufbau-dreiteilig',
    (select id from public.exercise_categories where slug = 'box'),
    'paced', 'timer', 'free',
    'Aufbau-Session', 'Drei Blöcke, ruhiger werdend',
    'Drei Abschnitte, die ohne Unterbrechung ineinander übergehen: erst ankommen im Viererrhythmus, dann längere Phasen, zum Schluss betont langes Ausatmen.',
    'Der Aufbau nimmt den Körper mit, statt ihn zu überfordern: die CO₂-Toleranz wird über die längeren Haltephasen im zweiten Block trainiert, der dritte Block führt gezielt herunter. Als Ganzes wirkt die Session eher beruhigend.',
    '{co2_toleranz,entspannend,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    4, 2, 5, true
  )
  on conflict (slug) do nothing
  returning id
),
-- Block 1: ankommen, 4-4-4-4, ohne Pause danach
s1 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 1, 'Ankommen', 4, 0 from e
  returning id
),
p1 as (
  insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
  select s1.id, v.pos, v.kind::phase_kind, v.dur, v.cue
  from s1, (values
    (1, 'inhale',   4, 'Ruhig durch die Nase einatmen'),
    (2, 'hold_in',  4, 'Halten, Schultern locker'),
    (3, 'exhale',   4, 'Langsam ausatmen'),
    (4, 'hold_out', 4, 'Leer halten')
  ) as v(pos, kind, dur, cue)
  returning step_id
),
-- Block 2: vertiefen, 6-6-6-6, ohne Pause danach
s2 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 2, 'Vertiefen', 4, 0 from e
  returning id
),
p2 as (
  insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
  select s2.id, v.pos, v.kind::phase_kind, v.dur, v.cue
  from s2, (values
    (1, 'inhale',   6, 'Tiefer einatmen, ohne zu pressen'),
    (2, 'hold_in',  6, 'Halten, Kiefer locker'),
    (3, 'exhale',   6, 'Gleichmäßig ausatmen'),
    (4, 'hold_out', 6, 'Leer halten')
  ) as v(pos, kind, dur, cue)
  returning step_id
),
-- Block 3: herunterfahren, 4-7-8
s3 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 3, 'Herunterfahren', 4, 0 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
select s3.id, v.pos, v.kind::phase_kind, v.dur, v.cue
from s3, (values
  (1, 'inhale',  4, 'Ruhig einatmen'),
  (2, 'hold_in', 7, 'Halten'),
  (3, 'exhale',  8, 'Lang durch den Mund ausatmen')
) as v(pos, kind, dur, cue);
