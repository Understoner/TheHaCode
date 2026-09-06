-- ---------- Kurse als Gast buchen (06.09.2026) ----------
-- Bisher brauchte jede Kursbuchung ein Konto. Fuer einen Online-Kurs, der
-- einmal stattfindet und ueber Stripe bezahlt wird, ist das eine Huerde ohne
-- Gegenwert: die App bietet dem Teilnehmer danach nichts, wofuer er sich
-- anmelden muesste. Die Buchung ist ein Kaufvorgang, kein Zugang.
--
-- ADDITIV, MIT EINER AUSNAHME, DIE KEINE IST (CLAUDE.md §Migrationen)
-- -------------------------------------------------------------------
-- Zwei neue Spalten, zwei neue Funktionen, ein neuer Index - und
-- course_bookings.user_id verliert sein not null. Das ist die einzige Stelle,
-- die keine reine Ergaenzung ist, und sie ist in beide Richtungen vertraeglich:
--   * Die alte App-Version schreibt nie in diese Tabelle; sie liest nur die
--     eigenen Buchungen ueber user_id = auth.uid(). Eine Gastzeile hat dort
--     null stehen, der Vergleich ergibt null, die Zeile bleibt unsichtbar.
--     Keine alte Abfrage aendert ihr Ergebnis.
--   * Die neue Version laeuft am alten Schema ebenfalls: solange niemand eine
--     Gastbuchung anlegt, bleibt alles wie es war.
-- Eine Spalte zu lockern kann kein bestehendes Insert brechen - nur eines, das
-- vorher scheiterte, laesst sie jetzt durch.
--
-- WER EINE BUCHUNG BEZAHLT HAT, STEHT WEITERHIN AN GENAU EINER STELLE
-- -------------------------------------------------------------------
-- Entweder user_id oder guest_email, nie beides und nie keines. Das haelt
-- chk_course_bookings_wer fest. Ohne diese Pruefung gaebe es Zeilen, bei denen
-- unklar waere, wem der Platz gehoert - und der Webhook entscheidet genau
-- daran, ob er eine Zahlung verbuchen darf.
--
-- WAS EIN GAST NICHT BEKOMMT
-- --------------------------
-- Keine Sicht auf seine Buchung in der App - er hat kein Konto, an dem eine
-- Policy haengen koennte. Seine Bestaetigung ist der Zahlungsbeleg von Stripe
-- (§ 11 AGB, siehe _HINWEIS.md). Eine Buchung nachtraeglich einem Konto
-- zuzuschlagen ist bewusst NICHT eingebaut: das waere eine Zuordnung ueber die
-- E-Mail-Adresse, und genau die ist laut SAD §4.3 Punkt 5 kein Schluessel.
--
-- MISSBRAUCH, OFFEN BENANNT
-- -------------------------
-- Ohne Konto kostet ein Reservierungsversuch nichts als eine Adresse. Wer will,
-- haelt mit erfundenen Adressen Plaetze besetzt. Dagegen steht dreierlei:
-- die Haltezeit von 40 Minuten, nach der ein unbezahlter Platz von selbst
-- zurueckfaellt; ein Index, der je Adresse und Kurs nur eine offene Buchung
-- zulaesst; und dass reserve_course_seat_for_guest ausschliesslich unter
-- service_role laeuft, also nur aus der Edge Function heraus. Ein entschlossener
-- Stoerer kaeme trotzdem durch - bei Kursgroessen im zweistelligen Bereich ist
-- das ein Fall fuer den Blick in die Buchungsliste, nicht fuer eine
-- Betrugserkennung im Code.

-- ---------- 1. Die zwei Spalten ----------
alter table public.course_bookings
  add column if not exists guest_email text,
  add column if not exists guest_name  text;

comment on column public.course_bookings.guest_email is
  'Adresse des Gasts, klein und ohne Leerzeichen gespeichert. Nur gesetzt, '
  'wenn user_id null ist. Zahlungsbeleg und Rueckfragen gehen dorthin.';
comment on column public.course_bookings.guest_name is
  'Name des Gasts fuer die Teilnehmerliste. Freiwillig.';

-- ---------- 2. Konto ODER Gast ----------
alter table public.course_bookings
  alter column user_id drop not null;

