-- ---------- Atem-Tagebuch, Habit Score Tracker, Session-Protokoll (V1.1) ----------
-- SAD §3.5, §3.6, §3.10 und §3.12 (neu). Rein additiv (CLAUDE.md §Migrationen):
-- vier neue Tabellen, eine neue Spalte mit Vorgabewert, drei Funktionen, eine
-- unveroeffentlichte Einwilligungsfassung. Nichts entfernt, nichts umbenannt.
-- Die alte App-Version kennt keine der Tabellen und laeuft unveraendert weiter.
--
-- DER AUFBAU IN EINEM SATZ
-- ------------------------
-- Kategorie (Redaktion) -> Vorlage (Redaktion) -> Auswahl des Nutzers ->
-- Tageseintrag. Punkte und Limits haengen an Kategorie und Vorlage; der Score
-- selbst wird NIRGENDS gespeichert, sondern aus den Eintraegen gerechnet
-- (src/features/habits/score.ts). Ein gespeicherter Score waere ein zweiter
-- Wert, der neben den Eintraegen herlaeuft und irgendwann von ihnen abweicht.
--
-- WER WAS DARF
-- ------------
--   * Lesen, Loeschen der eigenen Eintraege: immer. Weder ein Widerruf noch
--     ein abgelaufenes Abo sperrt jemanden von seinen Gesundheitsdaten aus
--     (Art. 15, 20 DSGVO; SAD §3.10).
--   * Neue Eintraege und Aenderungen: Einwilligung health_data UND das Habit
--     ist freigegeben - entweder als Vorschau (is_preview) oder ueber Plus.
--   * Ein Habit auswaehlen: nur, wenn es freigegeben ist. Sehen darf man alle
--     veroeffentlichten, auch die gesperrten - die Vorschau soll zeigen, was
--     es mit Plus noch gibt.
--
-- Das Bezahlrecht fragt weiterhin ausschliesslich has_plus_access()
-- (CLAUDE.md §Zugriff). can_use_habit_template() unten ist kein zweiter
-- Zugriffswert, sondern verbindet ihn mit der Vorschau-Markierung.

-- ============================================================
-- 1. Kategorien (Redaktion)
-- ============================================================
-- Heute gibt es genau eine: Atmung. Geplant ist ein Longevity-Tagebuch mit
-- weiteren Kategorien (Schlaf, Bewegung, Ernaehrung ...) und mit negativen
-- wie "Zuckerattacke". Dafuer braucht es keine Schemaaenderung mehr, nur
-- Zeilen.
create table public.habit_categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  description   text,
  icon          text,

  -- Negative Kategorien ziehen Punkte ab. Das Vorzeichen steht HIER und nicht
  -- an den Punkten der Vorlage: sonst koennte eine Vorlage mit positiven
  -- Punkten in einer negativen Kategorie stehen, und niemand wuesste, was
  -- gemeint ist.
  is_negative   boolean not null default false,

  -- Hoechstens so viele Punkte (bei negativen: hoechstens so viel Abzug) je
  -- Tag, Woche und Monat. Rechenregel in SAD §3.12.
  max_per_day   int not null check (max_per_day   > 0),
  max_per_week  int not null check (max_per_week  > 0),
  max_per_month int not null check (max_per_month > 0),

  sort_order    int not null default 0,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Ein Wochenlimit unter dem Tageslimit waere ein Tippfehler im Studio, kein
  -- Konzept. Die Datenbank faengt ihn, weil das Studio keine Formularpruefung
  -- kennt (SAD §2.4).
  constraint chk_habit_category_limits
    check (max_per_day <= max_per_week and max_per_week <= max_per_month)
);

create trigger trg_habit_categories_updated
  before update on public.habit_categories
  for each row execute function public.set_updated_at();

alter table public.habit_categories enable row level security;

-- Veroeffentlichte Kategorien sind fuer alle lesbar, auch ohne Konto: sie
-- sagen nichts ueber eine Person, und die Tagebuchseite zeigt sie
-- Besuchern als Ausblick.
create policy habit_categories_read on public.habit_categories
  for select using (is_published);

