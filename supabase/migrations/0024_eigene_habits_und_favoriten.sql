-- 0024: Eigene Habits und Habit-Favoriten.
--
-- Eigene Habits liegen in derselben Tabelle wie die redaktionellen, nach dem
-- Muster von exercises (0007): owner_id null = Redaktion ("vorgeschlagen"),
-- sonst gehoert die Vorlage genau dieser Person. Damit laufen user_habits,
-- habit_logs, Auswertung und Score unveraendert weiter - ein eigenes Habit
-- ist fuer sie eine Vorlage wie jede andere.
--
-- Bezahlte Faehigkeit wie der Konfigurator (CLAUDE.md "Zugriff"): die Pruefung
-- sitzt am Anlegen und Aendern. Ansehen, Eintraege lesen und Loeschen bleiben
-- auch nach Ende des Abos erlaubt.
--
-- PUNKTE: ein eigenes Habit bringt 0 Punkte. Wie eigene Habits im Habit
-- Score Tracker zaehlen sollen, ist noch nicht entschieden (25.10.2026);
-- bis dahin haelt der Trigger unten die Null fest, damit niemand seinen Score
-- mit selbst erfundenen Habits aufblaest. Eine spaetere Entscheidung ist eine
-- Aenderung an genau dieser Funktion.
--
-- Additiv (SAD §2.6): neue Spalten sind nullable, neue Tabelle, Policies und
-- Funktionen werden ersetzt. Die alte App liest weiter alles, was sie kennt.

-- ===================================================================
-- 1. Eigentuemer an habit_templates
-- ===================================================================

alter table public.habit_templates
  add column if not exists owner_id   uuid references auth.users(id) on delete cascade,
  add column if not exists deleted_at timestamptz,
  add column if not exists client_id  uuid;

-- Der Client nennt keinen Slug (er steht nicht in den Spaltenrechten unten),
-- also braucht die Spalte einen Wert von sich aus. Fuer eigene Habits
-- ueberschreibt ihn der Trigger mit "eigen-<id>"; die Redaktion setzt ihren
-- Slug wie bisher selbst.
alter table public.habit_templates
  alter column slug set default ('vorlage-' || gen_random_uuid()::text);

create index if not exists idx_habit_templates_owner
  on public.habit_templates (owner_id) where owner_id is not null;
create unique index if not exists uq_habit_templates_client
  on public.habit_templates (owner_id, client_id) where client_id is not null;

comment on column public.habit_templates.owner_id is
  'null = Vorlage der Redaktion. Sonst ein eigenes Habit dieser Person (0024).';

-- user_habits.template_id war "on delete restrict". Restrict prueft SOFORT,
-- noch bevor die Kaskade einer Kontoloeschung die user_habits entfernt hat -
-- ein Konto mit einem gewaehlten eigenen Habit liesse sich dann nicht mehr
-- loeschen. "no action" prueft am Ende der Anweisung: dann sind die
-- user_habits schon weg. Fuer redaktionelle Vorlagen bleibt es dabei, dass
-- eine gewaehlte Vorlage nicht geloescht werden kann.
alter table public.user_habits
  drop constraint if exists user_habits_template_id_fkey;
alter table public.user_habits
  add constraint user_habits_template_id_fkey
    foreign key (template_id) references public.habit_templates(id) on delete no action;

-- ---------- Lesen ----------
-- Redaktion: veroeffentlicht, fuer alle. Eigene: nur fuer die Person selbst,
-- auch geloeschte - deren alte Eintraege stehen weiter in den Auswertungen.
drop policy if exists habit_templates_read on public.habit_templates;
create policy habit_templates_read on public.habit_templates
  for select using (
    (owner_id is null and is_published)
    or owner_id = (select auth.uid())
  );

-- ---------- Anlegen und Aendern ----------
create policy habit_templates_insert_own on public.habit_templates
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.has_plus_access());

create policy habit_templates_update_own on public.habit_templates
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Spaltenrechte statt Vertrauen: points, is_preview, is_published, slug,
-- exercise_id und owner_id kann der Client gar nicht erst nennen. Der
-- Trigger unten setzt sie trotzdem noch einmal fest - zwei Schloesser.
grant insert (id, owner_id, category_id, title, description_md, tracking_type, unit,
              min_value, max_value, step_value, default_target, higher_is_better,
              icon, client_id)
  on public.habit_templates to authenticated;
