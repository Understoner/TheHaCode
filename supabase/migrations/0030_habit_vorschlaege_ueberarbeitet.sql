-- 0030: Habit-Vorschlaege ueberarbeitet, Link an eigenen Habits (26.10.2026).
--
-- Vorgaben des Teams vom 26.10.2026 (Ueberarbeitung von 0029):
--   * Atmung: nur noch BOLT, Atmen zum Einschlafen und Bewusste Atempause
--     (diese mit eigener Session), dazu "Fokus" (positiv, Box-Atmung) und
--     "Autopilot" (negativ).
--   * Ernaehrung: neu und einfach - fuer Menschen, die sich mit Ernaehrung
--     gar nicht beschaeftigen. Kein Gramm-Zaehlen, kein Protein-Ziel.
--     "Alkohol getrunken" bleibt.
--   * Fasten: 3 Stunden vor dem Schlafen nur noch 5 Punkte, neu 16 Stunden
--     und 3-Tage-Fasten (je Fastentag 10, die Hoechstpunktzahl eines
--     einzelnen Habits). Die beiden Protein-Habits fallen weg (passen nicht
--     zur einfachen Linie).
--   * Muskeltraining: "Beine und Huefte schwer" wird "Morgentraining",
--     "Viel Alkohol nach dem Training" faellt weg.
--   * Schlaf: neu die Schlafqualitaet von Smartwatch oder Ring.
--   * Bewegung und Stressmanagement bleiben, wie sie sind.
--
-- Wegfallende Vorlagen werden nicht geloescht, sondern zurueckgezogen
-- (is_published false): an ihnen haengen moeglicherweise schon gewaehlte
-- Habits und Eintraege (user_habits.template_id, "no action"). Die App
-- blendet zurueckgezogene Vorlagen aus (useMyHabits).
--
-- Anders als 0029 ("do nothing") UEBERSCHREIBEN die Aenderungen unten Text
-- und Punkte der genannten Vorlagen - das ist hier der Auftrag.
--
-- Additiv (SAD §2.6): eine neue, nullable Spalte; der Trigger wird ersetzt
-- und nimmt sie mit. Die alte App kennt die Spalte nicht und schreibt sie
-- nie.

-- ===================================================================
-- 1. Link an eigenen Habits
-- ===================================================================
-- Wofuer: ein eigenes Habit mit einer Session verknuepfen - einer der
-- Redaktion oder einer selbst gebauten aus dem Konfigurator. Die Adresse
-- kommt aus der Adresszeile, deshalb ein Link und keine Auswahlliste:
-- dieselbe Spalte traegt auch einen Verweis nach draussen (Video, Artikel).
--
-- Erlaubt sind nur Pfade innerhalb der App ("/sessions/...") und http(s).
-- "javascript:" oder "//fremde-seite" kaemen sonst ueber den Link-Knopf im
-- Tagebuch zur Ausfuehrung. Die App prueft dasselbe noch einmal vor dem
-- Oeffnen (src/lib/externalLink.ts).
alter table public.habit_templates
  add column if not exists link_url text;

comment on column public.habit_templates.link_url is
  'Optionaler Link eines eigenen Habits: App-Pfad (/sessions/...) oder http(s) (0030).';

grant insert (link_url) on public.habit_templates to authenticated;
grant update (link_url) on public.habit_templates to authenticated;

