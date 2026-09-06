-- Wird bei jedem `npm run db:reset` nach den Migrationen eingespielt.
--
-- Zehn fertige Atemsequenzen als ARBEITSVORLAGE. Sie stehen hier und nicht in
-- einer Migration, weil redaktionelle Inhalte ueber Supabase Studio gepflegt
-- werden (CLAUDE.md) - eine Migration wuerde sie ungefragt auch nach Staging
-- und Production schreiben.
--
-- FUER DIE ECHTEN UMGEBUNGEN: diese Datei im Studio unter "SQL Editor"
-- ausfuehren. Sie ersetzt den redaktionellen Bestand vollstaendig (siehe das
-- DELETE gleich unten) und laesst selbst gebaute Nutzersequenzen unangetastet.
-- Danach ist alles im Table Editor bearbeitbar. Absichtlich ohne
-- Hilfsfunktion ausgeschrieben, damit jeder Block fuer sich kopierbar ist.
--
-- ERST DIE MIGRATIONEN, DANN DIESE DATEI. Die Sequenzen tragen den Atemweg,
-- und die Spalte dafuer entsteht in Migration 0016. In den echten Umgebungen
-- rollt die Pipeline die Migrationen nach dem Merge nach develop bzw. main aus
-- (docs/DEPLOYMENT.md) - vorher steht die Spalte dort nicht. Die Pruefung
-- gleich unten sagt das notfalls noch einmal.
--
-- Aufbau je Sequenz (SAD §3.4):
--   exercises              die Uebung selbst (type 'paced', playback_mode 'timer')
--    └── exercise_steps         ein Block, repeat_count = Anzahl Runden
--         └── exercise_phases        die Atemphasen in Reihenfolge
--
-- Eine Sequenz mit gleichbleibendem Takt braucht genau EINEN Block. Mehrere
-- Bloecke sind fuer Protokolle gedacht, die den Rhythmus wechseln - die
-- Sequenzen 8 bis 10 sind genau das, mit einer Zeile in exercise_steps je
-- Stufe.
--
-- Phasen mit Dauer 0 werden weggelassen statt mit 0 eingetragen: eine
-- Nullphase waere in der Animation ein Sprung.
--
-- ---------------------------------------------------------------------------
-- WAS DIESE ZEHN SEQUENZEN INHALTLICH LEITET
-- ---------------------------------------------------------------------------
-- Funktionale Atmung und die Prinzipien der Restorative Breathing®:
--
--   * NASE VOR MUND. Eingeatmet wird durchgehend durch die Nase - sie filtert,
--     befeuchtet und erzeugt den Widerstand, der das Zwerchfell ueberhaupt
--     erst arbeiten laesst. Durch den Mund wird nur dort ausgeatmet, wo der
--     Reiz gewollt ist (Sequenz 1 und 10, Stufe 1).
--   * WEICHER KEHLKOPF. Keine Ujjayi-Enge, kein hoerbares Reiben. Wo ein
--     Widerstand gewollt ist, kommt er von den Lippen (Lippenbremse), nicht
--     von der Glottis.
--   * KEINE ERZWUNGENEN HALTEPHASEN. Gehalten wird die Ruhe, nicht die Luft:
--     ohne Zudruecken, ohne Pressen, ohne Anspannen von Bauch oder Kehle. Wo
--     eine lange Haltephase Lufthunger erzeugen wuerde, ist sie verkuerzt -
--     Sequenz 3 ist genau darum die restorative Fassung der klassischen Box.
--   * BIOMECHANISCHE ENTLASTUNG. Dreidimensionale Zwerchfellbewegung statt
--     Brustkorbheben; Schultern, Kiefer und Nacken bleiben unbeteiligt. Die
--     cue_text-Zeilen sagen das an genau den Stellen, an denen es kippt.
--
-- Der Atemweg steht seit Migration 0016 als eigene Spalte (route) und nicht
-- mehr nur im Fliesstext. Haltephasen bekommen keinen Atemweg: dort stroemt
-- nichts.
--
-- Weil der Player den Atemweg jetzt selbst anzeigt, sagt cue_text ihn NICHT
-- noch einmal. Die beiden Zeilen teilen sich die Arbeit: die eine sagt,
-- wodurch die Luft geht, die andere, worauf dabei zu achten ist.
--
-- estimated_seconds traegt die tatsaechliche Gesamtdauer, nicht die gerundete
-- Wunschdauer: die Rundenzahl muss ganzzahlig sein, und ein angezeigter Wert,
-- der nicht zur laufenden Uhr passt, waere eine zweite Wahrheit. Wo beides
-- auseinanderfaellt, steht es im Kommentar ueber der Sequenz.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Laeuft diese Datei zu frueh?
-- ---------------------------------------------------------------------------
-- Ohne diese Pruefung scheitert der erste INSERT weiter unten mit
--
--   ERROR: 42703: column "route" of relation "exercise_phases" does not exist
--
-- und dieser Satz sagt niemandem, was zu tun ist. Er sagt vor allem nicht,
-- dass bis dahin schon geloescht wurde: das DELETE gleich darunter waere
-- gelaufen, die neuen Sequenzen nicht - die Umgebung stuende ohne jede
-- Sequenz da, bis jemand die Datei ein zweites Mal ausfuehrt.
--
-- Deshalb wird hier abgebrochen, bevor irgendetwas angefasst wird. Deutsch,
-- ohne Technikjargon, mit Handlungsoption (CLAUDE.md §Immer).
do $$
begin
  if to_regtype('public.breath_route') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name   = 'exercise_phases'
          and column_name  = 'route'
     ) then
    raise exception
      'In dieser Umgebung fehlt Migration 0016 (Atemweg). Es wurde nichts '
      'geaendert. Erst die Migrationen ausrollen lassen - nach dem Merge '
      'erledigt das die Pipeline von selbst, siehe docs/DEPLOYMENT.md - und '
      'diese Datei danach noch einmal ausfuehren.';
  end if;