create policy habit_categories_admin_write on public.habit_categories
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.habit_categories to anon, authenticated;
grant select, insert, update, delete on public.habit_categories to service_role;

comment on table public.habit_categories is
  'Longevity-Kategorien des Habit Score Trackers mit Punktelimits je Tag, Woche, '
  'Monat. Negative Kategorien ziehen Punkte ab.';

-- ============================================================
-- 2. Vorlagen (Redaktion), SAD §3.5
-- ============================================================
-- Abweichungen von der Skizze im SAD, alle begruendet:
--   * visibility entfaellt. Sehen duerfen alle Angemeldeten alle
--     veroeffentlichten Vorlagen; was man AUSWAEHLEN darf, sagt is_preview
--     zusammen mit has_plus_access(). Zwei Spalten fuer eine Frage waeren
--     zwei Stellen, die sich widersprechen koennen.
--   * category_id und points fuer den Score.
--   * exercise_id: die Sequenz, die zum Habit gehoert. Wer sie zu Ende
--     atmet, hat das Habit erledigt - die App traegt es dann selbst ein.
create table public.habit_templates (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  category_id      uuid not null references public.habit_categories(id) on delete restrict,
  title            text not null,
  description_md   text,
  tracking_type    public.habit_tracking_type not null,

  -- Fuer tracking_type = 'number'
  unit             text,
  min_value        numeric,
  max_value        numeric,
  step_value       numeric,
  default_target   numeric,
  higher_is_better boolean not null default true,

  -- Punkte fuer das Erledigen, nicht fuer den Wert: wer seinen BOLT-Wert
  -- misst, bekommt sie, egal ob 15 oder 40 Sekunden herauskommen. Das ist
  -- fair und haelt die App aus jeder Bewertung von Messwerten heraus
  -- (SAD §5.7, Medizinprodukt). Immer positiv - das Vorzeichen gibt die
  -- Kategorie.
  points           int not null default 0 check (points >= 0),

  -- Die Vorschau fuer Angemeldete ohne Plus.
  is_preview       boolean not null default false,

  exercise_id      uuid references public.exercises(id) on delete set null,

  icon             text,
  sort_order       int not null default 0,
  is_published     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint chk_habit_template_range
    check (min_value is null or max_value is null or min_value <= max_value)
);

create index idx_habit_templates_category on public.habit_templates (category_id);
create index idx_habit_templates_exercise on public.habit_templates (exercise_id)
  where exercise_id is not null;

create trigger trg_habit_templates_updated
  before update on public.habit_templates
  for each row execute function public.set_updated_at();

alter table public.habit_templates enable row level security;

create policy habit_templates_read on public.habit_templates
  for select using (is_published);

create policy habit_templates_admin_write on public.habit_templates
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.habit_templates to anon, authenticated;
grant select, insert, update, delete on public.habit_templates to service_role;

comment on table public.habit_templates is
  'Habit-Vorlagen der Redaktion. is_preview = auch ohne Plus auswaehlbar.';

-- ============================================================
-- 3. Darf der Aufrufer dieses Habit benutzen?
-- ============================================================
-- security definer, damit die Policies unten sie ohne Rekursion aufrufen
-- koennen. Sie beantwortet nur eine Frage ueber den Aufrufer selbst
-- (has_plus_access liest auth.uid()), ein Parameter fuer eine fremde Person
-- existiert nicht.
--
-- Unveroeffentlichte Vorlagen sind fuer niemanden benutzbar, auch nicht mit
-- Plus: sonst waere die Funktion ein Weg, IDs von Entwuerfen zu bestaetigen.
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
       and (t.is_preview or public.has_plus_access())
  );
$$;

grant execute on function public.can_use_habit_template(uuid) to authenticated;

comment on function public.can_use_habit_template(uuid) is
  'true, wenn der Aufrufer die Vorlage benutzen darf: veroeffentlicht und '
  'Vorschau oder Plus. Plus kommt ausschliesslich aus has_plus_access().';

-- ============================================================
-- 4. Auswahl des Nutzers, SAD §3.5
-- ============================================================
create table public.user_habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  template_id  uuid not null references public.habit_templates(id) on delete restrict,
  target_value numeric,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  started_on   date not null default current_date,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- CLAUDE.md §Immer, fehlte in der SAD-Skizze
  deleted_at   timestamptz,
  client_id    uuid
);

