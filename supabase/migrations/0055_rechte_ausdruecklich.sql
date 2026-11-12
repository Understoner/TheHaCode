-- 0055: Rechte ausdruecklich festlegen (Review 11.11.2026, Befunde S2 und S11).
--
-- WORUM ES GEHT
-- -------------
-- Viele Migrationen vergeben Rechte nur ("grant select ... to authenticated")
-- und verlassen sich darauf, dass anon und authenticated VORHER nichts hatten.
-- Das stimmt nur, solange die Plattform neuen Tabellen und Funktionen keine
-- pauschalen Rechte mitgibt. Oertlich ist das so. Dass es sich aendern kann,
-- steht in .github/workflows/ci.yml: mit CLI 2.116.0 erteilte die oertliche
-- Umgebung ploetzlich wieder pauschale Rechte, und dreizehn Missbrauchstests
-- wurden stumm. Fuer Staging und Live hat es nie jemand geprueft - die
-- pgTAP-Tests und der Security-Scan laufen nur gegen die oertliche Datenbank.
--
-- Was auf dem Spiel stand, falls eine Cloud-Umgebung pauschale Rechte hat:
--
--   * reserve_course_seat(), reserve_course_seat_for_guest() und
--     reserve_course_seat_any() entziehen das Ausfuehrungsrecht nur "public".
--     Ein direktes Recht von anon bliebe stehen: jeder ohne Konto koennte
--     ueber /rest/v1/rpc Plaetze fuer beliebige Nutzer-IDs reservieren und
--     Kurse ausbuchen.
--   * user_habits, habit_templates und die Uebungswege beschraenken
--     Aenderungen ueber SPALTENrechte. Ein pauschales UPDATE auf die ganze
--     Tabelle haette sie wirkungslos gemacht - die Vorlage eines Habits liesse
--     sich tauschen und damit die Plus-Schranke umgehen (0021 nennt den Fall).
--
-- WAS DIESE MIGRATION TUT
-- -----------------------
--   1. Sie entzieht. Sie vergibt KEIN Recht, das es nicht schon gab.
--   2. Sie stellt die Spaltenrechte wieder her, die ein Entzug auf
--      Tabellenebene mitnimmt (Postgres: "revoke update on tabelle" loescht
--      auch jedes "grant update (spalte)"). Sie liest sie dafuer vorher aus
--      dem Katalog, statt sie hier noch einmal abzuschreiben - eine
--      abgeschriebene Liste waere eine zweite Wahrheit neben 0021, 0024,
--      0025, 0028, 0030, 0035 und 0036.
--   3. SIE PRUEFT SICH SELBST. Der letzte Block fragt den Katalog, ob die
--      Rechte jetzt so stehen, wie sie sollen - die verbotenen weg, die
--      noetigen noch da. Stimmt etwas nicht, bricht die Migration mit einer
--      Meldung ab, die sagt was. Damit ist die Gegenpruefung auf Staging und
--      Live, die das Review verlangt, Teil des Einspielens: laeuft
--      "supabase db push" durch, stehen die Rechte.
--
-- In einer Umgebung, in der alles schon stimmt (oertlich), aendert sie nichts
-- ausser TRUNCATE, REFERENCES und TRIGGER - siehe Abschnitt 2.
--
-- Additiv im Sinn von SAD §2.6: kein Objekt faellt weg, keine Spalte aendert
-- sich. Die App vom 07.11.2026 nutzt keines der entzogenen Rechte; geprueft
-- wurde jede Abfrage in src/ gegen die Rechte, die nach dieser Migration
-- bleiben.
--
-- FUER KUENFTIGE MIGRATIONEN (steht jetzt auch in CLAUDE.md):
--   neue Tabelle  -> "revoke all on ... from anon, authenticated" VOR den grants
--   neue Funktion -> "revoke execute ... from public, anon, authenticated",
--                    dann gezielt vergeben
-- So wie es 0045 und 0053 schon tun.

-- ---------------------------------------------------------------------------
-- 1. Funktionen der Kursreservierung: nur service_role
-- ---------------------------------------------------------------------------
-- Bisher stand hier nur "from public" (0011, 0015, 0022).

revoke execute on function
  public.reserve_course_seat(uuid, uuid, boolean, integer, uuid)
  from public, anon, authenticated;

revoke execute on function
  public.reserve_course_seat_for_guest(uuid, text, text, boolean, integer, uuid)
  from public, anon, authenticated;