end $$;

-- Der redaktionelle Bestand wird ersetzt, nicht ergaenzt. Die Bedingung auf
-- owner_id ist die ganze Sicherheit dieser Zeile: selbst gebaute Sequenzen
-- haben eine owner_id und bleiben stehen. Bloecke und Phasen haengen per
-- cascade daran und verschwinden mit.
delete from public.exercises where owner_id is null;

insert into public.exercise_categories (slug, title, description, sort_order) values
  ('aktivieren', 'Aktivieren', 'Kurzes Einatmen, betontes Ausatmen. Bringt in Gang.',      1),
  ('box',        'Box-Atmung', 'Gleich lange Phasen. Der ruhige Einstieg.',                2),
  ('beruhigen',  'Beruhigen',  'Längeres Ausatmen als Einatmen - senkt die Erregung.',     3)
on conflict (slug) do update
  set title = excluded.title,
      description = excluded.description,
      sort_order = excluded.sort_order;


-- ---------------------------------------------------------------------------
-- 1) Morning Ignition - 5-3-2-2, 15 Runden = 180 s (3 Min)
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'morning-ignition',
    (select id from public.exercise_categories where slug = 'aktivieren'),
    'paced', 'timer', 'free',
    'Morning Ignition', 'Wachwerden in drei Minuten',
    'Langes Einatmen durch die Nase, kurzes kräftiges Ausatmen durch den Mund. Das Verhältnis ist umgekehrt zu allem, was beruhigt - genau darum wirkt es.',
    'Hebt den Sympathikustonus sanft an, vertreibt morgendliche Trägheit und steigert die Vigilanz. Das betonte Ausatmen durch den Mund macht den Reiz spürbar, ohne dass es in eine Hyperventilation kippt: die kurzen Haltephasen halten den CO₂-Wert in Grenzen. Eingeatmet wird trotzdem konsequent durch die Nase - sie erzeugt den Widerstand, den das Zwerchfell zum Arbeiten braucht.',
    '{aktivierend}',
    'Nicht bei Neigung zu Hyperventilation, Panikattacken oder Migräne mit Aura. Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    15, 2, 180, 1, true
  )
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 15 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s, (values
  (1, 'inhale',   5, 'nose', 'In die Flanken einatmen, Schultern bleiben unten'),
  (2, 'hold_in',  3, null,   'Halten ohne zuzudrücken - Kehle bleibt weich'),
  (3, 'exhale',   2, 'mouth','Kräftig ausstoßen'),
  (4, 'hold_out', 2, null,   'Kurz leer bleiben, ohne nachzuschieben')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 2) Oxygen-Charge - 4-6-4-2, 15 Runden = 240 s (4 Min)
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'oxygen-charge',
    (select id from public.exercise_categories where slug = 'aktivieren'),
    'paced', 'timer', 'free',
    'Oxygen-Charge', 'Wach, aber ruhig',
    'Die betonte Haltephase nach dem Einatmen ist der Kern: sechs Sekunden, in denen die Luft in den Lungenbläschen steht und Zeit für den Gasaustausch hat. Ein- und ausgeatmet wird durch die Nase.',
    'Verlängert die Kontaktzeit in den Alveolen und schärft dadurch die Sinne, ohne die Unruhe zu erzeugen, die schnelles Atmen mitbringt. Die kurze Haltephase am Ende hält den Zyklus in Bewegung. Gehalten wird locker - sobald sich Druck im Hals oder Bauch aufbaut, ist die Phase zu lang und die Sequenz die falsche für heute.',
    '{aktivierend,co2_toleranz}',
    'Bei Schwangerschaft, Epilepsie, Bluthochdruck oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    15, 2, 240, 2, true
  )
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 15 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s, (values
  (1, 'inhale',   4, 'nose', 'Ruhig einatmen, unten breit werden'),
  (2, 'hold_in',  6, null,   'Halten, ohne zu pressen - Kiefer und Kehle locker'),
  (3, 'exhale',   4, 'nose', 'Gleichmäßig ausatmen'),
  (4, 'hold_out', 2, null,   'Kurz leer, dann weiter')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 3) Grounded Flow - 4-2-4-2, 25 Runden = 300 s (5 Min)