alter table public.course_bookings
  add constraint chk_course_bookings_wer
    check (
      (user_id is not null and guest_email is null)
      or (user_id is null and guest_email is not null)
    ),
  -- Kein vollstaendiger Adresspruefer, nur die Schranke gegen offensichtlichen
  -- Unfug aus einer fehlerhaften Aufrufstelle. Ob die Adresse erreichbar ist,
  -- zeigt sich am Zahlungsbeleg, nicht hier.
  add constraint chk_course_bookings_guest_email
    check (
      guest_email is null
      or (guest_email = lower(btrim(guest_email)) and guest_email like '_%@_%.__%')
    );

-- Dieselbe Zusicherung wie uq_course_bookings_one_open_per_user, nur fuer
-- Gaeste: eine offene Buchung je Adresse und Kurs. Ohne sie koennte dieselbe
-- Adresse beliebig viele Plaetze halten.
create unique index uq_course_bookings_one_open_per_guest
  on public.course_bookings (course_id, guest_email)
  where deleted_at is null
    and guest_email is not null
    and status in ('reserved', 'confirmed');

-- ---------- 3. Die Reservierung, jetzt fuer beide ----------
-- Der gesamte bisherige Ablauf aus Migration 0011 - Sperre auf der Kurszeile,
-- Aufraeumen verfallener Reservierungen, Zaehlen, Anzahlungsregel - zieht hier
-- ein und bekommt einen zweiten Buchenden. Nichts daran ist neu ausser der
-- Frage, WER bucht; die Kommentare zum Wettlauf stehen unveraendert in 0011.
--
-- Diese Funktion ist NIEMANDEM freigegeben, auch service_role nicht. Sie wird
-- ausschliesslich von den beiden Funktionen darunter aufgerufen, die als
-- security definer unter dem Eigentuemer laufen. Damit gibt es genau zwei
-- Tueren, und beide fragen nach den AGB.
--
-- Fehlercodes wie in 0011, plus:
--   PT005  weder Konto noch Adresse - oder beides
create or replace function public.reserve_course_seat_any(
  p_course_id      uuid,
  p_user_id        uuid,
  p_guest_email    text,
  p_guest_name     text,
  p_agb_accepted   boolean,
  p_hold_minutes   integer,
  p_client_id      uuid
)
returns public.course_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course   public.courses;
  v_booking  public.course_bookings;
  v_taken    integer;
  v_deposit  integer;
  v_balance  timestamptz;
  v_email    text := lower(btrim(coalesce(p_guest_email, '')));
  v_name     text := nullif(btrim(coalesce(p_guest_name, '')), '');
begin
  if v_email = '' then v_email := null; end if;

  -- Genau einer von beiden. Die Datenbank prueft es noch einmal ueber
  -- chk_course_bookings_wer - hier steht es, damit der Aufrufer einen Code
  -- bekommt statt einer Constraint-Verletzung.
  if (p_user_id is null) = (v_email is null) then
    raise exception 'Eine Buchung gehoert entweder zu einem Konto oder zu einer Adresse'
      using errcode = 'PT005';
  end if;

  -- Ohne AGB keine Buchung. Die Pruefung steht hier und nicht nur in der Edge
  -- Function, damit es keinen zweiten Weg an ihr vorbei gibt.
  if not coalesce(p_agb_accepted, false) then
    raise exception 'Ohne Zustimmung zu den AGB keine Buchung'
      using errcode = 'PT004';
  end if;

  -- Die Sperre. Alles Weitere geschieht exklusiv fuer diesen Kurs.
  select * into v_course
    from public.courses
   where id = p_course_id
   for update;

  if not found
     or not v_course.booking_enabled
     or v_course.published_at is null
     or v_course.published_at > now()
     or v_course.price_cents is null
     or v_course.starts_at is null then
    raise exception 'Kurs % ist nicht buchbar', p_course_id using errcode = 'PT001';
  end if;

  if v_course.starts_at <= now() then
    raise exception 'Kurs % hat bereits begonnen', p_course_id using errcode = 'PT001';
  end if;

  -- Verfallene Reservierungen dieses Kurses freigeben, bevor gezaehlt wird.
  update public.course_bookings
     set status = 'expired'
   where course_id = p_course_id
     and status = 'reserved'
     and reserved_until is not null
     and reserved_until <= now();

  -- Hat dieser Bucher den Kurs schon? Eine bestaetigte Buchung ist ein Nein;
  -- eine noch laufende Reservierung wird wiederverwendet, damit ein Klick auf
  -- "zurueck" im Browser keinen zweiten Platz belegt.
  select * into v_booking
    from public.course_bookings
   where course_id = p_course_id
     and deleted_at is null
     and status in ('reserved', 'confirmed')
     and (
       (p_user_id is not null and user_id = p_user_id)
       or (v_email is not null and guest_email = v_email)
     )
   limit 1;

  if found then
    if v_booking.status = 'confirmed' then
      raise exception 'Kurs % ist bereits gebucht', p_course_id
        using errcode = 'PT003';
    end if;

    update public.course_bookings
       set reserved_until   = now() + make_interval(mins => p_hold_minutes),
           agb_accepted_at  = now(),
           guest_name       = coalesce(v_name, guest_name)
     where id = v_booking.id
    returning * into v_booking;

    return v_booking;
  end if;

  if v_course.capacity is not null then
    select count(*) into v_taken
      from public.course_bookings
     where course_id = p_course_id
       and deleted_at is null
       and (
         status = 'confirmed'
         or (status = 'reserved' and reserved_until > now())
       );

    if v_taken >= v_course.capacity then
      raise exception 'Kurs % ist ausgebucht', p_course_id using errcode = 'PT002';
    end if;
  end if;

  -- Anzahlung nur, solange der Restbetrag noch nicht faellig waere (§ 11 AGB:
  -- spaetestens vier Wochen vor Beginn). Wer spaeter bucht, zahlt voll.
  v_deposit := null;
  v_balance := null;

  if v_course.deposit_cents is not null
     and v_course.starts_at - interval '28 days' > now() then
    v_deposit := v_course.deposit_cents;
    v_balance := v_course.starts_at - interval '28 days';
  end if;

  insert into public.course_bookings (
    user_id, guest_email, guest_name, course_id, status,
    amount_total_cents, deposit_cents, balance_due_at,
    reserved_until, agb_accepted_at, client_id
  ) values (
    p_user_id, v_email, v_name, p_course_id, 'reserved',
    v_course.price_cents, v_deposit, v_balance,
    now() + make_interval(mins => p_hold_minutes), now(), p_client_id
  )
  returning * into v_booking;

  return v_booking;