revoke execute on function
  public.reserve_course_seat_any(uuid, uuid, text, text, boolean, integer, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabellen
-- ---------------------------------------------------------------------------
-- Ein Block, damit Merken, Entziehen und Wiederherstellen in jedem Fall
-- zusammen gelingen oder zusammen scheitern.

do $$
declare
  v_column_grants jsonb;
  g record;
begin
  -- 2a. Spaltenrechte von anon und authenticated merken.
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'rel', c.oid::regclass::text,
             'col', a.attname,
             'grantee', acl.grantee::regrole::text,
             'priv', acl.privilege_type)),
           '[]'::jsonb)
    into v_column_grants
    from pg_class c
    join pg_attribute a
      on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   cross join lateral aclexplode(a.attacl) acl
   where c.relnamespace = 'public'::regnamespace
     and a.attacl is not null
     and acl.grantee in ('anon'::regrole, 'authenticated'::regrole);

  -- 2b. TRUNCATE, REFERENCES, TRIGGER: braucht kein Client (Befund S11).
  -- TRUNCATE umgeht RLS. Ueber die REST-Schnittstelle ist es nicht
  -- erreichbar - ein Recht, das niemand braucht, gehoert trotzdem weg.
  revoke truncate, references, trigger
    on all tables in schema public from anon, authenticated;

  -- MAINTAIN (VACUUM, REINDEX, LOCK TABLE ...) gibt es erst ab Postgres 17.
  -- Als dynamischer Befehl, damit die Migration auf einer aelteren Version
  -- nicht an einem unbekannten Wort scheitert.
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
  end if;

  -- 2c. anon schreibt nirgends. Gastbuchungen laufen ueber die Edge Function
  -- (service_role), die Einwilligung bei der Registrierung ueber einen Trigger.
  revoke insert, update, delete on all tables in schema public from anon;

  -- 2d. anon liest keine Nutzertabelle.
  revoke select on
    public.certificates,
    public.challenge_items,
    public.challenge_slots,
    public.challenges,
    public.course_access,
    public.course_bookings,
    public.course_plan_slots,
    public.course_progress,
    public.exercise_favorites,
    public.exercise_sessions,
    public.habit_favorites,
    public.habit_logs,
    public.profiles,
    public.quiz_attempts,
    public.stripe_events,
    public.subscriptions,
    public.user_consents,
    public.user_habits
    from anon;

  -- 2e. authenticated: je Tabelle das, was die Migrationen NICHT vergeben
  -- haben. Abgeleitet aus dem Stand der oertlichen Datenbank nach 0054, in
  -- der es keine pauschalen Rechte gibt.

  -- Nur lesen - geschrieben wird ueber Funktionen, den Webhook oder das Studio.
  revoke insert, update, delete on
    public.certificates,
    public.challenge_template_items,
    public.challenge_templates,
    public.consent_definitions,
    public.course_access,
    public.course_bookings,
    public.habit_categories,
    public.online_course_block_contents,
    public.online_course_blocks,
    public.online_courses,
    public.quiz_attempts,
    public.subscriptions,
    public.v_exercise_duration
    from authenticated;

  -- Gar nichts.
  revoke select, insert, update, delete on public.stripe_events from authenticated;

  -- Einwilligungen: nur neue Zeilen, nie aendern oder loeschen (0012).
  revoke update, delete on public.user_consents from authenticated;

  -- Profil: aendern ja, anlegen und loeschen nein (Trigger bzw. delete-account).
  revoke insert, delete on public.profiles from authenticated;

  -- Erledigte Bloecke werden nicht umgeschrieben (0043).
  revoke update on public.course_progress from authenticated;

  -- Tabellen mit Spaltenrechten: das Recht auf die GANZE Tabelle faellt weg,
  -- die einzelnen Spalten kommen in 2f wieder.
  revoke update on public.user_habits from authenticated;
  revoke update on public.habit_favorites from authenticated;
  revoke insert, update, delete on public.habit_templates from authenticated;
  revoke insert, update on public.challenges from authenticated;
  revoke insert, update on public.challenge_items from authenticated;
  revoke insert, update on public.challenge_slots from authenticated;

  -- 2f. Spaltenrechte wiederherstellen - genau die aus 2a.
  for g in
    select * from jsonb_to_recordset(v_column_grants)
      as x(rel text, col text, grantee text, priv text)
  loop
    execute format('grant %s (%I) on %s to %I', g.priv, g.col, g.rel, g.grantee);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Selbstpruefung
