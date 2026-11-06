-- 0048: Habit-Anpassungen, Stufe "kleine Punkte", Einstieg und Ausklang fuer
-- Sessions, Uebungsweg CO2-Toleranz und News-Beitrag (06.11.2026).
--
-- Vorgaben des Users vom 06.11.2026. Alles Redaktionelle steht bewusst in der
-- Migration: so kommen Sessions, Habits, Uebungsweg und der Beitrag, der auf
-- ihn verlinkt, gemeinsam an - auf Live erst mit der Befoerderung.
--
-- ABWEICHUNG VON 0035 UND SAD §5.7, ENTSCHEIDUNG DES USERS
-- --------------------------------------------------------
-- Der Schlafwert der Uhr war bisher ein Gesundheits-Messwert ohne Wertgrenzen.
-- Der User will ihn jetzt mit Grenzen werten. Damit faellt er aus
-- is_health_measure; der BOLT-Wert bleibt gesperrt ("BOLT nie"), der CO2 Walk
-- kommt neu unter die Sperre.
--
-- ABWEICHUNG VON CLAUDE.md §Verboten, ENTSCHEIDUNG DES USERS
-- ----------------------------------------------------------
-- Einstieg und Ausklang sind Audiodateien in Sessions - dieselbe Machart wie
-- die Ansagen in voice.ts (06.09.2026). Standard ist: keine Datei, keine
-- Aenderung. Abgespielt wird in src/features/breathing/clips.ts.
--
-- Additiv (SAD §2.6): neue Spalten sind nullable. Die alte App ignoriert sie:
-- sie rechnet die mittlere Stufe fuer die Dauer des Deployments als 0.

-- ===================================================================
-- 1. Punkte zwischen den Wertgrenzen
-- ===================================================================
alter table public.habit_templates
  add column if not exists partial_points int;

comment on column public.habit_templates.partial_points is
  'Zahlen-Habit: Punkte zwischen penalty_from und points_from. NULL = 0 (0048). Nur Redaktion, kein Grant an authenticated.';

alter table public.habit_templates
  add constraint chk_habit_partial_points check (
    partial_points is null
    or (partial_points >= 0
        and partial_points <= points
        and points_from is not null
        and penalty_from is not null)
  );

-- ===================================================================
-- 2. Einstieg und Ausklang einer Session
-- ===================================================================
-- Pfad im Bucket session-audio. Nur fuer Sessions der Redaktion: eine eigene
-- Sequenz gehoert nicht in diesen Weg, und ein Client hat Schreibrecht auf
-- die ganze Zeile seiner eigenen Sequenz (0007).
alter table public.exercises
  add column if not exists intro_audio_path text,
  add column if not exists outro_audio_path text;

comment on column public.exercises.intro_audio_path is
  'Einstieg: Aufnahme vor der ersten Atemphase, Pfad im Bucket session-audio (0048).';
comment on column public.exercises.outro_audio_path is
  'Ausklang: Aufnahme, die so startet, dass sie mit der letzten Atemphase endet, Pfad im Bucket session-audio (0048).';

alter table public.exercises
  add constraint chk_exercise_clips_editorial check (
    owner_id is null or (intro_audio_path is null and outro_audio_path is null)
  ),
  add constraint chk_exercise_clip_paths check (
    (intro_audio_path is null
      or (intro_audio_path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' and intro_audio_path !~ '\.\.'))
    and (outro_audio_path is null
      or (outro_audio_path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' and outro_audio_path !~ '\.\.'))
  );

-- Oeffentlich wie public-assets: die App holt die Datei ueber ihre URL, und
-- die Aufnahme ist kein Bezahlinhalt. Auflisten und Schreiben nur Admins
-- (Muster 0031); ueber das Dashboard hochladen geht ohnehin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-audio', 'session-audio', true, 26214400,
        array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

create policy session_audio_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'session-audio' and public.is_admin());
create policy session_audio_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'session-audio' and public.is_admin());
create policy session_audio_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'session-audio' and public.is_admin())
  with check (bucket_id = 'session-audio' and public.is_admin());
create policy session_audio_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'session-audio' and public.is_admin());

