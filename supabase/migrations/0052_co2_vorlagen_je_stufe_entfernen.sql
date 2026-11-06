-- 0052: Die drei Vorlagen je Stufe aus 0048 entfernen (06.11.2026).
--
-- Vorgabe des Users: Bei den Uebungswegen bleiben nur "28 Tage CO2-Toleranz" und
-- "21 Tage Atem & Kraft". 0049 hatte die drei nur zurueckgezogen; ein Admin darf
-- aber auch Zurueckgezogenes lesen (challenge_templates_admin_write gilt "for
-- all") und sah sie deshalb weiter. Die App filtert jetzt zusaetzlich.
--
-- Bewusstes Loeschen von Inhalt, kein Schema (SAD §2.6 unberuehrt): Ihre Eintraege
-- in challenge_template_items gehen per cascade mit. Bereits gestartete Challenges
-- bleiben, ihre template_id wird per "on delete set null" leer. Die alte App
-- kommt damit zurecht: Sie zeigt schlicht zwei Vorlagen.

delete from public.challenge_templates
 where slug in ('co2-toleranz-anfaenger', 'co2-toleranz-fortgeschritten', 'co2-toleranz-expert');
