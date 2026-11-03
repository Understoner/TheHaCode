-- 0044: Onlinekurse, Schritt 6 - Bloecke im Tagebuch einplanen (V1.2, SAD §11.2).
--
-- Ein geplanter Termin je Block: Datum und (optional) Tageszeit wie bei den
-- Habit-Vorlagen (0039: morgens, tagsueber, abends). Das Muster ist das der
-- Uebungswege (challenge_slots, 0036), aber bewusst getrennt davon:
--
--   * Kurstermine sind KEINE Gesundheitsdaten. Sie stehen nicht in
--     habit_logs, fliessen nicht in den Habit Score und brauchen keine
--     Einwilligung health_data (Verzeichnis V13). Das Tagebuch zeigt sie nur an.
--   * Keine Erinnerungen (CLAUDE.md): ein Termin ist ein Eintrag, kein Wecker.
--   * Ein Block hat hoechstens einen Termin; verschieben heisst, das Datum zu
--     aendern.
--
-- Wie in 0043 kommt course_id per Trigger aus dem Block, nicht vom Client,
-- und neu planen darf nur, wer den Kurs oeffnen darf. Endet der Zugang,
-- bleiben die Termine sichtbar und loeschbar.
--
-- Additiv (SAD §2.6).

create table public.course_plan_slots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  uuid not null references public.online_courses(id) on delete cascade,
  block_id   uuid not null references public.online_course_blocks(id) on delete cascade,
  planned_on date not null,
  day_part   text check (day_part is null or day_part in ('morgens', 'tagsueber', 'abends')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id  uuid,
  unique (user_id, block_id)
);

create index idx_course_plan_slots_user_day on public.course_plan_slots (user_id, planned_on);
create index idx_course_plan_slots_course on public.course_plan_slots (course_id);
create unique index uq_course_plan_slots_client on public.course_plan_slots (user_id, client_id) where client_id is not null;

create trigger trg_course_plan_slots_updated
  before update on public.course_plan_slots
  for each row execute function public.set_updated_at();

create or replace function public.course_plan_slot_from_block()
returns trigger language plpgsql set search_path = '' as $$
begin
  select b.course_id into new.course_id
    from public.online_course_blocks b where b.id = new.block_id;
  return new;
end;
$$;

create trigger trg_course_plan_slot_from_block
  before insert or update on public.course_plan_slots
  for each row execute function public.course_plan_slot_from_block();

alter table public.course_plan_slots enable row level security;

create policy course_plan_slots_read_own on public.course_plan_slots
  for select to authenticated using (user_id = auth.uid());

create policy course_plan_slots_insert_own on public.course_plan_slots
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_open_course(course_id));

-- Verschieben: nur die eigenen, nur mit Zugang, und nicht auf ein fremdes Konto.
create policy course_plan_slots_update_own on public.course_plan_slots
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_open_course(course_id));

create policy course_plan_slots_delete_own on public.course_plan_slots
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.course_plan_slots to authenticated;
grant select, insert, update, delete on public.course_plan_slots to service_role;

comment on table public.course_plan_slots is
  'Im Tagebuch geplante Bloecke eines Onlinekurses (0044). Keine Gesundheitsdaten, keine Erinnerungen.';