-- ===================================================================
-- 3. Ernaehrung
-- ===================================================================
update public.habit_templates
   set is_published = false
 where owner_id is null
   and slug in ('selbst-gekocht', 'unter-4000-schritte');

update public.habit_templates
   set title = 'Bewusst gegessen'
 where owner_id is null and slug = 'langsam-essen';

insert into public.habit_templates (
  slug, category_id, title, description_md, tracking_type,
  higher_is_better, points, is_negative, day_part, sort_order, is_published
)
select 'proteinreiches-fruehstueck', c.id, 'Proteinreiches Frühstück',
  'Starte mit Eiweiß statt mit viel Kohlenhydraten: also nicht Semmel mit Marmelade, Cornflakes oder gesüßtes Müsli, sondern zum Beispiel Eier, griechisches Joghurt oder Topfen mit Beeren und Nüssen, Hüttenkäse, Räucherlachs oder Tofu-Rührei. Rund 25 bis 30 Gramm Eiweiß sind ein guter Richtwert. Das macht länger satt, der Blutzucker schwankt weniger, und du hilfst deinen Muskeln.',
  'done', true, 6, false, 'morgens', 23, true
  from public.habit_categories c
 where c.slug = 'ernaehrung'
on conflict (slug) do nothing;

-- ===================================================================
-- 4. Bewegung
-- ===================================================================
update public.habit_templates
   set points_from    = 5000,
       penalty_from   = 3000,
       penalty_points = 4,
       description_md = description_md
         || ' Unter 3.000 Schritten ziehen Punkte ab, ab 5.000 bekommst du Punkte, dazwischen zählt der Tag neutral.'
 where owner_id is null
   and slug = 'schritte'
   and points_from is null;

update public.habit_templates
   set description_md = description_md
         || ' Zu leicht? Schließ beim Stehen auf einem Bein die Augen – das erhöht den Schwierigkeitsgrad deutlich. Bleib dabei in Griffweite einer Wand oder eines Waschbeckens.'
 where owner_id is null
   and slug = 'gleichgewicht'
   and description_md not like '%die Augen%';

-- ===================================================================
-- 5. Schlaf
-- ===================================================================
update public.habit_templates
   set points_from    = 7,
       penalty_from   = 6,
       penalty_points = coalesce(penalty_points, points),
       partial_points = 4,
       description_md = replace(
           description_md,
           ' Ab sieben Stunden bekommst du die Punkte, unter sechs Stunden ziehen sie ab.',
           '')
         || ' Ab sieben Stunden bekommst du die vollen Punkte, ab sechs Stunden einen kleineren Teil, unter sechs Stunden ziehen sie ab.'
 where owner_id is null
   and slug = 'schlafdauer'
   and partial_points is null;

update public.habit_templates
   set is_health_measure = false,
       points            = 6,
       points_from       = 75,
       penalty_from      = 65,
       penalty_points    = 6,
       partial_points    = 3,
       description_md    = 'Für alle, die ihren Schlaf mit einer Smartwatch oder einem smarten Ring aufzeichnen: Trag den Schlafwert ein, den dir dein Gerät am Morgen anzeigt – meist eine Zahl von 0 bis 100 (zum Beispiel Schlafscore oder Schlafqualität). So siehst du im Tagebuch neben deinen Habits, wie du geschlafen hast. Ab 75 bekommst du die vollen Punkte, ab 65 einen kleineren Teil, darunter ziehen sie ab. Die Messung ist eine Schätzung des Geräts, keine medizinische Diagnose.'
 where owner_id is null
   and slug = 'schlafqualitaet-wearable'
   and partial_points is null;

