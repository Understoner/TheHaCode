-- ---------- Abos und Stripe-Events (SAD §3.7, §4.3) ----------
-- Rein additiv (CLAUDE.md §Migrationen): zwei neue Tabellen, ein neuer Trigger,
-- eine ersetzte Funktion. Nichts entfernt, nichts umbenannt. Die alte
-- App-Version laeuft unveraendert weiter - sie kennt die Tabellen schlicht
-- nicht, und has_plus_access() antwortet ihr wie bisher.
--
-- WAS HIER DIE WAHRHEIT HERSTELLT
-- -------------------------------
-- profiles.has_active_subscription ist laut CLAUDE.md der einzige Zugriffswert
-- und wird "ausschliesslich vom Stripe-Trigger" geschrieben. Dieser Trigger ist
-- er. Vor dieser Migration gab es die Spalte, aber niemanden, der sie setzt -
-- deshalb musste Plus bisher von Hand im Studio vergeben werden.
--
-- Der Weg ist ab jetzt immer derselbe, auch fuer Betatester und Supportfaelle
-- (SAD §4.6): eine Zeile in public.subscriptions, und der Trigger leitet daraus
-- profiles ab. Wer stattdessen direkt an profiles schreibt, umgeht genau die
-- Stelle, die die Wahrheit herstellt - der Schutztrigger aus 0001 verhindert
-- das seit jeher.

-- ---------- 1. Abos ----------
-- provider hat einen Vorgabewert, damit spaeteres 'apple_iap'/'google_play'
-- oder das haendische 'manual' aus SAD §4.6 ohne Schemaaenderung passen.
create table public.subscriptions (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,

  provider                   text not null default 'stripe',
  stripe_customer_id         text,
  stripe_subscription_id     text unique,
  stripe_checkout_session_id text unique,

  plan                       subscription_plan   not null,
  status                     subscription_status not null,
  current_period_end         timestamptz not null,
  cancel_at_period_end       boolean not null default false,

  -- Kaeuferland aus Stripe (ISO-3166-1 alpha-2, z. B. 'AT').
  -- SAD §4.5: die Kleinunternehmerregelung greift fuer inlaendische Umsaetze,
  -- digitale Leistungen an Privatpersonen in anderen EU-Laendern folgen dem
  -- Bestimmungslandprinzip. Die Architektur ist davon unberuehrt, die spaetere
  -- Auswertung nicht - und ein nicht mitgeschriebenes Land laesst sich in zwei
  -- Jahren nicht mehr rekonstruieren. Eine Spalte jetzt statt einer
  -- Datenarchaeologie spaeter.
  country                    text,

  started_at                 timestamptz not null default now(),
  canceled_at                timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  -- deleted_at und client_id verlangt CLAUDE.md fuer jede Nutzertabelle.
  -- deleted_at ist hier kein Zierrat: der Entitlement-Trigger unten
  -- uebergeht weggeraeumte Zeilen ausdruecklich, sonst waere die Spalte eine
  -- Falle - eine "geloeschte" Zeile, die weiter Zugriff gewaehrt.
  -- client_id bleibt bei Stripe-Zeilen null; ein Abo entsteht im Webhook, nicht
  -- auf einem Geraet. Die Spalte steht fuer den Fall bereit, dass ein Abo
  -- irgendwann doch aus der App heraus angelegt wird (In-App-Kauf).
  deleted_at                 timestamptz,
  client_id                  uuid
);

create index idx_subs_user_active on public.subscriptions (user_id)
  where status in ('active', 'trialing');

create trigger trg_subscriptions_updated
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Lesen: nur die eigenen Abos. Mehr gibt es fuer den Client nicht - kein
-- insert, kein update, kein delete. Ein Abo entsteht ausschliesslich im
-- Webhook, also unter service_role, und service_role umgeht RLS ohnehin.
--
-- Das ist der Missbrauchsfall, um den es hier geht: gaebe es eine
-- Schreibpolicy, koennte sich jeder Angemeldete eine Zeile mit
-- status = 'active' anlegen und haette ueber den Trigger unten sofort Plus.
-- Deshalb steht hier bewusst KEINE Schreibpolicy und auch kein Grant dafuer -
-- beides zusammen, weil eine fehlende Policy ohne fehlenden Grant nur die
-- halbe Miete waere.
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());

grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

comment on table public.subscriptions is
  'Abos je Nutzer. Schreibt ausschliesslich der Stripe-Webhook unter service_role; '
  'der Client darf nur die eigenen Zeilen lesen.';

-- ---------- 2. Idempotenz-Register ----------
-- Stripe liefert Events mehrfach aus (SAD §4.3 Punkt 3). Der Webhook legt die
-- Event-ID hier ab, bevor er irgendetwas verarbeitet: kommt kein Row zurueck,
-- war das Event schon da und die Antwort ist sofort 200.
--
-- Keine Nutzertabelle - kein user_id, kein deleted_at, keine cascade. Ein
-- Event gehoert Stripe, nicht einem Nutzer, und ueberlebt die Loeschung eines
-- Kontos bewusst: sonst koennte dasselbe Event nach einer Kontoloeschung ein
-- zweites Mal verarbeitet werden.
create table public.stripe_events (
  id           text primary key,        -- evt_...
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  payload      jsonb
);

