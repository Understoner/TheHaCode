import type { PhaseKind } from '@/types/breathing';

// Toene ueber die Web Audio API, keine einzige Audiodatei (CLAUDE.md:
// "Audiodateien fuer Cues oder Musik" sind verboten; SAD §7.5). Auch das
// Anschlagsgeraeusch unten ist erzeugt, kein Sample.
//
// ---------------------------------------------------------------------------
// Was eine Handpan klanglich ausmacht - und wie es hier nachgebaut ist
// ---------------------------------------------------------------------------
//
// 1. GESTIMMTE TEILTOENE. Jedes Tonfeld ist auf Grundton, Oktave (2f) und
//    Duodezime (3f) gestimmt. Das ist der Grund, warum eine Handpan "hohl"
//    und glockig klingt statt wie eine Gitarrensaite.
//
// 2. SCHWEBUNGEN. Das ist der Punkt, an dem synthetische Nachbauten meist
//    scheitern. Ein reales Blech schwingt je Teilton in ZWEI Moden, die durch
//    minimale Asymmetrie leicht unterschiedliche Frequenzen haben. Beide
//    zusammen ergeben eine langsame Schwebung - der Ton "lebt", statt still
//    zu stehen. Deshalb steht hier je Teilton ein Modenpaar mit ein bis zwei
//    Hertz Abstand, nicht ein einzelner Oszillator.
//
// 3. ANSCHLAG. Der Finger erzeugt ein kurzes, unharmonisches Geraeusch, das
//    nach 60 ms weg ist. Ohne das beginnt der Ton aus dem Nichts und klingt
//    nach Sinusgenerator. Erzeugt aus gefiltertem Rauschen plus zwei sehr
//    kurzen unharmonischen Teiltoenen.
//
// 4. KOERPER. Der Hohlraum unter dem Blech hat eine eigene, tiefe Resonanz
//    (Helmholtz, ueber die Oeffnung an der Unterseite). Sie haengt nicht an
//    der gespielten Note, sondern am Instrument - deshalb hier eine feste
//    tiefe Frequenz statt eines Vielfachen des Grundtons.
//
// 5. ABKLINGEN NACH FREQUENZ. Hohe Teiltoene verschwinden zuerst, der
//    Grundton traegt am laengsten. Deshalb hat jeder Teilton seine eigene
//    Abklingzeit statt einer gemeinsamen Huellkurve.
//
// 6. TONHOEHENABFALL. Metall wird beim Anschlag kurz ueberdehnt und faellt
//    innerhalb von Millisekunden auf die Ruhetonhoehe zurueck.
//
// Musik bringt der Nutzer weiterhin in seiner eigenen App mit; deshalb keine
// durchgehende Wiedergabe, die wuerde auf dem Handy den Audiofokus greifen.

// D-Moll-pentatonisch (D F A C) - die Stimmung "D Kurd" ist die mit Abstand
// haeufigste bei Handpans, und benachbarte Toene daraus klingen in jeder
// Reihenfolge zusammen. Tiefer als der erste Entwurf: eine Handpan liegt in
// dieser Lage, und fuer eine Atemuebung ist es angenehmer.
const PITCH: Record<PhaseKind, number> = {
  inhale: 220.0, // A3 - traegt aufwaerts
  hold_in: 261.63, // C4 - hellster Ton
  exhale: 146.83, // D3 - Grundton der Stimmung, tief und ruhend
  hold_out: 174.61, // F3
  free_breathing: 0,
};

// Modenpaare: [Frequenzverhaeltnis, Lautstaerke, Abklingzeit s, Schwebung Hz].
// Schwebung 0 = einzelner Oszillator (bei den kurzen Anschlagsanteilen waere
// eine Schwebung ohnehin nicht hoerbar).
const MODES: [ratio: number, gain: number, decay: number, beat: number][] = [
  [1.0, 1.0, 4.2, 0.7], // Grundton
  [2.0, 0.5, 2.8, 1.1], // Oktave - gestimmt
  [3.0, 0.26, 1.8, 1.6], // Duodezime - gestimmt
  [4.0, 0.1, 1.1, 2.2], // zweite Oktave
  [5.42, 0.05, 0.45, 0], // unharmonisch, faerbt den Anschlag
  [6.79, 0.028, 0.3, 0], // unharmonisch
];

