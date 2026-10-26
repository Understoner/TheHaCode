-- supabase/tests/030_habit_link.test.sql
--
-- Migration 0030: der Link an eigenen Habits. Missbrauchsfaelle: ein Link,
-- der beim Antippen Code ausfuehrt oder auf eine fremde Seite springt; der
-- Link an einer Vorlage der Redaktion; ein geaenderter Link ohne Plus.
begin;
select plan(10);

select has_column('public', 'habit_templates', 'link_url', 'habit_templates hat link_url');

insert into auth.users (id, email) values
  ('a3000000-0000-0000-0000-000000000001', 'link@example.at');
set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a3000000-0000-0000-0000-000000000001';
reset role;
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a3000000-0000-0000-0000-000000000001', id, 'health_data', now()
  from public.consent_definitions where kind = 'health_data' and version = 3;

-- Eine Vorlage der Redaktion, angelegt wie im Studio.
insert into public.habit_templates (id, slug, category_id, title, tracking_type, points, is_published)
select 'a3000000-dddd-0000-0000-000000000001', 'test-030-vorlage', id, 'Test-Vorlage', 'done', 5, true
  from public.habit_categories where slug = 'atmung';

create temporary table ids (name text, id uuid);
insert into ids select 'atmung', id from public.habit_categories where slug = 'atmung';
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into public.habit_templates (id, owner_id, category_id, title, tracking_type, points, link_url)
     select 'a3000000-eeee-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
            id, 'Meine Abendsession', 'done', 5, '  /sessions/abc  '
       from ids where name = 'atmung' $$,
  'Ein eigenes Habit darf auf eine Session zeigen');

select is(
  (select link_url from public.habit_templates where id = 'a3000000-eeee-0000-0000-000000000001'),
  '/sessions/abc',
  'Der Link wird ohne Leerraum gespeichert');

select lives_ok(
  $$ update public.habit_templates set link_url = 'https://example.at/video'
      where id = 'a3000000-eeee-0000-0000-000000000001' $$,
  'Ein https-Link geht auch');

-- Missbrauchsfall 1: ein Link, der Code ausfuehrt.
select throws_ok(
  $$ update public.habit_templates set link_url = 'javascript:alert(1)'
      where id = 'a3000000-eeee-0000-0000-000000000001' $$,
  '23514', null,
  'javascript: wird abgelehnt');

-- Missbrauchsfall 2: ein "Pfad", der in Wahrheit eine fremde Seite ist.
select throws_ok(
  $$ update public.habit_templates set link_url = '//fremd.example/x'
      where id = 'a3000000-eeee-0000-0000-000000000001' $$,
  '23514', null,
  '//host wird abgelehnt');

-- Missbrauchsfall 3: der Vorlage der Redaktion einen Link unterschieben.
select results_eq(
  $$ with u as (update public.habit_templates set link_url = 'https://fremd.example'
                 where id = 'a3000000-dddd-0000-0000-000000000001' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'Eine Vorlage der Redaktion bekommt keinen Link vom Nutzer');

select set_config('request.jwt.claim.sub', null, true);
reset role;

select is(
  (select link_url from public.habit_templates where id = 'a3000000-dddd-0000-0000-000000000001'),
  null,
  'Die Vorlage bleibt ohne Link');

-- Missbrauchsfall 4: ohne Plus den Link aendern.
set local role service_role;
update public.profiles set has_active_subscription = false
 where id = 'a3000000-0000-0000-0000-000000000001';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ update public.habit_templates set link_url = '/sessions/xyz'
      where id = 'a3000000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'Ohne Plus laesst sich der Link nicht aendern');

-- Loeschen geht weiter, auch mit Link und ohne Plus.
select lives_ok(
  $$ update public.habit_templates set deleted_at = now()
      where id = 'a3000000-eeee-0000-0000-000000000001' $$,
  'Loeschen bleibt ohne Plus erlaubt');

select * from finish();
rollback;