-- Ein Habit nur einmal aktiv je Person; nach dem Archivieren laesst es sich
-- neu waehlen.
create unique index uq_user_habit_active
  on public.user_habits (user_id, template_id)
  where is_active and deleted_at is null;
create unique index uq_user_habits_client
  on public.user_habits (user_id, client_id) where client_id is not null;
create index idx_user_habits_template on public.user_habits (template_id);

create trigger trg_user_habits_updated
  before update on public.user_habits
  for each row execute function public.set_updated_at();

alter table public.user_habits enable row level security;

create policy user_habits_select_own on public.user_habits
  for select using (user_id = auth.uid());

-- Hier sitzt die Vorschau-Schranke beim Auswaehlen.
create policy user_habits_insert_own on public.user_habits
  for insert with check (
    user_id = auth.uid()
    and public.can_use_habit_template(template_id)
  );

-- Aendern (Reihenfolge, Ziel, Archivieren) bleibt immer erlaubt - es gibt
-- nichts frei, was man nicht ohnehin hat. Die Vorlage selbst laesst sich
-- dagegen NICHT tauschen: sonst waehlte man ein Vorschau-Habit und machte
-- daraus per UPDATE ein Plus-Habit. Abgesichert ueber Spaltenrechte unten,
-- nicht ueber die Policy - eine with-check-Klausel sieht den alten Wert nicht.
create policy user_habits_update_own on public.user_habits
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_habits_delete_own on public.user_habits
  for delete using (user_id = auth.uid());

grant select, insert, delete on public.user_habits to authenticated;
grant update (target_value, sort_order, is_active, archived_at, deleted_at)
  on public.user_habits to authenticated;
grant select, insert, update, delete on public.user_habits to service_role;

comment on table public.user_habits is
  'Die Habits, die eine Person fuer ihr Tagebuch gewaehlt hat.';

-- ============================================================
-- 5. Tageseintraege, SAD §3.5 und §3.10
-- ============================================================
create table public.habit_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  user_habit_id  uuid not null references public.user_habits(id) on delete cascade,
  -- Der Kalendertag der Person, vom Geraet in ihrer Zeitzone bestimmt. Ein
  -- timestamptz hiesse, dass ein Eintrag um 23:30 in Wien nach UTC-Rechnung
  -- am naechsten Tag laege.
  log_date       date not null,

  value_numeric  numeric,
  value_text     text check (value_text is null or length(value_text) <= 1000),
  note           text check (note is null or length(note) <= 1000),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  client_id      uuid,

  -- Ein Eintrag je Habit und Tag. Das ist zugleich die Grenze gegen
  -- Punktesammeln: zweimal am Tag messen zaehlt einmal.
  unique (user_habit_id, log_date)
);

create unique index uq_habit_logs_client
  on public.habit_logs (user_id, client_id) where client_id is not null;
create index idx_habit_logs_user_date on public.habit_logs (user_id, log_date desc);

create trigger trg_habit_logs_updated
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

-- Werte gegen die Erfassungsart pruefen (SAD §3.5). security invoker: der
-- Trigger sieht genau das, was der Schreibende sehen darf. Eine fremde
-- user_habit_id findet er nicht und bricht ab, bevor die Policy ueberhaupt
-- gefragt wird - ohne dabei etwas ueber das fremde Habit zu verraten.
create or replace function public.validate_habit_log()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_type    public.habit_tracking_type;
  v_min     numeric;
  v_max     numeric;
  v_owner   uuid;