// Helmholtz-Resonanz des Korpus. Feste Frequenz, weil sie am Instrument
// haengt und nicht an der Note.
const BODY_HZ = 96;

const ATTACK_S = 0.004;

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

/** Kurzes Rauschen fuer den Finger-Anschlag - erzeugt, nicht geladen. */
function strikeNoise(ctx: BaseAudioContext, t: number, freq: number, level: number): void {
  const len = Math.floor(ctx.sampleRate * 0.07);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    // Abfallende Huellkurve direkt in die Daten: kurzer Impuls statt Teppich.
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  // Bandpass um die Grundtonregion - ungefiltertes Rauschen klingt nach
  // Zischen, nicht nach Finger auf Blech.
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 4;
  bp.Q.value = 1.2;

  const g = ctx.createGain();
  g.gain.value = level;

  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.08);
}

/**
 * Ein angeschlagener Handpan-Ton zum Phasenbeginn. Stumm bei kurzen Phasen.
 *
 * Der Kontext ist als BaseAudioContext typisiert, damit sich derselbe Klang in
 * einem OfflineAudioContext rendern und spektral nachmessen laesst.
 */
export function playCue(
  ctx: BaseAudioContext | null,
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
  const maxDecay = Math.min(4.2, phaseDurationMs / 1000 - 0.15);
  if (maxDecay <= ATTACK_S) return;

  // Tiefpass, der mitfaellt: beim Anschlag offen, danach dunkler. Ohne das
  // bleibt der Klang ueber die ganze Dauer gleich hell und wirkt synthetisch.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.6;
  filter.frequency.setValueAtTime(Math.min(freq * 14, 14000), t);
  filter.frequency.exponentialRampToValueAtTime(freq * 2.5, t + Math.min(1.6, maxDecay));

  const out = ctx.createGain();
  out.gain.value = volume;
  filter.connect(out).connect(ctx.destination);

  for (const [ratio, gain, decay, beat] of MODES) {
    const stop = Math.min(decay, maxDecay);
    if (stop <= ATTACK_S) continue;

    // Ein Modenpaar statt eines Oszillators: die beiden leicht verstimmten
    // Frequenzen erzeugen die Schwebung, die den Ton lebendig macht.
    const offsets = beat > 0 ? [-beat / 2, beat / 2] : [0];

    for (const offset of offsets) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = 'sine';
      const target = freq * ratio + offset;
      // Tonhoehenabfall beim Anschlag: kurz ueberdehnt, dann auf Ruhelage.
      osc.frequency.setValueAtTime(target * 1.01, t);
      osc.frequency.exponentialRampToValueAtTime(target, t + 0.06);

      const level = (gain * volume) / offsets.length;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(level, t + ATTACK_S);
      env.gain.exponentialRampToValueAtTime(0.00008, t + stop);

      osc.connect(env).connect(filter);
      osc.start(t);
      osc.stop(t + stop + 0.05);
    }
  }

  // Korpusresonanz: gibt dem Anschlag Fundament, ohne die Tonhoehe zu stoeren.
  const bodyStop = Math.min(0.9, maxDecay);
  if (bodyStop > ATTACK_S) {
    const body = ctx.createOscillator();
    const bodyEnv = ctx.createGain();
    body.type = 'sine';
    body.frequency.value = BODY_HZ;
    bodyEnv.gain.setValueAtTime(0, t);
    bodyEnv.gain.linearRampToValueAtTime(0.12 * volume, t + 0.012);
    bodyEnv.gain.exponentialRampToValueAtTime(0.00008, t + bodyStop);
    body.connect(bodyEnv).connect(filter);
    body.start(t);
    body.stop(t + bodyStop + 0.05);
  }

  strikeNoise(ctx, t, freq, 0.05 * volume);
}
