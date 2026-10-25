-- 0026: Longevity-Kategorien und Punkte fuer eigene Habits (25.10.2026).
--
-- 1. Neben Atmung sechs weitere Kategorien: Ernaehrung, Fasten, Bewegung,
--    Muskeltraining, Schlaf, Stressmanagement. Jede bekommt dieselben
--    Limits wie Atmung (Tag, Woche, Monat). Vorgeschlagene Habits gibt es
--    darin noch keine - eigene Habits koennen sie aber schon nutzen.
-- 2. Eigene Habits bringen 0 bis 10 Punkte, von der Person gewaehlt. Bisher
--    hielt der Trigger sie auf 0 (0024), bis das entschieden war.
--
-- Additiv: neue Zeilen, ein zusaetzliches Spaltenrecht, eine ersetzte
-- Funktion. Die alte App liest die neuen Kategorien einfach mit.

-- ===================================================================
-- 1. Kategorien
-- ===================================================================
-- Die Limits kommen von Atmung, so wie sie in der jeweiligen Umgebung steht
-- (docs/inhalte/habit-score-tracker.sql). Fehlt Atmung dort noch, gelten die
-- Werte aus diesem Skript: 20 / 100 / 400. "on conflict do nothing", damit
-- eine von Hand schon angelegte Kategorie nicht ueberschrieben wird.
insert into public.habit_categories
  (slug, title, max_per_day, max_per_week, max_per_month, sort_order, is_published)
select v.slug, v.title,
       coalesce(a.max_per_day, 20), coalesce(a.max_per_week, 100), coalesce(a.max_per_month, 400),
       v.sort_order, true
  from (values
    ('ernaehrung',       'Ernährung',         2),
    ('fasten',           'Fasten',            3),
    ('bewegung',         'Bewegung',          4),
    ('muskeltraining',   'Muskeltraining',    5),
    ('schlaf',           'Schlaf',            6),
    ('stressmanagement', 'Stressmanagement',  7)
  ) as v(slug, title, sort_order)
  left join public.habit_categories a on a.slug = 'atmung'
on conflict (slug) do nothing;

-- ===================================================================
-- 2. Punkte fuer eigene Habits
-- ===================================================================
-- Der Client darf points jetzt nennen - beim Anlegen und Aendern. Fuer
-- Vorlagen der Redaktion aendert das nichts: deren Zeilen erreicht ein
-- Nutzer weder per insert- noch per update-Policy.
grant insert (points) on public.habit_templates to authenticated;
grant update (points) on public.habit_templates to authenticated;

-- Wie in 0025, plus: points 0-10 statt fest 0, und points zaehlt als
-- Bearbeiten (Plus und Einwilligung).
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
    -- Bearbeiten und damit Plus - und seit 0025 auch Einwilligung.
    if (new.title, new.description_md, new.category_id, new.unit, new.min_value,
        new.max_value, new.step_value, new.default_target, new.higher_is_better,
        new.icon, new.points)
       is distinct from
       (old.title, old.description_md, old.category_id, old.unit, old.min_value,
        old.max_value, old.step_value, old.default_target, old.higher_is_better,
        old.icon, old.points) then
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