-- ===================================================================
-- 6. Sessions CO2-Toleranz, nur mit Plus
-- ===================================================================
-- Eine Stufe je Abschnitt: "Ein,Halten,Aus,Halten,Runden". Die Runden ergeben
-- rund vier (zuletzt zwei bis fuenf) Minuten, ganze Atemzuege, insgesamt rund
-- 15 Minuten.
do $$
declare
  v_common constant text := E'\n\nGanz wichtig: Du bleibst immer im Wohlgefühl. Wird es zu viel, atme zwischendurch einfach einmal im eigenen Rhythmus und steig wieder ein, wann immer du dazu bereit bist. Das ist kein Abbruch, sondern Teil der Übung.';
  v_notice constant text := 'Im Sitzen oder Liegen üben, nie beim Autofahren und nie im oder am Wasser. Bei Schwindel, Herzrasen oder Enge in der Brust normal weiteratmen und die Übung beenden. Bei Schwangerschaft, Herz-Kreislauf-Erkrankungen, Epilepsie, Panikstörung oder anderen Vorerkrankungen vorher mit deiner Ärztin oder deinem Arzt sprechen.';
  v_benefits constant text := 'Durch das ruhige, lange Atmen steigt das Kohlendioxid im Blut sanft an. Mit der Übung lernst du, diesen Reiz gelassen wahrzunehmen, und dein Atem wird auch im Alltag ruhiger. Du trainierst Gewöhnung, keinen Wettkampf.';
  r record;
  v_exercise uuid;
  v_step uuid;
  v_values int[];
  v_rounds int;
  v_seconds int;
  v_position int;
begin
  for r in
    select * from (values
      ('co2-ausatmung-anfaenger', 'CO2 Toleranz Ausatmung · Anfänger', 'Für den Morgen, die Ausatmung wird länger', 1, 101,
       '3,3,3,3,20;4,4,4,4,15;4,4,8,4,12;4,4,10,4,8',
       'Immer Ein, Halten, Aus, Halten – rund 15 Minuten, und die Ausatmung wird Schritt für Schritt länger: vier Minuten 3-3-3-3, vier Minuten 4-4-4-4, vier Minuten 4-4-8-4 und zum Schluss rund drei Minuten 4-4-10-4.'),
      ('co2-ausatmung-fortgeschritten', 'CO2 Toleranz Ausatmung · Fortgeschritten', 'Für den Morgen, die Ausatmung wird länger', 2, 102,
       '4,4,4,4,15;4,4,8,4,12;4,4,10,4,11;5,5,15,5,6',
       'Immer Ein, Halten, Aus, Halten – rund 15 Minuten, und die Ausatmung wird Schritt für Schritt länger: vier Minuten 4-4-4-4, vier Minuten 4-4-8-4, vier Minuten 4-4-10-4 und zum Schluss drei Minuten 5-5-15-5.'),
      ('co2-ausatmung-expert', 'CO2 Toleranz Ausatmung · Expert', 'Für den Morgen, die Ausatmung wird länger', 3, 103,
       '4,4,8,4,12;4,4,10,4,11;5,5,15,5,10;7,7,41,5,2',
       'Immer Ein, Halten, Aus, Halten – rund 15 Minuten, und die Ausatmung wird Schritt für Schritt länger: vier Minuten 4-4-8-4, vier Minuten 4-4-10-4, fünf Minuten 5-5-15-5 und zum Schluss zwei Minuten 7-7-41-5.'),
      ('co2-halten-anfaenger', 'CO2 Toleranz Halten · Anfänger', 'Für den Abend, das Halten wird länger', 1, 104,
       '3,3,3,3,20;4,4,4,4,15;4,4,6,6,12;4,4,6,8,8',
       'Immer Ein, Halten, Aus, Halten – rund 15 Minuten, und das Halten nach dem Ausatmen wird Schritt für Schritt länger: vier Minuten 3-3-3-3, vier Minuten 4-4-4-4, vier Minuten 4-4-6-6 und zum Schluss rund drei Minuten 4-4-6-8.'),
      ('co2-halten-fortgeschritten', 'CO2 Toleranz Halten · Fortgeschritten', 'Für den Abend, das Halten wird länger', 2, 105,
       '4,4,4,4,15;4,4,6,6,12;4,4,6,8,11;5,5,7,13,6',
       'Immer Ein, Halten, Aus, Halten – rund 15 Minuten, und das Halten nach dem Ausatmen wird Schritt für Schritt länger: vier Minuten 4-4-4-4, vier Minuten 4-4-6-6, vier Minuten 4-4-6-8 und zum Schluss drei Minuten 5-5-7-13.'),
      ('co2-halten-expert', 'CO2 Toleranz Halten · Expert', 'Für den Abend, das Halten wird länger', 3, 106,
       '4,4,6,6,12;4,4,6,8,11;5,5,7,13,10;7,7,11,35,2',
       'Immer Ein, Halten, Aus, Halten – rund 15 Minuten, und das Halten nach dem Ausatmen wird Schritt für Schritt länger: vier Minuten 4-4-6-6, vier Minuten 4-4-6-8, fünf Minuten 5-5-7-13 und zum Schluss zwei Minuten 7-7-11-35.')
    ) as s(slug, title, subtitle, difficulty, sort_order, stages, description)
  loop
    continue when exists (select 1 from public.exercises where slug = r.slug);

    v_rounds := 0;
    v_seconds := 0;
    for v_position, v_values in
      select ord::int, string_to_array(part, ',')::int[]
        from unnest(string_to_array(r.stages, ';')) with ordinality as u(part, ord)
    loop
      v_rounds := v_rounds + v_values[5];
      v_seconds := v_seconds + v_values[5] * (v_values[1] + v_values[2] + v_values[3] + v_values[4]);
    end loop;

    insert into public.exercises (
      slug, category_id, type, playback_mode, visibility, title, subtitle,
      description_md, benefits_md, effects, contraindications_md,
      default_round_count, difficulty, estimated_seconds, sort_order, is_published
    ) values (
      r.slug,
      (select id from public.exercise_categories where slug = 'box'),
      'paced', 'timer', 'plus',
      r.title, r.subtitle, r.description || v_common, v_benefits,
      '{co2_toleranz}', v_notice,
      v_rounds, r.difficulty, v_seconds, r.sort_order, true
    )
    returning id into v_exercise;

    for v_position, v_values in
      select ord::int, string_to_array(part, ',')::int[]
        from unnest(string_to_array(r.stages, ';')) with ordinality as u(part, ord)
    loop
      insert into public.exercise_steps (exercise_id, position, label, repeat_count, rest_seconds)
      values (v_exercise, v_position,
              v_values[1] || '-' || v_values[2] || '-' || v_values[3] || '-' || v_values[4],
              v_values[5], 0)
      returning id into v_step;

      insert into public.exercise_phases (step_id, position, kind, duration_seconds, route, cue_text) values
        (v_step, 1, 'inhale',   v_values[1], 'nose', 'Sanft durch die Nase einatmen'),
        (v_step, 2, 'hold_in',  v_values[2], null,   'Locker halten'),
        (v_step, 3, 'exhale',   v_values[3], 'nose', 'Langsam ausatmen'),
        (v_step, 4, 'hold_out', v_values[4], null,   'Wird es zu viel: einmal frei atmen und wieder einsteigen');
    end loop;
  end loop;
