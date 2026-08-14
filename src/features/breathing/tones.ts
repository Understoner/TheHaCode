import type { PhaseKind } from '@/types/breathing';

// Toene ueber die Web Audio API, keine einzige Audiodatei (CLAUDE.md:
// "Audiodateien fuer Cues oder Musik" sind verboten; SAD §7.5).
//
// Klangbild: Handpan. Der Unterschied zum reinen Sinus des ersten Entwurfs
// liegt nicht in der Tonhoehe, sondern in drei Dingen:
//
//   1. Obertoene. Eine Handpan ist auf Oktave und Duodezime gestimmt - jedes
//      Tonfeld klingt gleichzeitig mit f, 2f und 3f. Genau das macht den
//      typischen "hohlen" Klang aus. Dazu ein leiser, unharmonischer Anteil
//      bei 5,4f fuer das metallische Anschlaggeraeusch.
//   2. Huellkurve je Teilton. Hohe Teiltoene verklingen deutlich schneller
//      als der Grundton - deshalb klingt der Ton weich aus statt abrupt zu
//      enden. Alle Teiltoene teilen sich einen kurzen Anschlag von 6 ms.
//   3. Tiefpass, der mitfaellt. Beim Anschlag ist der Klang offen, danach
//      wird er dunkler. Ohne das klingt es nach Synthesizer, nicht nach Metall.
//
// Musik bringt der Nutzer weiterhin in seiner eigenen App mit; deshalb auch
// hier keine durchgehende Wiedergabe, die wuerde auf dem Handy den Audiofokus
// greifen und fremde Musik abwuergen.

// Grundtoene je Phase. Pentatonisch gewaehlt (D4 F4 A4 C5) statt einer
// Dur-Tonleiter - Handpans sind fast immer pentatonisch gestimmt, und
// benachbarte Toene daraus klingen in jeder Reihenfolge zusammen.
const PITCH: Record<PhaseKind, number> = {
  inhale: 440.0, // A4 - aufwaerts gerichtet
  hold_in: 523.25, // C5
  exhale: 293.66, // D4 - tief, traegt das Ausatmen
  hold_out: 349.23, // F4
  free_breathing: 0,
};

// Teiltoene einer Handpan: Grundton, Oktave, Duodezime - dazu ein leiser
// unharmonischer Anteil fuer den Anschlag. Werte: [Frequenzverhaeltnis,
// Lautstaerkeanteil, Abklingdauer in Sekunden].
const PARTIALS: [ratio: number, gain: number, decay: number][] = [
  [1.0, 1.0, 1.9], // Grundton, traegt am laengsten
  [2.0, 0.42, 1.2], // Oktave
  [3.0, 0.22, 0.8], // Duodezime
  [5.4, 0.07, 0.28], // unharmonisch, nur der Anschlag
];

const ATTACK_S = 0.006;

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

/** Ein angeschlagener Handpan-Ton zum Phasenbeginn. Stumm bei kurzen Phasen. */
export function playCue(
  ctx: AudioContext | null,
  kind: PhaseKind,
  phaseDurationMs: number,
  volume = 0.22
): void {
  if (!ctx) return;
  if (phaseDurationMs < MIN_PHASE_MS) return;

  const freq = PITCH[kind];
  if (!freq) return;

  const t = ctx.currentTime;

  // Der Ton soll nie laenger klingen als die Phase dauert, sonst ueberlagern
  // sich zwei Anschlaege.
  const maxDecay = Math.min(1.9, phaseDurationMs / 1000 - 0.15);
  if (maxDecay <= ATTACK_S) return;

  // Tiefpass, der mitfaellt: offen beim Anschlag, danach dunkler.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(freq * 8, t);
  filter.frequency.exponentialRampToValueAtTime(freq * 2, t + Math.min(0.9, maxDecay));

  const out = ctx.createGain();
  out.gain.value = volume;
  filter.connect(out).connect(ctx.destination);

  for (const [ratio, gain, decay] of PARTIALS) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    // Winzige Verstimmung der oberen Teiltoene: exakt ganzzahlige Verhaeltnisse
    // klingen synthetisch, echtes Metall ist nie ganz sauber gestimmt.
    osc.frequency.value = freq * ratio * (ratio === 1 ? 1 : 1.001);

    const stop = Math.min(decay, maxDecay);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + ATTACK_S);
    env.gain.exponentialRampToValueAtTime(0.0001, t + stop);

    osc.connect(env).connect(filter);
    osc.start(t);
    osc.stop(t + stop + 0.05);
  }
}
