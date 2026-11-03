-- 0046: Onlinekurse, Schritt 8 - Zertifikat (V1.2, SAD §11.2).
--
-- Entscheidung des Teams (03.11.2026): Ein Zertifikat gibt es, wenn ALLE
-- Inhalte eines Kurses erledigt sind UND das Quiz mit mindestens
-- pass_percent bestanden ist. Geprueft wird hier in der Datenbank, nicht im
-- Browser: das bestandene Quiz steht nur in course_progress, wenn
-- submit_quiz() es eingetragen hat (0043/0045).
--
--   * Ein Zertifikat je Konto und Kurs. Den Namen waehlt die Person bei der
--     Ausstellung; danach ist er fest - das Zertifikat ist ein Nachweis.
--   * Es bleibt abrufbar, solange das Konto besteht, auch nach Ablauf des
--     Kurszugangs. Mit dem Konto verschwindet es (Kaskade).
--   * Pruefcode: verify_certificate() zeigt jedem, der den Code kennt, nur
--     Name, Kurs und Datum. Den Code gibt nur die Person selbst weiter.
--   * Die PDF erzeugt die Edge Function certificate-pdf (pdf-lib) aus genau
--     dieser Zeile.
--
-- Keine Gesundheitsdaten (Verzeichnis V13). Additiv (SAD §2.6).

create table public.certificates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- restrict: ein Kurs mit ausgestellten Zertifikaten wird unveroeffentlicht,
  -- nicht geloescht - sonst liefe der Pruefcode ins Leere.
  course_id  uuid not null references public.online_courses(id) on delete restrict,
  code       text not null unique check (code ~ '^AC-[0-9A-F]{4}-[0-9A-F]{4}$'),
  full_name  text not null check (length(btrim(full_name)) between 2 and 80),
  score      int not null check (score >= 0),
  total      int not null check (total > 0 and score <= total),
  issued_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id  uuid,
  unique (user_id, course_id)
);

create index idx_certificates_course on public.certificates (course_id);
create unique index uq_certificates_client on public.certificates (user_id, client_id) where client_id is not null;

create trigger trg_certificates_updated
  before update on public.certificates
  for each row execute function public.set_updated_at();

alter table public.certificates enable row level security;

-- Nur lesen, nur die eigenen. Ausgestellt wird nur ueber issue_certificate(),
-- geaendert oder geloescht gar nicht (der Nachweis bliebe sonst nicht, was
-- er war).
create policy certificates_read_own on public.certificates
  for select to authenticated using (user_id = auth.uid());

grant select on public.certificates to authenticated;
grant select, insert, update, delete on public.certificates to service_role;

comment on table public.certificates is
  'Zertifikate der Onlinekurse (0046). Ausstellen nur ueber issue_certificate(), unveraenderlich.';

-- ===================================================================
-- Ausstellen
-- ===================================================================
create or replace function public.issue_certificate(p_course_id uuid, p_full_name text)
returns public.certificates language plpgsql security definer set search_path = '' as $$
declare
  v_user    uuid := auth.uid();
  v_name    text := btrim(coalesce(p_full_name, ''));
  v_cert    public.certificates;
  v_quiz    uuid;
  v_attempt public.quiz_attempts;
  v_code    text;
begin
  if v_user is null then
    raise exception 'Anmeldung erforderlich' using errcode = '42501';
  end if;

  -- Schon ausgestellt: dasselbe Zertifikat zurueck, der Name bleibt der alte.
  select * into v_cert from public.certificates
   where user_id = v_user and course_id = p_course_id and deleted_at is null;
  if v_cert.id is not null then
    return v_cert;
  end if;

  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Bitte einen Namen mit 2 bis 80 Zeichen angeben' using errcode = '22023';
  end if;

  select b.id into v_quiz from public.online_course_blocks b
   where b.course_id = p_course_id and b.kind = 'quiz';
  if v_quiz is null then
    raise exception 'Dieser Kurs hat kein Quiz' using errcode = 'P0002';
  end if;

  -- Alle Bloecke erledigt, das Quiz eingeschlossen (das traegt nur
  -- submit_quiz() bei Bestehen ein).
  if exists (
    select 1 from public.online_course_blocks b
     where b.course_id = p_course_id
       and not exists (select 1 from public.course_progress p
                        where p.user_id = v_user and p.block_id = b.id and p.deleted_at is null)
  ) then
    raise exception 'Noch nicht alle Inhalte erledigt oder das Quiz nicht bestanden' using errcode = '42501';
  end if;

  -- Das beste bestandene Ergebnis steht auf dem Zertifikat.
  select * into v_attempt from public.quiz_attempts
   where user_id = v_user and block_id = v_quiz and passed and deleted_at is null
   order by score desc, created_at asc limit 1;
  if v_attempt.id is null then
    raise exception 'Das Quiz ist nicht bestanden' using errcode = '42501';
  end if;

  loop
    v_code := 'AC-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4)) || '-'
                    || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4));
    exit when not exists (select 1 from public.certificates where code = v_code);
  end loop;

  insert into public.certificates (user_id, course_id, code, full_name, score, total)
  values (v_user, p_course_id, v_code, v_name, v_attempt.score, v_attempt.total)
  returning * into v_cert;
  return v_cert;
end;
$$;

revoke execute on function public.issue_certificate(uuid, text) from public, anon;
grant execute on function public.issue_certificate(uuid, text) to authenticated, service_role;

-- ===================================================================
-- Pruefen (oeffentlich, nur mit Code)
-- ===================================================================
create or replace function public.verify_certificate(p_code text)
returns table (full_name text, course_title text, issued_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.full_name, o.title, c.issued_at
    from public.certificates c
    join public.online_courses o on o.id = c.course_id
   where c.code = upper(btrim(p_code)) and c.deleted_at is null;
$$;

revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated, service_role;

comment on function public.verify_certificate(text) is
  'Oeffentliche Pruefung eines Zertifikats (0046): nur Name, Kurs und Datum.';