--    Die restorative Fassung der Box: verkuerzte Haltephasen.
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'grounded-flow',
    (select id from public.exercise_categories where slug = 'box'),
    'paced', 'timer', 'free',
    'Grounded Flow', 'Box-Atmung, restorativ',
    'Die klassische Box mit halbierten Haltephasen. Vier Sekunden ein, zwei halten, vier aus, zwei halten - lautlos durch die Nase, mit dreidimensionaler Zwerchfellbewegung.',
    'Die verkürzten Haltephasen sind der ganze Unterschied: Sie verhindern den Lufthunger, der bei 4-4-4-4 viele dazu bringt, die Luft zuzudrücken und den Rumpf zu verspannen. Genau diese Verspannung ist es, die eine beruhigend gemeinte Übung anstrengend macht. Was bleibt, ist der gleichmäßige Takt - regulierend, entlastend und lange durchhaltbar.',
    '{entspannend,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    25, 1, 300, 3, true
  )
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 25 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s, (values
  (1, 'inhale',   4, 'nose', 'Lautlos einatmen - Bauch, Flanken und Rücken weiten sich'),
  (2, 'hold_in',  2, null,   'Kurz halten, nichts festhalten'),
  (3, 'exhale',   4, 'nose', 'Ausatmen lassen, ohne zu drücken'),
  (4, 'hold_out', 2, null,   'Zwei Sekunden Ruhe, dann kommt der Atem von selbst')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 4) Classical SEAL Balance - 4-4-4-4, 19 Runden = 304 s
--    Wunschdauer 300 s; 19 Runden liegen naeher dran als 18 (288 s).
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'classical-seal-balance',
    (select id from public.exercise_categories where slug = 'box'),
    'paced', 'timer', 'free',
    'Classical SEAL Balance', 'Die klassische Box',
    'Vier gleich lange Phasen, das bekannteste Muster der getakteten Atmung. Durch die Nase ein und aus, fünf Minuten lang.',
    'Neutralisiert Stressspitzen, stabilisiert die Herzratenvariabilität und ordnet die Gedanken. Der gleichmäßige Takt gibt dem Nervensystem eine Struktur, an der es sich ausrichtet. Wenn sich die Haltephasen eng anfühlen oder der Bauch dabei hart wird, ist Grounded Flow die passendere Sequenz - erzwungenes Halten arbeitet gegen den Zweck der Übung.',
    '{stressreduktion,entspannend,co2_toleranz}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    19, 1, 304, 4, true
  )
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 19 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s, (values
  (1, 'inhale',   4, 'nose', 'Ruhig einatmen'),
  (2, 'hold_in',  4, null,   'Halten, Schultern und Kiefer locker'),
  (3, 'exhale',   4, 'nose', 'Gleichmäßig ausatmen'),
  (4, 'hold_out', 4, null,   'Leer halten, ohne Anspannung')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 5) Deep Cognitive Focus - 5-5-5-5, 18 Runden = 360 s (6 Min)
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'deep-cognitive-focus',
    (select id from public.exercise_categories where slug = 'box'),
    'paced', 'timer', 'free',
    'Deep Cognitive Focus', 'Drei Atemzüge pro Minute',
    'Fünf Sekunden je Phase - ein Zyklus dauert zwanzig Sekunden, macht drei Atemzüge in der Minute. Der ruhigste Takt dieser Sammlung ohne Betonung des Ausatmens.',
    'Die langen, gleich langen Phasen holen ein hohes Lungenvolumen ohne Anstrengung und geben dem mentalen Rauschen nichts mehr, woran es sich halten kann. Gedacht als Vorbereitung auf konzentrierte Arbeit, nicht zum Einschlafen: der Takt ist ruhig, aber symmetrisch - er führt nicht herunter, er stellt still.',
    '{co2_toleranz,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    18, 2, 360, 5, true
  )
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 18 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s, (values
  (1, 'inhale',   5, 'nose', 'Langsam einatmen, bis unten breit'),
  (2, 'hold_in',  5, null,   'Halten - der Brustkorb bleibt ruhig, nichts drückt'),
  (3, 'exhale',   5, 'nose', 'Fein und gleichmäßig ausatmen'),
  (4, 'hold_out', 5, null,   'Leer bleiben, ohne auf den nächsten Atemzug zu warten')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 6) Vagal Downshift - 4-4-6-2, 19 Runden = 304 s
