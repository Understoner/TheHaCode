-- ---------- Favoriten und Musik-Playlists (13.09.2026) ----------
-- Zwei Ergaenzungen, beide rein additiv (CLAUDE.md §Migrationen): eine neue
-- Tabelle und zwei neue, nullable Spalten. Nichts entfernt, nichts umbenannt.
-- Die alte App-Version laeuft unveraendert weiter - sie kennt beides nicht.

-- ============================================================
-- 1. Favoriten
-- ============================================================
-- Der Stern soll fuer BEIDE Sorten Sequenzen funktionieren: fuer die
-- redaktionellen (owner_id is null) und fuer die selbst gebauten. Deshalb
-- haengt er an exercises und nicht an einer der beiden Haelften - fuer die
-- Engine wie fuer den Stern ist eine Sequenz eine Sequenz (SAD §3.4).
--
-- WARUM EINE EIGENE TABELLE UND KEINE SPALTE
-- ------------------------------------------
-- Ein Favorit ist eine Beziehung zwischen Person und Sequenz, keine
-- Eigenschaft der Sequenz: dieselbe redaktionelle Uebung ist fuer den einen
-- Favorit und fuer den anderen nicht. Als Spalte an exercises waere sie fuer
-- alle dieselbe; als Array in profiles waere sie ohne Fremdschluessel und
-- haette nach dem Loeschen einer Sequenz tote IDs darin stehen.
--
-- Anders als bei den Wirkeffekten (0008, dort bewusst ein Array) traegt die
-- Tabelle hier also etwas, was die Spalte nicht kann.
create table public.exercise_favorites (
  id          uuid primary key default gen_random_uuid(),

  -- CLAUDE.md §Immer: on delete cascade auf auth.users, user_id denormalisiert.
  -- Wer sein Konto loescht, nimmt seine Sterne mit (001_foundation.test.sql).
  user_id     uuid not null references auth.users(id)      on delete cascade,
  -- Und eine geloeschte Sequenz nimmt die Sterne mit, die auf ihr standen -
  -- sonst zeigte der Favoritenfilter auf etwas, das es nicht mehr gibt.
  exercise_id uuid not null references public.exercises(id) on delete cascade,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- deleted_at steht hier, weil CLAUDE.md es fuer jede Nutzertabelle verlangt,
  -- und bleibt in der Praxis leer: der Stern wird wirklich geloescht. Ein
  -- Favorit traegt keinen Inhalt, den ein Zurueckholen retten wuerde, und ein
  -- weggeklickter Stern soll auch beim naechsten Klick wieder frisch gesetzt
  -- werden koennen - mit Soft Delete waere das ein Sonderfall im UPSERT.
  deleted_at  timestamptz,
  client_id   uuid,

  -- Ein Stern je Person und Sequenz. Ohne das legte ein doppelter Klick auf
  -- einem zweiten Geraet eine zweite Zeile an, und der Filter zeigte die
  -- Sequenz doppelt.
  unique (user_id, exercise_id)
);

-- Die Abfrage der App lautet immer "alle Favoriten DIESER Person" - genau
-- darauf liegt der Index. Der unique-Constraint oben legt ihn als
-- (user_id, exercise_id) ohnehin an; der zweite Index deckt den Weg
-- andersherum ab (die Kaskade beim Loeschen einer Sequenz).
create index idx_exercise_favorites_exercise on public.exercise_favorites (exercise_id);

create trigger trg_exercise_favorites_updated
  before update on public.exercise_favorites
  for each row execute function public.set_updated_at();

alter table public.exercise_favorites enable row level security;

-- Lesen, setzen, entfernen: ausschliesslich die eigenen Sterne. Kein
-- "using (true)", nirgends - wer wessen Sequenzen mag, geht niemanden sonst
-- etwas an.
create policy exercise_favorites_select_own on public.exercise_favorites
  for select using (user_id = auth.uid());

-- Der zweite Teil des with check ist der eigentliche Punkt: markieren laesst
-- sich nur, was man auch sehen darf. RLS greift in der Unterabfrage rekursiv,
-- eine fremde oder kostenpflichtige Sequenz liefert dort schlicht keine Zeile.
-- Ohne das waere der Stern ein Weg, IDs durchzuprobieren.
--
-- has_plus_access() steht hier bewusst NICHT: Favorisieren ist keine bezahlte
-- Faehigkeit. Die Bezahlschranke sitzt weiterhin allein am INSERT in
-- exercises (CLAUDE.md §Zugriff).
create policy exercise_favorites_insert_own on public.exercise_favorites
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );

create policy exercise_favorites_update_own on public.exercise_favorites
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy exercise_favorites_delete_own on public.exercise_favorites
  for delete using (user_id = auth.uid());

