-- supabase/tests/054_wearables_gewicht.test.sql
--
-- Gewicht als Tageswert (Migration 0054): wird gespeichert, fuellt das Habit
-- mit einer Nachkommastelle, und - Missbrauchsfall - ein Wert ausserhalb der
-- Grenzen des Habits (Tippfehler auf der Waage, Gramm statt Kilo) landet
-- nicht im Tagebuch.
begin;
select plan(4);

insert into auth.users (id, email) values ('a5400000-0000-0000-0000-00000000000a', 'a@example.at');

set local role service_role;
update public.profiles set has_active_subscription = true where id = 'a5400000-0000-0000-0000-00000000000a';
reset role;

insert into public.consent_definitions (kind, version, locale, title, body_md, published_at)
select 'health_data', 1, 'de', 'x', 'x', now()
 where not exists (select 1 from public.consent_definitions where kind = 'health_data' and published_at is not null);
insert into public.user_consents (user_id, definition_id, kind, granted_at)
select 'a5400000-0000-0000-0000-00000000000a', id, 'health_data', now()
  from public.consent_definitions
 where kind = 'health_data' and published_at is not null
 order by version limit 1;

insert into public.habit_categories (id, slug, title, max_per_day, max_per_week, max_per_month, is_published)
values ('a5400000-cccc-0000-0000-000000000001', 'test-054', 'Test', 30, 150, 500, true);
insert into public.habit_templates (id, slug, category_id, title, tracking_type, unit, min_value, max_value,
                                    points, is_preview, is_health_measure, is_published, wearable_metric)
values ('a5400000-eeee-0000-0000-000000000001', 'test-054-gewicht', 'a5400000-cccc-0000-0000-000000000001',
        'Gewicht', 'number', 'kg', 20, 400, 0, false, true, true, 'weight');
insert into public.user_habits (id, user_id, template_id, started_on)
values ('a5400000-aaaa-0000-0000-0000000000a1', 'a5400000-0000-0000-0000-00000000000a',
        'a5400000-eeee-0000-0000-000000000001', current_date - 30);
insert into public.wearable_connections (user_id, provider) values ('a5400000-0000-0000-0000-00000000000a', 'garmin');

select ok(public.is_wearable_metric('weight'), 'Gewicht ist ein bekannter Tageswert');

set local role service_role;
select is(
  public.save_wearable_days('a5400000-0000-0000-0000-00000000000a', 'garmin',
    jsonb_build_array(
      jsonb_build_object('metric', 'weight', 'day', current_date - 1, 'value', 72.35),
      jsonb_build_object('metric', 'weight', 'day', current_date - 2, 'value', 72350))),
  2, 'Garmin-Gewicht gespeichert');
reset role;

select is(
  (select value_numeric from public.habit_logs
    where user_habit_id = 'a5400000-aaaa-0000-0000-0000000000a1' and log_date = current_date - 1),
  72.4::numeric, 'Gewicht im Tagebuch mit einer Nachkommastelle');

select is(
  (select count(*)::int from public.habit_logs
    where user_habit_id = 'a5400000-aaaa-0000-0000-0000000000a1' and log_date = current_date - 2),
  0, '72.350 kg (Gramm statt Kilo) liegt ueber der Grenze und fuellt nichts');

select * from finish();
rollback;