--    Wunschdauer 300 s; 19 Runden liegen naeher dran als 18 (288 s).
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'vagal-downshift',
    (select id from public.exercise_categories where slug = 'beruhigen'),
    'paced', 'timer', 'free',
    'Vagal Downshift', 'Runterkommen über die Lippenbremse',
    'Ausgeatmet wird gegen einen sanften Widerstand: die Lippen leicht gespitzt, als würde man eine Kerze zum Flackern und nicht zum Ausgehen bringen. Sechs Sekunden lang, doppelt so lang wie die Ruhe danach.',
    'Der dosierte Ausatemwiderstand stimuliert den Vagusnerv und senkt die Herzfrequenz rascher, als es ein gleich langes Ausatmen ohne Widerstand täte. Wichtig ist, wo der Widerstand entsteht: an den Lippen, nicht im Hals. Eine enggestellte Glottis erzeugt zwar ein ähnliches Geräusch, aber Druck statt Entlastung.',
    '{entspannend,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    19, 1, 304, 6, true
  )
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 19 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s, (values
  (1, 'inhale',   4, 'nose',        'Ruhig einatmen'),
  (2, 'hold_in',  4, null,          'Halten, ohne die Kehle zu schließen'),
  (3, 'exhale',   6, 'pursed_lips', 'Lippen leicht spitzen und fein ausströmen lassen'),
  (4, 'hold_out', 2, null,          'Kurz leer, dann kommt der Atem von selbst')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 7) Night-Downfall - 4-3-8-3, 23 Runden = 414 s
--    Wunschdauer 420 s; 23 Runden liegen naeher dran als 24 (432 s).
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'night-downfall',
    (select id from public.exercise_categories where slug = 'beruhigen'),
    'paced', 'timer', 'free',
    'Night-Downfall', 'Sieben Minuten vor dem Schlafen',
    'Das Ausatmen dauert doppelt so lang wie das Einatmen und läuft sacht durch die Nase - ohne Lippenbremse, ohne Betonung, ohne Anstrengung. Die stärkste beruhigende Sequenz dieser Sammlung.',
    'Ein Ausatmen, das doppelt so lang ist wie das Einatmen, bringt den Parasympathikus in die Führung: Herzfrequenz, Muskeltonus und Blutdruck gehen mit. Die kurzen Haltephasen halten den Takt zusammen, ohne Lufthunger zu erzeugen. Im Liegen üben, und wenn das Zählen dabei einschläft, ist das kein Abbruch, sondern das Ziel.',
    '{entspannend}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    23, 1, 414, 7, true
  )
  returning id
), s as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count)
  select id, 1, 'Zyklus', 23 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s, (values
  (1, 'inhale',   4, 'nose', 'Sacht einatmen, ohne den Brustkorb zu heben'),
  (2, 'hold_in',  3, null,   'Kurz halten, alles bleibt weich'),
  (3, 'exhale',   8, 'nose', 'Lang und leise ausströmen lassen'),
  (4, 'hold_out', 3, null,   'Leer bleiben und nachspüren')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 8) Progressive Down-Regulator - drei Stufen = 361 s