end $$;

-- ===================================================================
-- 7. Habits zum Uebungsweg
-- ===================================================================
-- Je Session ein Habit, damit das Abatmen sich selbst eintraegt (exercise_id).
insert into public.habit_templates (
  slug, category_id, title, description_md, tracking_type,
  higher_is_better, points, is_negative, exercise_id, day_part, sort_order, is_published
)
select v.slug, c.id, e.title,
  'Die Session „' || e.title || '“ atmen, rund 15 Minuten. Wer sie zu Ende atmet, bekommt das Habit automatisch eingetragen. Bleib im Wohlgefühl: Wird es zu viel, atme zwischendurch einmal im eigenen Rhythmus und steig wieder ein, wann immer du dazu bereit bist.',
  'done', true, 8, false, e.id, v.day_part, v.sort_order, true
  from (values
    ('co2-ausatmung-anfaenger',       'morgens', 40),
    ('co2-ausatmung-fortgeschritten', 'morgens', 41),
    ('co2-ausatmung-expert',          'morgens', 42),
    ('co2-halten-anfaenger',          'abends',  44),
    ('co2-halten-fortgeschritten',    'abends',  45),
    ('co2-halten-expert',             'abends',  46)
  ) as v(slug, day_part, sort_order)
  join public.exercises e on e.slug = v.slug
  join public.habit_categories c on c.slug = 'atmung'
