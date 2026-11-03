-- 0042: Onlinekurse, Schritt 1 - Inhalte und Zugang (V1.2, SAD §11.2).
--
-- Entscheidungen des Teams (03.11.2026):
--   * Onlinekurse sind on demand, kein Live-Unterricht. Sie bestehen aus
--     Bloecken (Erklaervideo, gesprochene Aufnahme, Text mit Bild, PDF, genau
--     ein Quiz am Ende) mit einem Vorschlagstag. Alle Bloecke sind sofort
--     offen, die Reihenfolge ist nur ein Vorschlag.
--   * Zugang je Kurs:
--       public   Inhalte fuer alle, auch ohne Konto (Speichern nur mit Konto)
--       account  mit kostenlosem Konto
--       plus     in Plus enthalten; endet Plus, sind die Inhalte gesperrt,
--                Erreichtes (Fortschritt, Zertifikat) bleibt
--       paid     Einzelkauf, 1 Jahr ab Kauf, keine automatische Verlaengerung;
--                erneuter Kauf nach Ablauf erlaubt (neue Zeile)
--   * Plus-Kunden bekommen auf paid 15 % Rabatt - das rechnet der Checkout
--     (Schritt 3), nicht die Datenbank.
--
-- DATENMODELL
-- -----------
--   online_courses                 Kurse der Redaktion (Studio)
--   online_course_blocks           Gliederung: Art, Titel, Vorschlagstag, Dauer.
--                                  Fuer alle lesbar, damit Kursseite und
--                                  Zeitverlauf vor dem Kauf sichtbar sind.
--   online_course_block_contents   der eigentliche Inhalt eines Blocks (Text,
--                                  Medienpfade, Video-ID). Eigene Tabelle,
--                                  weil RLS zeilenweise wirkt: Gliederung
--                                  offen, Inhalt nur mit Zugang.
--   course_access                  Kaeufe (und manuelle Freischaltungen).
--                                  Schreibt NUR der Stripe-Webhook bzw.
--                                  service_role (CLAUDE.md, V1.2).
--   Bucket course-media            privat; Ordner = Kurs-ID. Lesen (und damit
--                                  signierte URLs) nur mit Zugang.
--
-- Zugriff steht in GENAU einer Funktion: can_open_course(). Plus fragt sie
-- nur ueber has_plus_access(), Kaeufe nur ueber course_access. Keine Policy
-- fragt access, profiles oder course_access direkt - aendert sich die Regel,
-- aendert sich nur diese Funktion (dasselbe Prinzip wie SAD §4.6).
--
-- Keine Gesundheitsdaten: Kurse und Kaeufe sind Vertragsdaten (Art. 6 Abs. 1
-- lit. b, Verzeichnis V13). Fortschritt, Planung, Quiz und Zertifikat folgen
-- in eigenen Migrationen (Schritte 2, 6, 7, 8).
--
-- Additiv (SAD §2.6): nur neue Typen, Tabellen, Funktionen, ein Bucket.

-- ===================================================================
-- 1. Typen
-- ===================================================================
create type public.online_course_access as enum ('public', 'account', 'plus', 'paid');
create type public.online_block_kind as enum ('video', 'audio', 'text', 'pdf', 'quiz');

-- ===================================================================
-- 2. Kurse
-- ===================================================================
create table public.online_courses (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title          text not null check (length(btrim(title)) between 1 and 80),
  subtitle       text check (subtitle is null or length(subtitle) <= 120),
  summary_md     text check (summary_md is null or length(summary_md) <= 600),
  description_md text check (description_md is null or length(description_md) <= 8000),
  -- Titelbild im oeffentlichen Bucket public-assets, Ordner courses/ (0004).
  cover_path     text,
  access         public.online_course_access not null default 'account',
  price_cents    int check (price_cents is null or price_cents > 0),
  access_days    int not null default 365 check (access_days between 1 and 3650),
  pass_percent   int not null default 80 check (pass_percent between 50 and 100),
  suggested_days int check (suggested_days is null or suggested_days between 1 and 365),
  is_published   boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Genau die Einzelkauf-Kurse haben einen Preis. Ein paid-Kurs ohne Preis
  -- waere unkaeuflich, ein Preis an einem freien Kurs ein Widerspruch.
  constraint chk_online_course_price
    check ((access = 'paid') = (price_cents is not null))
);

