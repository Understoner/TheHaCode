-- ---------- Kurse bekommen einen Langtext (SAD §3.13) ----------
-- Bis hierher trug courses.description beides: den Satz, mit dem die Kachel auf
-- /kurse wirbt, UND alles, was ein Interessent wissen muss. Auf der
-- Uebersichtsseite wurde daraus eine Textwand - dieselbe Ueberlegung wie bei
-- news_posts, wo excerpt und body_md schon immer getrennt sind.
--
-- Additiv nach CLAUDE.md: neue Spalte, nullable. Die alte App-Version liest
-- weiterhin nur description, die neue faellt ohne body_md auf description
-- zurueck. Beide Richtungen laufen, in beliebiger Reihenfolge ausgerollt.
alter table public.courses
  add column if not exists body_md text;

comment on column public.courses.body_md is
  'Langtext in Markdown fuer /kurse/<slug>. null ist erlaubt: dann zeigt die Detailseite description.';