-- Wie in 0028, plus: link_url wird geprueft und zaehlt als Bearbeiten.
create or replace function public.guard_own_habit_template()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Die Redaktion (owner_id null) schreibt ueber is_admin() - unberuehrt.
  if new.owner_id is null then
    if tg_op = 'UPDATE' and old.owner_id is not null then
      raise exception 'Ein eigenes Habit wird nicht zur Vorlage der Redaktion'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Ein Habit wechselt nicht den Eigentuemer' using errcode = '42501';
    end if;
    if new.tracking_type is distinct from old.tracking_type then
      -- Vorhandene Eintraege passen sonst nicht mehr zur Art.
      raise exception 'Die Art des Eintrags laesst sich nicht aendern'
        using errcode = 'check_violation';
    end if;
    -- Loeschen geht immer, auch ohne Abo und nach Widerruf. Alles andere ist
    -- Bearbeiten und damit Plus - und seit 0025 auch Einwilligung. Seit 0028
    -- zaehlt auch das Vorzeichen dazu, seit 0030 der Link.
    if (new.title, new.description_md, new.category_id, new.unit, new.min_value,
        new.max_value, new.step_value, new.default_target, new.higher_is_better,
        new.icon, new.points, new.is_negative, new.link_url)
       is distinct from
       (old.title, old.description_md, old.category_id, old.unit, old.min_value,
        old.max_value, old.step_value, old.default_target, old.higher_is_better,
        old.icon, old.points, old.is_negative, old.link_url) then
      if not public.has_plus_access() then
        raise exception 'Eigene Habits bearbeiten gehoert zu Plus' using errcode = '42501';
      end if;
      if not public.has_consent('health_data') then
        raise exception 'Eigene Habits bearbeiten braucht die Einwilligung' using errcode = '42501';
      end if;
    end if;
  else
    -- Eine Obergrenze, damit niemand die Tabelle zumuellt.
    select count(*) into v_count
      from public.habit_templates
     where owner_id = new.owner_id and deleted_at is null;
    if v_count >= 100 then
      raise exception 'Hoechstens 100 eigene Habits' using errcode = 'check_violation';
    end if;
    new.slug := 'eigen-' || new.id::text;
    new.sort_order := 1000;
  end if;

  -- Punkte waehlt die Person selbst, 0 bis 10 je Erledigung (Entscheidung
  -- 25.10.2026). Mehr als 10 nicht: ein eigenes Habit soll die Kategorie
  -- nicht mit einem einzigen Haken fuellen. Gedeckelt wird ohnehin je
  -- Kategorie und Tag (score.ts).
  if new.points is null or new.points not between 0 and 10 then
    raise exception 'Eigene Habits bringen 0 bis 10 Punkte' using errcode = 'check_violation';
  end if;

  -- Was ein eigenes Habit nie sein kann.
  new.is_preview   := false;
  new.is_published := true;
  new.exercise_id  := null;

  if new.tracking_type not in ('done', 'number') then
    raise exception 'Eigene Habits sind "erledigt" oder "Zahl"' using errcode = 'check_violation';
  end if;

  new.title := btrim(coalesce(new.title, ''));
  if length(new.title) not between 1 and 80 then
    raise exception 'Titel mit 1 bis 80 Zeichen' using errcode = 'check_violation';
  end if;
  new.description_md := nullif(btrim(coalesce(new.description_md, '')), '');
  if length(new.description_md) > 500 then
    raise exception 'Beschreibung hoechstens 500 Zeichen' using errcode = 'check_violation';
  end if;
  new.unit := nullif(btrim(coalesce(new.unit, '')), '');
  if length(new.unit) > 20 then
    raise exception 'Einheit hoechstens 20 Zeichen' using errcode = 'check_violation';
  end if;

  -- Ein App-Pfad beginnt mit genau einem Schraegstrich ("//host" waere eine
  -- fremde Seite), sonst nur http(s). Kein Leerzeichen, keine spitzen
  -- Klammern oder Anfuehrungszeichen.
  new.link_url := nullif(btrim(coalesce(new.link_url, '')), '');
  if new.link_url is not null then
    if length(new.link_url) > 500 then
      raise exception 'Link hoechstens 500 Zeichen' using errcode = 'check_violation';
    end if;
    if new.link_url !~ '^(/(?!/)|https?://)[^\s"''<>]*$' then
      raise exception 'Link muss mit https:// oder / beginnen' using errcode = 'check_violation';
    end if;
  end if;

  if new.tracking_type = 'done' then
    new.unit := null;
    new.min_value := null;
    new.max_value := null;
    new.step_value := null;
    new.default_target := null;
  end if;

  if not exists (
    select 1 from public.habit_categories c
     where c.id = new.category_id and c.is_published
  ) then
    raise exception 'Diese Kategorie gibt es nicht' using errcode = 'foreign_key_violation';
  end if;

  return new;
end $$;

-- ===================================================================
-- 2. Session "Bewusste Atempause" - 6 x (4 ein, 6 aus) = 60 s
-- ===================================================================
-- Eine Minute, damit sie dreimal am Tag in jeden Alltag passt. Laengeres
-- Aus- als Einatmen beruhigt; kein Halten, damit es auch im Buero, im Auto
-- an der Ampel oder vor einem Gespraech unauffaellig geht. Kostenlos wie
-- Sinkflug: das Habit ist Plus, die Session nicht.
--
-- Die Kategorie "beruhigen" kommt in Staging und Live aus der Redaktion,
-- lokal erst aus seed.sql (laeuft NACH den Migrationen). Fehlt sie, bleibt
-- category_id leer - docs/inhalte/habit-score-tracker.sql traegt sie lokal
-- nach.
do $$
declare
  v_exercise uuid;
  v_step     uuid;
