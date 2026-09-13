-- supabase/tests/017_favoriten_und_playlists.test.sql
--
-- Zwei Ergaenzungen aus Migration 0017, beide an Stellen, an denen ein Fehler
-- still bliebe statt laut zu scheitern:
--
--   1. exercise_favorites ist eine Nutzertabelle. Vier neue Policies heissen
--      vier Missbrauchsfaelle (CLAUDE.md): fremde Sterne lesen, fremde Sterne
--      setzen, fremde Sterne loeschen - und der Stern als Weg, IDs
--      durchzuprobieren, die man gar nicht sehen darf.
--   2. Die Playlist-Adressen landen am Ende in Linking.openURL. Was hier
--      hineindarf, entscheidet damit mit, was im Browser des Besuchers laufen
--      kann. Redaktionelle Sequenzen werden im Studio ohne
--      Formularvalidierung gepflegt (SAD §2.4) - die Datenbank ist der Ort,
--      an dem ein "javascript:..." gar nicht erst hineinkommt.
begin;
select plan(19);

delete from public.exercises;

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'stern@example.at'),
  ('c0000000-0000-0000-0000-000000000002', 'fremder@example.at'),
  ('c0000000-0000-0000-0000-000000000003', 'ohne-plus@example.at');

-- Plus nur ueber service_role - der Schutztrigger aus 0001 laesst nichts
-- anderes zu.
set local role service_role;
update public.profiles set has_active_subscription = true
 where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');
reset role;

-- Drei redaktionelle Sequenzen: eine fuer alle, eine nur fuer Plus, eine noch
-- unveroeffentlicht. Zusammen decken sie alle drei Zweige der Lesepolicy aus
-- 0007 ab, an der die Favoriten-Policy haengt.
insert into public.exercises (slug, type, title, visibility, is_published, default_round_count)
values
  ('test-stern-frei',    'paced', 'Frei fuer alle', 'free', true,  1),
  ('test-stern-plus',    'paced', 'Nur mit Plus',   'plus', true,  1),
  ('test-stern-entwurf', 'paced', 'Noch Entwurf',   'free', false, 1);

-- Und eine eigene Sequenz: der Stern soll fuer beide Sorten gelten.
insert into public.exercises (owner_id, type, playback_mode, visibility, is_published, title, default_round_count)
values ('c0000000-0000-0000-0000-000000000001', 'paced', 'timer', 'plus', false, 'Meine eigene', 4);

-- Die IDs muessen VON AUSSEN kommen (dieselbe Falle wie in
-- 009_save_exercise.test.sql): holt der Angreifer sie selbst per
-- Unterabfrage, liefert RLS ihm NULL, der Angriff laeuft ins Leere und der
-- Test waere gruen, ohne je einen Angriff versucht zu haben. Der echte
-- Angreifer kennt die ID, etwa aus einem geteilten Link.
create temporary table ids (name text, id uuid);
insert into ids
  select 'frei',    id from public.exercises where slug = 'test-stern-frei'
  union all
  select 'plus',    id from public.exercises where slug = 'test-stern-plus'
  union all
  select 'entwurf', id from public.exercises where slug = 'test-stern-entwurf'
  union all
  select 'eigen',   id from public.exercises where title = 'Meine eigene';
grant select on ids to authenticated;

-- ============================================================
-- 1. Der Normalfall
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into public.exercise_favorites (user_id, exercise_id)
     values ('c0000000-0000-0000-0000-000000000001', (select id from ids where name = 'frei')) $$,
  'Eine allgemein bereitgestellte Sequenz laesst sich mit einem Stern markieren');

-- Der zweite Teil der Aufgabe: derselbe Stern an einer selbst gebauten
-- Sequenz. Fuer den Stern ist eine Sequenz eine Sequenz.
select lives_ok(
  $$ insert into public.exercise_favorites (user_id, exercise_id)
     values ('c0000000-0000-0000-0000-000000000001', (select id from ids where name = 'eigen')) $$,
  'Und eine eigene Sequenz ebenso');

select is(
  (select count(*)::int from public.exercise_favorites),
  2,
  'Beide Sterne stehen da');

-- Ein Stern je Person und Sequenz: ohne den unique-Constraint legte ein
-- zweiter Klick auf einem anderen Geraet eine zweite Zeile an, und der Filter
-- zeigte die Sequenz doppelt.
select throws_ok(
  $$ insert into public.exercise_favorites (user_id, exercise_id)
     values ('c0000000-0000-0000-0000-000000000001', (select id from ids where name = 'frei')) $$,
  '23505',
  null,
  'Derselbe Stern laesst sich kein zweites Mal setzen');

-- ============================================================
-- 2. Missbrauch: der Stern im Namen eines anderen
-- ============================================================
select throws_ok(
  $$ insert into public.exercise_favorites (user_id, exercise_id)
     values ('c0000000-0000-0000-0000-000000000002', (select id from ids where name = 'frei')) $$,
  '42501',
  null,
  'Ein Stern laesst sich nicht im Namen eines anderen setzen');

-- ============================================================
-- 3. Missbrauch: der Stern als Weg, unsichtbare IDs zu bestaetigen
-- ============================================================
-- Ohne die exists-Pruefung im with check waere ein erfolgreicher Stern die
-- Auskunft "diese ID gibt es" - fuer jede ID, die jemand durchprobiert.
select throws_ok(
  $$ insert into public.exercise_favorites (user_id, exercise_id)
     values ('c0000000-0000-0000-0000-000000000001', (select id from ids where name = 'entwurf')) $$,
  '42501',
  null,
  'Eine unveroeffentlichte Sequenz laesst sich nicht markieren');

