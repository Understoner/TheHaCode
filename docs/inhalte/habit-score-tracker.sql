-- Atem-Tagebuch / Habit Score Tracker: Startbestand (V1.1).
--
-- Inhalt, kein Schema: im Studio unter "SQL Editor" ausfuehren, in Staging und
-- Live je einmal (CLAUDE.md, Redaktion ueber Studio). Mehrfach ausfuehrbar -
-- gleicher slug heisst Aktualisierung statt Doublette. Lokal laeuft die Datei
-- bei jedem `npm run db:reset` nach seed.sql mit (supabase/config.toml).
--
-- ERST DIE MIGRATIONEN, DANN DIESE DATEI. Die Tabellen entstehen in 0021,
-- die Erfassungsart "done" in 0020.
--
-- Was hier entsteht:
--   1. die neue Sequenz "Sinkflug" fuer das Einschlafen
--   2. die Kategorie "Atmung" mit ihren Punktelimits
--   3. zwei Habits: "BOLT-Wert ermitteln" (Vorschau, auch ohne Plus) und
--      "Atmen zum Einschlafen" (Plus, haengt an "Sinkflug")
--
-- Die Kategorie und die Habits sind veroeffentlicht. Eintragen kann trotzdem
-- niemand etwas, solange die Einwilligung health_data nicht veroeffentlicht
-- ist (Migration 0021, Abschnitt 8) - das ist Absicht.

do $$
begin
  if to_regclass('public.habit_templates') is null then
    raise exception
      'In dieser Umgebung fehlt Migration 0021 (Habit Score Tracker). Es wurde '
      'nichts geaendert. Erst die Migrationen ausrollen lassen - nach dem Merge '
      'erledigt das die Pipeline von selbst, siehe docs/DEPLOYMENT.md - und '
      'diese Datei danach noch einmal ausfuehren.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Sinkflug - Einschlafen in vier Stufen = 546 s (gut 9 Minuten)
--
--    Was die Sequenz von Night-Downfall und dem Progressive Down-Regulator
--    unterscheidet: sie VERLANGSAMT den Atem schrittweise (6 -> gut 4 -> 4
--    Atemzuege pro Minute), ohne ihn je anzuhalten, und endet nicht mit einem
--    Takt, sondern mit drei Minuten freiem Atmen. Wer einschlafen will, soll
--    am Ende nicht mehr zaehlen muessen - der Takt gibt die Fuehrung ab.
--
--    Inhaltlich:
--      * Langsame Atmung um 6 Zuege pro Minute (Resonanzbereich) und ein
--        Ausatmen, das deutlich laenger ist als das Einatmen, staerken den
--        Parasympathikus - Herzfrequenz und Erregung sinken.
--      * Keine Haltephase nach dem Einatmen: volles Halten wirkt eher
--        aktivierend. Nur die natuerliche kurze Pause nach dem Ausatmen,
--        die sich von selbst einstellt (Restorative-Prinzip "gehalten wird
--        die Ruhe, nicht die Luft").
--      * Durchgehend durch die Nase, auch ausatmen: leiser, kein
--        Austrocknen des Mundes, kein Wachhalten durch Geraeusch.
--      * Die freie Phase am Ende hat weder Ton noch Ansage (tones.ts,
--        voice.ts) - der Abschluss klingt erst nach drei Minuten Stille.
--
--    Stufe 1  Ankommen      4-0-6-0  12 Runden = 120 s   6 Zuege/Min
--    Stufe 2  Verlangsamen  4-0-8-2   9 Runden = 126 s   gut 4 Zuege/Min
--    Stufe 3  Sinken        4-0-9-2   8 Runden = 120 s   4 Zuege/Min
--    Stufe 4  Loslassen     frei     1 x 180 s
-- ---------------------------------------------------------------------------
do $$
declare
  v_exercise uuid;
  v_step     uuid;
begin
  -- Gibt es die Sequenz schon, bleibt sie, wie sie ist: im Studio
  -- nachgebesserte Phasen sollen ein zweiter Lauf nicht ueberschreiben.
  if exists (select 1 from public.exercises where slug = 'sinkflug') then
    return;
  end if;

  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'sinkflug',
    (select id from public.exercise_categories where slug = 'beruhigen'),
    'paced', 'timer', 'free',
    'Sinkflug', 'Neun Minuten in den Schlaf',
    'Im Liegen, das Licht schon aus. Der Atem wird in drei Stufen langsamer - von sechs auf vier Atemzüge pro Minute -, ausgeatmet wird immer länger als eingeatmet, alles durch die Nase. Danach drei Minuten ohne Takt: nicht mehr zählen, der Atem macht es allein. Tipp: Telefon mit dem Bildschirm nach unten ablegen und Ton oder Ansage leise stellen.',
    'Langsames Atmen mit verlängertem Ausatmen verschiebt das Nervensystem Richtung Ruhe: Herzfrequenz und Muskeltonus gehen herunter, das Gedankenkarussell verliert seinen Takt. Weil nie die Luft angehalten wird, entsteht kein Lufthunger, der wieder wach macht. Und weil die letzte Stufe gar keinen Takt mehr hat, gibt es am Ende nichts mehr, worauf man achten müsste. Wer vorher einschläft, verpasst den Schluss - das ist das Ziel.',
    '{entspannend}',
    'Wird das lange Ausatmen eng oder entsteht Lufthunger, kürzer ausatmen - nichts erzwingen. Bei Schwangerschaft, Epilepsie, Herz-Kreislauf- oder Atemwegserkrankungen vorher ärztlich abklären. Nie im Wasser oder beim Autofahren üben.',
    12, 1, 546, 12, true
  )
  returning id into v_exercise;

  -- Stufe 1: Ankommen
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  values (v_exercise, 1, 'Ankommen', 12, 0)
  returning id into v_step;

  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text) values
    (v_step, 1, 'inhale', 4, 'nose', 'Sacht in den Bauch einatmen'),
    (v_step, 2, 'exhale', 6, 'nose', 'Länger ausatmen, die Schultern sinken');

  -- Stufe 2: Verlangsamen
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  values (v_exercise, 2, 'Verlangsamen', 9, 0)
  returning id into v_step;

  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text) values
    (v_step, 1, 'inhale',   4, 'nose', 'Leise einatmen, ohne den Brustkorb zu heben'),
    (v_step, 2, 'exhale',   8, 'nose', 'Lang und leise ausströmen lassen'),
    (v_step, 3, 'hold_out', 2, null,   'Die Pause kommt von selbst');

  -- Stufe 3: Sinken
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  values (v_exercise, 3, 'Sinken', 8, 0)
  returning id into v_step;

  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text) values
    (v_step, 1, 'inhale',   4, 'nose', 'Kaum spürbar einatmen'),
    (v_step, 2, 'exhale',   9, 'nose', 'Ausatmen und schwer werden'),
    (v_step, 3, 'hold_out', 2, null,   'Nichts tun');

  -- Stufe 4: Loslassen
  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  values (v_exercise, 4, 'Loslassen', 1, 0)
  returning id into v_step;

  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text) values
    (v_step, 1, 'free_breathing', 180, null, 'Nicht mehr zählen. Der Atem macht es allein.');
