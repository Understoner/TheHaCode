-- 0056: Laengerer Pruefcode fuer Zertifikate (Review 11.11.2026, Befund S6).
--
-- WORUM ES GEHT
-- -------------
-- Der Pruefcode hatte die Form AC-XXXX-XXXX: acht Hexadezimalstellen, 32 Bit.
-- verify_certificate() ist ohne Anmeldung aufrufbar - das soll so sein, der
-- Code ist der Schluessel - und liefert zu einem Treffer Name, Kurs und Datum.
-- Bei 1.000 ausgestellten Zertifikaten trifft im Mittel jeder
-- 4,3-millionste Versuch; mit 100 Anfragen pro Sekunde ist das ein Klarname
-- alle zwoelf Stunden. Ein geduldiges Skript haette sich so eine
-- Teilnehmerliste zusammengeraten.
--
-- WAS SICH AENDERT
-- ----------------
--   * Neue Codes haben vier Gruppen: AC-XXXX-XXXX-XXXX-XXXX, 64 Bit. Raten
--     ist damit aussichtslos.
--   * Alte Codes bleiben gueltig und unveraendert - sie stehen auf bereits
--     ausgegebenen PDFs. Wer ein altes Zertifikat hat, behaelt den kurzen Code.
--     (Ob die wenigen alten Zertifikate einen neuen Code bekommen sollen, ist
--     eine Entscheidung des Teams: die alten PDFs zeigten dann ins Leere.)
--   * Die Pruefbedingung der Spalte laesst beide Formen zu.
--
-- ADDITIV? Die Bedingung wird durch eine WEITERE ersetzt: alles, was vorher
-- gueltig war, ist es noch. Die App vom 07.11.2026 liest den Code nur und
-- zeigt ihn an; sie kommt mit beiden Laengen zurecht (SAD §2.6).
--
-- NICHT in dieser Migration: der Zeichensatz der PDF (Befund S5). Der ist in
-- der Edge Function geloest (supabase/functions/_shared/pdf-text.ts), ohne
-- die Eingabe des Namens einzuschraenken.

-- Ein Befehl, damit die Spalte zu keinem Zeitpunkt ohne Bedingung dasteht.
alter table public.certificates
  drop constraint certificates_code_check,
  add constraint certificates_code_check
    check (code ~ '^AC-[0-9A-F]{4}(-[0-9A-F]{4}){1,3}$');

-- issue_certificate() wie in 0046, geaendert ist allein die Erzeugung des
-- Codes am Ende. Wer hier etwas aendert: das ist die geltende Fassung.
create or replace function public.issue_certificate(p_course_id uuid, p_full_name text)
returns public.certificates language plpgsql security definer set search_path = '' as $$
declare
  v_user    uuid := auth.uid();
  v_name    text := btrim(coalesce(p_full_name, ''));
  v_cert    public.certificates;
  v_quiz    uuid;
  v_attempt public.quiz_attempts;
  v_code    text;
  v_hex     text;
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

  -- 64 Bit Zufall in vier Gruppen (0056). Die Schleife bleibt als Guertel zum
  -- Hosentraeger: ein Zusammenstoss ist praktisch ausgeschlossen, die
  -- unique-Bedingung der Spalte finge ihn ohnehin.
  loop
    v_hex := upper(encode(extensions.gen_random_bytes(8), 'hex'));
    v_code := 'AC-' || substr(v_hex, 1, 4) || '-' || substr(v_hex, 5, 4) || '-'
                    || substr(v_hex, 9, 4) || '-' || substr(v_hex, 13, 4);
    exit when not exists (select 1 from public.certificates where code = v_code);
  end loop;

  insert into public.certificates (user_id, course_id, code, full_name, score, total)
  values (v_user, p_course_id, v_code, v_name, v_attempt.score, v_attempt.total)
  returning * into v_cert;
  return v_cert;
end;
$$;

-- "create or replace" behaelt die Rechte. Trotzdem ausdruecklich, wie 0055 es
-- fuer jede Funktion verlangt.
revoke execute on function public.issue_certificate(uuid, text) from public, anon;
grant execute on function public.issue_certificate(uuid, text) to authenticated, service_role;
