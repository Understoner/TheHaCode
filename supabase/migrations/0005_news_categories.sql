-- ---------- News-Kategorien (Filter auf der Landing Page) ----------
-- Additiv (CLAUDE.md §Migrationen): neue Spalte mit Default, keine bestehende
-- angefasst - alte und neue App-Version laufen beide mit diesem Schema.
create type news_category as enum ('praxis', 'blog', 'kurs', 'allgemein');

alter table public.news_posts
  add column category news_category not null default 'allgemein';
