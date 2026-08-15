-- ---------- Eigene Sequenzen speichern (SAD §3.4) ----------
-- Rein additiv (CLAUDE.md §Migrationen): eine neue Funktion, kein Schema
-- angefasst, keine Policy geaendert. Die alte App-Version laeuft unveraendert
-- weiter, sie ruft die Funktion schlicht nicht auf.
--
-- WARUM EINE FUNKTION UND NICHT DREI AUFRUFE VOM CLIENT
-- -----------------------------------------------------
-- Eine Sequenz steht in drei Tabellen: exercises -> exercise_steps ->
-- exercise_phases. Ueber PostgREST waeren das drei Aufrufe ohne gemeinsame
-- Transaktion. Bricht der zweite ab, bleibt eine Uebung ohne Bloecke stehen -
-- sie taucht in der Liste des Nutzers auf, laesst sich oeffnen und spielt
-- nichts. Genau die Sorte stiller Datenfehler, die man spaeter von Hand
-- aufraeumt. Hier ist es ein Aufruf, eine Transaktion, ganz oder gar nicht.
--
-- SICHERHEIT: DIESE FUNKTION IST BEWUSST *SECURITY INVOKER*
-- ---------------------------------------------------------
-- Das ist der Vorgabewert und steht hier trotzdem ausgeschrieben, weil es der
-- entscheidende Punkt ist: die Funktion laeuft mit den Rechten des Aufrufers,
-- nicht ihres Eigentuemers. Damit greifen alle Policies aus 0007 unveraendert
-- weiter, insbesondere
--
--   exercises_insert_own  ... with check (owner_id = auth.uid()
--                                         and public.has_plus_access() ...)
--
-- Die Paywall sitzt also weiterhin genau dort, wo CLAUDE.md sie verlangt - am
-- INSERT in exercises - und nicht in dieser Funktion. Wer kein Plus hat,
-- scheitert hier an derselben Policy wie bei einem direkten Aufruf. Die
-- Funktion verschafft niemandem ein Recht, das er nicht ohnehin haette; sie
-- fasst nur zusammen, was sonst drei Aufrufe waeren.
--
-- Ein "security definer" waere hier ein Rechteloch: er wuerde die Policy
-- umgehen und die Bezahlschranke aushebeln. Falls jemand diese Funktion
-- spaeter umbaut: das ist die eine Zeile, die nicht angefasst werden darf.
--
-- Aufbau von p_steps:
--   [{ "label": "Aufwaermen"|null,
--      "repeat_count": 8,
--      "rest_seconds": 30,
--      "phases": [{ "kind": "inhale", "duration_seconds": 4,
--                   "cue_text": "durch die Nase"|null }, ...] }, ...]
--
-- Die inhaltliche Pruefung uebernehmen die Constraints aus 0007 (Dauer >= 0,
-- repeat_count 1..200, phase_kind als Enum) und der Mengen-Trigger
-- check_exercise_quota. Bewusst nicht hier noch einmal: zwei Orte fuer
-- dieselbe Regel laufen frueher oder spaeter auseinander.
create or replace function public.save_exercise(
  p_exercise_id uuid,      -- null = neue Sequenz
  p_title       text,
  p_subtitle    text,
  p_steps       jsonb
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
begin
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Die Sequenz braucht einen Titel';
  end if;

  if p_steps is null or jsonb_array_length(p_steps) = 0 then
    raise exception 'Die Sequenz braucht mindestens einen Block';
  end if;

  -- default_round_count ist fuer type = 'paced' Pflicht (chk_paced_needs_rounds
  -- aus 0007). Bei mehreren Bloecken gibt es keine eine Rundenzahl - der Wert
  -- des ersten Blocks ist die sinnvollste Auskunft und wird ohnehin nur
  -- angezeigt, gerechnet wird immer ueber die Bloecke selbst.
  v_rounds := coalesce((p_steps -> 0 ->> 'repeat_count')::int, 1);

  if p_exercise_id is null then
    insert into public.exercises (
      owner_id, type, playback_mode, visibility, is_published,
      title, subtitle, default_round_count
    ) values (
      auth.uid(), 'paced', 'timer', 'plus', false,
      btrim(p_title), nullif(btrim(coalesce(p_subtitle, '')), ''), v_rounds
    )
    returning id into v_exercise_id;
  else
    update public.exercises
       set title               = btrim(p_title),
           subtitle            = nullif(btrim(coalesce(p_subtitle, '')), ''),
           default_round_count = v_rounds
     where id = p_exercise_id
       and owner_id = auth.uid()
    returning id into v_exercise_id;

    -- Kein Treffer heisst: fremde Sequenz, geloescht, oder kein Plus mehr
    -- (exercises_update_own verlangt has_plus_access). Fuer den Aufrufer ist
    -- der Unterschied ohne Belang - und ohne Unterscheidung laesst sich hier
    -- auch nicht durchprobieren, welche IDs es gibt.
    if v_exercise_id is null then
      raise exception 'Diese Sequenz laesst sich nicht speichern';
    end if;

    -- Bloecke werden ersetzt statt abgeglichen. Ein Abgleich muesste
    -- Verschieben, Einfuegen und Loeschen einzeln aufloesen; das Ersetzen ist
    -- eine Zeile und liefert dasselbe Ergebnis. Die Phasen haengen per
    -- cascade an den Bloecken und verschwinden mit.
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

-- Nur Angemeldete duerfen die Funktion ueberhaupt aufrufen. Was sie danach
-- darf, entscheiden allein die Policies aus 0007.
grant execute on function public.save_exercise(uuid, text, text, jsonb) to authenticated;

comment on function public.save_exercise(uuid, text, text, jsonb) is
  'Legt eine eigene Sequenz an oder ersetzt ihre Bloecke - in einer Transaktion. '
  'security invoker: die Bezahlschranke bleibt die INSERT-Policy auf exercises.';
