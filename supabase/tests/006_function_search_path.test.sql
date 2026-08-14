-- supabase/tests/006_function_search_path.test.sql
--
-- Zwei Dinge, die bisher ungeprueft waren:
--   1. der feste search_path aller public-Funktionen (Migration 0006)
--   2. die Sichtbarkeitsvererbung von news_translations auf news_posts -
--      die einzige Policy im Schema, die ihre Bedingung nicht selbst traegt,
--      sondern aus einer Unterabfrage bezieht. Genau dort waere ein Leck am
--      leisesten (CLAUDE.md: pro Policy ein Missbrauchsfall).
begin;
select plan(7);

-- ---------- 1. search_path ----------
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
      )),
  0,
  'jede Funktion in public hat einen festgeschriebenen search_path'
);

select is(
  (select proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'),
  -- Postgres speichert den leeren search_path als search_path="" ab
  array['search_path=""'],
  'is_admin() faellt auf gar kein Schema mehr zurueck'
);

-- Die Absicherung darf die Funktion nicht kaputtgemacht haben: ohne
-- Admin-Claim bleibt is_admin() false, mit Claim wird es true.
select is(public.is_admin(), false, 'is_admin() ohne Admin-Claim bleibt false');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'app_metadata', json_build_object('role', 'admin')
  )::text,
  true
);
select is(public.is_admin(), true, 'is_admin() erkennt app_metadata.role = admin weiterhin');
select set_config('request.jwt.claims', null, true);

-- ---------- 2. news_translations erbt die Sichtbarkeit ----------
insert into public.news_posts (id, slug, title, body_md, visibility, published_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'entwurf-intern', 'Interner Entwurf', 'Text', 'free', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'nur-plus',       'Nur fuer Plus',    'Text', 'plus', now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'oeffentlich',    'Oeffentlich',      'Text', 'free', now() - interval '1 day');

insert into public.news_translations (post_id, locale, title, body_md) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'en', 'Internal draft', 'Body'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'en', 'Plus only',      'Body'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'en', 'Public',         'Body');

set local role anon;

-- Missbrauchsfall: der Umweg ueber die Uebersetzungstabelle darf weder den
-- unveroeffentlichten Entwurf noch den bezahlten Beitrag preisgeben.
select is(
  (select count(*)::int from public.news_translations
    where post_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'anon kommt ueber news_translations nicht an einen unveroeffentlichten Entwurf'
);

select is(
  (select count(*)::int from public.news_translations
    where post_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'anon kommt ueber news_translations nicht an einen Plus-Beitrag'
);

-- Normalfall: der oeffentliche Beitrag bleibt uebersetzbar lesbar
select is(
  (select title from public.news_translations
    where post_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'Public',
  'die Uebersetzung eines oeffentlichen Beitrags bleibt lesbar'
);

reset role;

select * from finish();
rollback;
