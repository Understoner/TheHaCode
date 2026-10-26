-- 0028: Das Vorzeichen haengt am Habit, nicht mehr an der Kategorie (26.10.2026).
--
-- Bisher zog ein Habit nur ab, wenn seine ganze Kategorie negativ war (0021).
-- Ein Abzug wie "Koffein am Abend" haette eine eigene Kategorie neben
-- "Schlaf" gebraucht - sieben Kategorien mehr, unuebersichtlich. Jetzt
-- traegt jedes Habit selbst, ob es bringt oder abzieht. Die Kategorien
-- bleiben, wie sie sind.
--
-- Die Punkte bleiben ein Betrag (points >= 0); das Vorzeichen steht daneben.
-- So bleibt die Grenze 0-10 fuer eigene Habits unveraendert, und eine Zahl
-- allein sagt nie etwas anderes als die Spalte daneben.
--
-- Additiv: eine neue Spalte mit Default false - jedes vorhandene Habit
-- bleibt positiv, die alte App liest die Spalte einfach nicht.
-- habit_categories.is_negative bleibt bestehen und wirkt weiter
-- (src/features/habits/score.ts): ein Habit zieht ab, wenn es selbst ODER
-- seine Kategorie negativ ist.

alter table public.habit_templates
  add column if not exists is_negative boolean not null default false;

comment on column public.habit_templates.is_negative is
  'Das Habit zieht seine Punkte ab, statt sie zu bringen (0028).';

-- Eigene Habits duerfen ihre Wirkung waehlen - beim Anlegen und Aendern,
-- wie points (0026). Vorlagen der Redaktion erreicht ein Nutzer weder per
-- insert- noch per update-Policy.
grant insert (is_negative) on public.habit_templates to authenticated;
grant update (is_negative) on public.habit_templates to authenticated;

-- Wie in 0026, plus: is_negative zaehlt als Bearbeiten (Plus und
-- Einwilligung).
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
    -- zaehlt auch das Vorzeichen dazu.
    if (new.title, new.description_md, new.category_id, new.unit, new.min_value,
        new.max_value, new.step_value, new.default_target, new.higher_is_better,
        new.icon, new.points, new.is_negative)
       is distinct from
       (old.title, old.description_md, old.category_id, old.unit, old.min_value,
        old.max_value, old.step_value, old.default_target, old.higher_is_better,
        old.icon, old.points, old.is_negative) then
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
