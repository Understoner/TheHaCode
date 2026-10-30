-- 0031: Rechte nach dem ersten Security-Scan (30.10.2026, Splinter).
--
-- Additiv im Sinne von SAD §2.6: keine Spalte, keine Tabelle aendert sich.
-- Die App nutzt keines der hier entzogenen Rechte - alte und neue App-Version
-- laufen mit diesem Schema gleich.
--
-- 1. AUSFUEHRUNGSRECHTE AN SECURITY-DEFINER-FUNKTIONEN
-- ---------------------------------------------------
-- Postgres gibt neue Funktionen PUBLIC zum Ausfuehren frei - damit auch anon,
-- ueber /rest/v1/rpc/<name>. Fuer security-definer-Funktionen heisst das: jeder
-- ohne Konto kann sie mit den Rechten ihres Eigentuemers anstossen.
--
--   * Trigger-Funktionen braucht niemand aufzurufen: Postgres prueft beim
--     Ausloesen eines Triggers kein EXECUTE-Recht. Also fuer alle entziehen.
--   * has_consent() und can_use_habit_template() stecken nur in Schreib-
--     Policies fuer Angemeldete. anon braucht sie nicht.
--   * has_plus_access() und course_seats() BLEIBEN fuer anon: die erste fragen
--     anonym lesbare Policies (news_read, exercises_read) - ohne Recht bekaeme
--     ein Besucher ohne Konto einen Fehler statt der freien Inhalte; die zweite
--     ruft die oeffentliche Kursseite. Beide verraten nur, was ohnehin
--     oeffentlich bzw. die eigene Sitzung betrifft.

revoke execute on function public.check_exercise_quota() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user_consents() from public, anon, authenticated;

revoke execute on function public.has_consent(public.consent_kind) from public, anon;
grant execute on function public.has_consent(public.consent_kind) to authenticated, service_role;

revoke execute on function public.can_use_habit_template(uuid) from public, anon;
grant execute on function public.can_use_habit_template(uuid) to authenticated, service_role;

-- 2. DER OEFFENTLICHE BUCKET LAESST SICH NICHT MEHR AUFLISTEN
-- ----------------------------------------------------------
-- public-assets ist ein oeffentlicher Bucket: Dateien kommen ueber ihre
-- oeffentliche URL (getPublicUrl), und dafuer braucht es keine Policy. Die
-- breite Lese-Policy aus 0004 erlaubte darueber hinaus, ALLE Dateinamen
-- aufzulisten - auch Bilder, die noch nirgends verlinkt sind. Die App listet
-- nie. Auflisten duerfen kuenftig nur Admins (Pflege ueber die App oder
-- Studio).

drop policy if exists public_assets_read on storage.objects;

create policy public_assets_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());

-- 3. KEIN using (true) MEHR BEI exercise_categories
-- ------------------------------------------------
-- 0007 gab die Kategorien mit using (true) frei - das einzige using (true) im
-- Schema, und CLAUDE.md verbietet es. Dasselbe Muster wie habit_categories:
-- eine Spalte is_published (Vorgabe true, alle bestehenden Kategorien bleiben
-- sichtbar) und Lesen nur, was veroeffentlicht ist. Admins sehen ueber
-- exercise_categories_admin_write (for all) weiterhin alles.

alter table public.exercise_categories
  add column if not exists is_published boolean not null default true;

drop policy if exists exercise_categories_read on public.exercise_categories;

create policy exercise_categories_read_published on public.exercise_categories
  for select using (is_published);
