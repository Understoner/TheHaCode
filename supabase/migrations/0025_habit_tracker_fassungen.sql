-- 0025: Aus dem Atem-Tagebuch wird der Habit Tracker (25.10.2026).
--
-- Kuenftig werden nicht nur Atem-Gewohnheiten gefuehrt. Der Name aendert sich
-- deshalb auch in den beiden Fassungen, die ihn nennen - als NEUE Versionen,
-- weil veroeffentlichte Fassungen seit 0022 unveraenderlich sind. Die alten
-- Versionen bleiben als Nachweis stehen.
--
-- Wer health_data v1 schon zugestimmt hat, muss nicht neu einwilligen:
-- has_consent() fragt nach der Art, nicht nach der Version (0012). Der Inhalt
-- der Einwilligung ist derselbe, nur der Name und die eigenen Habits kommen
-- ausdruecklich dazu.

-- ===================================================================
-- 1. Datenschutzerklaerung, Fassung 3
-- ===================================================================
-- Neu darin: selbst angelegte Habits und Habit-Favoriten, Name Habit Tracker.
-- "Fassung 3", weil Fassung 2 vom selben Tag ist und auf Staging schon
-- veroeffentlicht wurde - ein Datum allein unterschiede die beiden nicht.
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'privacy', 3, 'de', 'Datenschutzerklärung',
  'Ich habe die Datenschutzerklärung in der Fassung 3 vom 25.10.2026 zur Kenntnis '
  'genommen. Sie ist unter /datenschutz abrufbar und beschreibt, welche Daten '
  'zu welchem Zweck verarbeitet werden.',
  true, now()
)
on conflict (kind, version, locale) do nothing;

-- ===================================================================
-- 2. Einwilligung Habit Tracker (health_data v2)
-- ===================================================================
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'health_data', 2, 'de', 'Einwilligung Habit Tracker',
  'Ich willige ausdrücklich ein, dass meine Einträge im Habit Tracker '
  '(zum Beispiel BOLT-Wert und erledigte Atemübungen) und die Habits, die ich '
  'selbst anlege, als Gesundheitsdaten nach Art. 9 Abs. 2 lit. a DSGVO '
  'gespeichert und für meine eigenen Auswertungen verarbeitet werden. Die '
  'Einwilligung ist freiwillig und keine Voraussetzung für die übrige Nutzung '
  'der App. Ich kann sie jederzeit unter „Konto“ widerrufen; bereits '
  'gespeicherte Einträge kann ich danach weiter ansehen, exportieren und '
  'löschen. Einzelheiten stehen in der Datenschutzerklärung unter /datenschutz.',
  false, now()
)
on conflict (kind, version, locale) do nothing;

-- ===================================================================
-- 3. Eigene Habits nur mit Einwilligung
-- ===================================================================
-- Ein eigenes Habit traegt einen frei gewaehlten Titel - "Insulin spritzen",
-- "Rauchfrei". Das ist selbst eine Gesundheitsangabe, nicht erst der Eintrag
-- dazu. Anlegen und inhaltliches Aendern verlangen deshalb dieselbe
-- Einwilligung wie das Eintragen. Loeschen geht weiter immer.
drop policy if exists habit_templates_insert_own on public.habit_templates;
create policy habit_templates_insert_own on public.habit_templates
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.has_plus_access()
    and public.has_consent('health_data')
  );

create or replace function public.guard_own_habit_template()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Die Redaktion (owner_id null) schreibt ueber is_admin() - unberuehrt.
  if new.owner_id is null then
    if tg_op = 'UPDATE' and old.owner_id is not null then
      raise exception 'Ein eigenes Habit wird nicht zur Vorlage der Redaktion'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Ein Habit wechselt nicht den Eigentuemer' using errcode = '42501';
    end if;
    if new.tracking_type is distinct from old.tracking_type then
      -- Vorhandene Eintraege passen sonst nicht mehr zur Art.
      raise exception 'Die Art des Eintrags laesst sich nicht aendern'
        using errcode = 'check_violation';
    end if;
    -- Loeschen geht immer, auch ohne Abo und nach Widerruf. Alles andere ist
    -- Bearbeiten und damit Plus - und seit 0025 auch Einwilligung.
    if (new.title, new.description_md, new.category_id, new.unit, new.min_value,
        new.max_value, new.step_value, new.default_target, new.higher_is_better,
        new.icon)
       is distinct from
       (old.title, old.description_md, old.category_id, old.unit, old.min_value,
        old.max_value, old.step_value, old.default_target, old.higher_is_better,
        old.icon) then
      if not public.has_plus_access() then
        raise exception 'Eigene Habits bearbeiten gehoert zu Plus' using errcode = '42501';
      end if;
      if not public.has_consent('health_data') then
        raise exception 'Eigene Habits bearbeiten braucht die Einwilligung' using errcode = '42501';
      end if;
    end if;
  else
    -- Eine Obergrenze, damit niemand die Tabelle zumuellt.
    select count(*) into v_count
      from public.habit_templates
     where owner_id = new.owner_id and deleted_at is null;
    if v_count >= 100 then
      raise exception 'Hoechstens 100 eigene Habits' using errcode = 'check_violation';
    end if;
    new.slug := 'eigen-' || new.id::text;
    new.sort_order := 1000;
  end if;

  -- Was ein eigenes Habit nie sein kann. Punkte: 0, bis entschieden ist,
  -- wie eigene Habits im Habit Score Tracker zaehlen (0024).
  new.points       := 0;
  new.is_preview   := false;
  new.is_published := true;
  new.exercise_id  := null;

  if new.tracking_type not in ('done', 'number') then
    raise exception 'Eigene Habits sind "erledigt" oder "Zahl"' using errcode = 'check_violation';
  end if;

  new.title := btrim(coalesce(new.title, ''));
  if length(new.title) not between 1 and 80 then
    raise exception 'Titel mit 1 bis 80 Zeichen' using errcode = 'check_violation';
  end if;
  new.description_md := nullif(btrim(coalesce(new.description_md, '')), '');
  if length(new.description_md) > 500 then
    raise exception 'Beschreibung hoechstens 500 Zeichen' using errcode = 'check_violation';
  end if;
  new.unit := nullif(btrim(coalesce(new.unit, '')), '');
  if length(new.unit) > 20 then
    raise exception 'Einheit hoechstens 20 Zeichen' using errcode = 'check_violation';
  end if;
  if new.tracking_type = 'done' then
    new.unit := null;
    new.min_value := null;
    new.max_value := null;
    new.step_value := null;
    new.default_target := null;
  end if;

  if not exists (
    select 1 from public.habit_categories c
     where c.id = new.category_id and c.is_published
  ) then
    raise exception 'Diese Kategorie gibt es nicht' using errcode = 'foreign_key_violation';
  end if;

  return new;
end $$;
