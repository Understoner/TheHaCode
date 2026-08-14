import type { PhaseKind } from '@/types/breathing';

// Toene ueber die Web Audio API, keine einzige Audiodatei (CLAUDE.md:
// "Audiodateien fuer Cues oder Musik" sind verboten; SAD §7.5).
//
// Kein Laden, kein Cache, keine Lizenzfrage, keine Sprachaufnahme - und es
// funktioniert in jeder Sprache. Musik bringt der Nutzer in seiner eigenen App
// mit; deshalb auch bewusst keine durchgehende Wiedergabe, die wuerde auf dem
// Handy den Audiofokus greifen und fremde Musik abwuergen.

const PITCH: Record<PhaseKind, number> = {
  inhale: 523.25, // C5 - aufwaerts gerichtet
  hold_in: 659.25, // E5
  exhale: 392.0, // G4 - tiefer, ausklingend
  hold_out: 329.63, // E4
  free_breathing: 0,
};

// Phasen unter dieser Laenge bleiben stumm, sonst stolpern die Toene
// uebereinander (SAD §7.5).
const MIN_PHASE_MS = 1200;

type Ctor = new () => AudioContext;

/**
 * Der AudioContext darf erst auf eine Nutzergeste entstehen - ein Aufruf aus
 * useEffect heraus wird von Browsern blockiert. Ausloeser ist der Tap auf
 * "Starten", nicht das Oeffnen des Screens.
 */
export function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

/** Ein kurzer Ton zum Phasenbeginn. Kein Ton, wenn die Phase zu kurz ist. */
export function playCue(
  ctx: AudioContext | null,
  kind: PhaseKind,
  phaseDurationMs: number,
  volume = 0.25
): void {
  if (!ctx) return;
  if (phaseDurationMs < MIN_PHASE_MS) return;

  const freq = PITCH[kind];
  if (!freq) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  // Kurze Huellkurve: 15 ms an, 180 ms aus. Ohne Ausblenden knackt es.
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}