begin
  select ht.tracking_type, ht.min_value, ht.max_value, uh.user_id
    into v_type, v_min, v_max, v_owner
    from public.user_habits uh
    join public.habit_templates ht on ht.id = uh.template_id
   where uh.id = new.user_habit_id;

  if v_type is null then
    raise exception 'Dieses Habit gibt es nicht (mehr)'
      using errcode = 'foreign_key_violation';
  end if;

  -- user_id ist denormalisiert (fuer RLS). Er muss zum Habit passen, sonst
  -- laege ein Eintrag im Tagebuch des einen und zaehlte im Score des anderen.
  if new.user_id is distinct from v_owner then
    raise exception 'Eintrag und Habit gehoeren nicht derselben Person'
      using errcode = 'check_violation';
  end if;

  -- Ein Tag Vorlauf fuer Zeitzonen oestlich von UTC, mehr nicht. Nachtragen
  -- vergangener Tage bleibt erlaubt.
  if new.log_date > current_date + 1 then
    raise exception 'Eintraege fuer die Zukunft sind nicht moeglich'
      using errcode = 'check_violation';
  end if;

  if v_type = 'text' then
    if new.value_text is null or btrim(new.value_text) = '' then
      raise exception 'Text erforderlich' using errcode = 'check_violation';
    end if;
    new.value_numeric := null;
  elsif v_type = 'done' then
    -- Die Zeile selbst ist die Aussage. Der Wert 1 steht nur da, damit
    -- Zaehlungen ueber value_numeric nicht an einem NULL scheitern.
    new.value_numeric := 1;
    new.value_text := null;
  else
    if new.value_numeric is null then
      raise exception 'Wert erforderlich' using errcode = 'check_violation';
    end if;
    if v_type = 'smiley_5' and new.value_numeric not between 1 and 5 then
      raise exception 'smiley_5 erwartet 1..5' using errcode = 'check_violation';
    end if;
    if v_type = 'slider_100' and new.value_numeric not between 0 and 100 then
      raise exception 'slider_100 erwartet 0..100' using errcode = 'check_violation';
    end if;
    if v_type = 'number' and v_min is not null and new.value_numeric < v_min then
      raise exception 'Wert unter Minimum' using errcode = 'check_violation';
    end if;
    if v_type = 'number' and v_max is not null and new.value_numeric > v_max then
      raise exception 'Wert ueber Maximum' using errcode = 'check_violation';
    end if;
    new.value_text := null;
  end if;

  return new;
end $$;

create trigger trg_validate_habit_log
  before insert or update on public.habit_logs
  for each row execute function public.validate_habit_log();

alter table public.habit_logs enable row level security;

-- Lesen und Loeschen: IMMER, fuer die eigenen Zeilen (SAD §3.10).
create policy habit_logs_select_own on public.habit_logs
  for select using (user_id = auth.uid());

create policy habit_logs_delete_own on public.habit_logs
  for delete using (user_id = auth.uid());

-- Schreiben: Einwilligung nach Art. 9 UND das Habit ist freigegeben. Die
-- Unterabfrage prueft zugleich, dass das Habit der schreibenden Person
-- gehoert - user_id = auth.uid() allein liesse einen Eintrag an einem
-- fremden Habit zu, wenn nur die eigene ID daneben steht.
create policy habit_logs_insert_own on public.habit_logs
  for insert with check (
    user_id = auth.uid()
    and public.has_consent('health_data')
    and exists (
      select 1 from public.user_habits uh
       where uh.id = user_habit_id
         and uh.user_id = auth.uid()
         and public.can_use_habit_template(uh.template_id)
    )
  );

create policy habit_logs_update_own on public.habit_logs
  for update using (
    user_id = auth.uid()
    and public.has_consent('health_data')
  ) with check (
    user_id = auth.uid()
    and public.has_consent('health_data')
    and exists (
      select 1 from public.user_habits uh
       where uh.id = user_habit_id
         and uh.user_id = auth.uid()
         and public.can_use_habit_template(uh.template_id)
    )
  );

grant select, insert, update, delete on public.habit_logs to authenticated;
grant select, insert, update, delete on public.habit_logs to service_role;

comment on table public.habit_logs is
  'Tageseintraege des Atem-Tagebuchs. Gesundheitsdaten nach Art. 9 DSGVO: '
  'Schreiben nur mit Einwilligung health_data, Lesen und Loeschen immer.';

