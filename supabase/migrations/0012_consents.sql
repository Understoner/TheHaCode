-- ---------- Einwilligungen (SAD §3.10, T17) ----------
-- Rein additiv (CLAUDE.md §Migrationen): ein Enum, zwei Tabellen, eine
-- Funktion, zwei Definitionszeilen. Nichts entfernt, nichts umbenannt. Die
-- alte App-Version kennt die Tabellen nicht und laeuft unveraendert weiter.
--
-- WARUM DAS JETZT KOMMT UND NICHT ERST MIT DEM TAGEBUCH
-- -----------------------------------------------------
-- SAD §5 sagt woertlich, die Consent-Infrastruktur aus §3.10 "bleibt trotzdem
-- im Schema. Sie ist bereits gebaut" - das war eine Annahme, sie stimmte nicht.
-- Gebaut wird sie hier. In V1 traegt sie AGB und Datenschutz; die Definition
-- health_data wird bewusst NICHT angelegt, damit V1 nachweislich keine
-- Gesundheitsdaten nach Art. 9 verarbeitet (SAD §5, Kasten). Mit dem Tagebuch
-- (V1.1) kommt sie dazu - dann aendert sich hier eine Zeile, kein Schema.
--
-- WARUM CONSENT INS SCHEMA GEHOERT UND NICHT IN EIN BOOLEAN
-- ---------------------------------------------------------
-- Nachweisbar sein muss nicht nur DASS jemand zugestimmt hat, sondern WOZU
-- genau - also der exakte Wortlaut. Deshalb zwei Tabellen: die versionierte
-- Definition mit ihrem Text und dessen Pruefsumme, und der Vermerk, wer wann
-- welcher Definition zugestimmt hat.
--
-- append-only: ein Widerruf ist eine neue Zeile, kein UPDATE. Ein
-- ueberschriebenes granted_at waere ein vernichteter Nachweis.

create type public.consent_kind as enum (
  'terms',              -- AGB / Nutzungsbedingungen
  'privacy',            -- Datenschutzerklaerung
  'health_data',        -- Art. 9 DSGVO: Tagebuch (V1.1, hier nicht veroeffentlicht)
  'marketing_email',    -- Newsletter, getrennt und opt-in
  'push_notifications'  -- Erinnerungen
);

-- ---------- 1. Die Definitionen ----------
-- Redaktionell gepflegt wie News und Kurse, aber mit einem Unterschied: nach
-- der Veroeffentlichung wird eine Definition nicht mehr geaendert, sondern es
-- kommt eine neue Version dazu. Sonst zeigt der Nachweis auf einen Text, den
-- es so nie gab.
create table public.consent_definitions (
  id           uuid primary key default gen_random_uuid(),
  kind         public.consent_kind not null,
  version      int  not null,
  locale       text not null default 'de',
  title        text not null,
  body_md      text not null,
  -- Der Nachweis des exakten Wortlauts. Wird vom Trigger unten aus body_md
  -- berechnet und nicht von Hand gesetzt: eine Pruefsumme, die jemand selbst
  -- eintraegt, prueft nichts.
  body_sha256  text not null default '',
  is_required  boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (kind, version, locale)
);

create or replace function public.set_consent_hash()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.body_sha256 := encode(extensions.digest(new.body_md, 'sha256'), 'hex');
  return new;
end $$;

create trigger trg_consent_definitions_hash
  before insert or update of body_md on public.consent_definitions
  for each row execute function public.set_consent_hash();

create trigger trg_consent_definitions_updated
  before update on public.consent_definitions
  for each row execute function public.set_updated_at();

-- ---------- 2. Die erteilten Einwilligungen ----------
create table public.user_consents (
  id            uuid primary key default gen_random_uuid(),

  -- Die Reihenfolge der Erklaerungen, und zwar verlaesslich.
  -- created_at reicht dafuer NICHT: now() ist der Beginn der Transaktion, also
  -- tragen zwei Zeilen aus derselben Transaktion denselben Zeitstempel - und
  -- "die letzte" waere dann Zufall. Bei einer Frage, deren Antwort "hat er
  -- eingewilligt oder widerrufen?" lautet, ist Zufall die schlechteste
  -- denkbare Sortierung. Eine Identity-Spalte gibt eine echte Gesamtordnung.
  seq           bigint generated always as identity,
  user_id       uuid not null references auth.users(id) on delete cascade,
  definition_id uuid not null references public.consent_definitions(id) on delete restrict,
  -- denormalisiert, damit has_consent() ohne Join auskommt
  kind          public.consent_kind not null,
  granted_at    timestamptz,
  revoked_at    timestamptz,
  source        text not null default 'web',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- CLAUDE.md verlangt beides fuer jede Nutzertabelle. deleted_at ist hier
  -- bewusst ohne Wirkung auf has_consent(): eine "geloeschte" Einwilligung
  -- gibt es nicht, ein Widerruf ist eine neue Zeile mit revoked_at. Die
  -- Spalte steht fuer den Loeschlauf bereit, nicht fuer die Fachlogik.
  deleted_at    timestamptz,
  client_id     uuid,

  constraint chk_granted_or_revoked
    check (granted_at is not null or revoked_at is not null)
);

