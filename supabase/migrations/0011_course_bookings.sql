-- ---------- Kursbuchungen (T20, AGB Teil B §§ 11-13) ----------
-- Rein additiv (CLAUDE.md §Migrationen): fuenf neue Spalten an courses, ein
-- neues Enum, eine neue Tabelle, zwei Funktionen. Nichts entfernt, nichts
-- umbenannt. Die alte App-Version laeuft unveraendert weiter - sie kennt die
-- neuen Spalten nicht, und booking_enabled ist per Vorgabe false, also bleibt
-- fuer sie jeder Kurs beim externen signup_url.
--
-- WAS HIER ANDERS IST ALS BEIM ABO
-- --------------------------------
-- Ein Kurs ist eine Einmalzahlung, kein Abo. Daraus folgt alles Weitere:
--   * Der Checkout laeuft mit mode = 'payment', nicht 'subscription'.
--   * Eine Kursbuchung erzeugt NIEMALS eine Zeile in public.subscriptions und
--     beruehrt has_plus_access() an keiner Stelle. Wer einen Workshop bucht,
--     bekommt dadurch kein Plus - und wer Plus hat, keinen Workshop.
--   * Plaetze sind endlich. Das ist die einzige Stelle im Projekt mit einem
--     echten Wettlauf, siehe reserve_course_seat() weiter unten.
--
-- ANZAHLUNG - DIE ENTSCHEIDUNG VOM 21.08.2026
-- -------------------------------------------
-- § 11 AGB verlangt bei Offline-Terminen ueber 130 EUR eine Anzahlung von 50 %,
-- der Rest spaetestens vier Wochen vor Beginn. Die AGB bleiben wie sie sind;
-- die App bildet den Fall so ab:
--   * courses.deposit_cents gesetzt  -> im Checkout wird die Anzahlung bezahlt,
--     der Restbetrag steht als amount_total_cents - amount_paid_cents offen und
--     wird von Hand ueber einen Stripe-Zahlungslink eingesammelt.
--   * courses.deposit_cents null     -> der volle Betrag wird sofort bezahlt.
--   * Wer spaeter als vier Wochen vor Beginn bucht, zahlt IMMER voll. Eine
--     Anzahlung, deren Restbetrag schon faellig waere, ist keine Anzahlung.
-- Der Ablauf fuer den Restbetrag steht in docs/KURSBUCHUNG.md.
--
-- STORNO - EBENFALLS AM 21.08.2026 ENTSCHIEDEN
-- --------------------------------------------
-- § 12 AGB (Staffel 12/6 Wochen) wird NICHT gerechnet. Der Nutzer storniert
-- per E-Mail, die Erstattung passiert im Stripe-Dashboard, der Status hier im
-- Studio. Deshalb gibt es canceled_at und den Status 'canceled', aber keine
-- Erstattungslogik. Absichtlich: eine falsch gerechnete Staffel waere ein
-- Geldfehler, und es geht um wenige Faelle im Jahr.

-- ---------- 1. Kurse bekommen Preis, Plaetze und Beginn ----------
-- Alle nullable bzw. mit Vorgabewert - sonst waere die Migration nicht additiv.
alter table public.courses
  add column if not exists price_cents     integer,
  add column if not exists deposit_cents   integer,
  add column if not exists capacity        integer,
  add column if not exists starts_at       timestamptz,
  add column if not exists booking_enabled boolean not null default false;

comment on column public.courses.price_cents is
  'Gesamtpreis in Cent, brutto. Kleinunternehmer (SAD §4.5): keine Steuer ausgewiesen.';
comment on column public.courses.deposit_cents is
  'Anzahlung in Cent nach § 11 AGB, null = Vollzahlung im Checkout.';
comment on column public.courses.capacity is
  'Teilnehmerbegrenzung, null = unbegrenzt.';
comment on column public.courses.booking_enabled is
  'true = in der App buchbar. false = Anmeldung weiter ueber signup_url (T07a als Rueckfall).';

