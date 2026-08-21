-- ---------- Zustimmung bei der Registrierung, und Freischaltung ohne Neuladen ----------
-- Rein additiv (CLAUDE.md §Migrationen): eine neue Funktion, ein neuer Trigger,
-- eine Tabelle in der Realtime-Publikation. Nichts entfernt, nichts umbenannt,
-- keine bestehende Funktion angefasst. Die alte App-Version merkt davon nichts.
--
-- Beide Punkte stehen seit dem Backlog offen (T05 und T16) und sind hier
-- zusammengefasst, weil beide an auth bzw. profiles haengen.

-- ---------- 1. Zustimmung bei der Registrierung (T05) ----------
-- WARUM EIN TRIGGER UND NICHT EIN INSERT AUS DEM FORMULAR
-- -------------------------------------------------------
-- Weil es im Moment der Registrierung keine Sitzung gibt. Ist die
-- E-Mail-Bestaetigung eingeschaltet - und das ist sie -, liefert signUp() kein
-- Token; ein Insert in user_consents scheitert dann an
-- user_consents_insert (user_id = auth.uid(), und auth.uid() ist null).
--
-- Der Client koennte die Zustimmung also erst nach dem ersten Anmelden
-- nachtragen. Das waere aber genau die Luecke, die T05 schliessen soll: zwischen
-- Registrierung und erster Anmeldung gaebe es ein Konto ohne Zustimmung, und
-- wer den zweiten Schritt nie macht, hat nie zugestimmt.
--
-- Deshalb reist die Zustimmung als Metadatum mit der Registrierung mit, und
-- dieser Trigger macht daraus Zeilen - im selben Augenblick, in dem das Konto
-- entsteht.
--
-- Dass raw_user_meta_data vom Client kommt und manipulierbar ist (CLAUDE.md),
-- ist hier ohne Belang: es geht nicht um ein Recht, das sich jemand verschafft,
-- sondern um seine eigene Erklaerung. Wer sie faelscht, faelscht sie gegen sich
-- selbst. Was der Trigger NICHT aus den Metadaten uebernimmt, ist die Fassung -
-- die bestimmt er selbst, aus den veroeffentlichten Definitionen.
create or replace function public.handle_new_user_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_when timestamptz;
begin
  -- Kein Zeitstempel, keine Zustimmung. Ein Konto ohne diese Angabe entsteht
  -- weiterhin - etwa beim Anlegen von Hand im Studio -, es traegt dann nur
  -- keine Einwilligung. Die Oberflaeche fragt in dem Fall auf der Kontoseite
  -- nach.
  begin
    v_when := (new.raw_user_meta_data->>'consented_at')::timestamptz;
  exception when others then
    v_when := null;
  end;

  if v_when is null then
    return new;
  end if;

  -- Die jeweils juengste veroeffentlichte Pflichtfassung je Art. distinct on
  -- braucht dieselbe Sortierung wie die order-by-Klausel; kind steht deshalb
  -- vorn und version dahinter.
  insert into public.user_consents (user_id, definition_id, kind, granted_at, source)
  select distinct on (d.kind)
         new.id, d.id, d.kind, v_when, 'web'
    from public.consent_definitions d
   where d.published_at is not null
     and d.published_at <= now()
     and d.is_required
   order by d.kind, d.version desc;

  return new;
end $$;

-- Ein eigener Trigger neben on_auth_user_created statt einer Erweiterung von
-- handle_new_user(): der legt die profiles-Zeile an, und das soll auch dann
-- passieren, wenn hier etwas schiefgeht. Zwei Trigger, zwei Aufgaben.
create trigger on_auth_user_consents
  after insert on auth.users
  for each row execute function public.handle_new_user_consents();

comment on function public.handle_new_user_consents() is
  'Macht aus raw_user_meta_data.consented_at Zeilen in user_consents - die Fassung '
  'bestimmt der Trigger, nicht der Client.';

-- ---------- 2. Freischaltung ohne Neuladen (T16) ----------
-- Bisher stand in der Abnahme "Nach Zahlung schaltet die App ueber Realtime
-- frei, ohne Neuladen" - gebaut war es nie. Der Nutzer kam aus dem Checkout
-- zurueck und sah weiter die Bezahlschranke, bis er die Seite neu lud.
--
-- Freigegeben wird ausschliesslich profiles, und das ist Absicht:
--   * Dort steht has_active_subscription, also genau der Wert, an dem
--     has_plus_access() haengt. Ein Ereignis auf subscriptions waere nur ein
--     Umweg dorthin.
--   * profiles traegt keine Zahlungsdaten. subscriptions dagegen fuehrt
--     Kundennummern und Periodengrenzen - die gehen ueber eine offene
--     Verbindung niemanden etwas an, auch nicht den Eigentuemer.
--
-- RLS gilt fuer Realtime genauso wie fuer eine Abfrage: profiles_select_own
-- sorgt dafuer, dass jeder nur seine eigene Zeile zu sehen bekommt. Ohne diese
-- Policy waere die Freigabe hier ein Leck; mit ihr ist sie eine Benachrichtigung
-- ueber die eigene Zeile.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