end $$;

revoke execute on function
  public.reserve_course_seat_any(uuid, uuid, text, text, boolean, integer, uuid) from public;

comment on function
  public.reserve_course_seat_any(uuid, uuid, text, text, boolean, integer, uuid) is
  'Der gemeinsame Kern der Kursreservierung fuer Konten und Gaeste. Niemandem '
  'freigegeben - aufgerufen wird sie nur von reserve_course_seat() und '
  'reserve_course_seat_for_guest().';

-- ---------- 4. Die beiden Tueren ----------
-- Die Signatur von reserve_course_seat bleibt Zeichen fuer Zeichen die aus
-- Migration 0011: create-course-checkout ruft sie in der ausgelieferten
-- Fassung genauso auf wie in der neuen.
create or replace function public.reserve_course_seat(
  p_course_id      uuid,
  p_user_id        uuid,
  p_agb_accepted   boolean default false,
  p_hold_minutes   integer default 35,
  p_client_id      uuid default null
)
returns public.course_bookings
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.reserve_course_seat_any(
    p_course_id, p_user_id, null, null, p_agb_accepted, p_hold_minutes, p_client_id);
end $$;

create or replace function public.reserve_course_seat_for_guest(
  p_course_id      uuid,
  p_guest_email    text,
  p_guest_name     text default null,
  p_agb_accepted   boolean default false,
  p_hold_minutes   integer default 35,
  p_client_id      uuid default null
)
returns public.course_bookings
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.reserve_course_seat_any(
    p_course_id, null, p_guest_email, p_guest_name, p_agb_accepted, p_hold_minutes, p_client_id);
end $$;

-- Wie bei reserve_course_seat: nur service_role, also nur aus der Edge
-- Function heraus. Waere sie vom Client aufrufbar, koennte jeder mit
-- erfundenen Adressen jeden Kurs ausbuchen, ohne auch nur ein Konto anzulegen.
revoke execute on function
  public.reserve_course_seat_for_guest(uuid, text, text, boolean, integer, uuid) from public;
grant execute on function
  public.reserve_course_seat_for_guest(uuid, text, text, boolean, integer, uuid) to service_role;

comment on function
  public.reserve_course_seat_for_guest(uuid, text, text, boolean, integer, uuid) is
  'Haelt einen Kursplatz fuer jemanden ohne Konto. Nur service_role - der '
  'Aufruf kommt aus der Edge Function create-course-checkout.';