-- Die Pruefungen fangen genau die Tippfehler ab, die im Studio passieren -
-- die Redaktion laeuft dort ohne Formularvalidierung (SAD §2.4).
alter table public.courses
  add constraint chk_courses_price_positive
    check (price_cents is null or price_cents > 0),
  add constraint chk_courses_capacity_positive
    check (capacity is null or capacity > 0),
  -- Eine Anzahlung ohne Preis ergibt keinen Betrag, und eine Anzahlung in
  -- Hoehe des Preises ist keine.
  add constraint chk_courses_deposit_sane
    check (
      deposit_cents is null
      or (price_cents is not null and deposit_cents > 0 and deposit_cents < price_cents)
    ),
  -- Buchbar heisst: es gibt etwas zu zahlen und einen Termin, auf den sich die
  -- Storno- und Restzahlungsfristen beziehen koennen. Ohne diese Pruefung
  -- koennte im Studio ein Haken gesetzt werden, an dem der Checkout dann
  -- scheitert - und zwar erst beim Nutzer.
  add constraint chk_courses_booking_needs_price
    check (not booking_enabled or (price_cents is not null and starts_at is not null));

-- ---------- 2. Der Status einer Buchung ----------
--   reserved  - Platz gehalten, noch nicht bezahlt. Verfaellt (reserved_until).
--   confirmed - bezahlt; bei Anzahlung heisst das: Anzahlung eingegangen.
--   canceled  - storniert, Erstattung von Hand (§ 12 AGB).
--   expired   - Reservierung ist verfallen, der Platz ist wieder frei.
create type public.course_booking_status as enum
  ('reserved', 'confirmed', 'canceled', 'expired');

-- ---------- 3. Die Buchungen ----------
create table public.course_bookings (
  id         uuid primary key default gen_random_uuid(),

  -- CLAUDE.md §Immer: cascade auf auth.users, user_id denormalisiert.
  -- Dass eine Kontoloeschung die Buchung mitnimmt, ist hier vertretbar: der
  -- steuerlich aufzubewahrende Beleg (§ 132 BAO) ist die Zahlung bei Stripe,
  -- nicht diese Zeile. Sie ist die Sicht des Nutzers auf seine Buchung.
  user_id    uuid not null references auth.users(id) on delete cascade,

  -- Kein cascade: einen Kurs zu loeschen, auf den jemand bezahlt hat, ist
  -- keine Redaktionsentscheidung. restrict laesst das Loeschen scheitern,
  -- statt Buchungen still verschwinden zu lassen.
  course_id  uuid not null references public.courses(id) on delete restrict,

  status     public.course_booking_status not null default 'reserved',

  -- Geld in Cent, wie bei Stripe. Kein numeric, keine Rundungsfragen.
  amount_total_cents integer not null,
  amount_paid_cents  integer not null default 0,
  -- Was im Checkout faellig war: null = Vollzahlung. Der Wert wird beim
  -- Reservieren aus dem Kurs kopiert und nicht mehr angefasst - aendert die
  -- Redaktion spaeter den Preis, gilt fuer diese Buchung weiter das
  -- Vereinbarte.
  deposit_cents      integer,
  balance_due_at     timestamptz,
  balance_paid_at    timestamptz,

  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text unique,

  -- Nur fuer status = 'reserved' von Bedeutung.
  reserved_until timestamptz,
  confirmed_at   timestamptz,
  canceled_at    timestamptz,

  -- Wann dieser Nutzer den AGB zugestimmt hat. § 5 AGB macht den
  -- Haftungsausschluss zum Vertragsbestandteil, § 11 macht die Anmeldung erst
  -- mit der Bestaetigung verbindlich - beides traegt nur, wenn die AGB
  -- ueberhaupt einbezogen wurden. Beim Abo fehlt diese Einbeziehung noch
  -- (T19a: consent_collection braucht die AGB-Adresse im Stripe-Dashboard),
  -- bei Kursbuchungen wird sie hier festgehalten.
  agb_accepted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id  uuid,

  constraint chk_course_bookings_amounts
    check (amount_total_cents > 0 and amount_paid_cents >= 0),
  constraint chk_course_bookings_deposit
    check (deposit_cents is null or (deposit_cents > 0 and deposit_cents < amount_total_cents))
);