-- Ohne "auto_expose_new_tables" erteilt Supabase keine Grants mehr automatisch
-- (config.toml) - deshalb explizit. anon bekommt nichts: ohne Konto gibt es
-- keine Favoriten, und localStorage ist fuer fachliche Daten verboten.
grant select, insert, update, delete on public.exercise_favorites to authenticated;
grant select, insert, update, delete on public.exercise_favorites to service_role;

comment on table public.exercise_favorites is
  'Mit einem Stern markierte Sequenzen, je Person. Gilt fuer redaktionelle wie '
  'fuer selbst gebaute Sequenzen.';

-- ============================================================
-- 2. Playlist-Links (Spotify / Apple Music)
-- ============================================================
-- Musik bringt der Nutzer in seiner eigenen App mit (CLAUDE.md §Verboten:
-- keine Audiodateien fuer Musik). Was hier dazukommt, ist deshalb kein Ton,
-- sondern eine Adresse: ein Verweis auf eine Playlist, die der Nutzer in
-- Spotify oder Apple Music startet und die dort parallel zur Sequenz laeuft.
-- Die App spielt sie nicht ab und kann sie auch nicht steuern - sie oeffnet
-- den Link, mehr nicht.
--
-- Zwei Spalten statt einer generischen (provider, url): die beiden Dienste
-- sind fest, jeder Nutzer hat in aller Regel genau einen davon, und die
-- Oberflaeche zeigt beide Knoepfe nebeneinander. Eine Zuordnungstabelle
-- braeuchte eigene RLS, eigene Grants und eigene Missbrauchstests fuer
-- nichts, was zwei Spalten nicht koennen ("Wartungsarmut schlaegt Eleganz").
alter table public.exercises
  add column if not exists spotify_url     text,
  add column if not exists apple_music_url text;

-- WARUM DIE PRUEFUNG AUCH IN DER DATENBANK STEHT
-- ----------------------------------------------
-- Redaktionelle Sequenzen werden im Supabase Studio gepflegt, also ohne
-- Formularvalidierung (SAD §2.4) - dieselbe Ueberlegung wie beim Enum fuer den
-- Atemweg in 0016. Und eine Adresse aus der Datenbank landet am Ende in
-- Linking.openURL: ein dort eingetragenes "javascript:..." liefe im Kontext
-- der eigenen Seite. src/lib/externalLink.ts faengt das am Client ab, hier
-- kommt es gar nicht erst hinein.
--
-- Die Einschraenkung auf genau diese Hosts ist Absicht: erlaubt ist, was zu
-- den beiden Knoepfen passt, nicht "irgendeine https-Adresse".
alter table public.exercises
  add constraint chk_spotify_url check (
    spotify_url is null
    or (spotify_url ~ '^https://(open\.spotify\.com|spotify\.link)/'
        and spotify_url !~ '\s'
        and length(spotify_url) <= 500)
  );

alter table public.exercises
  add constraint chk_apple_music_url check (
    apple_music_url is null
    or (apple_music_url ~ '^https://music\.apple\.com/'
        and apple_music_url !~ '\s'
        and length(apple_music_url) <= 500)
  );

comment on column public.exercises.spotify_url is
  'Spotify-Playlist, die zur Sequenz passt. Wird nur geoeffnet, nie abgespielt.';
comment on column public.exercises.apple_music_url is
  'Apple-Music-Playlist, die zur Sequenz passt. Wird nur geoeffnet, nie abgespielt.';