--    Wunschdauer 360 s, je Stufe 120 s. Ganzzahlige Rundenzahlen ergeben
--    128 + 119 + 114 s; in der Summe eine Sekunde ueber dem Ziel.
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'progressive-down-regulator',
    (select id from public.exercise_categories where slug = 'beruhigen'),
    'paced', 'timer', 'free',
    'Progressive Down-Regulator', 'Drei Stufen in den Schlafmodus',
    'Drei Abschnitte, die ohne Unterbrechung ineinander übergehen: erst ein neutraler Reset im Viererrhythmus, dann die Lippenbremse, zuletzt das doppelt lange Ausatmen durch die Nase.',
    'Stufenweiser Spannungsabbau statt eines Sprungs: Wer aus dem Alltag kommt, findet einen 4-3-8-4-Takt oft zu ruhig, um sich darauf einzulassen. Der neutrale Einstieg holt ab, die vagale Dehnung in Stufe zwei senkt die Erregung, und erst die dritte Stufe führt in die Tiefe. Der Atemweg wechselt mit: Nase, Lippenbremse, Nase.',
    '{entspannend,stressreduktion}',
    'Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    8, 2, 361, 8, true
  )
  returning id
),
-- Stufe 1: neutraler Reset, 4-4-4-4, 8 Runden = 128 s
s1 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 1, 'Reset', 8, 0 from e
  returning id
),
p1 as (
  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
  select s1.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
  from s1, (values
    (1, 'inhale',   4, 'nose', 'Ruhig einatmen'),
    (2, 'hold_in',  4, null,   'Halten, Schultern locker'),
    (3, 'exhale',   4, 'nose', 'Gleichmäßig ausatmen'),
    (4, 'hold_out', 4, null,   'Leer halten, ohne Anspannung')
  ) as v(pos, kind, dur, route, cue)
  returning step_id
),
-- Stufe 2: vagale Dehnung, 4-4-6-3, 7 Runden = 119 s
s2 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 2, 'Vagale Dehnung', 7, 0 from e
  returning id
),
p2 as (
  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
  select s2.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
  from s2, (values
    (1, 'inhale',   4, 'nose',        'Ruhig einatmen'),
    (2, 'hold_in',  4, null,          'Halten, ohne die Kehle zu schließen'),
    (3, 'exhale',   6, 'pursed_lips', 'Lippen leicht spitzen, fein ausströmen lassen'),
    (4, 'hold_out', 3, null,          'Kurz leer bleiben')
  ) as v(pos, kind, dur, route, cue)
  returning step_id
),
-- Stufe 3: tiefe Sedierung, 4-3-8-4, 6 Runden = 114 s
s3 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 3, 'Tiefe', 6, 0 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s3.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s3, (values
  (1, 'inhale',   4, 'nose', 'Sacht einatmen'),
  (2, 'hold_in',  3, null,   'Kurz halten, alles bleibt weich'),
  (3, 'exhale',   8, 'nose', 'Lang und leise ausströmen lassen'),
  (4, 'hold_out', 4, null,   'Leer bleiben und nachspüren')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 9) CO₂-Tolerance Ladder - drei Stufen = 368 s
--    Wunschdauer 360 s, je Stufe 120 s. Stufe 2 geht mit ganzen Runden nicht
--    auf (16 s Takt): 8 Runden = 128 s, 7 waeren 112 s. 8 gewaehlt, damit
--    keine Stufe unter ihrer Zeit bleibt.
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'co2-tolerance-ladder',
    (select id from public.exercise_categories where slug = 'box'),
    'paced', 'timer', 'free',
    'CO₂-Tolerance Ladder', 'Drei Stufen, immer länger',
    'Dreimal dieselbe Form, dreimal langsamer: 3-3-3-3, dann 4-4-4-4, dann 6-6-6-6. Durchgehend durch die Nase.',
    'Baut die CO₂-Toleranz stufenweise auf, statt sie zu erzwingen. Die Gewöhnungsstufe stellt den Takt her, die Konsolidierung hält ihn, die Expansion dehnt ihn - und weil der Aufbau langsam kommt, bleibt die Stressreaktion aus, die ein Sprung auf 6-6-6-6 auslösen würde. Wird die letzte Stufe eng, ist das die Grenze für heute und keine Aufforderung durchzuhalten: das Training wirkt über die Wiederholung, nicht über die Anstrengung.',
    '{co2_toleranz}',
    'Bei Schwangerschaft, Epilepsie, Bluthochdruck oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    10, 2, 368, 9, true
  )
  returning id
),
-- Stufe 1: Gewoehnung, 3-3-3-3, 10 Runden = 120 s
s1 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 1, 'Gewöhnung', 10, 0 from e
  returning id
),
p1 as (
  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
  select s1.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
  from s1, (values
    (1, 'inhale',   3, 'nose', 'Einatmen'),
    (2, 'hold_in',  3, null,   'Kurz halten'),
    (3, 'exhale',   3, 'nose', 'Ausatmen'),
    (4, 'hold_out', 3, null,   'Kurz leer bleiben')
  ) as v(pos, kind, dur, route, cue)
  returning step_id
),
-- Stufe 2: Konsolidierung, 4-4-4-4, 8 Runden = 128 s
s2 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 2, 'Konsolidierung', 8, 0 from e
  returning id
),
p2 as (
  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
  select s2.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
  from s2, (values
    (1, 'inhale',   4, 'nose', 'Ruhig einatmen'),
    (2, 'hold_in',  4, null,   'Halten, Schultern locker'),
    (3, 'exhale',   4, 'nose', 'Gleichmäßig ausatmen'),
    (4, 'hold_out', 4, null,   'Leer halten, ohne Anspannung')
  ) as v(pos, kind, dur, route, cue)
  returning step_id
),
-- Stufe 3: Expansion, 6-6-6-6, 5 Runden = 120 s
s3 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 3, 'Expansion', 5, 0 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s3.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s3, (values
  (1, 'inhale',   6, 'nose', 'Langsam einatmen, unten breit werden'),
  (2, 'hold_in',  6, null,   'Halten ohne zuzudrücken - sobald es eng wird, ist die Grenze da'),
  (3, 'exhale',   6, 'nose', 'Fein ausatmen'),
  (4, 'hold_out', 6, null,   'Leer bleiben, ohne nachzuschieben')
) as v(pos, kind, dur, route, cue);