-- ============================================================
-- 6. Session-Protokoll, SAD §3.6
-- ============================================================
-- Nutzungsdaten nach Art. 6 Abs. 1 lit. b, keine Gesundheitsdaten: dass
-- jemand eine Sequenz geatmet hat, sagt nichts ueber seinen Zustand. Deshalb
-- ohne Einwilligung und ohne Plus.
create table public.exercise_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- set null: eine geloeschte eigene Sequenz soll die Atemminuten nicht
  -- rueckwirkend aus der Statistik nehmen.
  exercise_id      uuid references public.exercises(id) on delete set null,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  duration_seconds int check (duration_seconds >= 0 and duration_seconds <= 86400),
  rounds_completed int check (rounds_completed >= 0),
  is_completed     boolean not null default false,
  client_id        uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint chk_session_completed
    check (not is_completed or completed_at is not null)
);

create unique index uq_sessions_client
  on public.exercise_sessions (user_id, client_id) where client_id is not null;
create index idx_sessions_user_time on public.exercise_sessions (user_id, started_at desc);
create index idx_sessions_exercise on public.exercise_sessions (exercise_id)
  where exercise_id is not null;

create trigger trg_exercise_sessions_updated
  before update on public.exercise_sessions
  for each row execute function public.set_updated_at();

alter table public.exercise_sessions enable row level security;

create policy exercise_sessions_select_own on public.exercise_sessions
  for select using (user_id = auth.uid());

-- Wie beim Stern (0017): protokollieren laesst sich nur, was man sehen darf.
-- Sonst waere das Protokoll ein Weg, IDs durchzuprobieren.
create policy exercise_sessions_insert_own on public.exercise_sessions
  for insert with check (
    user_id = auth.uid()
    and (exercise_id is null
         or exists (select 1 from public.exercises e where e.id = exercise_id))
  );

create policy exercise_sessions_update_own on public.exercise_sessions
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (exercise_id is null
         or exists (select 1 from public.exercises e where e.id = exercise_id))
  );

create policy exercise_sessions_delete_own on public.exercise_sessions
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.exercise_sessions to authenticated;
grant select, insert, update, delete on public.exercise_sessions to service_role;

comment on table public.exercise_sessions is
  'Protokoll geatmeter Sequenzen (Start, Ende, Dauer). Nutzungsdaten, keine '
  'Gesundheitsdaten.';

-- ============================================================
-- 7. Der Schalter fuer den Habit Score Tracker
-- ============================================================
-- Gehoert zur Person, nicht zum Geraet - wie Ton und Ansage (0001, 0016).
-- Vorgabe aus: Punkte sind ein Angebot, kein Zwang.
alter table public.profiles
  add column if not exists habit_score_enabled boolean not null default false;

comment on column public.profiles.habit_score_enabled is
  'Habit Score Tracker eingeschaltet. Vorgabe aus.';

-- ============================================================
-- 8. Die Einwilligung nach Art. 9 - als ENTWURF
-- ============================================================
-- Unveroeffentlicht (published_at null): unsichtbar, und niemand kann sich
-- darauf berufen (Policy user_consents_insert aus 0012). Veroeffentlicht wird
-- sie von Hand, erst nachdem ein Mensch den Wortlaut geprueft hat und die
-- Datenschutzerklaerung angepasst ist:
--
--   update public.consent_definitions set published_at = now()
--    where kind = 'health_data' and version = 1;
--
-- Bis dahin laesst sich der Text im Studio aendern. Danach nicht mehr - dann
-- kommt eine Version 2 dazu (Kommentar an consent_definitions, 0012).
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'health_data', 1, 'de', 'Einwilligung Atem-Tagebuch',
  'Ich willige ausdrücklich ein, dass meine Einträge im Atem-Tagebuch '
  '(zum Beispiel BOLT-Wert und erledigte Atemübungen) als Gesundheitsdaten '
  'nach Art. 9 Abs. 2 lit. a DSGVO gespeichert und für meine eigenen '
  'Auswertungen verarbeitet werden. Die Einwilligung ist freiwillig und keine '
  'Voraussetzung für die übrige Nutzung der App. Ich kann sie jederzeit unter '
  '„Konto“ widerrufen; bereits gespeicherte Einträge kann ich danach weiter '
  'ansehen, exportieren und löschen. Einzelheiten stehen in der '
  'Datenschutzerklärung unter /datenschutz.',
  false, null
)
on conflict (kind, version, locale) do nothing;
