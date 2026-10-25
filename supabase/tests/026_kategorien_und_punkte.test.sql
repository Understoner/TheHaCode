-- supabase/tests/026_kategorien_und_punkte.test.sql
--
-- Migration 0026: sechs neue Kategorien mit den Limits von Atmung, und
-- Punkte 0-10 fuer eigene Habits. Missbrauchsfall: sich mit einem eigenen
-- Habit mehr Punkte geben, als erlaubt ist, oder die Punkte einer Vorlage
-- der Redaktion umschreiben.
begin;
select plan(11);

-- ---------- Kategorien ----------
select is(
  (select array_agg(slug order by sort_order) from public.habit_categories
    where slug in ('atmung', 'ernaehrung', 'fasten', 'bewegung', 'muskeltraining', 'schlaf', 'stressmanagement')
      and is_published and not is_negative),
  array['atmung', 'ernaehrung', 'fasten', 'bewegung', 'muskeltraining', 'schlaf', 'stressmanagement'],
  'Sieben veroeffentlichte Kategorien, in dieser Reihenfolge');

select is(
  (select count(distinct (max_per_day, max_per_week, max_per_month))::int from public.habit_categories
    where slug in ('atmung', 'ernaehrung', 'fasten', 'bewegung', 'muskeltraining', 'schlaf', 'stressmanagement')),
  1,
  'Alle mit denselben Limits wie Atmung');

-- ---------- Punkte fuer eigene Habits ----------
insert into auth.users (id, email) values
  ('a2600000-0000-0000-0000-000000000001', 'punkte@example.at');
set local role service_role;
update public.profiles set has_active_subscription = true
 where id = 'a2600000-0000-0000-0000-000000000001';
reset role;
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a2600000-0000-0000-0000-000000000001', id, 'health_data', now()
  from public.consent_definitions where kind = 'health_data' and version = 2;

create temporary table ids (name text, id uuid);
insert into ids
  select 'schlaf', id from public.habit_categories where slug = 'schlaf'
  union all
  select 'vorlage', id from public.habit_templates where owner_id is null order by 1 limit 1;
grant select on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2600000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into public.habit_templates (id, owner_id, category_id, title, tracking_type, points)
     select 'a2600000-eeee-0000-0000-000000000001', 'a2600000-0000-0000-0000-000000000001',
            id, 'Vor 22 Uhr ins Bett', 'done', 7
       from ids where name = 'schlaf' $$,
  'Ein eigenes Habit in einer neuen Kategorie, mit 7 Punkten');

select is(
  (select points from public.habit_templates where id = 'a2600000-eeee-0000-0000-000000000001'),
  7,
  'Die gewaehlten Punkte bleiben stehen');

select lives_ok(
  $$ update public.habit_templates set points = 10
      where id = 'a2600000-eeee-0000-0000-000000000001' $$,
  '10 ist erlaubt');

select lives_ok(
  $$ update public.habit_templates set points = 0
      where id = 'a2600000-eeee-0000-0000-000000000001' $$,
  '0 ebenso');

select throws_ok(
  $$ update public.habit_templates set points = 11
      where id = 'a2600000-eeee-0000-0000-000000000001' $$,
  '23514', null,
  '11 nicht');

select throws_ok(
  $$ update public.habit_templates set points = -5
      where id = 'a2600000-eeee-0000-0000-000000000001' $$,
  '23514', null,
  'und negativ auch nicht');

-- Das neue Spaltenrecht darf nicht an die Vorlagen der Redaktion reichen.
select results_eq(
  $$ with u as (update public.habit_templates set points = 10
                 where id = (select id from ids where name = 'vorlage') returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'Die Punkte einer vorgeschlagenen Vorlage bleiben unberuehrt');

select set_config('request.jwt.claim.sub', null, true);
reset role;

-- Punkte aendern ist Bearbeiten - nach Abo-Ende gesperrt.
set local role service_role;
update public.profiles set has_active_subscription = false
 where id = 'a2600000-0000-0000-0000-000000000001';
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2600000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ update public.habit_templates set points = 5
      where id = 'a2600000-eeee-0000-0000-000000000001' $$,
  '42501', null,
  'Ohne Plus lassen sich die Punkte nicht aendern');

select lives_ok(
  $$ update public.habit_templates set deleted_at = now()
      where id = 'a2600000-eeee-0000-0000-000000000001' $$,
  'Loeschen geht weiter');

select * from finish();
rollback;