begin
  if exists (select 1 from public.exercises where slug = 'bewusste-atempause') then
    return;
  end if;

  insert into public.exercises (
    slug, category_id, type, playback_mode, visibility, title, subtitle,
    description_md, benefits_md, effects, contraindications_md,
    default_round_count, difficulty, estimated_seconds, sort_order, is_published
  ) values (
    'bewusste-atempause',
    (select id from public.exercise_categories where slug = 'beruhigen'),
    'paced', 'timer', 'free',
    'Bewusste Atempause', 'Eine Minute aus dem Autopiloten',
    'Eine Minute innehalten, wo du gerade bist - im Sitzen, im Stehen, auch mit offenen Augen. Vier Sekunden durch die Nase ein, sechs Sekunden langsam aus, sechsmal. Kein Halten, nichts Besonderes: nur der Atem, der etwas länger hinaus- als hereinströmt. Gedacht für dreimal am Tag, zum Beispiel vor dem ersten Mail, nach dem Mittagessen und auf dem Heimweg.',
    'Das längere Ausatmen ist der kürzeste Weg vom Gas zur Bremse: der Puls wird ruhiger, die Schultern sinken, und für einen Moment entscheidest du selbst, statt nur zu reagieren. Eine Minute ist wenig - gerade deshalb lässt sie sich jeden Tag mehrmals unterbringen. Die Wirkung kommt aus der Wiederholung.',
    '{entspannend,stressreduktion}',
    'Wird das Ausatmen eng, einfach kürzer ausatmen - nichts erzwingen. Nicht beim Autofahren mit geschlossenen Augen üben.',
    6, 1, 60, 13, true
  )
  returning id into v_exercise;

  insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
  values (v_exercise, 1, 'Atempause', 6, 0)
  returning id into v_step;

  insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text) values
    (v_step, 1, 'inhale', 4, 'nose', 'Durch die Nase einatmen'),
    (v_step, 2, 'exhale', 6, 'nose', 'Langsam ausatmen, die Schultern sinken');
end $$;

-- ===================================================================
-- 3. Zurueckgezogene Vorlagen
-- ===================================================================
update public.habit_templates
   set is_published = false
 where owner_id is null
   and slug in (
     -- Atmung
     'langsam-atmen', 'cyclic-sighing', 'zone2-nasenatmung', 'atemanhalten-im-wasser',
     -- Ernaehrung (alles ausser Alkohol)
     'protein-ziel', 'ballaststoffe-30g', 'gemuese-obst', 'nuesse', 'fettfisch',
     'suessgetraenk', 'verarbeitetes-fleisch',
     -- Fasten: Protein-Ziel passt nicht zur einfachen Linie
     'fasten-mit-protein-brechen', 'fasten-ohne-protein',
     -- Muskeltraining
     'alkohol-nach-training'
   );

-- ===================================================================
-- 4. Geaenderte Vorlagen
-- ===================================================================
update public.habit_templates
   set title = 'Drei bewusste Atempausen',
       description_md = 'Dreimal am Tag für eine Minute aus dem Autopiloten aussteigen: innehalten, vier Sekunden durch die Nase ein, sechs Sekunden langsam aus. Am leichtesten gelingt es mit festen Ankern – etwa vor dem ersten Mail, nach dem Mittagessen und bevor du nach Hause gehst. Die Session „Bewusste Atempause“ führt dich durch die Minute. Das längere Ausatmen bremst die Stressreaktion, und über den Tag verteilt erinnert es dich daran, dass du deinen Atem selbst lenken kannst.',
       exercise_id = coalesce(
         (select id from public.exercises where slug = 'bewusste-atempause'),
         exercise_id)
 where owner_id is null and slug = 'atempause';

update public.habit_templates
   set title = 'Alkohol getrunken',
       description_md = 'Bier, Wein, Spritzer, Sekt oder Schnaps – egal wie viel, auch ein einzelnes Glas zählt. Alkohol stört den Tiefschlaf, belastet die Leber und erhöht das Krebsrisiko; nach heutigem Wissen gibt es keine Menge, die schützt. Jeder Tag ohne ist ein guter Tag.',
       sort_order = 30
 where owner_id is null and slug = 'alkohol';

update public.habit_templates
   set points = 5,
       description_md = 'Die letzte Mahlzeit und der letzte Snack mindestens drei Stunden vor dem Zubettgehen – wer um 23 Uhr schlafen geht, isst bis 20 Uhr. Danach nur noch Wasser oder Kräutertee. Spätes Essen hält Verdauung, Blutzucker und Puls in der Nacht hoch; mit leerem Magen schläfst du tiefer und erholst dich besser. Ein einfacher Einstieg ins Fasten.'
 where owner_id is null and slug = 'drei-stunden-vor-dem-schlaf';

