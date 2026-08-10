-- ---------- Admin-Erkennung (SAD §3.8) ----------
-- Die Rolle steht in app_metadata und ist damit vom Client NICHT manipulierbar.
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ---------- News auf der Startseite (SAD §3.12) ----------
create table public.news_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  excerpt          text,
  body_md          text not null,
  cover_image_path text,
  visibility       visibility_level not null default 'free',
  is_pinned        boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_news_published on public.news_posts (published_at desc)
  where published_at is not null;

create trigger trg_news_posts_updated
  before update on public.news_posts
  for each row execute function public.set_updated_at();

-- Bleibt in V1 leer (Sprache ist ausschliesslich de, CLAUDE.md) - Englisch ist
-- mittelfristig geplant, das Nachruesten der Tabelle kaeme sonst mit einem
-- Umbau jeder Content-Query (SAD §3.11).
create table public.news_translations (
  post_id  uuid not null references public.news_posts(id) on delete cascade,
  locale   text not null,
  title    text not null,
  excerpt  text,
  body_md  text not null,
  primary key (post_id, locale)
);

alter table public.news_posts        enable row level security;
alter table public.news_translations enable row level security;

-- Lesen: nur veroeffentlichte Beitraege, gestaffelt nach Sichtbarkeit
create policy news_read on public.news_posts
  for select using (
    published_at is not null and published_at <= now() and (
      visibility = 'free'
      or (visibility = 'registered' and auth.uid() is not null)
      or (visibility = 'plus'       and public.has_plus_access())
    )
  );

-- Uebersetzungen erben die Sichtbarkeit ihres Beitrags, wie phases_read
-- ueber exercise_steps -> exercises (SAD §3.8)
create policy news_translations_read on public.news_translations
  for select using (exists (
    select 1 from public.news_posts p where p.id = post_id
  ));

-- Redaktion: Admins duerfen Inhalte schreiben, auch ohne Admin-UI (SAD §3.8)
create policy news_admin_write on public.news_posts
  for all using (public.is_admin()) with check (public.is_admin());

create policy news_translations_admin_write on public.news_translations
  for all using (public.is_admin()) with check (public.is_admin());

-- Ohne "auto_expose_new_tables" erteilt Supabase keine Grants mehr automatisch
-- (aktueller Cloud-Default, config.toml) - deshalb explizit wie bei profiles.
-- authenticated braucht Schreibrechte auf Tabellenebene, damit ein am Client
-- angemeldeter Admin (app_metadata.role = 'admin') ueberhaupt schreiben kann -
-- die eigentliche Einschraenkung auf Admins leistet allein die RLS-Policy.
grant select                             on public.news_posts        to anon;
grant select                             on public.news_translations to anon;
grant select, insert, update, delete     on public.news_posts        to authenticated;
grant select, insert, update, delete     on public.news_translations to authenticated;
grant select, insert, update, delete     on public.news_posts        to service_role;
grant select, insert, update, delete     on public.news_translations to service_role;
