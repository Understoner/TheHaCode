-- 0054: Gewicht als Tageswert der Geraete (07.11.2026, nur Testsystem)
--
-- Wunsch des Users: Gewicht mittracken. Garmin liefert es aus der Body
-- Composition (Index-Waage oder Eingabe in Garmin Connect), Oura misst kein
-- Gewicht. Im Tagebuch als Habit "Gewicht" (docs/inhalte/wearables.sql, nur
-- Staging) - ohne Punkte und ohne Wertgrenzen: ein Gesundheits-Messwert,
-- den die App nicht bewertet (SAD §5.7, is_health_measure).
--
-- Additiv (SAD §2.6): die Liste der Werte waechst um einen, und
-- apply_wearable_days rundet Gewicht wie die Schlafdauer auf eine Stelle.

create or replace function public.is_wearable_metric(p_metric text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_metric in (
    'steps',              -- Schritte
    'floors',             -- Etagen gestiegen (nur Garmin)
    'intensity_minutes',  -- Intensitaetsminuten: maessig + 2 x intensiv
    'sleep_hours',        -- Schlafdauer in Stunden
    'sleep_score',        -- Schlafwert 0..100
    'resting_hr',         -- Ruhepuls (Garmin: Ruhe-HF, Oura: niedrigster Wert im Schlaf)
    'body_battery',       -- Body Battery, Tagesdurchschnitt (nur Garmin)
    'stress_level',       -- Stress 0..100, Tagesdurchschnitt (nur Garmin)
    'stress_minutes',     -- Minuten mit hohem Stress (nur Oura)
    'respiration',        -- Atemfrequenz, Atemzuege pro Minute
    'weight'              -- Gewicht in kg, letzte Messung des Tages (nur Garmin, 0054)
  );
$$;

create or replace function public.apply_wearable_days(p_user_id uuid, p_from date, p_to date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  if p_user_id is null or p_from is null or p_to is null or p_to < p_from
     or p_to - p_from > 400 then
    raise exception 'Ungueltiger Zeitraum' using errcode = 'check_violation';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  if not public.has_consent('health_data') then
    return 0;
  end if;

  insert into public.habit_logs (user_id, user_habit_id, log_date, value_numeric, source)
  select uh.user_id, uh.id, d.day,
         -- Schlafdauer und Gewicht auf eine Stelle, alles andere ganzzahlig.
         round(avg(d.value), case when ht.wearable_metric in ('sleep_hours', 'weight') then 1 else 0 end),
         'wearable'
    from public.user_habits uh
    join public.habit_templates ht on ht.id = uh.template_id
    join public.wearable_daily d
      on d.user_id = uh.user_id
     and d.metric = ht.wearable_metric
     and d.deleted_at is null
   where uh.user_id = p_user_id
     and uh.is_active
     and uh.deleted_at is null
     and ht.wearable_metric is not null
     and public.can_use_habit_template(ht.id)
     -- Ein Tag Vorlauf fuer Zeitzonen oestlich von UTC, wie der Trigger aus 0021.
     and d.day between greatest(p_from, uh.started_on) and least(p_to, current_date + 1)
   group by uh.user_id, uh.id, d.day, ht.wearable_metric, ht.min_value, ht.max_value
  -- Ausserhalb der Grenzen des Habits (etwa > 60.000 Schritte) wuerde der
  -- Trigger aus 0021 den ganzen Abgleich abbrechen: solche Tage entfallen.
  having (ht.min_value is null or round(avg(d.value), 1) >= ht.min_value)
     and (ht.max_value is null or round(avg(d.value), 1) <= ht.max_value)
  on conflict (user_habit_id, log_date) do update
     set value_numeric = excluded.value_numeric,
         source        = 'wearable',
         deleted_at    = null
   where public.habit_logs.source = 'wearable'
     and public.habit_logs.value_numeric is distinct from excluded.value_numeric;

  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

revoke execute on function public.apply_wearable_days(uuid, date, date) from public, anon, authenticated;
grant execute on function public.apply_wearable_days(uuid, date, date) to service_role;