create trigger trg_online_courses_updated
  before update on public.online_courses
  for each row execute function public.set_updated_at();

comment on table public.online_courses is
  'Onlinekurse (on demand) der Redaktion, V1.2 (0042). Zugang nur ueber can_open_course().';

-- ===================================================================
-- 3. Bloecke: Gliederung (offen) und Inhalt (geschuetzt)
-- ===================================================================
create table public.online_course_blocks (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.online_courses(id) on delete cascade,
  sort_order   int not null default 0,
  -- Vorschlagstag relativ zum Start, 0 = Tag 1 im Zeitverlauf.
  day_offset   int not null default 0 check (day_offset between 0 and 364),
  kind         public.online_block_kind not null,
  title        text not null check (length(btrim(title)) between 1 and 100),
  summary      text check (summary is null or length(summary) <= 300),
  duration_sec int check (duration_sec is null or duration_sec between 1 and 14400),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_online_course_blocks_course on public.online_course_blocks (course_id, sort_order);
-- Genau ein Quiz je Kurs (Entscheidung 03.11.2026). Dass es am Ende steht,
-- ist Sache der Redaktion (sort_order).
create unique index uq_online_course_blocks_one_quiz
  on public.online_course_blocks (course_id) where kind = 'quiz';

create trigger trg_online_course_blocks_updated
  before update on public.online_course_blocks
  for each row execute function public.set_updated_at();

create table public.online_course_block_contents (
  block_id          uuid primary key references public.online_course_blocks(id) on delete cascade,
  -- denormalisiert, damit die Policy ohne Join auf den Kurs pruefen kann;
  -- ein Trigger haelt sie gleich zur Gliederung.
  course_id         uuid not null references public.online_courses(id) on delete cascade,
  body_md           text check (body_md is null or length(body_md) <= 20000),
  -- Pfade im privaten Bucket course-media, erster Ordner = course_id.
  image_path        text,
  audio_path        text,
  pdf_path          text,
  video_provider    text check (video_provider is null or video_provider in ('vimeo', 'youtube')),
  video_external_id text,
  video_hash        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_online_block_video
    check ((video_provider is null) = (video_external_id is null))
);

create index idx_online_course_block_contents_course on public.online_course_block_contents (course_id);

create trigger trg_online_course_block_contents_updated
  before update on public.online_course_block_contents
  for each row execute function public.set_updated_at();

-- Der Inhalt gehoert zum Kurs seines Blocks - sonst koennte ein Inhalt mit
-- der course_id eines freien Kurses an einem Block eines Bezahlkurses haengen
-- und die Policy unten wuerde ihn freigeben.
create or replace function public.online_block_content_course()
returns trigger language plpgsql set search_path = '' as $$
begin
  select b.course_id into new.course_id
    from public.online_course_blocks b where b.id = new.block_id;
  return new;
end;
$$;

create trigger trg_online_block_content_course
  before insert or update on public.online_course_block_contents
  for each row execute function public.online_block_content_course();

comment on table public.online_course_blocks is
  'Gliederung der Onlinekurse (0042): fuer alle lesbar, Inhalt in online_course_block_contents.';
comment on table public.online_course_block_contents is
  'Inhalt eines Blocks (0042): lesbar nur mit can_open_course(course_id).';

-- ===================================================================
-- 4. Kaeufe
-- ===================================================================
create table public.course_access (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  -- restrict: ein Kurs mit Kaeufen wird nicht geloescht, sondern
  -- unveroeffentlicht - sonst verschwaende der Kaufnachweis.
  course_id                  uuid not null references public.online_courses(id) on delete restrict,
  source                     text not null default 'stripe' check (source in ('stripe', 'manual')),
  purchased_at               timestamptz not null default now(),
  expires_at                 timestamptz not null,
  amount_paid_cents          int check (amount_paid_cents is null or amount_paid_cents >= 0),
  stripe_checkout_session_id text unique,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  deleted_at                 timestamptz,
  client_id                  uuid,
  constraint chk_course_access_range check (expires_at > purchased_at)
);

create index idx_course_access_user on public.course_access (user_id, course_id, expires_at desc);
create index idx_course_access_course on public.course_access (course_id);
create unique index uq_course_access_client on public.course_access (user_id, client_id) where client_id is not null;

create trigger trg_course_access_updated
  before update on public.course_access
  for each row execute function public.set_updated_at();

comment on table public.course_access is
  'Kaeufe von Onlinekursen (0042). Schreibt nur service_role (Stripe-Webhook, manuelle Freischaltung).';

-- ===================================================================
-- 5. Die eine Zugriffsfunktion
-- ===================================================================
-- security definer, damit sie course_access und unveroeffentlichte Kurse
-- (fuer Admins) sehen darf, ohne dass die Aufrufenden es duerfen.
create or replace function public.can_open_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.is_admin()
        or (c.is_published and case c.access
              when 'public'  then true
              when 'account' then auth.uid() is not null
              when 'plus'    then public.has_plus_access()
              when 'paid'    then exists (
                select 1 from public.course_access a
                 where a.user_id = auth.uid()
                   and a.course_id = c.id
                   and a.deleted_at is null
                   and a.expires_at > now())
            end)
      from public.online_courses c
     where c.id = p_course_id
  ), false);