-- Der Zaehlindex fuer die Kapazitaet: nur belegte Plaetze stehen drin.
create index idx_course_bookings_open on public.course_bookings (course_id)
  where deleted_at is null and status in ('reserved', 'confirmed');

create index idx_course_bookings_user on public.course_bookings (user_id)
  where deleted_at is null;

-- Zweite Verteidigungslinie gegen die Doppelbuchung desselben Kurses. Die
-- erste ist reserve_course_seat(); dieser Index gilt auch dann, wenn jemand
-- eines Tages an der Funktion vorbei schreibt.
create unique index uq_course_bookings_one_open_per_user
  on public.course_bookings (user_id, course_id)
  where deleted_at is null and status in ('reserved', 'confirmed');

create trigger trg_course_bookings_updated
  before update on public.course_bookings
  for each row execute function public.set_updated_at();

alter table public.course_bookings enable row level security;

-- Lesen: nur die eigenen Buchungen. Sonst nichts - kein insert, kein update,
-- kein delete, und auch kein Grant dafuer.
--
-- Das ist der Missbrauchsfall, um den es geht: gaebe es eine Schreibpolicy,
-- koennte sich jeder Angemeldete eine Zeile mit status = 'confirmed' anlegen
-- und stuende ohne Zahlung auf der Teilnehmerliste - und haette obendrein
-- einen Platz belegt, der jemand anderem gehoert. Eine Buchung entsteht
-- ausschliesslich in reserve_course_seat() (service_role) und wird
-- ausschliesslich vom Stripe-Webhook bestaetigt.
create policy course_bookings_select_own on public.course_bookings
  for select using (user_id = auth.uid());

grant select on public.course_bookings to authenticated;
grant select, insert, update, delete on public.course_bookings to service_role;

comment on table public.course_bookings is
  'Kursbuchungen je Nutzer. Angelegt von reserve_course_seat(), bestaetigt vom '
  'Stripe-Webhook - beides unter service_role. Der Client darf nur lesen.';

-- ---------- 4. Der Wettlauf um den letzten Platz ----------
-- DIE STELLE, AN DER DIESE MIGRATION SORGFALT BRAUCHT.
--
-- Zwei Personen buchen gleichzeitig den letzten Platz. Wuerde der Client
-- zaehlen - "noch 1 frei, also los" - bekaemen beide ein Ja, und die
-- Ueberbuchung faellt erst auf der Teilnehmerliste auf. Deshalb zaehlt die
-- Datenbank, und zwar unter Sperre:
--
--   select ... from public.courses where id = ... for update
--
-- Diese Zeile ist der ganze Trick. Die Kurszeile ist der Zaehlpunkt; wer sie
-- haelt, zaehlt allein. Die zweite Transaktion wartet an dieser Sperre, bis
-- die erste ihre Buchung geschrieben und committet hat - und zaehlt sie dann
-- mit. Ohne das for update wuerden beide denselben veralteten Stand lesen.
--
-- security definer, weil die Funktion Zeilen anderer Nutzer zaehlen muss (die
-- Select-Policy zeigt nur die eigenen) und weil sie schreibt, wo der Client
-- nicht schreiben darf. Deshalb ist sie auch NICHT fuer authenticated
-- freigegeben: sie laeuft nur unter service_role, also nur aus der Edge
-- Function create-course-checkout heraus. Waere sie vom Client aufrufbar,
-- koennte jeder beliebig viele Plaetze auf beliebigen Kursen halten und einen
-- Kurs ohne eine einzige Zahlung ausbuchen.
--
-- Die Fehlercodes kommen ueber PostgREST als error.code beim Aufrufer an:
--   PT001  Kurs gibt es nicht oder er ist nicht buchbar
--   PT002  ausgebucht
--   PT003  dieser Nutzer hat den Kurs bereits gebucht und bezahlt
--   PT004  ohne Zustimmung zu den AGB wird nicht reserviert
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
declare
  v_course   public.courses;
  v_booking  public.course_bookings;
  v_taken    integer;
  v_deposit  integer;
  v_balance  timestamptz;