end $$;

-- ---------------------------------------------------------------------------
-- 2) Kategorie Atmung
--
--    Zwei Habits zu je 10 Punkten: das Tageslimit 20 erreicht, wer beide
--    erledigt. Die Woche ist bei 100 gedeckelt - fuenf volle Tage reichen,
--    zwei Tage Pause kosten nichts. Der Monat bei 400 - rund vier volle
--    Wochen. Das belohnt Regelmaessigkeit, nicht Perfektion (SAD §3.12).
-- ---------------------------------------------------------------------------
insert into public.habit_categories (
  slug, title, description, icon, is_negative,
  max_per_day, max_per_week, max_per_month, sort_order, is_published
) values (
  'atmung', 'Atmung',
  'Bewusst atmen, messen, zur Ruhe kommen.',
  'atmung', false,
  20, 100, 400, 1, true
)
on conflict (slug) do update
  set title         = excluded.title,
      description   = excluded.description,
      icon          = excluded.icon,
      is_negative   = excluded.is_negative,
      max_per_day   = excluded.max_per_day,
      max_per_week  = excluded.max_per_week,
      max_per_month = excluded.max_per_month,
      sort_order    = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 3) Die zwei Habits
-- ---------------------------------------------------------------------------
insert into public.habit_templates (
  slug, category_id, title, description_md, tracking_type,
  unit, min_value, max_value, step_value, default_target, higher_is_better,
  points, is_preview, exercise_id, icon, sort_order, is_published
) values
  (
    'bolt-wert',
    (select id from public.habit_categories where slug = 'atmung'),
    'BOLT-Wert ermitteln',
    'Morgens, bevor du aufstehst: normal ein- und ausatmen, nach dem Ausatmen die Nase zuhalten und die Sekunden zählen, bis du den ersten deutlichen Atemreiz spürst. Dann loslassen und ruhig weiteratmen. Es geht nicht darum, möglichst lange auszuhalten - der erste Impuls zählt. Der Wert ist eine Trainingsgröße, keine medizinische Messung.',
    'number',
    'Sekunden', 0, 120, 1, null, true,
    10, true, null, 'stoppuhr', 1, true
  ),
  (
    'atmen-zum-einschlafen',
    (select id from public.habit_categories where slug = 'atmung'),
    'Atmen zum Einschlafen',
    'Abends im Bett die Sequenz „Sinkflug“ atmen. Wer sie zu Ende atmet, bekommt das Habit automatisch eingetragen - wer vorher einschläft, hakt es am Morgen ab.',
    'done',
    null, null, null, null, null, true,
    10, false, (select id from public.exercises where slug = 'sinkflug'), 'mond', 2, true
  )
on conflict (slug) do update
  set category_id      = excluded.category_id,
      title            = excluded.title,
      description_md   = excluded.description_md,
      tracking_type    = excluded.tracking_type,
      unit             = excluded.unit,
      min_value        = excluded.min_value,
      max_value        = excluded.max_value,
      step_value       = excluded.step_value,
      higher_is_better = excluded.higher_is_better,
      points           = excluded.points,
      is_preview       = excluded.is_preview,
      exercise_id      = excluded.exercise_id,
      icon             = excluded.icon,
      sort_order       = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 4) Verknuepfungen aus Migration 0030 nachtragen
--
--    0030 legt die Session "Bewusste Atempause" an und haengt "Fokus" an
--    "Classical SEAL Balance". In Staging und Live gibt es Kategorie und
--    Session da schon. Lokal laufen die Migrationen aber VOR seed.sql - dort
--    fehlten beide noch. Mehrfach ausfuehrbar, ueberschreibt nichts, was
--    schon gesetzt ist.
-- ---------------------------------------------------------------------------
update public.exercises
   set category_id = (select id from public.exercise_categories where slug = 'beruhigen')
 where slug = 'bewusste-atempause' and category_id is null;

update public.habit_templates
   set exercise_id = (select id from public.exercises
                       where slug = 'classical-seal-balance' and owner_id is null)
 where slug = 'fokus' and owner_id is null and exercise_id is null;
