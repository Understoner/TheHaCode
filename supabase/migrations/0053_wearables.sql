-- 0053: Geraete-Anbindung Oura und Garmin (07.11.2026, nur Testsystem)
--
-- Wer mag, verbindet Oura und/oder Garmin. Die Tageswerte der Geraete landen
-- in wearable_daily (je Anbieter eine Zeile je Wert und Tag). Daraus fuellt
-- die Datenbank die gewaehlten Lebensstil-Habits (Schritte, Schlafdauer,
-- Schlafwert, Etagen, Intensitaetsminuten) - liefern beide Geraete denselben
-- Wert, steht im Tagebuch der Durchschnitt.
--
-- Bewusst nur Tageswerte: keine Herzfrequenz-Verlaeufe, keine Einzelmessungen.
--
-- AUF LIVE AUS
-- ------------
-- Die Oberflaeche steht hinter src/features/wearables/flag.ts (Livesystem
-- aus), die Edge Function antwortet nur, wenn WEARABLES_ENABLED=true als
-- Function Secret gesetzt ist (nur Staging). Die Tabellen hier sind ohne
-- Verbindung leer und schaden nicht; ein Rueckbau braucht deshalb keine
-- zerstoerende Migration (SAD §2.6) - siehe docs/WEARABLES.md.
--
-- WER SCHREIBT
-- ------------
-- Nur die Edge Function "wearables" mit service_role, und auch die nur ueber
-- save_wearable_days() / remove_wearable(). Dort sitzen die Pruefungen
-- (Einwilligung health_data, Verbindung vorhanden, Habit benutzbar), damit sie
-- in der Datenbank stehen und per pgTAP geprueft sind - nicht nur im Code der
-- Funktion. Der Client liest nur seine eigenen Zeilen.
--
-- Additiv (SAD §2.6): neue Tabellen, neue nullable Spalten. Die alte App
-- ignoriert habit_logs.source und habit_templates.wearable_metric.

-- ===================================================================
-- 1. Anbieter und Werte
-- ===================================================================
create type public.wearable_provider as enum ('oura', 'garmin');

-- Die Liste der Tageswerte steht in einer Funktion statt in fuenf Checks:
-- kommt ein Wert dazu, aendert sich genau diese Stelle.
create or replace function public.is_wearable_metric(p_metric text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_metric in (
    'steps',              -- Schritte
    'floors',             -- Etagen gestiegen (nur Garmin)
    'intensity_minutes',  -- Intensitaetsminuten: maessig + 2 x intensiv
    'sleep_hours',        -- Schlafdauer in Stunden
    'sleep_score',        -- Schlafwert 0..100
    'resting_hr',         -- Ruhepuls (Garmin: Ruhe-HF, Oura: niedrigster Wert im Schlaf)
    'body_battery',       -- Body Battery, Tagesdurchschnitt (nur Garmin)
    'stress_level',       -- Stress 0..100, Tagesdurchschnitt (nur Garmin)
    'stress_minutes',     -- Minuten mit hohem Stress (nur Oura)
    'respiration'         -- Atemfrequenz, Atemzuege pro Minute
  );
$$;

-- ===================================================================
-- 2. Verbindungen (lesbar fuer die Person, ohne Schluessel)
-- ===================================================================
create table public.wearable_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        public.wearable_provider not null,
  connected_at    timestamptz not null default now(),
  last_synced_at  timestamptz,
  -- Kurzer Fehlercode fuer die Anzeige ("token_expired"), keine Details.
  last_error      text check (last_error is null or length(last_error) <= 80),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  client_id       uuid,
  unique (user_id, provider)
);

create trigger trg_wearable_connections_updated
  before update on public.wearable_connections
  for each row execute function public.set_updated_at();

alter table public.wearable_connections enable row level security;

create policy wearable_connections_select_own on public.wearable_connections
  for select using (user_id = auth.uid());

-- Kein Schreiben vom Client: Verbinden und Trennen gehen ueber die Edge
-- Function, weil dabei die Schluessel beim Anbieter widerrufen werden.
revoke all on public.wearable_connections from anon, authenticated;
grant select on public.wearable_connections to authenticated;
grant select, insert, update, delete on public.wearable_connections to service_role;

comment on table public.wearable_connections is
  'Verbundene Geraete (Oura, Garmin) einer Person (0053). Schreiben nur service_role.';

