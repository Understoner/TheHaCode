-- ---------- Kurse und Team — Homepage-Ablösung (SAD §3.13) ----------
-- Reine oeffentliche Marketinginhalte, bewusst ohne visibility_level:
-- anders als News gibt es hier keine Bezahlstufen.

create table public.courses (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  description       text not null,
  location          text,
  price_info        text,
  signup_url        text,
  cover_image_path  text,
  sort_order        int not null default 0,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_courses_sort on public.courses (sort_order)
  where published_at is not null;

create trigger trg_courses_updated
  before update on public.courses
  for each row execute function public.set_updated_at();

create table public.team_members (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  full_name     text not null,
  role_title    text,
  bio           text,
  photo_path    text,
  sort_order    int not null default 0,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_team_members_sort on public.team_members (sort_order)
  where published_at is not null;

create trigger trg_team_members_updated
  before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.courses      enable row level security;
alter table public.team_members enable row level security;

-- Lesen: nur veroeffentlichte Zeilen
create policy courses_read on public.courses
  for select using (published_at is not null and published_at <= now());

create policy team_members_read on public.team_members
  for select using (published_at is not null and published_at <= now());

-- Redaktion: Admins duerfen schreiben, auch ohne Admin-UI (SAD §3.8) -
-- Redaktion laeuft vorerst ueber Supabase Studio (SAD §2.4)
create policy courses_admin_write on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

create policy team_members_admin_write on public.team_members
  for all using (public.is_admin()) with check (public.is_admin());

-- Ohne "auto_expose_new_tables" erteilt Supabase keine Grants mehr automatisch
-- (config.toml) - deshalb explizit wie bei news_posts.
grant select                         on public.courses      to anon;
grant select                         on public.team_members to anon;
grant select, insert, update, delete on public.courses      to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.courses      to service_role;
grant select, insert, update, delete on public.team_members to service_role;
