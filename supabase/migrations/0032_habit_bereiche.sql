-- 0032: Habit-Bereiche je Person (30.10.2026).
--
-- TheHaCode ist eine Atem-App. Neue Konten sehen im Tagebuch deshalb zuerst
-- nur den Bereich Atmung; weitere Bereiche (Ernaehrung, Schlaf, ...) schaltet
-- man in den Einstellungen des Tagebuchs dazu. Gezeigt wird nur, was
-- eingeschaltet ist - in der Auswahl wie im Tagebuch.
--
-- Gespeichert werden die Slugs der Kategorien, nicht ihre IDs: Slugs sind
-- lesbar und stabil, und ein Bereich, den die Redaktion spaeter neu anlegt,
-- bleibt einfach aus, bis man ihn einschaltet.
--
-- BESTEHENDE KONTEN: NULL heisst "alle Bereiche". Wer heute schon Habits aus
-- Ernaehrung oder Schlaf fuehrt, soll nach dem Update nichts vermissen. Erst
-- danach wird die Vorgabe {atmung} gesetzt - sie gilt damit nur fuer Profile,
-- die ab jetzt entstehen (handle_new_user legt sie an).
--
-- Additiv (SAD §2.6): neue Spalte, nullable, die alte App-Version kennt sie
-- nicht und braucht sie nicht. Geschrieben wird sie ueber die bestehende
-- Policy profiles_update_own (nur die eigene Zeile).

alter table public.profiles
  add column if not exists habit_categories text[];

alter table public.profiles
  alter column habit_categories set default '{atmung}';

-- Nur Slugs (Kleinbuchstaben, Ziffern, Bindestrich), hoechstens 20 - mehr
-- Kategorien gibt es nicht, und mehr soll hier auch niemand ablegen koennen.
alter table public.profiles
  add constraint profiles_habit_categories_valid check (
    habit_categories is null
    or (
      cardinality(habit_categories) <= 20
      and array_to_string(habit_categories, ',') ~ '^([a-z0-9-]+(,[a-z0-9-]+)*)?$'
    )
  );

comment on column public.profiles.habit_categories is
  'Eingeschaltete Habit-Bereiche (Slugs aus habit_categories). NULL = alle (Konten vor 0032), Vorgabe fuer neue Konten {atmung}.';
