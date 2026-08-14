-- ---------- Uebungen / Box-Atemsequenzen (SAD §3.4) ----------
-- Zweistufiges Modell, weil eine Atemuebung eine verschachtelte, wiederholte
-- Sequenz ist:
--
--   exercise
--    └── exercise_step   (position, repeat_count)      "Block", wiederholt sich N-mal
--         └── exercise_phase (position, kind, duration) einzelne Atemphase
--
-- Box Breathing ist der Spezialfall: EIN Step mit repeat_count = 8 und vier
-- Phasen. Fuer wenige Zeilen mehr deckt dasselbe Modell auch
-- High-Frequency-Protokolle mit mehreren Bloecken ab (SAD §3.4).
--
-- Bewusst nicht als JSONB in exercises: die Phasen sind Redaktionsdaten, die
-- im Studio bearbeitet und geprueft werden. JSONB verliert Constraints,
-- Referenzintegritaet und Diff-Barkeit.
--
-- Die Enums (exercise_type, playback_mode, phase_kind, visibility_level)
-- stehen bereits seit 0001_foundation.sql.

-- ---------- Kategorien ----------
create table public.exercise_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text,
  icon        text,
  sort_order  int  not null default 0
);

-- ---------- Uebungen ----------
create table public.exercises (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique,   -- null bei Nutzer-Sequenzen
  category_id           uuid references public.exercise_categories(id) on delete set null,

  -- NULL = redaktionell (ueber Studio gepflegt), gesetzt = vom Nutzer gebaut.
  -- Ein Feld statt zweier Tabellenbaeume: die Engine kennt nur einen Codepfad.
  owner_id              uuid references auth.users(id) on delete cascade,

  type                  exercise_type    not null,
  playback_mode         playback_mode    not null default 'timer',
  visibility            visibility_level not null default 'plus',

  title                 text not null,
  subtitle              text,
  description_md        text,
  benefits_md           text,
  contraindications_md  text,          -- fachlich relevant: Schwangerschaft, Epilepsie, Herz

  cover_image_path      text,          -- Storage: public-assets
  audio_path            text,          -- erst ab V1.2 (audio_guided), siehe SAD §7.2
  video_provider        text check (video_provider in ('vimeo','youtube')),
  video_external_id     text,
  video_hash            text,

  -- Nur fuer type = 'paced'
  default_round_count   int check (default_round_count between 1 and 200),
  has_metronome         boolean not null default true,

  difficulty            int check (difficulty between 1 and 3),
  estimated_seconds     int,           -- optional vorberechnet, sonst v_exercise_duration
  sort_order            int not null default 0,
  is_published          boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- CLAUDE.md verlangt beides fuer Tabellen mit Nutzerbezug. In V1 gibt es noch
  -- keine Anmeldung und damit keine Nutzer-Sequenzen; die Spalten stehen
  -- trotzdem jetzt schon, weil Migrationen ausnahmslos additiv sind und ein
  -- Nachruesten spaeter drei Schritte ueber zwei Releases kostet.
  deleted_at            timestamptz,
  client_id             uuid,

  -- Integritaetsregeln je Typ
  constraint chk_paced_needs_rounds
    check (type <> 'paced' or default_round_count is not null),
  constraint chk_general_needs_content
    check (type <> 'general' or (description_md is not null or audio_path is not null or video_external_id is not null)),
  -- Gefuehrte Aufnahmen brauchen zwingend eine Audiodatei als Zeitquelle (SAD §7.2)
  constraint chk_audio_modes_need_audio
    check (playback_mode = 'timer' or audio_path is not null)
);

create index idx_exercises_visibility on public.exercises (visibility) where is_published;
create index idx_exercises_category on public.exercises (category_id);
create index idx_exercises_owner on public.exercises (owner_id) where owner_id is not null;

create trigger trg_exercises_updated
  before update on public.exercises
  for each row execute function public.set_updated_at();

