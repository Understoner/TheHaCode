-- 0022: Schutz der Kursbuchung, Buchungen ueberleben die Kontoloeschung,
--       veroeffentlichte Einwilligungsfassungen sind unveraenderlich,
--       Datenschutzerklaerung in der Fassung vom 25.10.2026.
--
-- Alles additiv im Sinne von SAD §2.6: die alte App ruft dieselben Funktionen
-- mit denselben Parametern, und keine Spalte verschwindet. Gelockert wird nur
-- eine Pruefung (chk_course_bookings_wer) und der Fremdschluessel zu
-- auth.users - beides laesst mehr zu als vorher, nicht weniger.

-- ===================================================================
-- 1. Gastreservierungen begrenzen
-- ===================================================================
--
-- Zwei Sperren, weil keine allein reicht:
--
--   * pro Absender: take_guest_booking_slot() zaehlt Versuche je Kennung.
--     Die Kennung bildet create-course-checkout als HMAC aus der IP-Adresse;
--     hier landet nie eine IP im Klartext. Nach 24 Stunden ist sie weg.
--   * pro Kurs: reserve_course_seat_any() laesst Gaeste hoechstens die
--     Haelfte der Plaetze offen halten (PT006). Die greift auch dann, wenn
--     jemand die IP wechselt.

create table public.guest_booking_attempts (
  id         bigint generated always as identity primary key,
  key_hash   text not null check (length(key_hash) between 16 and 128),
  created_at timestamptz not null default now()
);

create index idx_guest_booking_attempts_key
  on public.guest_booking_attempts (key_hash, created_at);

-- RLS an, aber keine einzige Policy: lesen und schreiben darf nur die
-- Funktion unten, die als Eigentuemer laeuft. Kein Client sieht diese Tabelle.
alter table public.guest_booking_attempts enable row level security;
revoke all on public.guest_booking_attempts from anon, authenticated;

comment on table public.guest_booking_attempts is
  'Zaehler fuer Gastreservierungen je Absenderkennung (HMAC der IP, nie die IP '
  'selbst). Eintraege leben 24 Stunden. Kein Personenbezug ueber den Tag hinaus.';

create or replace function public.take_guest_booking_slot(
  p_key_hash text,
  p_limit    integer default 5,
  p_window   interval default interval '1 hour'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key_hash is null or length(p_key_hash) < 16 then
    raise exception 'Ungueltige Kennung' using errcode = '22023';
  end if;

  -- Aufraeumen nebenbei: was aelter als ein Tag ist, braucht niemand mehr.
  delete from public.guest_booking_attempts
   where created_at < now() - interval '24 hours';

  -- Gleichzeitige Aufrufe derselben Kennung nacheinander zaehlen, sonst
  -- kommen zehn parallele Anfragen alle an einem Zaehlerstand von 0 vorbei.
  perform pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));

  select count(*) into v_count
    from public.guest_booking_attempts
   where key_hash = p_key_hash
     and created_at > now() - p_window;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.guest_booking_attempts (key_hash) values (p_key_hash);
  return true;
end $$;

revoke execute on function public.take_guest_booking_slot(text, integer, interval) from public, anon, authenticated;
grant execute on function public.take_guest_booking_slot(text, integer, interval) to service_role;

comment on function public.take_guest_booking_slot(text, integer, interval) is
  'true = dieser Absender darf noch eine Gastreservierung starten. Nur fuer '
  'create-course-checkout (service_role).';

-- Unveraendert aus 0015 bis auf den Block "Neu in 0022".
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
  v_guests   integer;
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

  -- Neu in 0022: Gaeste duerfen hoechstens die Haelfte der Plaetze
  -- gleichzeitig in offenen Reservierungen halten. Eine Gastbuchung kostet
  -- nichts als eine erfundene Adresse; ohne diese Grenze liesse sich ein
  -- kleiner Kurs mit ein paar Aufrufen fuer 40 Minuten als ausgebucht
  -- darstellen, und echte Interessenten gingen wieder. Bezahlte Plaetze und
  -- Buchungen mit Konto zaehlen nicht mit - die Grenze trifft nur, was noch
  -- niemand bezahlt hat.
  if p_user_id is null and v_course.capacity is not null then
    select count(*) into v_guests
      from public.course_bookings
     where course_id = p_course_id
       and deleted_at is null
       and guest_email is not null
       and status = 'reserved'
       and reserved_until > now();

    if v_guests >= greatest(1, v_course.capacity / 2) then
      raise exception 'Kurs % hat zu viele offene Gastreservierungen', p_course_id
        using errcode = 'PT006';
    end if;
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