grant update (category_id, title, description_md, unit, min_value, max_value,
              step_value, default_target, higher_is_better, icon, sort_order,
              deleted_at)
  on public.habit_templates to authenticated;

-- Kein Hard-Delete fuer Nutzer: geloescht wird ueber deleted_at. Eine
-- Vorlage, an der Eintraege haengen, soll ihre Geschichte nicht mitnehmen.

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
    -- Loeschen geht immer, auch ohne Abo (SAD §3.4 sinngemaess). Alles
    -- andere ist Bearbeiten und damit Plus.
    if (new.title, new.description_md, new.category_id, new.unit, new.min_value,
        new.max_value, new.step_value, new.default_target, new.higher_is_better,
        new.icon)
       is distinct from
       (old.title, old.description_md, old.category_id, old.unit, old.min_value,
        old.max_value, old.step_value, old.default_target, old.higher_is_better,
        old.icon)
       and not public.has_plus_access() then
      raise exception 'Eigene Habits bearbeiten gehoert zu Plus' using errcode = '42501';
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

  -- Was ein eigenes Habit nie sein kann.
  new.points       := 0;
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

-- Laeuft vor trg_habit_templates_updated? Egal: der setzt nur updated_at.
create trigger trg_habit_templates_guard_own
  before insert or update on public.habit_templates
  for each row execute function public.guard_own_habit_template();

-- Wer ein eigenes Habit loescht, nimmt es auch aus seinem Tagebuch. Die
-- Eintraege bleiben, wie bei jedem herausgenommenen Habit.
create or replace function public.archive_deleted_own_habit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_id is not null and new.deleted_at is not null and old.deleted_at is null then
    update public.user_habits
       set is_active = false, archived_at = coalesce(archived_at, now())
     where template_id = new.id
       and user_id = new.owner_id
       and is_active;
  end if;
  return new;
end $$;

create trigger trg_habit_templates_archive_own
  after update of deleted_at on public.habit_templates
  for each row execute function public.archive_deleted_own_habit();

-- ---------- Wer eine Vorlage benutzen darf ----------
-- security definer sieht alle Zeilen - ohne die Eigentuemerpruefung koennte
-- jemand das eigene Habit einer anderen Person ueber dessen ID waehlen.
create or replace function public.can_use_habit_template(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.habit_templates t
     where t.id = p_template_id
       and t.is_published
       and t.deleted_at is null
       and (t.owner_id is null or t.owner_id = (select auth.uid()))
       and (t.is_preview or public.has_plus_access())
  );
$$;

comment on table public.habit_templates is
  'Habit-Vorlagen: owner_id null = Redaktion (is_preview = auch ohne Plus '
  'auswaehlbar), sonst ein eigenes Habit (0024, Plus, 0 Punkte).';

-- ===================================================================
-- 2. Favoriten
-- ===================================================================

create table public.habit_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.habit_templates(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  client_id   uuid,

  unique (user_id, template_id)
);

create index idx_habit_favorites_template on public.habit_favorites (template_id);

create trigger trg_habit_favorites_updated
  before update on public.habit_favorites
  for each row execute function public.set_updated_at();

alter table public.habit_favorites enable row level security;

create policy habit_favorites_select_own on public.habit_favorites
  for select using (user_id = (select auth.uid()));

-- Nur Vorlagen, die man sehen darf: das exists laeuft unter RLS der
-- Vorlagen, ein fremdes eigenes Habit ist darin also nicht zu finden.
-- Ein Favorit ist kein Plus - auch ein gesperrtes Habit darf man sich merken.
create policy habit_favorites_insert_own on public.habit_favorites
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habit_templates t where t.id = template_id)
  );

create policy habit_favorites_update_own on public.habit_favorites
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy habit_favorites_delete_own on public.habit_favorites
  for delete using (user_id = (select auth.uid()));

grant select, insert, delete on public.habit_favorites to authenticated;
grant update (deleted_at) on public.habit_favorites to authenticated;
grant select, insert, update, delete on public.habit_favorites to service_role;

comment on table public.habit_favorites is
  'Habits, die sich eine Person als Favorit markiert hat (0024).';
