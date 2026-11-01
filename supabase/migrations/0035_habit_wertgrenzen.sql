-- 0035: Punkte nach Wertgrenzen fuer Zahlen-Habits (01.11.2026).
--
-- Entscheidung des Users vom 01.11.2026: Bei Habits mit eingetragenem Wert
-- kann der Score vom Wert abhaengen. Beispiel Schlafdauer: unter 6 Stunden
-- gibt es Minuspunkte, ab 7 Stunden Pluspunkte, dazwischen nichts. Die
-- Grenzen sind je Habit optional - ohne Grenzen gilt weiter "Punkte fuers
-- Eintragen" (0021).
--
-- Das ist eine bewusste Aenderung der Regel aus SAD §3.14 ("Punkte fuers
-- Erledigen, nicht fuer den Wert") und §5.7 (Abgrenzung zum Medizinprodukt).
-- Der User hat sie so getroffen: "Lebensstil ja, BOLT nie". Erlaubt sind
-- Grenzen fuer Lebensstil-Werte (Schlafdauer, Schritte, Bildschirmzeit) und
-- fuer eigene Habits, deren Grenzen sich die Person selbst setzt. Fuer
-- Messwerte mit Gesundheitsbezug - den BOLT-Wert und den Schlafwert einer
-- Smartwatch - sperrt die Datenbank sie (is_health_measure). Dort bleibt es
-- bei "Punkte fuers Eintragen, keine Normbereiche".
--
-- DIE REGEL (gerechnet in src/features/habits/valuePoints.ts)
-- -----------------------------------------------------------
-- higher_is_better = true (Schlafdauer, Schritte):
--   Wert >= points_from  -> +points
--   Wert <  penalty_from -> -penalty_points
--   dazwischen           -> 0
-- higher_is_better = false (Bildschirmzeit, Koffein):
--   Wert <= points_from  -> +points
--   Wert >  penalty_from -> -penalty_points
--   dazwischen           -> 0
-- Fehlt points_from, gibt es die Pluspunkte fuer jeden Wert, der nicht unter
-- die Minus-Grenze faellt. Fehlt penalty_from, gibt es nie Minuspunkte.
--
-- Additiv (SAD §2.6): vier neue Spalten, alle nullable bzw. mit Default. Die
-- alte App kennt sie nicht und rechnet wie bisher (Punkte fuers Eintragen) -
-- fuer die Dauer eines Deployments vertretbar, danach rechnet die neue.

-- ===================================================================
-- 1. Spalten
-- ===================================================================
alter table public.habit_templates
  add column if not exists points_from        numeric,
  add column if not exists penalty_from       numeric,
  add column if not exists penalty_points     int,
  add column if not exists is_health_measure  boolean not null default false;

comment on column public.habit_templates.points_from is
  'Zahlen-Habit: ab diesem Wert (bzw. bis zu ihm bei higher_is_better = false) gibt es die Punkte. NULL = fuer jeden Wert (0035).';
comment on column public.habit_templates.penalty_from is
  'Zahlen-Habit: unter diesem Wert (bzw. darueber bei higher_is_better = false) gibt es penalty_points Abzug. NULL = nie (0035).';
comment on column public.habit_templates.penalty_points is
  'Abzug beim Unterschreiten von penalty_from, als Betrag (0035).';
comment on column public.habit_templates.is_health_measure is
  'Messwert mit Gesundheitsbezug (BOLT, Schlafwert der Uhr): nie Wertgrenzen, SAD §5.7 (0035).';

-- Wertgrenzen nur an Zahlen-Habits, nie an Abzugs-Habits (dort traegt das
-- Habit selbst schon das Vorzeichen) und nie an Gesundheits-Messwerten. Der
-- BOLT-Wert steht zusaetzlich per Slug drin: seine Vorlage kommt in Staging
-- und Live aus docs/inhalte, also vielleicht erst nach dieser Migration.
alter table public.habit_templates
  add constraint chk_habit_value_points check (
    (points_from is null and penalty_from is null)
    or (tracking_type = 'number'
        and not is_negative
        and not is_health_measure
        and slug <> 'bolt-wert')
  ),
  add constraint chk_habit_penalty_points check (
    (penalty_points is null or penalty_points >= 0)
    and (penalty_from is null or penalty_points is not null)
  ),
  -- Die Minus-Grenze liegt auf der schlechten Seite der Plus-Grenze. Gleich
  -- ist erlaubt: dann gibt es keinen neutralen Bereich.
  add constraint chk_habit_value_order check (
    points_from is null or penalty_from is null
    or (higher_is_better and penalty_from <= points_from)
    or (not higher_is_better and penalty_from >= points_from)
  );

-- Eigene Habits duerfen die Grenzen setzen; is_health_measure nicht (das ist
-- Sache der Redaktion, der Trigger setzt es fuer eigene Habits auf false).
grant insert (points_from, penalty_from, penalty_points) on public.habit_templates to authenticated;
grant update (points_from, penalty_from, penalty_points) on public.habit_templates to authenticated;

-- ===================================================================
-- 2. Trigger fuer eigene Habits
-- ===================================================================
-- Wie in 0030, plus: die Wertgrenzen zaehlen als Bearbeiten (Plus und
-- Einwilligung), Minuspunkte 0 bis 10 wie die Pluspunkte, is_health_measure
-- ist fuer eigene Habits immer false, und ein "erledigt"-Habit hat keine
-- Grenzen.
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
    -- zaehlt auch das Vorzeichen dazu, seit 0030 der Link, seit 0035 die
    -- Wertgrenzen.
    if (new.title, new.description_md, new.category_id, new.unit, new.min_value,
        new.max_value, new.step_value, new.default_target, new.higher_is_better,
        new.icon, new.points, new.is_negative, new.link_url,
        new.points_from, new.penalty_from, new.penalty_points)
       is distinct from
       (old.title, old.description_md, old.category_id, old.unit, old.min_value,
        old.max_value, old.step_value, old.default_target, old.higher_is_better,
        old.icon, old.points, old.is_negative, old.link_url,
        old.points_from, old.penalty_from, old.penalty_points) then
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
  -- Dieselbe Grenze fuer den Abzug unter der Minus-Grenze (0035).
  if new.penalty_points is not null and new.penalty_points not between 0 and 10 then
    raise exception 'Eigene Habits ziehen 0 bis 10 Punkte ab' using errcode = 'check_violation';
  end if;

  -- Was ein eigenes Habit nie sein kann.
  new.is_preview        := false;
  new.is_published      := true;
  new.exercise_id       := null;
  new.is_health_measure := false;

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
    new.points_from := null;
    new.penalty_from := null;
    new.penalty_points := null;
  end if;
  -- Ohne Minus-Grenze gibt es keinen Abzug - ein Rest-Wert wuerde nur
  -- verwirren.
  if new.penalty_from is null then
    new.penalty_points := null;
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
-- 3. Redaktion: Messwerte sperren, Schlafdauer mit Grenzen
-- ===================================================================
update public.habit_templates
   set is_health_measure = true
 where owner_id is null
   and slug in ('bolt-wert', 'schlafqualitaet-wearable');

-- Vorgabe des Users vom 01.11.2026: unter 6 Stunden Minuspunkte, ab 7
-- Stunden Pluspunkte. Abzug so hoch wie der Gewinn.
update public.habit_templates
   set points_from    = 7,
       penalty_from   = 6,
       penalty_points = points,
       description_md = description_md
         || ' Ab sieben Stunden bekommst du die Punkte, unter sechs Stunden ziehen sie ab.'
 where owner_id is null
   and slug = 'schlafdauer'
   and points_from is null;