on conflict (slug) do nothing;

-- Der Walk ist ein Messwert wie BOLT: Punkte fuers Eintragen, nie Wertgrenzen.
insert into public.habit_templates (
  slug, category_id, title, description_md, tracking_type,
  unit, min_value, max_value, step_value, default_target, higher_is_better,
  points, is_negative, is_health_measure, day_part, sort_order, is_published
)
select 'co2-walk', c.id, 'CO2 Walk',
  'Beim Spazierengehen: Nach zwei bis drei normalen Atemzügen ausatmen, die Nase zuhalten, die Luft anhalten und die Schritte zählen, bis ein starker Atemreflex einsetzt. Dann wieder normal atmen und das Ganze beim Gehen mehrmals hintereinander wiederholen. Trag die Anzahl deiner Schritte ein. Neben dem BOLT-Wert ist sie ein Richtwert für deine CO2-Toleranz. Sie hängt aber sehr stark von der Tagesverfassung und anderen Dingen ab, aussagekräftig ist deshalb eher der Trend als der einzelne Tag. Bleib im Wohlgefühl und geh nur dort, wo du sicher unterwegs bist: abseits von Straßenverkehr, Treppen und Wasser. Wird dir schwindlig, bleib stehen und atme normal weiter. Bei Schwangerschaft oder Vorerkrankungen vorher ärztlich abklären.',
  'number', 'Schritte', 0, 500, 1, 30, true,
  8, false, true, 'tagsueber', 43, true
  from public.habit_categories c
 where c.slug = 'atmung'
on conflict (slug) do nothing;

-- ===================================================================
-- 8. Uebungsweg: eine Vorlage je Stufe
-- ===================================================================
insert into public.challenge_templates (slug, title, description_md, duration_days, is_preview, is_published, sort_order)
select v.slug, v.title,
  '28 Tage Training für deine CO2-Toleranz. Jeden Morgen zuerst den BOLT-Wert ermitteln, danach eine CO2 Toleranz Session mit langer Ausatmung. Zu Mittag der CO2 Walk. Am Abend eine CO2 Toleranz Session mit langem Halten. Die Sessions dauern rund 15 Minuten. Du bleibst dabei immer im Wohlgefühl: Wird es zu viel, atme einfach einmal im eigenen Rhythmus und steig wieder ein, wann immer du dazu bereit bist.',
  28, false, true, v.sort_order
  from (values
    ('co2-toleranz-anfaenger',       '28 Tage CO2-Toleranz: Anfänger',       20),
    ('co2-toleranz-fortgeschritten', '28 Tage CO2-Toleranz: Fortgeschritten', 21),
    ('co2-toleranz-expert',          '28 Tage CO2-Toleranz: Expert',         22)
  ) as v(slug, title, sort_order)
on conflict (slug) do nothing;

insert into public.challenge_template_items (template_id, habit_template_id, plan, sort_order)
select t.id, h.id, '{"daily": true}'::jsonb, v.sort_order
  from (values
    ('co2-toleranz-anfaenger',       'bolt-wert',                     1),
    ('co2-toleranz-anfaenger',       'co2-ausatmung-anfaenger',       2),
    ('co2-toleranz-anfaenger',       'co2-walk',                      3),
    ('co2-toleranz-anfaenger',       'co2-halten-anfaenger',          4),
    ('co2-toleranz-fortgeschritten', 'bolt-wert',                     1),
    ('co2-toleranz-fortgeschritten', 'co2-ausatmung-fortgeschritten', 2),
    ('co2-toleranz-fortgeschritten', 'co2-walk',                      3),
    ('co2-toleranz-fortgeschritten', 'co2-halten-fortgeschritten',    4),
    ('co2-toleranz-expert',          'bolt-wert',                     1),
    ('co2-toleranz-expert',          'co2-ausatmung-expert',          2),
    ('co2-toleranz-expert',          'co2-walk',                      3),
    ('co2-toleranz-expert',          'co2-halten-expert',             4)
  ) as v(template_slug, habit_slug, sort_order)
  join public.challenge_templates t on t.slug = v.template_slug
  join public.habit_templates h on h.slug = v.habit_slug and h.owner_id is null