alter table public.stripe_events enable row level security;

-- Absichtlich ohne jede Policy: RLS ohne Policy heisst "niemand", und
-- service_role umgeht RLS. Damit kommt ausser dem Webhook niemand heran.
-- Der payload enthaelt Rohdaten von Stripe inklusive E-Mail-Adresse und
-- Rechnungsland - nichts davon geht den Client etwas an.
grant select, insert, update, delete on public.stripe_events to service_role;

comment on table public.stripe_events is
  'Verarbeitete Stripe-Events. Nur service_role; bewusst ohne RLS-Policy.';

-- ---------- 3. Der Entitlement-Trigger ----------
-- Die einzige Stelle im System, die profiles.has_active_subscription schreibt.
--
-- WARUM SECURITY INVOKER UND NICHT SECURITY DEFINER
-- -------------------------------------------------
-- SAD §3.7 schreibt "security definer". Das funktioniert hier nicht, und der
-- Grund ist der Schutztrigger aus 0001:
--
--   if (... entitlement-spalten geaendert ...) and current_user <> 'service_role'
--     then raise exception ...
--
-- In einer security-definer-Funktion ist current_user der Eigentuemer der
-- Funktion (postgres), nicht der Aufrufer. Der Schutztrigger wuerde also
-- ausgerechnet den Trigger blockieren, fuer den er eine Ausnahme machen soll.
--
-- security invoker loest das ohne Aufweichung: der Trigger laeuft unter dem
-- Recht dessen, der subscriptions geschrieben hat - und schreiben darf dort
-- laut Grants oben nur service_role. Der Schutztrigger bleibt damit
-- unveraendert streng, und es braucht keine Hintertuer, kein Sitzungsflag und
-- keine zweite Rolle.
--
-- Folge fuers Handanlegen (SAD §4.6): der dort gezeigte INSERT muss unter
-- service_role laufen. Im Studio heisst das Table Editor, nicht SQL Editor -
-- der SQL Editor arbeitet als postgres und scheitert am Schutztrigger. Er
-- scheitert dabei laut und mit Meldung, nicht still.
create or replace function public.sync_profile_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid    uuid := coalesce(new.user_id, old.user_id);
  v_active boolean;
  v_until  timestamptz;
begin
  -- Bewusst ueber ALLE Zeilen des Nutzers gerechnet, nicht nur ueber die
  -- gerade geaenderte: wer ein Monatsabo kuendigt und ein Jahresabo abschliesst,
  -- hat zwei Zeilen. Die Frage ist nie "was ist mit dieser Zeile", sondern
  -- "hat dieser Mensch Zugriff".
  select
    bool_or(s.status in ('active', 'trialing')
            and s.current_period_end > now()),
    max(s.current_period_end) filter (
      where s.status in ('active', 'trialing')
    )
  into v_active, v_until
  from public.subscriptions s
  where s.user_id = v_uid
    and s.deleted_at is null;

  update public.profiles
     set has_active_subscription = coalesce(v_active, false),
         plus_until              = v_until,
         updated_at              = now()
   where id = v_uid;

  return null;
end $$;

create trigger trg_sync_entitlement
  after insert or update or delete on public.subscriptions
  for each row execute function public.sync_profile_entitlement();

comment on function public.sync_profile_entitlement() is
  'Leitet profiles.has_active_subscription und plus_until aus subscriptions ab. '
  'security invoker mit Absicht - siehe Migration 0010.';

-- ---------- 4. has_plus_access() zieht plus_until mit heran ----------
-- SAD §3.7 sieht fuer abgelaufene Perioden ohne Stripe-Event einen taeglichen
-- pg_cron-Job vor ("Guertel und Hosentraeger"). Der Fall ist echt: bleibt das
-- Event customer.subscription.deleted aus - Netzwerkausfall, geloeschter
-- Endpoint, Stripe-Stoerung - steht has_active_subscription weiter auf true,
-- obwohl die Periode laengst vorbei ist.
--
-- Statt eines Jobs beantwortet das die Funktion selbst. Genau dafuer gibt es
-- sie: CLAUDE.md haelt fest, dass sich bei einer Aenderung der
-- Zugriffsregel "genau sie aendert und keine einzige Policy". Das ist der
-- Fall. Kein pg_cron, keine Extension, kein Job, der stillschweigend nicht
-- mehr laeuft - die Regel gilt bei jeder Abfrage.
--
-- plus_until IS NULL gewaehrt weiterhin Zugriff. Das ist kein Versehen: so
-- bleiben von Hand gesetzte Freischaltungen aus der Zeit vor dieser Migration
-- gueltig, bei denen nur das Boolean gesetzt wurde. Neue Zeilen bekommen
-- plus_until immer vom Trigger oben.
create or replace function public.has_plus_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.has_active_subscription
        and (p.plus_until is null or p.plus_until > now())
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;