-- ---------- Bloecke ----------
create table public.exercise_steps (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  position      int  not null,
  label         text,                                   -- z. B. "Aufwaermen", "Retention"
  repeat_count  int  not null default 1 check (repeat_count between 1 and 200),
  rest_seconds  numeric(5,2) not null default 0 check (rest_seconds >= 0),
  unique (exercise_id, position)
);

create index idx_exercise_steps_exercise on public.exercise_steps (exercise_id);

-- ---------- Phasen ----------
create table public.exercise_phases (
  id                        uuid primary key default gen_random_uuid(),
  step_id                   uuid not null references public.exercise_steps(id) on delete cascade,
  position                  int  not null,
  kind                      phase_kind   not null,
  duration_seconds          numeric(5,2) not null default 0 check (duration_seconds >= 0),

  -- "So lange du kannst" (Retention): der Client zeigt eine Stoppuhr,
  -- beendet wird per Tippen.
  is_open_ended             boolean not null default false,

  -- Progression ueber die Runden (z. B. Ausatmung pro Runde 0,5 s laenger)
  duration_delta_per_round  numeric(4,2) not null default 0,
  max_duration_seconds      numeric(5,2),

  cue_text                  text,                       -- "durch die Nase, in den Bauch"
  unique (step_id, position),

  constraint chk_open_ended_has_no_fixed_duration
    check (not is_open_ended or duration_seconds = 0)
);

create index idx_exercise_phases_step on public.exercise_phases (step_id);

-- ---------- RLS ----------
alter table public.exercise_categories enable row level security;
alter table public.exercises           enable row level security;
alter table public.exercise_steps      enable row level security;
alter table public.exercise_phases     enable row level security;

create policy exercise_categories_read on public.exercise_categories
  for select using (true);

create policy exercise_categories_admin_write on public.exercise_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- Redaktionelle Inhalte: sichtbar nach Stufe. Eigene Sequenzen: immer die
-- eigenen - auch nach Ablauf des Abos (SAD §3.4).
create policy exercises_read on public.exercises
  for select using (
    (owner_id is null and is_published and deleted_at is null and (
        visibility = 'free'
        or (visibility = 'registered' and auth.uid() is not null)
        or (visibility = 'plus'       and public.has_plus_access())
    ))
    or owner_id = auth.uid()
  );

-- Die bezahlte Leistung ist eine Faehigkeit, kein Inhalt: die Pruefung sitzt
-- am INSERT, nicht am SELECT (CLAUDE.md §Zugriff).
create policy exercises_insert_own on public.exercises
  for insert with check (
    owner_id = auth.uid()
    and public.has_plus_access()
    and type = 'paced'            -- Nutzer bauen Sequenzen, keine Videobeitraege
    and playback_mode = 'timer'
    and visibility = 'plus'
    and not is_published          -- eigene Sequenzen erscheinen nie im Katalog
  );

create policy exercises_update_own on public.exercises
  for update using (owner_id = auth.uid() and public.has_plus_access())
          with check (owner_id = auth.uid());

-- Loeschen bleibt IMMER erlaubt, auch nach Ende des Abos.
create policy exercises_delete_own on public.exercises
  for delete using (owner_id = auth.uid());

-- Redaktion: wie bei News, Kursen und Team duerfen Admins schreiben. Studio
-- arbeitet zwar mit service_role und umgeht RLS ohnehin - die Policy sorgt
-- dafuer, dass ein am Client angemeldeter Admin dieselben Rechte hat und das
-- Muster im Schema einheitlich bleibt.
create policy exercises_admin_write on public.exercises
  for all using (public.is_admin() and owner_id is null)
  with check (public.is_admin() and owner_id is null);

-- Kindtabellen erben die Sichtbarkeit ueber die Unterabfrage auf exercises:
-- RLS greift dort rekursiv, ein nicht sichtbarer Elternsatz liefert also auch
-- keine Bloecke oder Phasen (in 007_exercises.test.sql als Missbrauchsfall
-- geprueft, nicht bloss angenommen).
create policy exercise_steps_read on public.exercise_steps
  for select using (exists (
    select 1 from public.exercises e where e.id = exercise_id
  ));

