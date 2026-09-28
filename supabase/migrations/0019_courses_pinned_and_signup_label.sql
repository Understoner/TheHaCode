-- ---------- Kurse: angeheftet und eigene Beschriftung des Knopfs (SAD §3.13) ----------
-- Anlass: "Atmung nach Maß", ein Anfrage-Angebot ohne Termin. Es soll auf
-- /kurse IMMER als erstes stehen. Die Liste sortiert aber nach starts_at, und
-- ein Kurs ohne Termin steht dort bewusst am Ende (useCoursesList.ts). Ein
-- Termin in der Vergangenheit als Trick fiele wiederum aus der Liste heraus.
-- Also ein eigener Schalter, benannt wie bei news_posts.is_pinned (0002).
--
-- Und der Knopf heisst dort nicht "Anmelden", sondern "Jetzt individuelles
-- Angebot anfragen". Der Text ist Redaktionsinhalt wie der Titel, deshalb
-- eine Spalte statt eines Sonderfalls im Code.
--
-- Additiv nach CLAUDE.md: is_pinned mit Default, signup_label nullable. Die
-- alte App-Version liest beide nicht und zeigt den Kurs einfach nach Termin
-- (also am Ende) mit "Anmelden" - nichts bricht, in beliebiger Reihenfolge
-- ausgerollt.
alter table public.courses
  add column if not exists is_pinned boolean not null default false;

alter table public.courses
  add column if not exists signup_label text;

comment on column public.courses.is_pinned is
  'true = steht auf /kurse vor allen datierten Kursen, unabhaengig vom Termin.';

comment on column public.courses.signup_label is
  'Beschriftung des Knopfs zu signup_url. null = "Anmelden" aus der Uebersetzung.';
