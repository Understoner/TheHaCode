-- docs/inhalte/challenges.sql
--
-- Beispiel-Vorlage fuer Challenges (Migration 0036). Inhalt, kein Schema:
-- laeuft im SQL Editor von Staging bzw. Live (oder lokal per psql) und legt
-- die Vorlage UNVEROEFFENTLICHT an. Veroeffentlichen in Supabase Studio:
-- challenge_templates -> is_published = true. Kostenlos zum Ausprobieren:
-- is_preview = true - dann muessen ALLE Habits der Vorlage ebenfalls
-- Vorschau-Habits sein (habit_templates.is_preview), sonst scheitert der
-- Start ohne Plus am ersten Plus-Habit.
--
-- Der Plan eines Habits ist relativ zum Starttag (Tag 0):
--   {"daily": true}                          jeden Tag
--   {"weekdays": [1, 3, 5]}                  Mo, Mi, Fr (1 = Montag ... 7 = Sonntag)
--   {"days": [0, 7, 14]}                     am Start, nach einer und nach zwei Wochen
--   {"blocks": [{"start": 14, "length": 3}]} ab Tag 14 drei Tage am Stueck,
--                                            einmal am Ende abgehakt
-- Die Schluessel lassen sich kombinieren. Wochentage richten sich nach dem
-- Kalender, nicht nach dem Starttag.

insert into public.challenge_templates (slug, title, description_md, duration_days, is_preview, is_published, sort_order)
values (
  'atem-und-kraft-21',
  '21 Tage Atem & Kraft',
  'Drei Wochen, die sich im Alltag unterbringen lassen: jeden Tag drei kurze Atempausen, dreimal pro Woche das Morgentraining, einmal pro Woche Fokus vor konzentrierter Arbeit – und zum Schluss drei Tage Fasten. Trag dazu jeden Morgen ein, wie lange du geschlafen hast.',
  21, false, false, 10
)
on conflict (slug) do nothing;

insert into public.challenge_template_items (template_id, habit_template_id, plan, sort_order)
select t.id, h.id, v.plan::jsonb, v.sort_order
  from (values
    ('atempause',     '{"daily": true}',                          1),
    ('beine-schwer',  '{"weekdays": [1, 3, 5]}',                  2),
    ('fokus',         '{"days": [0, 7, 14]}',                     3),
    ('schlafdauer',   '{"daily": true}',                          4),
    ('fasten-3-tage', '{"blocks": [{"start": 17, "length": 3}]}', 5)
  ) as v(habit_slug, plan, sort_order)
  join public.challenge_templates t on t.slug = 'atem-und-kraft-21'
  join public.habit_templates h on h.slug = v.habit_slug and h.owner_id is null
on conflict (template_id, habit_template_id) do nothing;
