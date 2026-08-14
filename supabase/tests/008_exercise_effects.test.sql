-- supabase/tests/008_exercise_effects.test.sql
begin;
select plan(5);

delete from public.exercises;

insert into public.exercises (slug, type, visibility, title, default_round_count, is_published, effects) values
  ('mit-zwei',  'paced', 'free', 'Zwei Effekte',  4, true,  '{entspannend,stressreduktion}'),
  ('mit-einem', 'paced', 'free', 'Ein Effekt',    4, true,  '{co2_toleranz}'),
  ('ohne',      'paced', 'free', 'Ohne Angabe',   4, true,  default),
  ('entwurf',   'paced', 'free', 'Entwurf',       4, false, '{entspannend}');

select is(
  (select effects from public.exercises where slug = 'ohne'),
  '{}'::exercise_effect[],
  'ohne Angabe bleibt die Effektliste leer statt null'
);

set local role anon;

-- Der Filter der Uebersichtsseite: "enthaelt", nicht "ist gleich" - eine
-- Uebung mit mehreren Effekten muss unter jedem einzelnen auffindbar sein.
select is(
  (select count(*)::int from public.exercises where effects @> '{entspannend}'),
  1,
  'anon findet die Uebung ueber einen ihrer mehreren Effekte'
);

select is(
  (select count(*)::int from public.exercises where effects @> '{stressreduktion}'),
  1,
  'dieselbe Uebung ist auch ueber ihren zweiten Effekt auffindbar'
);

select is(
  (select slug from public.exercises where effects @> '{co2_toleranz}'),
  'mit-einem',
  'der Filter liefert die tatsaechlich passende Uebung'
);

-- Missbrauchsfall: der Filter darf die Sichtbarkeitsregel nicht aushebeln.
-- Der Entwurf traegt denselben Effekt wie eine veroeffentlichte Uebung.
select is(
  (select count(*)::int from public.exercises where effects @> '{entspannend}' and not is_published),
  0,
  'ueber den Effektfilter wird kein unveroeffentlichter Entwurf sichtbar'
);

reset role;

select * from finish();
rollback;
