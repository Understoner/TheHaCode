-- 0051: Die Stimme der Ansagen ist waehlbar (06.11.2026).
--
-- Wunsch des Users: Michael, Louisa und Alexander, Standard ist Alexander. Das
-- gilt auch fuer bestehende Konten, bis jemand selbst waehlt. Die Stimme steht wie
-- die Schalter fuer Ton und Stimme am Profil und gilt damit auf jedem Geraet.
-- Die Liste der Stimmen steht in src/features/breathing/voice.ts; ein Wert, den
-- die App nicht kennt, wird die Vorgabe. Darum hier nur die Form, keine Liste: eine
-- neue Stimme braucht keine Migration.
--
-- Additiv (SAD §2.6): neue Spalte mit Default. Die alte App kennt sie nicht.

alter table public.profiles
  add column if not exists voice_id text not null default 'alexander'
    constraint chk_profile_voice_id check (voice_id ~ '^[a-z]{1,30}$');

comment on column public.profiles.voice_id is
  'Gewaehlte Stimme der Ansagen, siehe src/features/breathing/voice.ts (0051).';
