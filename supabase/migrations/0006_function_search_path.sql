-- ---------- Funktionen gegen search_path-Manipulation absichern ----------
-- Rein additiv (CLAUDE.md §Migrationen): nur "create or replace function",
-- keine Signatur geaendert, keine Spalte, Tabelle oder Policy angefasst. Alte
-- und neue App-Version laufen unveraendert weiter.
--
-- Warum ueberhaupt: eine Funktion ohne festen search_path loest unqualifizierte
-- Namen erst zur Laufzeit auf, und zwar in dem search_path, den der Aufrufer
-- mitbringt. Wer eigene Objekte anlegen kann, kann so eine Funktion oder einen
-- Operator unterschieben, die dann anstelle der gemeinten aufgerufen wird.
-- Bei den Definer-Funktionen unten liefe das mit den Rechten des Eigentuemers.
-- Supabases Security Advisor meldet das als "function_search_path_mutable".
--
-- Konkret ausnutzbar war hier nichts: is_admin() ruft nur auth.jwt() auf, und
-- auth.jwt() ist schemaqualifiziert. Genau darauf will man sich aber nicht
-- verlassen muessen, sobald jemand die Funktionen spaeter erweitert -
-- is_admin() ist die Grundlage jeder Schreib-Policy auf News, Kursen, Team und
-- Storage.
--
-- search_path = '' statt = public: damit faellt gar nichts mehr implizit auf
-- ein Schema zurueck, jede Referenz muss qualifiziert sein (pg_catalog bleibt
-- immer erreichbar). Das ist die Empfehlung von Supabase und macht ein
-- Vergessen beim naechsten Umbau zu einem lauten Fehler statt zu einer
-- stillen Luecke.

-- Grundlage jeder Admin-Schreib-Policy (news_posts, courses, team_members,
-- storage.objects) - deshalb hier die wichtigste der fuenf.
create or replace function public.is_admin()
returns boolean language sql stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Die einzige Zugriffsentscheidung (CLAUDE.md §Zugriff). Lief bisher mit
-- search_path = public - als security definer die zweite Funktion, bei der
-- eine untergeschobene profiles-Relation teuer waere.
create or replace function public.has_plus_access()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.has_active_subscription from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Laeuft als security definer bei jedem Signup, also mit den Rechten des
-- Eigentuemers auf einer Tabelle, die der neue Nutzer nicht anfassen darf.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Der Schutz der Entitlement-Spalten. Ohne festen search_path haengt die
-- Aufloesung von current_user am Aufrufer - der Trigger, der das Bezahlrecht
-- schuetzt, soll von aussen gar nicht beeinflussbar sein.
create or replace function public.protect_entitlement_columns()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if (new.has_active_subscription is distinct from old.has_active_subscription
      or new.plus_until is distinct from old.plus_until)
     and current_user <> 'service_role' then
    raise exception 'has_active_subscription und plus_until sind nur per service_role aenderbar';
  end if;
  return new;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;
