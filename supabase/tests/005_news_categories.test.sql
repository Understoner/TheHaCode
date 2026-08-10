-- supabase/tests/005_news_categories.test.sql
begin;
select plan(3);

insert into public.news_posts (id, slug, title, body_md, visibility, published_at, category) values
  ('55555555-5555-5555-5555-555555555555', 'atmung-im-alltag', 'Atmung im Alltag', 'Text', 'free', now() - interval '1 day', 'praxis'),
  ('66666666-6666-6666-6666-666666666666', 'ohne-kategorie',   'Ohne Kategorie',   'Text', 'free', now() - interval '1 day', default);

select is(
  (select category::text from public.news_posts where slug = 'ohne-kategorie'), 'allgemein',
  'ohne Angabe faellt eine News auf die Kategorie allgemein zurueck'
);

set local role anon;

select is(
  (select count(*)::int from public.news_posts where category = 'praxis'),
  1,
  'anon kann veroeffentlichte News nach Kategorie filtern'
);

select is(
  (select slug from public.news_posts where category = 'praxis' limit 1), 'atmung-im-alltag',
  'die gefilterte News ist die tatsaechlich passende'
);

reset role;

select * from finish();
rollback;
