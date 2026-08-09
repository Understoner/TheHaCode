-- ---------- Extensions ----------
create extension if not exists "pgcrypto";       -- gen_random_uuid()

-- ---------- Enums ----------
create type visibility_level     as enum ('free', 'registered', 'plus');
create type exercise_type        as enum ('paced', 'general');   -- Typ A / Typ B
create type playback_mode        as enum ('timer', 'audio_guided', 'audio_only');
create type phase_kind           as enum ('inhale', 'hold_in', 'exhale', 'hold_out', 'free_breathing');
create type habit_tracking_type  as enum ('number', 'smiley_5', 'slider_100', 'text');
create type subscription_plan    as enum ('monthly', 'yearly');
create type subscription_status  as enum ('active','trialing','past_due','canceled','incomplete','expired');

-- ---------- Utility: updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Users / Profiles (SAD §3.3) ----------
-- auth.users gehoert Supabase. Alles Fachliche liegt in public.profiles (1:1, gleiche ID).
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  display_name            text,
  avatar_url              text,
  locale                  text        not null default 'de',
  timezone                text        not null default 'Europe/Vienna',

  -- Der EINZIGE Zugriffswert, ausschliesslich vom Stripe-Trigger gesetzt
  has_active_subscription boolean     not null default false,
  plus_until              timestamptz,

  -- Toene beim Phasenwechsel, geraeteuebergreifend gemerkt
  sound_enabled           boolean     not null default true,

  onboarding_completed_at timestamptz,
  registered_at           timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Ohne "auto_expose_new_tables" erteilt Supabase keine Grants mehr automatisch
-- (aktueller Cloud-Default, config.toml) — deshalb explizit statt pauschal.
-- anon bekommt bewusst nichts: Profile sind nur fuer angemeldete Nutzer.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Entitlement-Felder sind nie vom Client schreibbar, auch nicht auf die eigene
-- Zeile — has_active_subscription setzt ausschliesslich der Stripe-Trigger
-- (SAD §3.8). Als Trigger statt als Column-Revoke: Supabases lokale Umgebung
-- erteilt nach den Migrationen offenbar erneut Tabellen-Grants (per pgTAP
-- bestaetigt — has_column_privilege blieb trotz revoke true), ein Revoke
-- waere also nur Scheinsicherheit. Der Trigger prueft unabhaengig davon.
create or replace function public.protect_entitlement_columns()
returns trigger language plpgsql as $$
begin
  if (new.has_active_subscription is distinct from old.has_active_subscription
      or new.plus_until is distinct from old.plus_until)
     and current_user <> 'service_role' then
    raise exception 'has_active_subscription und plus_until sind nur per service_role aenderbar';
  end if;
  return new;
end $$;

create trigger trg_profiles_protect_entitlement
  before update on public.profiles
  for each row execute function public.protect_entitlement_columns();

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profil automatisch beim Signup anlegen (gilt fuer E-Mail, Google und Apple gleichermassen)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Die einzige Zugriffsentscheidung. RLS und App fragen ausschliesslich sie,
-- niemals die Spalte direkt. Kaeme spaeter eine Aktion, ein Gutschein oder doch
-- ein Testzeitraum dazu, aendert sich genau diese Funktion — und keine Policy.
create or replace function public.has_plus_access()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.has_active_subscription from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
