-- 0023: Einwilligung Atem-Tagebuch (health_data v1) veroeffentlichen.
--
-- Wortlaut unveraendert aus 0021, vom Team am 25.10.2026 freigegeben -
-- zusammen mit der Datenschutzerklaerung in der Fassung vom 25.10.2026
-- (privacy v2, 0022), auf die er verweist.
--
-- Veroeffentlicht wird beim Einspielen: auf Staging mit dem Merge, auf Live
-- mit der Befoerderung. Ab dann haelt der Trigger aus 0022 den Wortlaut fest;
-- eine Korrektur waere health_data v2.
--
-- "published_at is null": wurde die Fassung in einer Umgebung schon von Hand
-- im Studio veroeffentlicht (docs/INHALTE.md, alter Weg), bleibt es bei
-- diesem Zeitpunkt - der Trigger wuerde eine Aenderung ohnehin ablehnen.
update public.consent_definitions
   set published_at = now()
 where kind = 'health_data'
   and version = 1
   and locale = 'de'
   and published_at is null;