-- Mit Plus geht die Plus-Sequenz ...
select lives_ok(
  $$ insert into public.exercise_favorites (user_id, exercise_id)
     values ('c0000000-0000-0000-0000-000000000001', (select id from ids where name = 'plus')) $$,
  'Mit Plus laesst sich eine Plus-Sequenz markieren');

-- ... ohne Plus nicht. Der Stern selbst kostet nichts (has_plus_access steht
-- nicht in der Favoriten-Policy) - er reicht aber auch niemandem etwas durch,
-- was er nicht ohnehin sehen darf.
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$ insert into public.exercise_favorites (user_id, exercise_id)
     values ('c0000000-0000-0000-0000-000000000003', (select id from ids where name = 'plus')) $$,
  '42501',
  null,
  'Ohne Plus laesst sich eine Plus-Sequenz nicht markieren');

-- ============================================================
-- 4. Missbrauch: fremde Sterne lesen und loeschen
-- ============================================================
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);

select is(
  (select count(*)::int from public.exercise_favorites),
  0,
  'Die Sterne eines anderen sind nicht zu sehen');

-- RLS laesst das DELETE nicht scheitern, es trifft schlicht keine Zeile -
-- deshalb wird danach gezaehlt und nicht auf eine Ausnahme geprueft.
select lives_ok(
  $$ delete from public.exercise_favorites
      where user_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'Ein DELETE auf fremde Sterne laeuft ins Leere, statt zu scheitern');

reset role;
select is(
  (select count(*)::int from public.exercise_favorites
    where user_id = 'c0000000-0000-0000-0000-000000000001'),
  3,
  'Und hat die fremden Sterne nicht angefasst');

-- ============================================================
-- 5. Kaskade: eine geloeschte Sequenz nimmt ihre Sterne mit
-- ============================================================
-- Sonst zeigte der Favoritenfilter auf etwas, das es nicht mehr gibt.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
delete from public.exercises where id = (select id from ids where name = 'eigen');
reset role;

select is(
  (select count(*)::int from public.exercise_favorites
    where exercise_id = (select id from ids where name = 'eigen')),
  0,
  'Mit der Sequenz verschwindet auch der Stern darauf');

-- ============================================================
-- 6. Die Playlist-Adressen
-- ============================================================
select lives_ok(
  $$ update public.exercises
        set spotify_url     = 'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY',
            apple_music_url = 'https://music.apple.com/at/playlist/entspannung/pl.u-abc123'
      where slug = 'test-stern-frei' $$,
  'Eine Spotify- und eine Apple-Music-Adresse lassen sich hinterlegen');

-- Der eigentliche Grund fuer die Pruefung in der Datenbank: die Redaktion
-- arbeitet im Studio ohne Formularvalidierung, und die Adresse landet am Ende
-- in Linking.openURL.
select throws_ok(
  $$ update public.exercises set spotify_url = 'javascript:alert(1)'
      where slug = 'test-stern-frei' $$,
  '23514',
  null,
  'Ein "javascript:"-Eintrag kommt gar nicht erst hinein');

select throws_ok(
  $$ update public.exercises set apple_music_url = 'https://boeser-dienst.example/playlist'
      where slug = 'test-stern-frei' $$,
  '23514',
  null,
  'Und eine fremde Domain im Apple-Feld ebenso wenig');

-- ============================================================
-- 7. save_exercise traegt die Adressen mit
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ select public.save_exercise(
       null, 'Mit Musik', null,
       $json$[{ "repeat_count": 4, "rest_seconds": 0,
                "phases": [{ "kind": "inhale", "duration_seconds": 4 },
                           { "kind": "exhale", "duration_seconds": 6 }] }]$json$::jsonb,
       'https://open.spotify.com/playlist/abc',
       'https://music.apple.com/at/playlist/abc') $$,
  'save_exercise nimmt die beiden Adressen entgegen');

select is(
  (select array[spotify_url, apple_music_url] from public.exercises where title = 'Mit Musik'),
  array['https://open.spotify.com/playlist/abc', 'https://music.apple.com/at/playlist/abc'],
  'und legt sie an der Sequenz ab');

-- Der Grund, warum die alte, vierstellige Fassung die vorhandenen Werte liest
-- statt null durchzureichen: eine noch ausgelieferte App-Version kennt die
-- Felder nicht und darf sie deshalb auch nicht leeren (CLAUDE.md
-- §Migrationen - alte App-Version und neues Schema muessen zusammen laufen).
select lives_ok(
  $$ select public.save_exercise(
       (select id from public.exercises where title = 'Mit Musik'),
       'Mit Musik, umbenannt', null,
       $json$[{ "repeat_count": 4, "rest_seconds": 0,
                "phases": [{ "kind": "inhale", "duration_seconds": 4 }] }]$json$::jsonb) $$,
  'Die alte Fassung mit vier Parametern laeuft weiter');

reset role;
select is(
  (select spotify_url from public.exercises where title = 'Mit Musik, umbenannt'),
  'https://open.spotify.com/playlist/abc',
  'und loescht die Playlist nicht, die sie gar nicht kennt');

select * from finish();
rollback;