update public.habit_templates
   set title = 'Morgentraining',
       description_md = 'Gleich nach dem Aufstehen, ohne Geräte, in etwa zehn Minuten: 3 × 15 Liegestütze, 3 × 15 Kniebeugen und 3 × Rudern im Türrahmen. Fürs Rudern stellst du dich in einen offenen Türrahmen, hältst dich mit beiden Händen links und rechts am Rahmen fest, lässt dich mit gestrecktem Körper nach hinten fallen und ziehst dich mit den Armen wieder hoch – je weiter die Füße vorn stehen, desto schwerer. Zu viel? Liegestütze an der Wand oder auf den Knien, Kniebeugen nur bis zum Sessel. Wichtig ist, dass du jeden Morgen anfängst.',
       points = 8
 where owner_id is null and slug = 'beine-schwer';

-- ===================================================================
-- 5. Neue Vorlagen
-- ===================================================================
insert into public.habit_templates (
  slug, category_id, title, description_md, tracking_type,
  unit, min_value, max_value, step_value, default_target, higher_is_better,
  points, is_negative, is_preview, exercise_id, sort_order, is_published
)
select v.slug, c.id, v.title, v.description_md, v.tracking_type::public.habit_tracking_type,
       v.unit, v.min_value, v.max_value, v.step_value, v.default_target, v.higher_is_better,
       v.points, v.is_negative, false,
       (select e.id from public.exercises e where e.slug = v.exercise_slug and e.owner_id is null),
       v.sort_order, true
  from (values
  -- Atmung
  ('fokus', 'atmung', 'Fokus',
   'Synchronisiere Sympathikus und Parasympathikus – das System für Leistung und das für Ruhe. Atme dazu 5 Minuten lang im gleichen Takt: 4 Sekunden ein, 4 Sekunden halten, 4 Sekunden aus und noch einmal 4 Sekunden halten. Alles durch die Nase, ruhig und ohne Kraft. Mach das immer dann, wenn du in einen wachen und fokussierten Zustand kommen möchtest – vor konzentrierter Arbeit, einer Prüfung oder einem wichtigen Gespräch. Die geführte Session dazu findest du in DER ATEMCODE unter Sessions: „Classical SEAL Balance“.',
   'done', null::text, null::numeric, null::numeric, null::numeric, null::numeric, true, 8, false,
   'classical-seal-balance', 15),
  ('autopilot', 'atmung', 'Autopilot',
   'Du warst heute ständig im Autopiloten unterwegs. Stress hat deinen Tagesablauf bestimmt, und du hast dir nie bewusst Zeit genommen, den Autopiloten zu beenden – keine Atempause, kein Innehalten. Trag es ehrlich ein: Wer es bemerkt, hat den ersten Schritt schon gemacht. Morgen hilft schon eine einzige bewusste Minute.',
   'done', null, null, null, null, null, true, 6, true, null, 16),

  -- Ernaehrung: einfach, ohne Wiegen und Zaehlen
  ('ohne-zucker', 'ernaehrung', 'Den ganzen Tag ohne Zucker',
   'Einen ganzen Tag keine Süßigkeiten, kein Kuchen, keine Limo, kein gesüßter Kaffee oder Tee. Obst ist erlaubt. Du musst keine Etiketten lesen – es geht um das, was du bewusst als süß erkennst. Zucker macht schnell wieder hungrig, lässt den Blutzucker auf und ab springen und ist eng mit Übergewicht und Typ-2-Diabetes verbunden. Nach ein paar Tagen wird das Verlangen meist spürbar kleiner.',
   'done', null, null, null, null, null, true, 10, false, null, 20),
  ('gemuese-jede-mahlzeit', 'ernaehrung', 'Gemüse zu jeder Hauptmahlzeit',
   'Zu Frühstück, Mittag- und Abendessen jeweils etwas Gemüse oder Salat – eine Tomate zum Brot, Salat zum Mittagessen, Gemüse zum Abendessen. Tiefkühlgemüse zählt genauso. Gemüse macht satt, bringt Ballaststoffe und Vitamine, ohne dass du rechnen musst. Faustregel: die Hälfte des Tellers.',
   'done', null, null, null, null, null, true, 8, false, null, 21),
  ('wasser-trinken', 'ernaehrung', 'Nur Wasser, Tee oder Kaffee getrunken',
   'Den ganzen Tag nur Wasser, ungesüßten Tee oder Kaffee ohne Zucker – keine Limo, kein Saft, kein Energydrink, kein Alkohol. Ein großes Glas Wasser gleich nach dem Aufstehen ist ein guter Start. Getränke mit Zucker machen nicht satt und liefern trotzdem viele Kalorien.',
   'done', null, null, null, null, null, true, 6, false, null, 22),
  ('selbst-gekocht', 'ernaehrung', 'Selbst gekocht',
   'Mindestens eine Hauptmahlzeit selbst zubereitet – aus Zutaten, die du erkennst, statt Fertiggericht, Lieferdienst oder Imbiss. Es muss nicht aufwendig sein: Nudeln mit Gemüse, ein Omelett oder eine Suppe reichen. Wer selbst kocht, weiß, was drin ist, und isst automatisch weniger Zucker, Salz und Fett.',
   'done', null, null, null, null, null, true, 6, false, null, 23),
  ('langsam-essen', 'ernaehrung', 'In Ruhe gegessen',
   'Mindestens eine Mahlzeit am Tisch, ohne Handy und Fernseher, mit Zeit zum Kauen. Hör auf, wenn du angenehm satt bist – nicht erst, wenn der Teller leer ist. Das Sättigungsgefühl kommt rund 20 Minuten nach dem ersten Bissen; wer langsam isst, isst ganz von selbst weniger.',
   'done', null, null, null, null, null, true, 4, false, null, 24),
  ('fast-food', 'ernaehrung', 'Fast Food oder Fertiggericht gegessen',
   'Burger, Pommes, Pizza vom Lieferdienst, Würstel vom Stand oder ein Fertiggericht aus der Packung. Einmal ist kein Drama – aber solche Mahlzeiten stecken voller Zucker, Salz und Fett und machen nur kurz satt. Trag es ehrlich ein, damit du siehst, wie oft es vorkommt.',
   'done', null, null, null, null, null, true, 6, true, null, 25),

  -- Fasten
  ('fasten-16h', 'fasten', '16 Stunden gefastet',
   'Sechzehn Stunden zwischen der letzten Mahlzeit des Vortags und der ersten des Tages, zum Beispiel von 20 Uhr bis 12 Uhr – du lässt also das Frühstück aus. In der Fastenzeit sind Wasser, ungesüßter Tee und schwarzer Kaffee erlaubt. Der Körper bekommt eine lange Pause von der Verdauung und greift auf seine Reserven zurück. Wenn du 16 Stunden schaffst, trag nur das ein, nicht zusätzlich die 12 Stunden. Nicht geeignet bei Schwangerschaft und Stillzeit, Essstörungen und Diabetes mit Medikamenten – dann vorher ärztlich abklären.',
   'done', null, null, null, null, null, true, 8, false, null, 11),
  ('fasten-3-tage', 'fasten', '3-Tage-Fasten',
   'Drei Tage ohne feste Nahrung, nur Wasser, ungesüßter Kräutertee und klare Gemüsebrühe. Trag jeden Fastentag einzeln ein – jeder bringt die volle Punktzahl. Mach das höchstens drei- bis viermal im Jahr und sprich es am besten vorher mit deiner Ärztin oder deinem Arzt ab. Nicht fasten bei: Schwangerschaft und Stillzeit, unter 18 Jahren, Untergewicht, Essstörungen (auch früheren), Diabetes mit Insulin oder blutzuckersenkenden Tabletten, Herzrhythmusstörungen oder Herzschwäche, Nieren- oder Lebererkrankungen, Gicht, Krebserkrankungen und bei regelmäßigen Medikamenten wie Blutdruck- oder Entwässerungstabletten. Brich sofort ab bei Schwindel, Herzrasen, Verwirrtheit oder starker Schwäche. Danach langsam wieder anfangen: kleine Portionen, viel Eiweiß.',
   'done', null, null, null, null, null, true, 10, false, null, 12),

  -- Schlaf
  ('schlafqualitaet-wearable', 'schlaf', 'Schlafqualität von Smartwatch oder Ring',
   'Für alle, die ihren Schlaf mit einer Smartwatch oder einem smarten Ring aufzeichnen: Trag den Schlafwert ein, den dir dein Gerät am Morgen anzeigt – meist eine Zahl von 0 bis 100 (zum Beispiel Schlafscore oder Schlafqualität). So siehst du im Tagebuch neben deinen Habits, wie gut du geschlafen hast. Die Punkte gibt es fürs Eintragen, nicht für einen hohen Wert; die Messung ist eine Schätzung des Geräts, keine medizinische Diagnose.',
   'number', 'Punkte', 0, 100, 1, null, true, 4, false, null, 12)
  ) as v(slug, category_slug, title, description_md, tracking_type,
         unit, min_value, max_value, step_value, default_target, higher_is_better,
         points, is_negative, exercise_slug, sort_order)
  join public.habit_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;
