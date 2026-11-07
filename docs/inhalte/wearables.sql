-- docs/inhalte/wearables.sql
--
-- Zwei neue Lebensstil-Habits fuer die Geraete-Anbindung (Migration 0053,
-- 07.11.2026). Inhalt, kein Schema: laeuft im SQL Editor von STAGING (oder
-- lokal per psql) - NICHT auf Live, solange die Anbindung dort aus ist
-- (docs/WEARABLES.md).
--
-- Beide Habits lassen sich auch von Hand fuehren. Mit Garmin fuellt sie die
-- App selbst; Oura liefert Intensitaetsminuten, aber keine Etagen.
-- Plus wie "Schritte" (is_preview = false).
--
-- Ruecknahme: unten der auskommentierte Block - zurueckziehen statt loeschen,
-- damit Eintraege, die schon jemand hat, erhalten bleiben.

insert into public.habit_templates (
  slug, category_id, title, description_md, tracking_type,
  unit, min_value, max_value, step_value, default_target, higher_is_better,
  points, points_from, is_negative, is_preview, sort_order, is_published, wearable_metric
)
select v.slug, c.id, v.title, v.description_md, 'number',
       v.unit, 0, v.max_value, 1, v.default_target, true,
       v.points, v.points_from, false, false, v.sort_order, true, v.wearable_metric
  from (values
    ('etagen', 'Etagen gestiegen',
     'Wie viele Stockwerke du heute zu Fuß hinaufgegangen bist – eine Etage sind rund drei Höhenmeter. Treppensteigen ist kurze, kräftige Belastung für Beine und Herz und lässt sich in jeden Alltag einbauen: Treppe statt Lift, eine Station früher aussteigen, der Weg über die Brücke. Ab zehn Etagen bekommst du die Punkte. Mit einer Garmin-Uhr trägt die App den Wert selbst ein.',
     'Etagen', 300, 10, 4, 10, 18, 'floors'),
    ('intensitaetsminuten', 'Intensitätsminuten',
     'Minuten, in denen du dich mindestens mäßig anstrengst – so, dass du schneller atmest, aber noch sprechen kannst. Intensive Minuten, in denen du kaum noch sprechen kannst, zählen doppelt. Die WHO empfiehlt 150 Minuten pro Woche, also gut 20 am Tag. Ab 22 Minuten bekommst du die Punkte. Mit Oura oder Garmin trägt die App den Wert selbst ein; liefern beide, den Durchschnitt.',
     'Minuten', 1440, 22, 6, 22, 19, 'intensity_minutes')
  ) as v(slug, title, description_md, unit, max_value, default_target, points, points_from, sort_order, wearable_metric)
  join public.habit_categories c on c.slug = 'bewegung'
on conflict (slug) do nothing;

-- Pruefen:
-- select slug, title, unit, points, points_from, wearable_metric, is_published
--   from public.habit_templates where wearable_metric is not null order by sort_order;

-- Ruecknahme (nur bei Bedarf):
-- update public.habit_templates set is_published = false
--  where owner_id is null and slug in ('etagen', 'intensitaetsminuten');
