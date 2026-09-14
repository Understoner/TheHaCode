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
-- BESTEHENDE ZEILEN BLEIBEN WIE SIE SIND
-- --------------------------------------
-- Eine geaenderte Vorgabe wirkt nur auf neue Zeilen. Jedes bestehende Profil
-- traegt schon false, und zwar ununterscheidbar: ob jemand die Stimme bewusst
-- abgeschaltet hat oder nur nie angefasst, steht nirgends. Ein update auf
-- true wuerde bewusste Abschaltungen stillschweigend rueckgaengig machen.
-- Sollen bestehende Konten doch umgestellt werden, ist das eine eigene,
-- ausdrueckliche Migration.
alter table public.profiles
  alter column voice_enabled set default true;

comment on column public.profiles.voice_enabled is
  'Gesprochene Phasen- und Schlussansagen. Vorgabe an seit Migration 0018 '
  '(vorher aus); bestehende Profile wurden dabei nicht umgestellt.';