$$;

revoke execute on function public.can_open_course(uuid) from public;
grant execute on function public.can_open_course(uuid) to anon, authenticated, service_role;

comment on function public.can_open_course(uuid) is
  'Einzige Zugriffsregel fuer Onlinekurse (0042, SAD §11.2). Plus nur ueber has_plus_access().';

-- Fuer Storage: der erste Ordner eines Objektnamens ist die Kurs-ID. Ein
-- Name ohne gueltige UUID vorne ist nie lesbar (statt eines Cast-Fehlers).
create or replace function public.can_open_course_media(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_open_course(v_folder::uuid);
end;
$$;

revoke execute on function public.can_open_course_media(text) from public;
grant execute on function public.can_open_course_media(text) to anon, authenticated, service_role;

-- ===================================================================
-- 6. RLS
-- ===================================================================
alter table public.online_courses enable row level security;
alter table public.online_course_blocks enable row level security;
alter table public.online_course_block_contents enable row level security;
alter table public.course_access enable row level security;

create policy online_courses_read on public.online_courses
  for select using (is_published);
create policy online_courses_admin_write on public.online_courses
  for all using (public.is_admin()) with check (public.is_admin());

create policy online_course_blocks_read on public.online_course_blocks
  for select using (
    exists (select 1 from public.online_courses c
             where c.id = course_id and c.is_published)
  );
create policy online_course_blocks_admin_write on public.online_course_blocks
  for all using (public.is_admin()) with check (public.is_admin());

create policy online_course_block_contents_read on public.online_course_block_contents
  for select using (public.can_open_course(course_id));
create policy online_course_block_contents_admin_write on public.online_course_block_contents
  for all using (public.is_admin()) with check (public.is_admin());

-- Kaeufe: nur die eigenen sehen, nichts schreiben. Insert/Update/Delete
-- haben fuer authenticated weder Grant noch Policy.
create policy course_access_read_own on public.course_access
  for select to authenticated using (user_id = auth.uid());

grant select on public.online_courses, public.online_course_blocks,
                public.online_course_block_contents to anon, authenticated;
grant select, insert, update, delete on public.online_courses, public.online_course_blocks,
                public.online_course_block_contents to service_role;
grant select on public.course_access to authenticated;
grant select, insert, update, delete on public.course_access to service_role;

-- ===================================================================
-- 7. Privater Bucket fuer Aufnahmen, Bilder und PDFs
-- ===================================================================
-- 50 MB: die Obergrenze des Supabase-Free-Tarifs je Datei. Eine gesprochene
-- Aufnahme von 30 Minuten liegt als MP3 (128 kbit/s) bei rund 29 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-media', 'course-media', false, 52428800,
        array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a',
              'image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Lesen (und damit signierte URLs) nur mit Zugang zum Kurs des Ordners.
create policy course_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'course-media' and public.can_open_course_media(name));

create policy course_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-media' and public.is_admin());
create policy course_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'course-media' and public.is_admin())
  with check (bucket_id = 'course-media' and public.is_admin());
create policy course_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-media' and public.is_admin());