on conflict (template_id, habit_template_id) do nothing;

-- ===================================================================
-- 9. News-Beitrag
-- ===================================================================
insert into public.news_posts
  (slug, title, category, visibility, is_pinned, published_at, excerpt, body_md)
values (
  'co2-toleranz',
  'Dein Atemreiz schlägt zu früh Alarm. Und du kannst das ändern.',
  'praxis', 'free', false, now(),
  'Nicht Sauerstoffmangel treibt dich zum nächsten Atemzug, sondern Kohlendioxid. Warum viele von uns darauf empfindlicher reagieren dürften als frühere Generationen und wie du deine Schwelle in 28 Tagen trainierst.',
$md$## Ein kleiner Test, bevor du weiterliest

Atme ganz normal aus. Halte dir die Nase zu und zähle die Sekunden, bis dein Körper dir deutlich sagt: Jetzt wieder atmen.

Merk dir die Zahl. Sie ist kein Urteil, aber ein Ausgangspunkt.

Denn was du gerade gespürt hast, war sehr wahrscheinlich gar kein Sauerstoffmangel. Bei gesunden Menschen ist nach so einer kurzen Pause noch reichlich Sauerstoff im Blut. Der Drang kommt von einem Stoff, den die meisten für ein reines Abgas halten: **Kohlendioxid**.

## Der Stoff mit dem schlechten Ruf

Sensoren im Hirnstamm messen laufend, wie viel CO2 im Blut ist, und genau daraus entsteht der Atemreiz. Dein Atem wird also vor allem vom CO2 gesteuert, nicht vom Sauerstoff.

Und CO2 ist weit mehr als ein Abfallprodukt:

- **Es hilft, den Sauerstoff abzuliefern.** Schon 1904 beschrieb der dänische Forscher Christian Bohr: Wo im Gewebe viel CO2 ist, gibt das Hämoglobin seinen Sauerstoff leichter ab.
- **Es hält die Blutgefäße im Gehirn weit.** Fällt das CO2, weil du zu viel atmest, verengen sie sich. Daher kommen Schwindel und Kribbeln, wenn jemand hyperventiliert.

Das ist das Paradox: Mehr Luft heißt nicht automatisch mehr Versorgung. Wer zu viel atmet, atmet das CO2 ab, das er eigentlich braucht.

## Warum unsere Schwelle wahrscheinlich gesunken ist

Ehrlich vorweg: Niemand hat die CO2-Toleranz unserer Urgroßeltern gemessen. Es gibt keine Kurve über hundert Jahre, und wer das behauptet, erzählt dir zu viel. Aber fast alles, was diese Schwelle von selbst trainiert hat, ist aus unserem Alltag verschwunden. Und das, was sie senken dürfte, ist dazugekommen.

**Wir bewegen uns kaum noch.** Eine Studie an Amish in Kanada, die ohne Auto und weitgehend ohne Maschinen leben, zählte bei Männern rund 18.000 und bei Frauen rund 14.000 Schritte am Tag. Der weltweite Durchschnitt liegt laut einer Auswertung von Smartphone-Daten bei rund 5.000. Jede harte körperliche Arbeit lässt das CO2 steigen und zeigt dem Körper: Das ist normal. Dieses tägliche Training fehlt uns heute.

**Wir stehen unter Dauerstrom.** Stress beschleunigt den Atem. Mails, Termine, Nachrichten: Der Körper bekommt ständig das Signal, sich bereitzumachen, und atmet entsprechend, oft auch dann, wenn du still am Schreibtisch sitzt.

**Wir atmen oft mit offenem Mund.** Durch den Mund strömt die Luft mit wenig Widerstand, und es wird leicht mehr, als der Körper gerade braucht.

**Wir halten nichts mehr aus.** Der leiseste Reiz wird sofort beantwortet: ein Seufzer, ein tiefer Atemzug, ein Griff zum Fenster.

Das kann sich aufschaukeln. Wer dauerhaft ein wenig zu viel atmet, gewöhnt den Körper an weniger CO2. Der Alarm springt dann früher an. Du atmest also noch mehr, und das CO2 bleibt niedrig. Du merkst davon nichts, außer vielleicht, dass du öfter seufzt, dass Treppen dich schneller außer Atem bringen und dass dich der Atem nicht mehr beruhigt, sondern antreibt.

## Was eine höhere Toleranz bringen kann

Die gute Nachricht: Die Empfindlichkeit auf CO2 ist keine feste Größe.

- **Der Körper gewöhnt sich.** Studien an Apnoetaucherinnen und -tauchern zeigen, dass sie auf steigendes CO2 deutlich schwächer reagieren als andere Menschen. Ganz so weit musst du gar nicht kommen, aber es zeigt, wie groß der Spielraum ist.
- **Ein falscher Alarm lässt sich beruhigen.** Der Psychiater Donald Klein beschrieb Panikattacken 1993 als möglichen „falschen Erstickungsalarm“. Die Forscherin Alicia Meuret und ihr Team trainierten Menschen mit Panikstörung vier Wochen lang darin, ihr zu niedriges CO2 anzuheben, und ihre Panik wurde deutlich schwächer. Das war begleitete Therapie und kein Selbstversuch. Aber es zeigt: Am Atem lässt sich etwas verändern, das viel weiter reicht als die Lunge.
- **Schon kurze Praxis wirkt.** In einer randomisierten Studie aus Stanford (2023) verbesserten fünf Minuten Atemübungen täglich innerhalb eines Monats die Stimmung und senkten die Atemfrequenz in Ruhe, stärker als Achtsamkeitsmeditation.

Was noch offen ist, sagen wir dir genauso: Direkte Langzeitstudien zum CO2-Toleranz-Training im Alltag fehlen bisher, und auch der BOLT-Wert ist kein medizinischer Messwert. Bei hochtrainierten Eisschnellläuferinnen und -läufern hing er in einer Studie nicht mit der Leistung zusammen. Deshalb schauen wir auf deinen eigenen Verlauf, nicht auf eine Norm.

Aber frag dich selbst: Wie viel wäre es dir wert, wenn dein Atem in einer stressigen Situation ruhig bleibt und der Alarm erst dann losgeht, wenn wirklich etwas los ist?

## Vier Wochen, die du spüren kannst

Genau dafür haben wir den Übungsweg **28 Tage CO2-Toleranz** gebaut, in drei Stufen: Anfänger, Fortgeschritten und Expert.

- **Am Morgen:** BOLT-Wert ermitteln, danach rund 15 Minuten „CO2 Toleranz Ausatmung“.
- **Zu Mittag:** der CO2 Walk. Beim Gehen nach dem Ausatmen die Luft anhalten und die Schritte zählen. Die Zahl trägst du ein und siehst deinen Trend im Diagramm.
- **Am Abend:** rund 15 Minuten „CO2 Toleranz Halten“.

Die Abstände wachsen in jeder Session Schritt für Schritt. Du musst nichts erzwingen, denn das Wichtigste bei dieser Übung ist: **Du bleibst immer im Wohlgefühl.** Wird es zu viel, atme zwischendurch einfach einmal im eigenen Rhythmus und steig wieder ein, wann immer du dazu bereit bist.

Mach den Test vom Anfang noch einmal am 28. Tag. Und dann vergleich die beiden Zahlen.

> Wenn du schwanger bist oder eine Herz-Kreislauf-Erkrankung, Epilepsie, eine Panikstörung oder eine andere Vorerkrankung hast, sprich vorher bitte mit deiner Ärztin oder deinem Arzt. Atemübungen ersetzen keine Behandlung. Übe nie beim Autofahren und nie im oder am Wasser.

Der Übungsweg und seine Sessions gehören zu Plus.

[Zum Übungsweg 28 Tage CO2-Toleranz](/habit-tracker/challenges)
$md$
)
on conflict (slug) do nothing;