-- ============================================================
-- 3. save_exercise kennt jetzt die beiden Adressen
-- ============================================================
-- Additiv geloest: die neue Fassung hat eine EIGENE Signatur (sechs
-- Parameter), die alte bleibt stehen und ruft sie auf. Damit laeuft eine noch
-- ausgelieferte App-Version, die nur vier Parameter kennt, unveraendert
-- weiter - genau das verlangt CLAUDE.md, weil Datenbank und App gleichzeitig
-- starten und die Reihenfolge nicht erzwingbar ist.
--
-- Bewusst keine Default-Werte an der neuen Fassung: mit Defaults waere ein
-- Aufruf mit vier Argumenten mehrdeutig und Postgres wiese ihn zurueck.
--
-- SICHERHEIT: WEITERHIN *SECURITY INVOKER*
-- ----------------------------------------
-- Das ist die eine Zeile, die nicht angefasst werden darf (Begruendung in
-- Migration 0009): die Bezahlschranke ist die INSERT-Policy auf exercises,
-- nicht diese Funktion. Ein "security definer" wuerde sie umgehen.
create or replace function public.save_exercise(
  p_exercise_id     uuid,      -- null = neue Sequenz
  p_title           text,
  p_subtitle        text,
  p_steps           jsonb,
  p_spotify_url     text,
  p_apple_music_url text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exercise_id uuid;
  v_step        jsonb;
  v_step_id     uuid;
  v_phase       jsonb;
  v_step_pos    int := 0;
  v_phase_pos   int;
  v_rounds      int;
  v_spotify     text := nullif(btrim(coalesce(p_spotify_url, '')), '');
  v_apple       text := nullif(btrim(coalesce(p_apple_music_url, '')), '');
begin
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Die Sequenz braucht einen Titel';
  end if;

  if p_steps is null or jsonb_array_length(p_steps) = 0 then
    raise exception 'Die Sequenz braucht mindestens einen Block';
  end if;

  -- Wie in 0009: bei mehreren Bloecken gibt es keine eine Rundenzahl, der Wert
  -- des ersten Blocks ist die sinnvollste Auskunft.
  v_rounds := coalesce((p_steps -> 0 ->> 'repeat_count')::int, 1);

  if p_exercise_id is null then
    insert into public.exercises (
      owner_id, type, playback_mode, visibility, is_published,
      title, subtitle, default_round_count, spotify_url, apple_music_url
    ) values (
      auth.uid(), 'paced', 'timer', 'plus', false,
      btrim(p_title), nullif(btrim(coalesce(p_subtitle, '')), ''), v_rounds,
      v_spotify, v_apple
    )
    returning id into v_exercise_id;
  else
    update public.exercises
       set title               = btrim(p_title),
           subtitle            = nullif(btrim(coalesce(p_subtitle, '')), ''),
           default_round_count = v_rounds,
           spotify_url         = v_spotify,
           apple_music_url     = v_apple
     where id = p_exercise_id
       and owner_id = auth.uid()
    returning id into v_exercise_id;

    if v_exercise_id is null then
      raise exception 'Diese Sequenz laesst sich nicht speichern';
    end if;

    delete from public.exercise_steps where exercise_id = v_exercise_id;
  end if;

  for v_step in select * from jsonb_array_elements(p_steps)
  loop
    v_step_pos := v_step_pos + 1;

    insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
    values (
      v_exercise_id,
      v_step_pos,
      nullif(btrim(coalesce(v_step ->> 'label', '')), ''),
      coalesce((v_step ->> 'repeat_count')::int, 1),
      coalesce((v_step ->> 'rest_seconds')::numeric, 0)
    )
    returning id into v_step_id;

    v_phase_pos := 0;
    for v_phase in select * from jsonb_array_elements(coalesce(v_step -> 'phases', '[]'::jsonb))
    loop
      v_phase_pos := v_phase_pos + 1;
      insert into public.exercise_phases (step_id, position, kind, duration_seconds, cue_text)
      values (
        v_step_id,
        v_phase_pos,
        (v_phase ->> 'kind')::public.phase_kind,
        coalesce((v_phase ->> 'duration_seconds')::numeric, 0),
        nullif(btrim(coalesce(v_phase ->> 'cue_text', '')), '')
      );
    end loop;

    if v_phase_pos = 0 then
      raise exception 'Block % hat keine Phase', v_step_pos;
    end if;
  end loop;

  return v_exercise_id;
end $$;

grant execute on function public.save_exercise(uuid, text, text, jsonb, text, text) to authenticated;

comment on function public.save_exercise(uuid, text, text, jsonb, text, text) is
  'Legt eine eigene Sequenz an oder ersetzt ihre Bloecke - in einer Transaktion, '
  'jetzt mitsamt den beiden Playlist-Adressen. security invoker: die '
  'Bezahlschranke bleibt die INSERT-Policy auf exercises.';

-- Die alte Fassung bleibt erreichbar und traegt keine eigene Logik mehr. Eine
-- bestehende Sequenz verliert dadurch ihre Playlists NICHT: sie wuerde sie
-- verlieren, wenn hier null durchgereicht wuerde - deshalb liest der Aufruf
-- die vorhandenen Werte und schreibt sie zurueck.
create or replace function public.save_exercise(
  p_exercise_id uuid,
  p_title       text,
  p_subtitle    text,
  p_steps       jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.save_exercise(
    p_exercise_id,
    p_title,
    p_subtitle,
    p_steps,
    (select e.spotify_url     from public.exercises e where e.id = p_exercise_id),
    (select e.apple_music_url from public.exercises e where e.id = p_exercise_id)
  );
$$;

comment on function public.save_exercise(uuid, text, text, jsonb) is
  'Alte Fassung ohne Playlist-Adressen. Reicht an die sechsstellige Fassung '
  'weiter und erhaelt dabei die bereits hinterlegten Adressen - damit eine '
  'noch ausgelieferte App-Version nichts ueberschreibt, was sie nicht kennt.';
