-- supabase/tests/049_co2_uebungsweg_ein_weg.test.sql
--
-- Migration 0049. Missbrauchsfaelle zuerst (CLAUDE.md):
--
--   1. Den Schalter planned_days_only selbst setzen
--   2. Die neue Vorlage ohne Admin-Rolle aendern
--   3. Eine Challenge-Beschreibung ueber die neue Grenze hinaus
-- Dann der Normalfall: ein Weg, die drei alten Vorlagen sind weg.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('a4900000-0000-0000-0000-000000000001', 'nutzer49@example.at');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a4900000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ update public.habit_templates set planned_days_only = true where slug = 'schlafdauer' $$,
  '42501', null, 'Kein Schreibrecht auf planned_days_only');
select throws_ok(
  $$ update public.challenge_templates set title = 'Boese' where slug = 'co2-toleranz-28' $$,
  '42501', null, 'Ohne Admin-Rolle kein Schreibrecht auf die Vorlage');
reset role;

select throws_ok(
  $$ insert into public.challenges (user_id, title, description_md, starts_on, ends_on)
     values ('a4900000-0000-0000-0000-000000000001', 'Zu lang', repeat('x', 2001), current_date, current_date) $$,
  '23514', null, 'Hoechstens 2000 Zeichen Beschreibung');
select lives_ok(
  $$ insert into public.challenges (user_id, title, description_md, starts_on, ends_on)
     values ('a4900000-0000-0000-0000-000000000001', 'Passt', (select description_md from public.challenge_templates where slug = 'co2-toleranz-28'), current_date, current_date) $$,
  'Die Beschreibung der Vorlage passt in die Challenge');

select is(
  (select count(*)::int from public.challenge_templates
    where slug = 'co2-toleranz-28' and duration_days = 28 and not is_preview and is_published),
  1, 'Ein Uebungsweg, 28 Tage, ohne Vorschau');
select is(
  (select count(*)::int from public.challenge_templates
    where slug in ('co2-toleranz-anfaenger', 'co2-toleranz-fortgeschritten', 'co2-toleranz-expert')),
  0, 'Die drei Vorlagen je Stufe sind entfernt (0052)');

select * from finish();
rollback;