create index idx_user_consents_lookup
  on public.user_consents (user_id, kind, seq desc);

create trigger trg_user_consents_updated
  before update on public.user_consents
  for each row execute function public.set_updated_at();

-- ---------- 3. Rechte ----------
alter table public.consent_definitions enable row level security;
alter table public.user_consents       enable row level security;

-- Definitionen sind oeffentlich lesbar, sobald veroeffentlicht - auch ohne
-- Konto: wer sich registriert, soll vorher lesen koennen, wozu.
-- Unveroeffentlichte bleiben unsichtbar, und genau daran haengt, dass
-- health_data in V1 nirgends auftaucht.
create policy consent_defs_read on public.consent_definitions
  for select using (published_at is not null);

create policy consent_defs_admin_write on public.consent_definitions
  for all using (public.is_admin()) with check (public.is_admin());

create policy user_consents_read on public.user_consents
  for select using (user_id = auth.uid());

-- Schreiben darf der Nutzer selbst - anders als bei Abos und Buchungen ist die
-- Einwilligung SEINE Erklaerung, nicht unsere Feststellung. Der Missbrauchsfall
-- ist deshalb ein anderer: nicht "jemand verschafft sich etwas", sondern
-- "jemand erklaert etwas fuer einen anderen". Dagegen steht user_id =
-- auth.uid() im with check.
--
-- Und nur INSERT: kein UPDATE, kein DELETE, keine Grants dafuer. Ein Widerruf
-- ist eine neue Zeile. Wer eine erteilte Einwilligung nachtraeglich umschreiben
-- koennte, koennte den Nachweis vernichten - und zwar genau dann, wenn er
-- gebraucht wird.
create policy user_consents_insert on public.user_consents
  for insert with check (
    user_id = auth.uid()
    and (
      -- Nur auf veroeffentlichte Definitionen. Ohne diese Bedingung koennte
      -- sich jemand auf health_data berufen, bevor es die Fassung gibt.
      select d.published_at is not null
        from public.consent_definitions d
       where d.id = definition_id
    )
  );

grant select on public.consent_definitions to anon, authenticated;
grant select, insert, update, delete on public.consent_definitions to service_role;

grant select, insert on public.user_consents to authenticated;
grant select, insert, update, delete on public.user_consents to service_role;

comment on table public.consent_definitions is
  'Versionierte Einwilligungstexte. Nach der Veroeffentlichung nicht mehr aendern, '
  'sondern eine neue Version anlegen - sonst zeigt der Nachweis ins Leere.';
comment on table public.user_consents is
  'Erteilte und widerrufene Einwilligungen, append-only. Ein Widerruf ist eine '
  'neue Zeile mit revoked_at, niemals ein UPDATE.';

-- ---------- 4. Der aktuelle Stand ----------
-- security definer, damit die Funktion spaeter auch aus einer Policy heraus
-- benutzbar ist (V1.1: habit_logs_insert). Sie liest ausschliesslich die
-- Zeilen des Aufrufers - auth.uid() steht in der Abfrage, nicht in einem
-- Parameter, den jemand setzen koennte.
create or replace function public.has_consent(p_kind public.consent_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select uc.granted_at is not null and uc.revoked_at is null
      from public.user_consents uc
     where uc.user_id = auth.uid()
       and uc.kind = p_kind
     order by uc.seq desc
     limit 1
  ), false);
$$;

grant execute on function public.has_consent(public.consent_kind) to authenticated;

comment on function public.has_consent(public.consent_kind) is
  'Aktueller Einwilligungsstand des Aufrufers. Liest nur dessen eigene Zeilen.';

-- ---------- 5. Die beiden Fassungen, die V1 braucht ----------
-- Der Text ist das, was neben dem Haken steht - und damit genau das, wozu
-- zugestimmt wird. Die Dokumente selbst stehen unter /agb und /datenschutz und
-- werden hier bewusst nicht kopiert: zwei Fassungen desselben Vertragswerks
-- laufen frueher oder spaeter auseinander (siehe die zusammengefuehrten AGB in
-- T19). Verwiesen wird deshalb auf die Fassung mit Datum.
--
-- health_data fehlt hier mit Absicht. Solange es die Definition nicht gibt,
-- kann niemand einwilligen, und ohne Einwilligung entstehen keine
-- Gesundheitsdaten (SAD §5).
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values
  ('terms', 1, 'de', 'Allgemeine Geschäftsbedingungen',
   'Ich habe die Allgemeinen Geschäftsbedingungen in der Fassung vom 21.08.2026 '
   'gelesen und stimme ihnen zu. Sie sind unter /agb abrufbar. Teil ihrer '
   'Geltung ist der Haftungsausschluss unter /haftungsausschluss (§ 5 AGB).',
   true, now()),
  ('privacy', 1, 'de', 'Datenschutzerklärung',
   'Ich habe die Datenschutzerklärung in der Fassung vom 21.08.2026 zur Kenntnis '
   'genommen. Sie ist unter /datenschutz abrufbar und beschreibt, welche Daten '
   'zu welchem Zweck verarbeitet werden.',
   true, now());
