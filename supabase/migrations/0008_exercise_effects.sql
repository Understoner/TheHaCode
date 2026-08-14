-- ---------- Wirkeffekte je Uebung ----------
-- Additiv (CLAUDE.md §Migrationen): neuer Typ, neue Spalte mit Default, keine
-- bestehende angefasst. Alte und neue App-Version laufen beide mit diesem
-- Schema - die alte ignoriert die Spalte schlicht.
--
-- Warum ein Array und keine Zuordnungstabelle:
-- Eine Uebung kann mehrere Effekte tragen, das waere klassisch eine
-- n:m-Tabelle. Dagegen sprechen hier drei Dinge. Die Werteliste ist fest und
-- kurz (vier Stueck, redaktionell nicht erweiterbar - dafuer gaebe es sonst
-- eine eigene Pflegemaske). Eine zusaetzliche Tabelle braeuchte eigene RLS,
-- eigene Grants und eigene Missbrauchstests, ohne dass sie etwas traegt, was
-- die Spalte nicht kann. Und im Studio ist ein Array-Feld an der Uebung
-- selbst zu pflegen, waehrend eine Zuordnungstabelle einen zweiten
-- Arbeitsschritt mit Fremdschluessel-Tipparbeit bedeutet.
-- "Wartungsarmut schlaegt Eleganz" (CLAUDE.md) - genau dieser Fall.
--
-- Kommt spaeter eine frei pflegbare Effektliste dazu, ist der Weg dorthin
-- additiv: neue Tabelle anlegen, doppelt schreiben, Lesen umstellen, Spalte
-- im uebernaechsten Release entfernen.
create type exercise_effect as enum (
  'co2_toleranz',
  'entspannend',
  'aktivierend',
  'stressreduktion'
);

alter table public.exercises
  add column effects exercise_effect[] not null default '{}';

-- Filtern nach Effekt laeuft ueber den Enthaelt-Operator (PostgREST: "cs").
-- Ohne GIN-Index waere das ein Full Scan - bei vier Uebungen egal, bei
-- vierhundert nicht.
create index idx_exercises_effects on public.exercises using gin (effects);

comment on column public.exercises.effects is
  'Wirkeffekte der Uebung, mehrere moeglich. Im Studio als Array pflegen, z. B. {entspannend,stressreduktion}.';
