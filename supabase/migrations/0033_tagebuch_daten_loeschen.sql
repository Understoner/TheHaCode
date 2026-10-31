-- 0033: Alle Tagebuch-Daten auf Wunsch loeschen (31.10.2026).
--
-- Entscheidung des Users vom 31.10.2026 (Verarbeitungsverzeichnis Abschnitt 7,
-- Punkt 1): Wer die Einwilligung health_data widerruft, bekommt angeboten,
-- alles aus dem Tagebuch sofort zu loeschen (Art. 17 Abs. 1 lit. b DSGVO).
-- Wer ablehnt, behaelt seine Daten wie bisher und kann sie weiter ansehen,
-- exportieren und einzeln loeschen.
--
-- Warum eine Funktion und kein Loeschen vom Client aus: eigene Habits haben
-- bewusst kein Hard-Delete fuer Nutzer (0024, geloescht wird ueber
-- deleted_at). Fuer genau diesen einen Fall - alles weg, auf ausdruecklichen
-- Wunsch - braucht es eine Stelle, die das darf. Sie loescht ausschliesslich
-- Zeilen von auth.uid() und nimmt keinen Parameter, ueber den sich eine
-- fremde ID einschleusen liesse.
--
-- Geloescht wird:
--   * habit_logs       - die Eintraege (Gesundheitsdaten)
--   * user_habits      - die Auswahl samt Zielwerten
--   * habit_favorites  - die Habit-Favoriten
--   * habit_templates  - die eigenen Habits (owner_id), auch die schon
--                        "geloeschten" mit deleted_at
-- Nicht geloescht wird: das Uebungsprotokoll (exercise_sessions, kein
-- Gesundheitsdatum, Art. 6 Abs. 1 lit. b), die Einstellungen im Profil und
-- der Nachweis der Einwilligung selbst (user_consents, Art. 7 Abs. 1).
--
-- Additiv (SAD §2.6): nur eine neue Funktion. Die alte App kennt sie nicht
-- und braucht sie nicht.

create or replace function public.delete_my_diary_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  -- Reihenfolge wegen der Fremdschluessel: Eintraege haengen an der Auswahl,
  -- die Auswahl an der Vorlage (on delete no action, 0024).
  delete from public.habit_logs      where user_id  = v_uid;
  delete from public.user_habits     where user_id  = v_uid;
  delete from public.habit_favorites where user_id  = v_uid;
  delete from public.habit_templates where owner_id = v_uid;
end $$;

revoke execute on function public.delete_my_diary_data() from public, anon;
grant execute on function public.delete_my_diary_data() to authenticated;

comment on function public.delete_my_diary_data() is
  'Loescht alle Tagebuch-Daten der angemeldeten Person (Eintraege, Auswahl, '
  'Habit-Favoriten, eigene Habits). Angeboten beim Widerruf von health_data.';
