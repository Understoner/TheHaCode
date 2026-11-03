-- 0047: Onlinekurse in der Kurse-Seite (V1.2, Wunsch des Teams 03.11.2026).
--
-- Die On-Demand-Kurse stehen nicht mehr auf einer eigenen Seite, sondern auf
-- /kurse neben den Live-Terminen. Dafuer zwei Angaben der Redaktion:
--
--   level         Einsteiger, Fortgeschrittene oder Experten - farbig wie
--                 die Reihen der Live-Kurse (Online Relax, Vor Ort ...).
--                 NULL = ohne Angabe.
--   is_featured   Der hervorgehobene On-Demand-Kurs, der neben dem naechsten
--                 Live-Termin steht. Hoechstens einer (Index unten).
--
-- Additiv (SAD §2.6): zwei Spalten mit Vorgabe bzw. nullable.

alter table public.online_courses
  add column if not exists level text
    constraint chk_online_course_level check (level in ('einsteiger', 'fortgeschritten', 'experten')),
  add column if not exists is_featured boolean not null default false;

create unique index if not exists uq_online_courses_one_featured
  on public.online_courses (is_featured) where is_featured;

comment on column public.online_courses.level is
  'Stufe: einsteiger, fortgeschritten, experten; NULL = ohne Angabe (0047).';
comment on column public.online_courses.is_featured is
  'Hervorgehoben neben dem naechsten Live-Termin auf /kurse; hoechstens einer (0047).';