begin
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
  -- Ohne diesen Schritt bliebe ein Platz bis in alle Ewigkeit belegt, nur
  -- weil jemand den Checkout abgebrochen hat.
  update public.course_bookings
     set status = 'expired'
   where course_id = p_course_id
     and status = 'reserved'
     and reserved_until is not null
     and reserved_until <= now();

  -- Hat dieser Nutzer den Kurs schon? Eine bestaetigte Buchung ist ein Nein;
  -- eine noch laufende Reservierung wird wiederverwendet, damit ein Klick auf
  -- "zurueck" im Browser keinen zweiten Platz belegt. Die Edge Function laesst
  -- die alte Stripe-Sitzung dazu verfallen.
  select * into v_booking
    from public.course_bookings
   where course_id = p_course_id
     and user_id = p_user_id
     and deleted_at is null
     and status in ('reserved', 'confirmed')
   limit 1;

  if found then
    if v_booking.status = 'confirmed' then
      raise exception 'Kurs % ist von % bereits gebucht', p_course_id, p_user_id
        using errcode = 'PT003';
    end if;

    update public.course_bookings
       set reserved_until   = now() + make_interval(mins => p_hold_minutes),
           agb_accepted_at  = now()
     where id = v_booking.id
    returning * into v_booking;

    return v_booking;
  end if;

  -- Zaehlen. Verfallene Reservierungen sind oben schon weg, die Bedingung auf
  -- reserved_until steht trotzdem da: sie macht die Zaehlung unabhaengig
  -- davon, dass vorher aufgeraeumt wurde.
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
    user_id, course_id, status,
    amount_total_cents, deposit_cents, balance_due_at,
    reserved_until, agb_accepted_at, client_id
  ) values (
    p_user_id, p_course_id, 'reserved',
    v_course.price_cents, v_deposit, v_balance,
    now() + make_interval(mins => p_hold_minutes), now(), p_client_id
  )
  returning * into v_booking;

  return v_booking;
end $$;

revoke execute on function
  public.reserve_course_seat(uuid, uuid, boolean, integer, uuid) from public;
grant execute on function
  public.reserve_course_seat(uuid, uuid, boolean, integer, uuid) to service_role;

comment on function public.reserve_course_seat(uuid, uuid, boolean, integer, uuid) is
  'Haelt einen Kursplatz unter Sperre der Kurszeile. Nur service_role - der '
  'Aufruf kommt aus der Edge Function create-course-checkout.';

-- ---------- 5. Freie Plaetze, oeffentlich lesbar ----------
-- Die Zahl der freien Plaetze steht auf der Kursseite, also braucht sie auch
-- anon. Die Buchungen selbst darf niemand sehen - deshalb liefert die
-- Funktion ausschliesslich Summen und keine einzige Zeile.
--
-- security definer aus genau diesem Grund; eine View mit denselben Rechten
-- waere dasselbe in unuebersichtlicher, und der Supabase-Linter mahnt sie zu
-- Recht an. stable, damit ein Aufruf je Anfrage genuegt.
create or replace function public.course_seats()
returns table (
  course_id   uuid,
  capacity    integer,
  seats_taken integer,
  seats_left  integer
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    c.id,
    c.capacity,
    count(b.id)::integer,
    case
      when c.capacity is null then null
      else greatest(c.capacity - count(b.id), 0)::integer
    end
  from public.courses c
  left join public.course_bookings b
    on b.course_id = c.id
   and b.deleted_at is null
   and (
     b.status = 'confirmed'
     or (b.status = 'reserved' and b.reserved_until > now())
   )
  where c.published_at is not null
    and c.published_at <= now()
    and c.booking_enabled
  group by c.id, c.capacity
$$;

grant execute on function public.course_seats() to anon, authenticated, service_role;

comment on function public.course_seats() is
  'Freie Plaetze je buchbarem Kurs. Liefert nur Summen, nie einzelne Buchungen.';