-- ===================================================================
-- 3. Schluessel der Anbieter (nur service_role)
-- ===================================================================
-- access_token und refresh_token liegen VERSCHLUESSELT hier (AES-GCM in der
-- Edge Function, Schluessel WEARABLE_TOKEN_KEY in den Function Secrets). Ein
-- Datenbank-Abzug allein gibt also keinen Zugriff auf die Geraetedaten.
-- RLS ohne Policy: weder anon noch authenticated sehen eine Zeile.
create table public.wearable_secrets (
  connection_id     uuid primary key references public.wearable_connections(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider          public.wearable_provider not null,
  -- Garmin schickt Benachrichtigungen mit seiner eigenen Nutzer-ID.
  provider_user_id  text check (provider_user_id is null or length(provider_user_id) <= 200),
  access_token      text not null,
  refresh_token     text,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  client_id         uuid
);

create unique index uq_wearable_secrets_provider_user
  on public.wearable_secrets (provider, provider_user_id)
  where provider_user_id is not null;

create trigger trg_wearable_secrets_updated
  before update on public.wearable_secrets
  for each row execute function public.set_updated_at();

alter table public.wearable_secrets enable row level security;

revoke all on public.wearable_secrets from anon, authenticated;
grant select, insert, update, delete on public.wearable_secrets to service_role;

comment on table public.wearable_secrets is
  'Verschluesselte OAuth-Schluessel je Verbindung (0053). Nur service_role, keine Policy.';

-- ===================================================================
-- 4. Tageswerte je Anbieter
-- ===================================================================
create table public.wearable_daily (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    public.wearable_provider not null,
  metric      text not null check (public.is_wearable_metric(metric)),
  day         date not null,
  value       numeric not null check (value >= 0 and value <= 1000000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  client_id   uuid,
  unique (user_id, provider, metric, day)
);

create index idx_wearable_daily_user_day on public.wearable_daily (user_id, day desc);

create trigger trg_wearable_daily_updated
  before update on public.wearable_daily
  for each row execute function public.set_updated_at();

alter table public.wearable_daily enable row level security;

-- Lesen: immer die eigenen Zeilen, wie habit_logs (SAD §3.10).
create policy wearable_daily_select_own on public.wearable_daily
  for select using (user_id = auth.uid());

revoke all on public.wearable_daily from anon, authenticated;
grant select on public.wearable_daily to authenticated;
grant select, insert, update, delete on public.wearable_daily to service_role;

comment on table public.wearable_daily is
  'Tageswerte der Geraete je Anbieter (0053), Gesundheitsdaten nach Art. 9. '
  'Schreiben nur ueber save_wearable_days().';

-- ===================================================================
-- 5. Welches Habit welchen Wert bekommt
-- ===================================================================
alter table public.habit_templates
  add column if not exists wearable_metric text
    check (wearable_metric is null or public.is_wearable_metric(wearable_metric));

comment on column public.habit_templates.wearable_metric is
  'Tageswert der Geraete, mit dem dieses Habit automatisch gefuellt wird (0053). NULL = von Hand.';

update public.habit_templates set wearable_metric = 'steps'
 where owner_id is null and slug = 'schritte' and wearable_metric is null;
update public.habit_templates set wearable_metric = 'sleep_hours'
 where owner_id is null and slug = 'schlafdauer' and wearable_metric is null;
update public.habit_templates set wearable_metric = 'sleep_score'
 where owner_id is null and slug = 'schlafqualitaet-wearable' and wearable_metric is null;
-- Etagen und Intensitaetsminuten kommen als Vorlagen ueber
-- docs/inhalte/wearables.sql - nur auf Staging, solange das Feature dort
-- erprobt wird.

-- ===================================================================
-- 6. Herkunft eines Eintrags
-- ===================================================================
-- 'wearable' = von der Geraete-Anbindung geschrieben. Nur solche Eintraege
-- ueberschreibt der naechste Abgleich; was die Person selbst eingetragen
-- oder korrigiert hat, bleibt stehen.
alter table public.habit_logs
  add column if not exists source text
    check (source is null or source = 'wearable');

comment on column public.habit_logs.source is
  'NULL = von der Person eingetragen, ''wearable'' = vom Geraete-Abgleich (0053).';

-- Den Wert setzt nie der Client: schreibt die Person selbst (auch eine
-- Korrektur eines Geraetewerts), ist der Eintrag ab dann ihrer.
create or replace function public.guard_habit_log_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.source := null;
  end if;
  return new;
end $$;

create trigger trg_habit_logs_source
  before insert or update on public.habit_logs
  for each row execute function public.guard_habit_log_source();

-- ===================================================================
-- 7. Habits aus den Tageswerten fuellen
-- ===================================================================
-- Fuer eine Person und einen Zeitraum: je gewaehltem Habit mit
-- wearable_metric und Tag der Durchschnitt ueber die Anbieter.
--
-- ALS WER LAEUFT DAS?
-- -------------------
-- Aufgerufen nur von save_wearable_days()/remove_wearable() und damit von
-- service_role. Damit fuer die Person dieselben Regeln gelten wie beim
-- Eintragen von Hand, setzt die Funktion fuer ihre Transaktion den Aufrufer
-- auf diese Person: has_consent(), can_use_habit_template() und
-- has_plus_access() lesen auth.uid(). So bleibt Plus allein in
-- has_plus_access() (CLAUDE.md §Zugriff). Fuer authenticated ist die
-- Funktion NICHT ausfuehrbar - sonst koennte jeder fremde Tagebuecher fuellen.
create or replace function public.apply_wearable_days(p_user_id uuid, p_from date, p_to date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  if p_user_id is null or p_from is null or p_to is null or p_to < p_from
     or p_to - p_from > 400 then
    raise exception 'Ungueltiger Zeitraum' using errcode = 'check_violation';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  if not public.has_consent('health_data') then
    return 0;
  end if;

  insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric, source)
  select uh.user_id, uh.id, d.day,
         -- Schlafdauer auf eine Stelle, alles andere ganzzahlig.
         round(avg(d.value), case when ht.wearable_metric = 'sleep_hours' then 1 else 0 end),
         'wearable'
    from public.user_habits uh
    join public.habit_templates ht on ht.id = uh.template_id
    join public.wearable_daily d
      on d.user_id = uh.user_id
     and d.metric = ht.wearable_metric
     and d.deleted_at is null
   where uh.user_id = p_user_id
     and uh.is_active
     and uh.deleted_at is null
     and ht.wearable_metric is not null
     and public.can_use_habit_template(ht.id)
     -- Ein Tag Vorlauf fuer Zeitzonen oestlich von UTC, wie der Trigger aus 0021.
     and d.day between greatest(p_from, uh.started_on) and least(p_to, current_date + 1)
   group by uh.user_id, uh.id, d.day, ht.wearable_metric, ht.min_value, ht.max_value
  -- Ausserhalb der Grenzen des Habits (etwa > 60.000 Schritte) wuerde der
  -- Trigger aus 0021 den ganzen Abgleich abbrechen: solche Tage entfallen.
  having (ht.min_value is null or round(avg(d.value), 1) >= ht.min_value)
     and (ht.max_value is null or round(avg(d.value), 1) <= ht.max_value)
  on conflict (user_habit_id, log_date) do update
     set value_numeric = excluded.value_numeric,
         source        = 'wearable',
         deleted_at    = null
   where public.habit_logs.source = 'wearable'
     and public.habit_logs.value_numeric is distinct from excluded.value_numeric;

  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

revoke execute on function public.apply_wearable_days(uuid, date, date) from public, anon, authenticated;
grant execute on function public.apply_wearable_days(uuid, date, date) to service_role;

comment on function public.apply_wearable_days(uuid, date, date) is
  'Fuellt die gewaehlten Habits einer Person aus wearable_daily (Durchschnitt der Anbieter). Nur service_role (0053).';

-- ===================================================================
-- 8. Tageswerte speichern
-- ===================================================================
-- p_values: [{"metric": "steps", "day": "2026-11-06", "value": 8123}, ...]
-- Nur mit Einwilligung health_data und bestehender Verbindung. Unbekannte
-- Werte oder Tage in der Zukunft werden uebergangen statt den ganzen Abgleich
-- abzubrechen - ein Anbieter, der morgen einen neuen Wert schickt, soll die
-- anderen nicht aufhalten.
create or replace function public.save_wearable_days(
  p_user_id  uuid,
  p_provider public.wearable_provider,
  p_values   jsonb
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date;
  v_to   date;
  v_rows int;
begin
  if p_user_id is null or p_provider is null or jsonb_typeof(p_values) is distinct from 'array' then
    raise exception 'Ungueltige Werte' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_values) > 5000 then
    raise exception 'Zu viele Werte' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.wearable_connections c
     where c.user_id = p_user_id and c.provider = p_provider and c.deleted_at is null
  ) then
    return 0;
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  if not public.has_consent('health_data') then
    return 0;
  end if;

  with incoming as (
    select v ->> 'metric' as metric,
           (v ->> 'day')::date as day,
           (v ->> 'value')::numeric as value
      from jsonb_array_elements(p_values) v
     where jsonb_typeof(v -> 'value') = 'number'
       and v ->> 'day' ~ '^\d{4}-\d{2}-\d{2}$'
  ), valid as (
    select distinct on (metric, day) metric, day, value
      from incoming
     where public.is_wearable_metric(metric)
       and day <= current_date + 1
       and day >= current_date - 400
       and value >= 0 and value <= 1000000
     order by metric, day
  )
  insert into public.wearable_daily (user_id, provider, metric, day, value)
  select p_user_id, p_provider, metric, day, value from valid
  on conflict (user_id, provider, metric, day) do update
     set value = excluded.value, deleted_at = null
   where public.wearable_daily.value is distinct from excluded.value
      or public.wearable_daily.deleted_at is not null;

  get diagnostics v_rows = row_count;

  select min((v ->> 'day')::date), max((v ->> 'day')::date)
    into v_from, v_to
    from jsonb_array_elements(p_values) v
   where v ->> 'day' ~ '^\d{4}-\d{2}-\d{2}$';

  update public.wearable_connections
     set last_synced_at = now(), last_error = null
   where user_id = p_user_id and provider = p_provider;

  if v_from is not null then
    perform public.apply_wearable_days(
      p_user_id, greatest(v_from, current_date - 400), least(v_to, current_date + 1));
  end if;

  return v_rows;
end $$;

revoke execute on function public.save_wearable_days(uuid, public.wearable_provider, jsonb) from public, anon, authenticated;
grant execute on function public.save_wearable_days(uuid, public.wearable_provider, jsonb) to service_role;

comment on function public.save_wearable_days(uuid, public.wearable_provider, jsonb) is
  'Speichert Tageswerte eines Anbieters und fuellt danach die Habits. Nur service_role (0053).';

-- ===================================================================
-- 9. Verbindung entfernen
-- ===================================================================
-- Loescht Verbindung, Schluessel (cascade) und die Tageswerte dieses
-- Anbieters. Die Tagebuch-Eintraege bleiben stehen - sie sind Eintraege der
-- Person; wo der andere Anbieter noch Werte hat, wird neu gemittelt.
create or replace function public.remove_wearable(p_user_id uuid, p_provider public.wearable_provider)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date;
  v_to   date;
begin
  if p_user_id is null or p_provider is null then
    raise exception 'Ungueltige Angaben' using errcode = 'check_violation';
  end if;

  select min(day), max(day) into v_from, v_to
    from public.wearable_daily
   where user_id = p_user_id and provider = p_provider;

  delete from public.wearable_daily
   where user_id = p_user_id and provider = p_provider;
  delete from public.wearable_connections
   where user_id = p_user_id and provider = p_provider;

  if v_from is not null then
    perform public.apply_wearable_days(p_user_id, v_from, least(v_to, current_date + 1));
  end if;
end $$;

revoke execute on function public.remove_wearable(uuid, public.wearable_provider) from public, anon, authenticated;
grant execute on function public.remove_wearable(uuid, public.wearable_provider) to service_role;

-- ===================================================================
-- 10. Widerruf heisst Loeschen (0040) - auch die Geraetedaten
-- ===================================================================
-- Wie 0036, dazu die Geraete. Die Schluessel beim Anbieter widerruft die App
-- vorher ueber die Edge Function (Trennen); fehlt das, sind sie hier mit der
-- Verbindung trotzdem weg und nicht mehr benutzbar.
create or replace function public.delete_my_diary_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  delete from public.challenges           where user_id  = v_uid;
  delete from public.habit_logs           where user_id  = v_uid;
  delete from public.user_habits          where user_id  = v_uid;
  delete from public.habit_favorites      where user_id  = v_uid;
  delete from public.habit_templates      where owner_id = v_uid;
  delete from public.wearable_daily       where user_id  = v_uid;
  delete from public.wearable_connections where user_id  = v_uid;
end $$;

comment on function public.delete_my_diary_data() is
  'Loescht alle Tagebuch-Daten der angemeldeten Person (Challenges, Eintraege, '
  'Auswahl, Habit-Favoriten, eigene Habits, Geraetedaten und -verbindungen). '
  'Angeboten beim Widerruf von health_data.';
