-- 0039: Tageszeit an der Habit-Vorlage (02.11.2026).
--
-- Der Vorschlag "Mondlicht Mobile" (02.11.2026, nur Testsystem) gruppiert das
-- Tagebuch nach Tageszeit: Morgens, Tagsueber, Abends. Bisher wusste keine
-- Vorlage, wann am Tag sie dran ist - dafuer diese eine Spalte.
--
-- NULL heisst "irgendwann am Tag" und landet in der Gruppe Tagsueber. Deshalb
-- setzt diese Migration nur die Vorlagen, die eindeutig an den Morgen oder an
-- den Abend gehoeren; alles andere bleibt NULL. Weitere pflegt die Redaktion
-- im Studio (nur den Wert, kein Schema). Eigene Habits bleiben NULL.
--
-- Additiv (SAD §2.6): eine nullable Spalte. Die alte App liest sie nicht,
-- die neue kommt ohne gesetzten Wert aus.

alter table public.habit_templates
  add column if not exists day_part text
    constraint chk_habit_day_part check (day_part in ('morgens', 'tagsueber', 'abends'));

comment on column public.habit_templates.day_part is
  'Wann am Tag das Habit dran ist: morgens, tagsueber, abends. NULL = irgendwann, zaehlt als tagsueber (0039).';

-- Eindeutige Faelle der Redaktion. Per Slug, damit es in Staging und Live
-- dieselben Zeilen trifft; eine Vorlage, die es dort nicht gibt, bleibt
-- einfach unberuehrt.
update public.habit_templates
   set day_part = 'morgens'
 where owner_id is null
   and day_part is null
   and slug in ('bolt-wert', 'morgenlicht', 'schlafdauer', 'schlafqualitaet-wearable');

update public.habit_templates
   set day_part = 'abends'
 where owner_id is null
   and day_part is null
   and slug in (
     'atmen-zum-einschlafen',
     'feste-schlafenszeit',
     'schlafzimmer-kuehl-dunkel',
     'abendroutine',
     'alkohol-vor-dem-schlaf',
     'handy-im-bett',
     'drei-stunden-vor-dem-schlaf',
     'arbeit-beendet',
     'dankbarkeit'
   );