-- ---------------------------------------------------------------------------
-- 10) Activation-to-Focus Shift - zwei Stufen = 294 s
--     Wunschdauer 300 s, je Stufe 150 s. Stufe 2 geht mit ganzen Runden nicht
--     auf (16 s Takt): 9 Runden = 144 s, 10 waeren 160 s. 9 gewaehlt.
-- ---------------------------------------------------------------------------
with e as (
  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'activation-to-focus-shift',
    (select id from public.exercise_categories where slug = 'aktivieren'),
    'paced', 'timer', 'free',
    'Activation-to-Focus Shift', 'Erst wach, dann fokussiert',
    'Zwei Abschnitte ohne Unterbrechung: zweieinhalb Minuten kurzes, kräftiges Ausatmen durch den Mund, danach zweieinhalb Minuten klassische Box durch die Nase.',
    'Treibt die morgendliche Lethargie aus und schwingt nahtlos in ruhige Arbeitskonzentration ein - das ist der Grund für die zwei Stufen. Aktivierung allein lässt aufgedreht zurück, Box-Atmung allein kommt gegen die Trägheit nicht an. Der Wechsel des Atemwegs macht den Übergang spürbar: erst durch den Mund hinaus, dann wieder ausschließlich durch die Nase.',
    '{aktivierend,stressreduktion}',
    'Nicht bei Neigung zu Hyperventilation, Panikattacken oder Migräne mit Aura. Bei Schwangerschaft, Epilepsie oder Herz-Kreislauf-Erkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    15, 2, 294, 10, true
  )
  returning id
),
-- Stufe 1: Wake-Up, 5-2-2-1, 15 Runden = 150 s
s1 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 1, 'Wake-Up', 15, 0 from e
  returning id
),
p1 as (
  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
  select s1.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
  from s1, (values
    (1, 'inhale',   5, 'nose',  'Durch die Nase in die Flanken einatmen'),
    (2, 'hold_in',  2, null,    'Kurz halten - Kehle bleibt weich'),
    (3, 'exhale',   2, 'mouth', 'Kräftig ausstoßen'),
    (4, 'hold_out', 1, null,    'Eine Sekunde leer')
  ) as v(pos, kind, dur, route, cue)
  returning step_id
),
-- Stufe 2: Zentrierung, 4-4-4-4, 9 Runden = 144 s
s2 as (
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  select id, 2, 'Fokus', 9, 0 from e
  returning id
)
insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text)
select s2.id, v.pos, v.kind::phase_kind, v.dur, v.route::breath_route, v.cue
from s2, (values
  (1, 'inhale',   4, 'nose', 'Ruhiger werden'),
  (2, 'hold_in',  4, null,   'Halten, Schultern locker'),
  (3, 'exhale',   4, 'nose', 'Gleichmäßig ausatmen'),
  (4, 'hold_out', 4, null,   'Leer halten, ohne Anspannung')
) as v(pos, kind, dur, route, cue);