-- ---------------------------------------------------------------------------
-- Bricht ab, wenn die Rechte nicht so stehen, wie sie sollen. Zwei Richtungen:
--
--   VERBOTEN - was kein Client koennen darf. Ein Treffer hiesse: der Entzug
--     oben hat nicht gegriffen, etwa weil das Recht von einer anderen Rolle
--     vergeben wurde als der, unter der Migrationen laufen.
--   NOETIG   - was die App braucht. Ein Treffer hiesse: 2f hat ein Spaltenrecht
--     nicht wiederhergestellt, und Habits oder Uebungswege liessen sich nicht
--     mehr speichern.
--
-- Lieber eine Migration, die laut scheitert, als eine der beiden Folgen.

do $$
declare
  v_problems text[] := '{}';
  v_found    text;
begin
  -- ---------- VERBOTEN: Funktionen ----------
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_found
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in (
       'reserve_course_seat', 'reserve_course_seat_for_guest', 'reserve_course_seat_any',
       'take_guest_booking_slot', 'set_user_admin',
       'apply_wearable_days', 'save_wearable_days', 'remove_wearable',
       'handle_new_user', 'handle_new_user_consents', 'check_exercise_quota')
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));
  if v_found is not null then
    v_problems := v_problems || ('Funktionen, die kein Client ausfuehren darf: ' || v_found);
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_found
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in (
       'has_consent', 'can_use_habit_template', 'delete_my_diary_data',
       'can_start_challenge', 'can_plan_challenge', 'save_challenge_plan',
       'submit_quiz', 'issue_certificate')
     and has_function_privilege('anon', p.oid, 'execute');
  if v_found is not null then
    v_problems := v_problems || ('Funktionen, die anon nicht ausfuehren darf: ' || v_found);
  end if;

  -- ---------- VERBOTEN: Tabellen ----------
  -- has_any_column_privilege sieht Tabellen- UND Spaltenrechte.
  select string_agg(c.relname, ', ')
    into v_found
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p', 'v')
     and (has_any_column_privilege('anon', c.oid, 'insert')
       or has_any_column_privilege('anon', c.oid, 'update')
       or has_table_privilege('anon', c.oid, 'delete'));
  if v_found is not null then
    v_problems := v_problems || ('anon darf schreiben in: ' || v_found);
  end if;

  select string_agg(c.relname, ', ')
    into v_found
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p')
     and (has_table_privilege('anon', c.oid, 'truncate')
       or has_table_privilege('authenticated', c.oid, 'truncate'));
  if v_found is not null then
    v_problems := v_problems || ('TRUNCATE fuer Clients auf: ' || v_found);
  end if;

  select string_agg(c.relname, ', ')
    into v_found
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relname in (
       'certificates', 'challenge_items', 'challenge_slots', 'challenges',
       'course_access', 'course_bookings', 'course_plan_slots', 'course_progress',
       'exercise_favorites', 'exercise_sessions', 'guest_booking_attempts',
       'habit_favorites', 'habit_logs', 'profiles', 'quiz_attempts', 'stripe_events',
       'subscriptions', 'user_consents', 'user_habits',
       'wearable_connections', 'wearable_daily', 'wearable_secrets')
     and has_any_column_privilege('anon', c.oid, 'select');
  if v_found is not null then
    v_problems := v_problems || ('anon darf Nutzertabellen lesen: ' || v_found);
  end if;

  -- Tabellen, in die authenticated nie selbst schreibt.
  select string_agg(c.relname, ', ')
    into v_found
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relname in (
       'certificates', 'course_access', 'course_bookings', 'quiz_attempts',
       'subscriptions', 'stripe_events', 'consent_definitions',
       'guest_booking_attempts', 'wearable_connections', 'wearable_daily', 'wearable_secrets',
       'online_quiz_questions', 'online_quiz_options')
     and (has_any_column_privilege('authenticated', c.oid, 'insert')
       or has_any_column_privilege('authenticated', c.oid, 'update')
       or has_table_privilege('authenticated', c.oid, 'delete'));
  if v_found is not null then
    v_problems := v_problems || ('authenticated darf schreiben in: ' || v_found);
  end if;

  -- Die Spalten, an denen eine Schranke haengt.
  if has_column_privilege('authenticated', 'public.user_habits', 'template_id', 'update') then
    v_problems := v_problems || 'authenticated darf user_habits.template_id aendern (Plus-Schranke der Habits)'::text;
  end if;
  if has_column_privilege('authenticated', 'public.user_habits', 'user_id', 'update') then
    v_problems := v_problems || 'authenticated darf user_habits.user_id aendern'::text;
  end if;
  if has_column_privilege('authenticated', 'public.habit_templates', 'owner_id', 'update')
     or has_column_privilege('authenticated', 'public.habit_templates', 'is_preview', 'update')
     or has_column_privilege('authenticated', 'public.habit_templates', 'is_published', 'update')
     or has_column_privilege('authenticated', 'public.habit_templates', 'slug', 'update') then
    v_problems := v_problems || 'authenticated darf geschuetzte Spalten von habit_templates aendern'::text;
  end if;
  if has_table_privilege('authenticated', 'public.habit_templates', 'delete') then
    v_problems := v_problems || 'authenticated darf habit_templates hart loeschen'::text;
  end if;
  if has_column_privilege('authenticated', 'public.challenges', 'user_id', 'update')
     or has_column_privilege('authenticated', 'public.challenges', 'template_id', 'update') then
    v_problems := v_problems || 'authenticated darf geschuetzte Spalten von challenges aendern'::text;
  end if;
  if has_any_column_privilege('authenticated', 'public.challenge_slots', 'update') then
    v_problems := v_problems || 'authenticated darf Termine von Uebungswegen aendern (vergangene sind fest)'::text;
  end if;
  if has_any_column_privilege('authenticated', 'public.course_progress', 'update') then
    v_problems := v_problems || 'authenticated darf course_progress aendern'::text;
  end if;
  if has_any_column_privilege('authenticated', 'public.user_consents', 'update')
     or has_table_privilege('authenticated', 'public.user_consents', 'delete') then
    v_problems := v_problems || 'authenticated darf Einwilligungen aendern oder loeschen'::text;
  end if;
  -- CLAUDE.md, V1.2: Quizloesungen sind fuer den Client nie lesbar.
  if has_column_privilege('anon', 'public.online_quiz_options', 'is_correct', 'select')
     or has_column_privilege('authenticated', 'public.online_quiz_options', 'is_correct', 'select') then
    v_problems := v_problems || 'Clients duerfen online_quiz_options.is_correct lesen (Quizloesungen)'::text;
  end if;

  -- ---------- NOETIG: was die App braucht ----------
  if not (has_column_privilege('authenticated', 'public.user_habits', 'target_value', 'update')
      and has_column_privilege('authenticated', 'public.user_habits', 'is_active', 'update')
      and has_column_privilege('authenticated', 'public.user_habits', 'deleted_at', 'update')
      and has_table_privilege('authenticated', 'public.user_habits', 'insert')) then
    v_problems := v_problems || 'authenticated kann eigene Habits nicht mehr speichern (user_habits)'::text;
  end if;
  if not (has_column_privilege('authenticated', 'public.habit_templates', 'title', 'insert')
      and has_column_privilege('authenticated', 'public.habit_templates', 'title', 'update')
      and has_column_privilege('authenticated', 'public.habit_templates', 'deleted_at', 'update')) then
    v_problems := v_problems || 'authenticated kann eigene Habit-Vorlagen nicht mehr speichern (habit_templates)'::text;
  end if;
  if not (has_column_privilege('authenticated', 'public.habit_favorites', 'deleted_at', 'update')) then
    v_problems := v_problems || 'authenticated kann Habit-Favoriten nicht mehr entfernen (habit_favorites)'::text;
  end if;
  if not (has_column_privilege('authenticated', 'public.challenges', 'title', 'insert')
      and has_column_privilege('authenticated', 'public.challenges', 'cancelled_at', 'update')
      and has_column_privilege('authenticated', 'public.challenge_items', 'plan', 'insert')
      and has_column_privilege('authenticated', 'public.challenge_items', 'plan', 'update')
      and has_column_privilege('authenticated', 'public.challenge_slots', 'due_on', 'insert')) then
    v_problems := v_problems || 'authenticated kann Uebungswege nicht mehr speichern (challenges, challenge_items, challenge_slots)'::text;
  end if;
  if not (has_column_privilege('anon', 'public.online_quiz_options', 'label', 'select')
      and has_column_privilege('authenticated', 'public.online_quiz_options', 'label', 'select')
      and has_column_privilege('authenticated', 'public.online_quiz_questions', 'question', 'select')) then
    v_problems := v_problems || 'Quizfragen sind nicht mehr lesbar (online_quiz_questions, online_quiz_options)'::text;
  end if;

  if array_length(v_problems, 1) > 0 then
    raise exception E'0055: Die Rechte stehen nicht wie erwartet:\n  - %',
      array_to_string(v_problems, E'\n  - ');
  end if;
end $$;
