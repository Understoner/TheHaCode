-- 0043: Onlinekurse, Schritt 2 - Fortschritt (V1.2, SAD §11.2).
--
-- Ein Eintrag je erledigtem Block. Die App setzt ihn am Ende eines Videos
-- oder einer Aufnahme, beim Herunterladen einer PDF oder per Knopf
-- ("Als erledigt markieren"); zuruecknehmen loescht die Zeile.
--
-- Regeln (Entscheidungen 03.11.2026):
--   * Fortschritt nur mit Konto - ohne auth.uid() gibt es keine Zeile.
--   * Neu erledigen nur, solange man den Kurs oeffnen darf
--     (can_open_course). Endet Plus oder ein Kauf, bleibt das Erreichte
--     lesbar, waechst aber nicht weiter.
--   * Das Quiz gilt NICHT ueber diese Tabelle als erledigt, sondern nur ueber
--     ein bestandenes Quiz (Schritt 7, submit_quiz). Sonst liesse sich die
--     Bedingung fuers Zertifikat mit einem Klick umgehen.
--   * course_id kommt per Trigger aus dem Block, nicht vom Client - sonst
--     koennte ein Block eines Bezahlkurses unter der ID eines freien Kurses
--     als erledigt eingetragen werden.
--
-- Keine Gesundheitsdaten (Verzeichnis V13). Additiv (SAD §2.6).

create table public.course_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_id    uuid not null references public.online_courses(id) on delete cascade,
  block_id     uuid not null references public.online_course_blocks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  client_id    uuid,
  unique (user_id, block_id)
);

create index idx_course_progress_user_course on public.course_progress (user_id, course_id);
create index idx_course_progress_block on public.course_progress (block_id);
create unique index uq_course_progress_client on public.course_progress (user_id, client_id) where client_id is not null;

create trigger trg_course_progress_updated
  before update on public.course_progress
  for each row execute function public.set_updated_at();

create or replace function public.course_progress_from_block()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_kind public.online_block_kind;
begin
  select b.course_id, b.kind into new.course_id, v_kind
    from public.online_course_blocks b where b.id = new.block_id;
  -- Das Quiz traegt nur submit_quiz() ein (Schritt 7). Die Funktion laeuft
  -- als security definer, also als ihr Eigentuemer (postgres) - die Rollen
  -- der App (anon, authenticated) kommen hier nie durch.
  if v_kind = 'quiz' and current_user in ('anon', 'authenticated') then
    raise exception 'Das Quiz gilt nur mit bestandenem Ergebnis als erledigt'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_course_progress_from_block
  before insert or update on public.course_progress
  for each row execute function public.course_progress_from_block();

alter table public.course_progress enable row level security;

-- Lesen: das eigene Erreichte, immer - auch nach Ende des Zugangs.
create policy course_progress_read_own on public.course_progress
  for select to authenticated using (user_id = auth.uid());

-- Erledigen: nur fuer sich und nur mit Zugang. course_id ist hier schon die
-- vom Trigger gesetzte (BEFORE-Trigger laufen vor der with-check-Pruefung).
create policy course_progress_insert_own on public.course_progress
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_open_course(course_id));

-- Zuruecknehmen: die eigene Zeile loeschen.
create policy course_progress_delete_own on public.course_progress
  for delete to authenticated using (user_id = auth.uid());

-- Kein UPDATE fuer authenticated: ein erledigter Block wird nicht
-- umgeschrieben (etwa auf einen anderen Block oder ein anderes Datum).
grant select, insert, delete on public.course_progress to authenticated;
grant select, insert, update, delete on public.course_progress to service_role;

comment on table public.course_progress is
  'Erledigte Bloecke eines Onlinekurses (0043). Quiz nur ueber submit_quiz() (Schritt 7).';
