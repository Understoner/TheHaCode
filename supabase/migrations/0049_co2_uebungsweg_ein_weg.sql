-- 0049: Der Uebungsweg CO2-Toleranz ist EIN Weg mit Steigerung (06.11.2026).
--
-- Korrektur des Users an 0048: statt drei Vorlagen je Stufe eine einzige:
-- Woche 1 Anfaenger, Woche 2 und 3 Fortgeschritten, Woche 4 Expert. BOLT-Wert
-- und CO2 Walk bleiben taeglich.
--
-- Eine Vorlage plant Tage relativ zum Start, Tag 0 ist der erste. Das Tagebuch
-- kannte bisher keine geplanten Tage: jedes gewaehlte Habit stand jeden Tag da,
-- hier also taeglich alle sechs Sessions. Deshalb planned_days_only. Damit
-- erscheint ein Habit, das in einer Challenge steckt, nur an seinen Terminen
-- (src/features/habits/plannedDays.ts). Ohne Termine, also von Hand gewaehlt,
-- steht es weiter jeden Tag da. Bewusst ein Schalter und keine neue Regel fuer
-- alle: "Morgentraining" in einer Challenge soll sonst nicht verschwinden.
--
-- Die Beschreibung einer Vorlage (bis 2000 Zeichen) wird beim Start in die
-- Challenge kopiert, die bisher nur 500 fasste. Die Grenze wird angeglichen.
--
-- Additiv (SAD §2.6): Die neue Spalte hat ein Default, die weitere Grenze lehnt
-- nichts ab, was vorher ging, und die drei alten Vorlagen werden nur
-- zurueckgezogen. Bereits gestartete Challenges bleiben unberuehrt.

-- ===================================================================
-- 1. Habits nur an geplanten Tagen
-- ===================================================================
alter table public.habit_templates
  add column if not exists planned_days_only boolean not null default false;

comment on column public.habit_templates.planned_days_only is
  'Steckt das Habit in einer Challenge, erscheint es im Tagebuch nur an seinen Terminen (0049). Nur Redaktion, kein Grant an authenticated.';

update public.habit_templates
   set planned_days_only = true
 where owner_id is null
   and slug in (
     'co2-ausatmung-anfaenger', 'co2-ausatmung-fortgeschritten', 'co2-ausatmung-expert',
     'co2-halten-anfaenger', 'co2-halten-fortgeschritten', 'co2-halten-expert'
   );

-- ===================================================================
-- 2. Laengere Beschreibung einer Challenge
-- ===================================================================
alter table public.challenges
  drop constraint if exists challenges_description_md_check;
alter table public.challenges
  add constraint challenges_description_md_check
  check (description_md is null or length(description_md) <= 2000);

-- ===================================================================
-- 3. Ein Uebungsweg statt drei
-- ===================================================================
update public.challenge_templates
   set is_published = false
 where slug in ('co2-toleranz-anfaenger', 'co2-toleranz-fortgeschritten', 'co2-toleranz-expert');

insert into public.challenge_templates (slug, title, description_md, duration_days, is_preview, is_published, sort_order)
values (
  'co2-toleranz-28',
  '28 Tage CO2-Toleranz',
  $text$28 Tage Training für deine CO2-Toleranz, das sich Schritt für Schritt steigert: in der ersten Woche die Anfänger-Sessions, in der zweiten und dritten Woche Fortgeschritten, in der letzten Woche Expert.

Was dir das bringt: Dein Atemreiz wird vor allem vom Kohlendioxid ausgelöst. Wer empfindlich darauf reagiert, atmet oft schneller und mehr, als der Körper gerade braucht. Mit einer höheren Toleranz springt dieser Alarm später an. Dein Atem kann dadurch ruhiger werden, auch unter Stress, und das wirkt auf den ganzen Körper: Wer weniger zu viel atmet, atmet auch weniger CO2 ab. Das hilft dem Blut, Sauerstoff ans Gewebe abzugeben, und hält die Blutgefäße im Gehirn weit. Spürbar werden kann das als mehr innere Ruhe, klarerer Kopf und weniger Atemnot bei Belastung. Langzeitstudien dazu fehlen noch, und die Übungen ersetzen keine Behandlung.

So läuft jeder Tag: Am Morgen zuerst den BOLT-Wert ermitteln, danach eine CO2 Toleranz Session mit langer Ausatmung. Zu Mittag der CO2 Walk. Am Abend eine CO2 Toleranz Session mit langem Halten. Die Sessions dauern rund 15 Minuten.

Du bleibst dabei immer im Wohlgefühl: Wird es zu viel, atme einfach einmal im eigenen Rhythmus und steig wieder ein, wann immer du dazu bereit bist.$text$,
  28, false, true, 20
)
on conflict (slug) do nothing;

insert into public.challenge_template_items (template_id, habit_template_id, plan, sort_order)
select t.id, h.id, v.plan::jsonb, v.sort_order
  from (values
    ('bolt-wert',                     '{"daily": true}', 1),
    ('co2-ausatmung-anfaenger',       '{"days": [0,1,2,3,4,5,6]}', 2),
    ('co2-ausatmung-fortgeschritten', '{"days": [7,8,9,10,11,12,13,14,15,16,17,18,19,20]}', 3),
    ('co2-ausatmung-expert',          '{"days": [21,22,23,24,25,26,27]}', 4),
    ('co2-walk',                      '{"daily": true}', 5),
    ('co2-halten-anfaenger',          '{"days": [0,1,2,3,4,5,6]}', 6),
    ('co2-halten-fortgeschritten',    '{"days": [7,8,9,10,11,12,13,14,15,16,17,18,19,20]}', 7),
    ('co2-halten-expert',             '{"days": [21,22,23,24,25,26,27]}', 8)
  ) as v(habit_slug, plan, sort_order)
  join public.challenge_templates t on t.slug = 'co2-toleranz-28'
  join public.habit_templates h on h.slug = v.habit_slug and h.owner_id is null
on conflict (template_id, habit_template_id) do nothing;

-- ===================================================================
-- 4. Der News-Beitrag beschreibt den einen Weg
-- ===================================================================
update public.news_posts
   set body_md = replace(
     body_md,
     'gebaut, in drei Stufen: Anfänger, Fortgeschritten und Expert.',
     'gebaut. Er steigert sich mit dir: in der ersten Woche die Anfänger-Sessions, in der zweiten und dritten Woche Fortgeschritten, in der letzten Woche Expert.'
   )
 where slug = 'co2-toleranz';
