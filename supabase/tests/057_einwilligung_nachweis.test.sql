-- supabase/tests/057_einwilligung_nachweis.test.sql
--
-- Migration 0057 (Review 11.11.2026, S7). Missbrauchsfaelle zuerst (CLAUDE.md):
--
--   1. Eine Einwilligung in Gesundheitsdaten erklaeren, die auf den Wortlaut
--      der AGB zeigt
--   2. Eine Einwilligung auf einen beliebigen Zeitpunkt datieren
--   3. Einen Widerruf zurueckdatieren
-- Dann der Normalfall: Art und Fassung passen, die Erklaerung wird angenommen.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('a5700000-0000-0000-0000-000000000001', 'nachweis@example.at');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a5700000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------- 1. Art und Fassung passen nicht zusammen ----------
select throws_ok(
  $$ insert into public.user_consents (user_id, definition_id, kind, granted_at)
     select 'a5700000-0000-0000-0000-000000000001', d.id, 'health_data', now()
       from public.consent_definitions d
      where d.kind = 'terms' and d.published_at is not null
      order by d.version desc limit 1 $$,
  '42501', null,
  'health_data laesst sich nicht auf den Wortlaut der AGB erklaeren');

select is(
  public.has_consent('health_data'), false,
  'und danach gilt die Einwilligung in Gesundheitsdaten nicht als erteilt');

-- ---------- Normalfall: Art und Fassung passen ----------
select lives_ok(
  $$ insert into public.user_consents (user_id, definition_id, kind, granted_at)
     select 'a5700000-0000-0000-0000-000000000001', d.id, d.kind, '2001-01-01T00:00:00Z'
       from public.consent_definitions d
      where d.kind = 'health_data' and d.published_at is not null
      order by d.version desc limit 1 $$,
  'Die passende Erklaerung wird angenommen');

select is(public.has_consent('health_data'), true, 'und zaehlt');

-- ---------- 2. Die Zeit kommt vom Server ----------
select is(
  (select granted_at from public.user_consents
    where user_id = 'a5700000-0000-0000-0000-000000000001' and kind = 'health_data'
    order by seq desc limit 1),
  now(),
  'granted_at ist die Serverzeit, nicht das mitgeschickte Jahr 2001');

-- ---------- 3. Auch beim Widerruf ----------
select lives_ok(
  $$ insert into public.user_consents (user_id, definition_id, kind, revoked_at)
     select 'a5700000-0000-0000-0000-000000000001', d.id, d.kind, '2001-01-01T00:00:00Z'
       from public.consent_definitions d
      where d.kind = 'health_data' and d.published_at is not null
      order by d.version desc limit 1 $$,
  'Der Widerruf wird angenommen');

select is(
  (select row(granted_at, revoked_at)::text from public.user_consents
    where user_id = 'a5700000-0000-0000-0000-000000000001' and kind = 'health_data'
    order by seq desc limit 1),
  row(null::timestamptz, now())::text,
  'revoked_at ist die Serverzeit, und der Trigger erfindet kein granted_at dazu');

reset role;

-- ---------- Ohne angemeldeten Nutzer bleibt die Zeit, wie sie kommt ----------
-- So schreibt der Trigger bei der Registrierung (0013): ohne Token.
set local request.jwt.claims = '';
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a5700000-0000-0000-0000-000000000001', d.id, d.kind, '2020-05-05T05:05:05Z'
  from public.consent_definitions d
 where d.kind = 'terms' and d.published_at is not null
 order by d.version desc limit 1;

select is(
  (select granted_at from public.user_consents
    where user_id = 'a5700000-0000-0000-0000-000000000001' and kind = 'terms'
    order by seq desc limit 1),
  '2020-05-05T05:05:05Z'::timestamptz,
  'Ohne Token (Registrierung, SQL Editor) bleibt der mitgegebene Zeitpunkt');

select * from finish();
rollback;