-- ===================================================================
-- 2. Buchungen ueberleben die Kontoloeschung - anonymisiert
-- ===================================================================
--
-- Bisher verschwand mit dem Konto auch jede Buchung (on delete cascade).
-- Die Datenschutzerklaerung sagt aber, Aufzeichnungen zu Zahlungen bleiben
-- sieben Jahre (§ 132 BAO). Ab jetzt bleibt die Zeile stehen: Betrag, Kurs,
-- Zeitpunkte und die Stripe-Kennungen, ueber die sich der Beleg bei Stripe
-- wiederfinden laesst. Der Bezug zur Person - user_id - wird geloescht.
--
-- Wer die Zeile dann noch sieht: niemand ausser service_role. Die einzige
-- Lese-Policy fragt user_id = auth.uid(), und das trifft null nie.

alter table public.course_bookings
  add column if not exists anonymized_at timestamptz;

comment on column public.course_bookings.anonymized_at is
  'Gesetzt, wenn das Konto geloescht wurde: die Buchung bleibt als '
  'Zahlungsaufzeichnung (§ 132 BAO), ohne Bezug zur Person.';

alter table public.course_bookings
  drop constraint if exists course_bookings_user_id_fkey;
alter table public.course_bookings
  add constraint course_bookings_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

-- Vorher: genau eines von user_id und guest_email. Jetzt darf beides fehlen -
-- aber nur bei einer anonymisierten Zeile.
alter table public.course_bookings
  drop constraint if exists chk_course_bookings_wer;
alter table public.course_bookings
  add constraint chk_course_bookings_wer
    check (
      (user_id is not null and guest_email is null)
      or (user_id is null and guest_email is not null)
      or (user_id is null and guest_email is null and anonymized_at is not null)
    );

-- Das "set null" des Fremdschluessels ist ein UPDATE, und dieser Trigger
-- sieht es. Er setzt den Zeitpunkt und gibt einen noch offenen Platz frei:
-- wer sein Konto mitten im Bezahlen loescht, soll niemandem den Platz
-- wegnehmen. Bezahlte Buchungen bleiben bestaetigt.
create or replace function public.anonymize_course_booking()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.user_id is not null and new.user_id is null and new.guest_email is null then
    new.anonymized_at  := coalesce(new.anonymized_at, now());
    new.guest_name     := null;
    new.client_id      := null;
    if new.status = 'reserved' then
      new.status         := 'expired';
      new.reserved_until := null;
    end if;
  end if;
  return new;
end $$;

create trigger trg_course_bookings_anonymize
  before update of user_id on public.course_bookings
  for each row execute function public.anonymize_course_booking();

-- ===================================================================
-- 3. Veroeffentlichte Fassungen sind unveraenderlich
-- ===================================================================
--
-- Der Nachweis einer Einwilligung zeigt auf eine Zeile in
-- consent_definitions. Liesse sich deren Wortlaut nachtraeglich aendern,
-- zeigte der Nachweis auf einen Text, dem nie jemand zugestimmt hat. Bisher
-- hielt das nur eine Absprache fest, ab jetzt die Datenbank - auch gegen
-- Admins und service_role. Eine Korrektur ist immer eine neue Version.

create or replace function public.freeze_published_consent_definition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.published_at is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Veroeffentlichte Fassung %/% ist unveraenderlich - bitte eine neue Version anlegen',
      old.kind, old.version using errcode = '42501';
  end if;

  if new.kind        is distinct from old.kind
     or new.version  is distinct from old.version
     or new.locale   is distinct from old.locale
     or new.title    is distinct from old.title
     or new.body_md  is distinct from old.body_md
     or new.body_sha256 is distinct from old.body_sha256
     or new.is_required is distinct from old.is_required
     or new.published_at is distinct from old.published_at then
    raise exception 'Veroeffentlichte Fassung %/% ist unveraenderlich - bitte eine neue Version anlegen',
      old.kind, old.version using errcode = '42501';
  end if;

  return new;
end $$;

create trigger trg_consent_definitions_frozen
  before update or delete on public.consent_definitions
  for each row execute function public.freeze_published_consent_definition();

-- ===================================================================
-- 4. Datenschutzerklaerung, Fassung vom 25.10.2026
-- ===================================================================
--
-- Neu darin: Atem-Tagebuch (Art. 9), Uebungsprotokoll, Favoriten,
-- Playlist-Links, Kursbuchungen. Neue Konten bestaetigen ab jetzt diese
-- Fassung (handle_new_user_consents nimmt die juengste veroeffentlichte).
-- Bestehende Konten sehen sie unter "Konto" als neue Fassung.
--
-- Veroeffentlicht wird beim Einspielen - auf Staging also mit dem Merge, auf
-- Live mit der Befoerderung, zusammen mit dem neuen Text unter /datenschutz.
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'privacy', 2, 'de', 'Datenschutzerklärung',
  'Ich habe die Datenschutzerklärung in der Fassung vom 25.10.2026 zur Kenntnis '
  'genommen. Sie ist unter /datenschutz abrufbar und beschreibt, welche Daten '
  'zu welchem Zweck verarbeitet werden.',
  true, now()
)
on conflict (kind, version, locale) do nothing;
