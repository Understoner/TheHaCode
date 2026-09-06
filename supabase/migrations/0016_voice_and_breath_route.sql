-- ---------- Stimme merken, Atemweg benennen (06.09.2026) ----------
-- Zwei kleine, voneinander unabhaengige Ergaenzungen. Beide rein additiv
-- (CLAUDE.md §Migrationen): zwei neue Spalten mit Vorgabewert beziehungsweise
-- nullable, ein neuer Typ. Nichts entfernt, nichts umbenannt. Die alte
-- App-Version laeuft unveraendert weiter - sie kennt beide Spalten nicht.

-- ---------- 1. Die gesprochene Ansage, geraeteuebergreifend ----------
-- Dieselbe Ueberlegung wie bei sound_enabled (Migration 0001, Backlog T10):
-- wer die Stimme abschaltet, will sie beim naechsten Oeffnen nicht wieder
-- hoeren - und auch nicht auf dem Telefon, nur weil er sie am Rechner
-- abgeschaltet hat.
--
-- Vorgabe false und nicht true, anders als beim Ton: eine Ansage bei jedem
-- Phasenwechsel ist eine deutliche Entscheidung, keine Grundeinstellung. Wer
-- die Uebung kennt, will den Takt hoeren, nicht das Wort.
--
-- Die Lautstaerken (Ton, Stimme, Musik) bleiben bewusst draussen: sie haengen
-- an Kopfhoerer und Umgebung, nicht an der Person, und wandern deshalb nicht
-- sinnvoll aufs naechste Geraet mit.
alter table public.profiles
  add column if not exists voice_enabled boolean not null default false;

comment on column public.profiles.voice_enabled is
  'Gesprochene Phasenansagen. Vorgabe aus - anders als sound_enabled.';

-- ---------- 2. Der Atemweg je Phase ----------
-- Bisher stand der Atemweg im Fliesstext von cue_text ("Ruhig durch die Nase
-- einatmen"). Fuer eine Anleitung reicht das; auswerten laesst es sich nicht,
-- und in einer zweiten Sprache stuende es gar nicht mehr drin.
--
-- Als eigene Spalte ist der Atemweg das, was er fachlich ist: eine feste
-- Angabe aus drei Moeglichkeiten. Der Text daneben bleibt der Text.
--
-- Englische Werte wie ueberall im Schema (phase_kind heisst 'inhale', nicht
-- 'einatmen'); die deutschen Worte stehen in der Uebersetzungsdatei
-- (CLAUDE.md: keine deutschen Strings im Code).
--
-- WARUM NULLABLE
-- --------------
-- Zwei Gruende, und beide sind fachlich:
--   * Halten hat keinen Atemweg. Waehrend einer Haltephase stroemt nichts,
--     also ist dort nichts anzugeben - null heisst hier "kein Luftstrom", nicht
--     "unbekannt". Das passt zur Restorative-Breathing-Regel, Haltephasen nicht
--     zu erzwingen: gehalten wird die Ruhe, nicht die Luft.
--   * Selbst gebaute Sequenzen kennen die Angabe nicht. Der Konfigurator fragt
--     sie nicht ab, und ein Pflichtfeld haette jede bestehende Zeile gebrochen.
create type public.breath_route as enum ('nose', 'mouth', 'pursed_lips');

comment on type public.breath_route is
  'Wodurch die Luft stroemt: Nase, Mund oder Lippenbremse (dosierter '
  'Ausatemwiderstand). Deutsche Bezeichnungen stehen in der App.';

alter table public.exercise_phases
  add column if not exists route public.breath_route;

comment on column public.exercise_phases.route is
  'Atemweg dieser Phase. null bei Haltephasen - dort stroemt nichts - und bei '
  'selbst gebauten Sequenzen.';
