-- ---------- Stimme standardmaessig an (14.09.2026) ----------
-- Migration 0016 hat voice_enabled mit Vorgabe false angelegt: eine Ansage bei
-- jedem Phasenwechsel galt als Entscheidung, nicht als Grundeinstellung. Mit
-- dem Umbau des Players ist das umgedreht. Die Schalter fuer Ton und Stimme
-- stehen jetzt in einem eingeklappten Block "Einstellungen" - wer die Stimme
-- nie gehoert hat, sucht dort nicht nach ihr. Dazu kommt seit PR #72 die
-- Schlussansage, die das Ende der Session erkennbar macht.
--
-- Additiv (CLAUDE.md §Migrationen): nur die Vorgabe aendert sich, keine Spalte
-- verschwindet oder heisst anders. Die alte App-Version schreibt voice_enabled
-- nur beim Umschalten und liest es mit eigener Rueckfallvorgabe - sie laeuft
-- unveraendert weiter.
--
alter table public.profiles
  alter column voice_enabled set default true;

-- AUCH BESTEHENDE PROFILE WERDEN EINMALIG UMGESTELLT
-- --------------------------------------------------
-- Eine geaenderte Vorgabe wirkt nur auf neue Zeilen. Jedes bestehende Profil
-- traegt false, und zwar ununterscheidbar: ob jemand die Stimme bewusst
-- abgeschaltet hat oder sie nur nie angefasst, steht nirgends.
--
-- Entschieden am 14.09.2026: alle auf an. Die Stimme gibt es erst seit dem
-- 06.09.2026, der Schalter lag bis heute offen im Player - die allermeisten
-- false stammen aus der alten Vorgabe, nicht aus einer Entscheidung. Wer die
-- Stimme in dieser Woche bewusst abgeschaltet hat, hoert sie einmal wieder
-- und schaltet sie unter "Einstellungen" erneut ab; von da an bleibt es aus.
--
-- Laeuft genau einmal, als Migration - nicht bei jedem Start. Spaetere
-- Abschaltungen beruehrt es nicht.
--
-- Nebenwirkungen, beide geprueft:
--   * trg_profiles_protect_entitlement sperrt nur has_active_subscription und
--     plus_until; voice_enabled laeuft durch.
--   * trg_profiles_updated setzt updated_at der umgestellten Profile auf den
--     Zeitpunkt der Migration. Kein Ablauf liest updated_at von profiles.
update public.profiles
   set voice_enabled = true
 where voice_enabled = false;

comment on column public.profiles.voice_enabled is
  'Gesprochene Phasen- und Schlussansagen. Vorgabe an seit Migration 0018 '
  '(vorher aus); bestehende Profile wurden dabei einmalig auf an gestellt.';