create policy exercise_steps_write_own on public.exercise_steps
  for all using (exists (
    select 1 from public.exercises e
    where e.id = exercise_id and e.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.exercises e
    where e.id = exercise_id and e.owner_id = auth.uid() and public.has_plus_access()
  ));

create policy exercise_steps_admin_write on public.exercise_steps
  for all using (public.is_admin()) with check (public.is_admin());

create policy exercise_phases_read on public.exercise_phases
  for select using (exists (
    select 1 from public.exercise_steps s where s.id = step_id
  ));

create policy exercise_phases_write_own on public.exercise_phases
  for all using (exists (
    select 1 from public.exercise_steps s
    join public.exercises e on e.id = s.exercise_id
    where s.id = step_id and e.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.exercise_steps s
    join public.exercises e on e.id = s.exercise_id
    where s.id = step_id and e.owner_id = auth.uid() and public.has_plus_access()
  ));

create policy exercise_phases_admin_write on public.exercise_phases
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Mengenlimit gehoert in die Datenbank, nicht ins UI ----------
create or replace function public.check_exercise_quota()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null
     and (select count(*) from public.exercises where owner_id = new.owner_id) >= 50 then
    raise exception 'Maximal 50 eigene Sequenzen';
  end if;
  return new;
end $$;

create trigger trg_exercise_quota
  before insert on public.exercises
  for each row execute function public.check_exercise_quota();

-- ---------- Gesamtdauer als View ----------
-- security_invoker = true ist hier sicherheitsrelevant und NICHT optional:
-- ohne das laeuft die View mit den Rechten ihres Eigentuemers und umgeht die
-- RLS der zugrunde liegenden Tabellen. Ein anonymer Aufruf bekaeme damit die
-- Dauer unveroeffentlichter oder kostenpflichtiger Uebungen. Der Missbrauchs-
-- fall steht in 007_exercises.test.sql.
create view public.v_exercise_duration
with (security_invoker = true) as
select
  e.id as exercise_id,
  sum(
    st.repeat_count * coalesce(ph.step_seconds, 0) + st.rest_seconds
  )::int as total_seconds
from public.exercises e
join public.exercise_steps st on st.exercise_id = e.id
left join lateral (
  select sum(p.duration_seconds
             + p.duration_delta_per_round * (st.repeat_count - 1) / 2.0) as step_seconds
  from public.exercise_phases p
  where p.step_id = st.id
) ph on true
group by e.id;

-- ---------- Grants ----------
-- Ohne "auto_expose_new_tables" erteilt Supabase keine Grants mehr automatisch
-- (config.toml) - deshalb explizit wie bei news_posts und courses.
grant select on public.exercise_categories to anon, authenticated;
grant select on public.exercises           to anon, authenticated;
grant select on public.exercise_steps      to anon, authenticated;
grant select on public.exercise_phases     to anon, authenticated;
grant select on public.v_exercise_duration to anon, authenticated;

-- Schreibrechte auf Tabellenebene braucht der angemeldete Nutzer, damit die
-- RLS-Policies ueberhaupt greifen koennen - die eigentliche Einschraenkung
-- leisten allein die Policies oben.
grant insert, update, delete on public.exercises       to authenticated;
grant insert, update, delete on public.exercise_steps  to authenticated;
grant insert, update, delete on public.exercise_phases to authenticated;
grant insert, update, delete on public.exercise_categories to authenticated;

grant select, insert, update, delete on public.exercise_categories to service_role;
grant select, insert, update, delete on public.exercises           to service_role;
grant select, insert, update, delete on public.exercise_steps      to service_role;
grant select, insert, update, delete on public.exercise_phases     to service_role;
grant select on public.v_exercise_duration to service_role;
