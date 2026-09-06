import type { PhaseKind } from '@/types/breathing';

// Toene ueber die Web Audio API, keine einzige Audiodatei (CLAUDE.md:
// "Audiodateien fuer Cues oder Musik" sind verboten; SAD §7.5). Auch das
// Anschlagsgeraeusch und der Nachhall unten sind erzeugt, kein Sample.
//
// ---------------------------------------------------------------------------
// EIN TON, NICHT VIER (Entscheidung vom 06.09.2026)
// ---------------------------------------------------------------------------
// Vorher hatte jede Phase ihre eigene Tonhoehe. Das klang nach Melodie, und
// eine Melodie zieht die Aufmerksamkeit auf sich - genau das, was eine
// Atemuebung nicht will. Jetzt schlaegt bei jedem Phasenwechsel derselbe Ton
// an: A3, der Ton, der bisher auf das Ausatmen folgte. Der Wechsel wird
// markiert, mehr nicht.
//
// ---------------------------------------------------------------------------
// Was eine Handpan klanglich ausmacht - und wie es hier nachgebaut ist
// ---------------------------------------------------------------------------
//
// 1. GESTIMMTE TEILTOENE. Jedes Tonfeld ist auf Grundton, Oktave (2f) und
//    Duodezime (3f) gestimmt. Das ist der Grund, warum eine Handpan "hohl"
//    und glockig klingt statt wie eine Gitarrensaite.
//
// 2. SCHWEBUNGEN. Ein reales Blech schwingt je Teilton in ZWEI Moden, die
//    durch minimale Asymmetrie leicht unterschiedliche Frequenzen haben.
//    Beide zusammen ergeben eine langsame Schwebung - der Ton "lebt", statt
//    still zu stehen. Deshalb steht hier je Teilton ein Modenpaar mit unter
//    zwei Hertz Abstand, nicht ein einzelner Oszillator.
//
// 3. MITSCHWINGENDE NACHBARFELDER. Der Punkt, an dem der erste Entwurf am
//    weitesten daneben lag - und der Grund, warum er nach Glocke klang und
//    nicht nach Handpan. Auf einem echten Instrument liegen sieben weitere
//    Tonfelder auf derselben Kuppel. Schlaegt man eines an, klingen die
//    verwandten leise mit, verzoegert und ohne eigenen Anschlag. Dieser Hof
//    ist das Erkennungsmerkmal des Instruments. Hier sind es zwei Felder der
//    D-Kurd-Stimmung ueber dem gespielten A3.
//
// 4. ANSCHLAG. Der Finger erzeugt ein kurzes, unharmonisches Geraeusch, das
//    nach wenigen Hundertstel weg ist. Ohne das beginnt der Ton aus dem
//    Nichts und klingt nach Sinusgenerator.
//
// 5. UNTERSCHIEDLICHE EINSCHWINGZEITEN. Die hohen Teiltoene sind sofort da,
//    der Grundton braucht ein paar Millisekunden, bis das Blech ihn traegt.
//    Ein gemeinsamer Einsatz fuer alle klingt nach Orgel, nicht nach Metall.
//
// 6. KOERPER. Der Hohlraum unter dem Blech hat eine eigene, tiefe Resonanz
//    (Helmholtz, ueber die Oeffnung an der Unterseite). Sie haengt nicht an
//    der gespielten Note, sondern am Instrument - deshalb hier eine feste
//    tiefe Frequenz statt eines Vielfachen des Grundtons.
//
// 7. ABKLINGEN NACH FREQUENZ. Hohe Teiltoene verschwinden zuerst, der
//    Grundton traegt am laengsten. Deshalb hat jeder Teilton seine eigene
//    Abklingzeit statt einer gemeinsamen Huellkurve.
//
// 8. TONHOEHENABFALL. Metall wird beim Anschlag kurz ueberdehnt und faellt
//    innerhalb von Millisekunden auf die Ruhetonhoehe zurueck.
//
// 9. RAUM. Niemand hoert eine Handpan trocken; sie steht in einem Zimmer.
//    Der Nachhall kommt aus einer erzeugten Impulsantwort - gefiltertes
//    Rauschen mit abfallender Huellkurve, in zwei Kanaelen unterschiedlich
//    gewuerfelt. Das ist auch die Breite: ohne sie sitzt der Ton als Punkt
//    zwischen den Ohren.
//
// Musik bringt der Nutzer weiterhin in seiner eigenen App mit; deshalb keine
// durchgehende Wiedergabe, die wuerde auf dem Handy den Audiofokus greifen.

/**
 * A3 - der Ton, der bisher auf das Ausatmen folgte, jetzt der einzige.
 * Er gehoert zur D-Kurd-Stimmung, der mit Abstand haeufigsten bei Handpans,
 * und liegt in der Lage, in der ein reales Instrument klingt.
 */
const NOTE_HZ = 220;

// Modenpaare: [Verhaeltnis, Lautstaerke, Abklingzeit s, Schwebung Hz, Einschwingzeit s].
// Schwebung 0 = einzelner Oszillator (bei den kurzen Anschlagsanteilen waere
// eine Schwebung ohnehin nicht hoerbar).
const MODES: [
  ratio: number,
  gain: number,
  decay: number,
  beat: number,
  attack: number,
][] = [
  [1.0, 1.0, 6.5, 0.55, 0.014], // Grundton - traegt am laengsten
  [2.0, 0.44, 4.2, 0.9, 0.007], // Oktave - gestimmt
  [3.0, 0.21, 2.8, 1.35, 0.005], // Duodezime - gestimmt
  [4.0, 0.08, 1.5, 1.9, 0.004], // zweite Oktave
  [5.37, 0.032, 0.4, 0, 0.002], // unharmonisch, faerbt den Anschlag
  [6.83, 0.018, 0.26, 0, 0.002], // unharmonisch
  [8.24, 0.009, 0.16, 0, 0.002], // unharmonisch
];

/**
 * Die Nachbarfelder, die leise mitschwingen: [Verhaeltnis, Lautstaerke].
 * 1,335 ist D4, 1,587 ist F4 - beide Teil der D-Kurd-Stimmung, in der A3
 * liegt. Sie bekommen weiter unten eine deutlich spaetere Einschwingzeit:
 * ein Nachbarfeld wird nicht angeschlagen, es wird angeregt.
 */
const SYMPATHETIC: [ratio: number, gain: number][] = [
  [1.335, 0.05],
  [1.587, 0.033],
];

const SYMPATHETIC_ATTACK_S = 0.085;
const SYMPATHETIC_DECAY_S = 3.4;

// Helmholtz-Resonanz des Korpus. Feste Frequenz, weil sie am Instrument
// haengt und nicht an der Note.
const BODY_HZ = 96;

/**
 * Damit die Summe aller Teiltoene den Ausgang nicht uebersteuert.
 *
 * HIER LAG EINER DER GRUENDE, WARUM DER LAUTSTAERKEREGLER NICHTS TAT: die
 * Modenlautstaerken summieren sich auf deutlich ueber eins, und der
 * Web-Audio-Ausgang kappt bei eins hart. Ab etwa 70 Prozent Reglerstellung
 * wurde es nicht mehr lauter, sondern nur noch verzerrt - der Regler sah aus,
 * als haette er keine Wirkung.
 */
const PEAK = 0.72;
const NORM = PEAK / MODES.reduce((sum, [, gain]) => sum + gain, 0);

/** Wie viel vom Ton in den Nachhall geht. */
const REVERB_SEND = 0.24;
const REVERB_SECONDS = 1.7;

// Phasen unter dieser Laenge bleiben stumm, sonst stolpern die Toene
// uebereinander (SAD §7.5).
const MIN_PHASE_MS = 1200;

/** Kurze Rampe statt Sprung - ein Sprung im Verstaerkungswert knackt. */
const RAMP_S = 0.02;

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

/**
 * Der Ausgangsweg aller Phasentoene.
 *
 * WARUM DAS EIN EIGENES GEBILDE IST UND NICHT EIN PARAMETER AN playCue
 * --------------------------------------------------------------------
 * Die Lautstaerke lag frueher als Zahl an jedem einzelnen Ton an. Damit wirkte
 * eine Aenderung fruehestens beim naechsten Anschlag - beim Ziehen am Regler
 * passierte hoerbar nichts, und wer zwischen zwei langen Phasen zog, wartete
 * bis zu einer halben Minute auf eine Reaktion. Jetzt haengt sie an einem
 * einzigen Verstaerker, durch den alles laeuft: eine Aenderung greift sofort,
 * auch mitten in einem klingenden Ton.
 *
 * Der zweite Grund ist der Nachhall. Eine Impulsantwort je Anschlag zu wuerfeln
 * waere Verschwendung; hier entsteht sie einmal je Kontext.
 */
export type ToneBus = {
  /** Ein Anschlag. Stumm bei zu kurzen Phasen und bei freier Atmung. */
  strike: (kind: PhaseKind, phaseDurationMs: number) => void;
  /** Wirkt sofort, auch auf einen gerade klingenden Ton. 0 bis 1. */
  setVolume: (value: number) => void;
  /** Bricht ab, was gerade klingt - beim Verlassen des Players. */
  silence: () => void;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Erzeugte Impulsantwort fuer den Nachhall: gefiltertes Rauschen mit
 * abfallender Huellkurve. Zwei Kanaele, unabhaengig gewuerfelt - daher kommt
 * die Breite.
 *
 * Das Tiefpassverhalten steckt im gleitenden Mittel ueber den letzten Wert:
 * ungefiltertes Rauschen ergaebe eine zischende Fahne, die nach Effektgeraet
 * klingt und nicht nach Zimmer.
 *
 * WARUM DIE ANTWORT AM ENDE GETEILT WIRD
 * --------------------------------------
 * Eine Faltung summiert ueber die gesamte Laenge der Antwort. Bei knapp zwei
 * Sekunden Rauschen sind das ueber 70.000 Werte, und die Ausgabe kaeme rund
 * vierzigmal lauter heraus als das, was hineingeht - der Nachhall wuerde den
 * Anschlag verschlucken und den Ausgang uebersteuern. Geteilt durch die
 * Quadratsumme kommt genau so viel zurueck, wie der Nebenweg aufdreht, und
 * REVERB_SEND bedeutet dann auch das, was dort steht.
 *
 * Deshalb steht convolver.normalize weiter unten auf false: der Browser bringt
 * eine eigene Normierung mit, aber eine, deren Faktor nirgends nachzulesen ist.
 * Eine eigene, sichtbare ist hier mehr wert als eine, die man ausprobieren muss.
 */
function impulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * REVERB_SECONDS));
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    let energy = 0;

    for (let i = 0; i < len; i += 1) {
      const noise = Math.random() * 2 - 1;
      last = last * 0.72 + noise * 0.28;
      data[i] = last * (1 - i / len) ** 2.6;
      energy += data[i] * data[i];
    }

    const norm = Math.sqrt(energy);
    if (norm > 0) {
      for (let i = 0; i < len; i += 1) data[i] /= norm;
    }
  }

  return buffer;
}

/** Kurzes Rauschen fuer den Finger-Anschlag - erzeugt, nicht geladen. */
function strikeNoise(ctx: BaseAudioContext, target: AudioNode, t: number, level: number): void {
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    // Abfallende Huellkurve direkt in die Daten: kurzer Impuls statt Teppich.
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  // Bandpass ueber der Grundtonregion - ungefiltertes Rauschen klingt nach
  // Zischen, nicht nach Finger auf Blech.
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = NOTE_HZ * 6;
  bp.Q.value = 1.6;

  const g = ctx.createGain();
  g.gain.value = level;

  src.connect(bp).connect(g).connect(target);
  src.start(t);
  src.stop(t + 0.06);
}

/**
 * Ein abklingender Sinus. Die Huellkurve faehrt exponentiell gegen Null -
 * linear klaenge nach Ausblenden, nicht nach Ausschwingen.
 */
function voice(
  ctx: BaseAudioContext,
  target: AudioNode,
  t: number,
  options: { freq: number; level: number; attack: number; decay: number; glide: boolean },
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = 'sine';
  if (options.glide) {
    // Tonhoehenabfall beim Anschlag: kurz ueberdehnt, dann auf Ruhelage.
    osc.frequency.setValueAtTime(options.freq * 1.008, t);
    osc.frequency.exponentialRampToValueAtTime(options.freq, t + 0.05);
  } else {
    osc.frequency.setValueAtTime(options.freq, t);
  }

  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(options.level, t + options.attack);
  env.gain.exponentialRampToValueAtTime(0.00008, t + options.decay);

  osc.connect(env).connect(target);
  osc.start(t);
  osc.stop(t + options.decay + 0.05);
}

/**
 * Baut den Ausgangsweg auf: Nachhall, Summenverstaerker, Ausgang.
 *
 * Der Kontext ist als BaseAudioContext typisiert, damit sich derselbe Klang in
 * einem OfflineAudioContext rendern und spektral nachmessen laesst.
 */
export function createToneBus(ctx: BaseAudioContext, volume = 0.5): ToneBus {
  let level = clamp01(volume);

  const master = ctx.createGain();
  master.gain.value = level;
  master.connect(ctx.destination);

  // Der Nachhall haengt als Nebenweg am Summenverstaerker, nicht in Reihe:
  // so bleibt der Anschlag trocken vorne und nur die Fahne geht in den Raum.
  let send: GainNode | null = null;
  if (typeof ctx.createConvolver === 'function') {
    const convolver = ctx.createConvolver();
    // Erst die Normierung abschalten, dann die Antwort setzen - normalize
    // wirkt nur auf das, was danach zugewiesen wird.
    convolver.normalize = false;
    convolver.buffer = impulseResponse(ctx);
    send = ctx.createGain();
    send.gain.value = REVERB_SEND;
    send.connect(convolver).connect(master);
  }

  const rampTo = (value: number) => {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(value, t + RAMP_S);
  };

  return {
    setVolume: (value: number) => {
      level = clamp01(value);
      rampTo(level);
    },

    silence: () => rampTo(0),

    strike: (kind: PhaseKind, phaseDurationMs: number) => {
      if (phaseDurationMs < MIN_PHASE_MS) return;
      // Freie Atmung hat keinen Phasenwechsel, den man anzeigen muesste.
      if (kind === 'free_breathing') return;

      const t = ctx.currentTime;

      // Nach silence() steht der Verstaerker auf Null. Der naechste Anschlag
      // holt ihn zurueck - sonst bliebe der Player nach dem Zurueckkommen
      // stumm.
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(level, t);

      playCue(ctx, master, send, phaseDurationMs);
    },
  };
}

/**
 * Der Anschlag selbst. Getrennt von createToneBus, damit sich der Klanggraph
 * einzeln pruefen laesst.
 */
export function playCue(
  ctx: BaseAudioContext,
  master: AudioNode,
  send: AudioNode | null,
  phaseDurationMs: number,
): void {
  const t = ctx.currentTime;

  // Der Ton soll nie laenger klingen als die Phase dauert, sonst ueberlagern
  // sich zwei Anschlaege.
  const maxDecay = Math.min(6.5, phaseDurationMs / 1000 - 0.15);
  if (maxDecay <= 0.02) return;

  // Tiefpass, der mitfaellt: beim Anschlag offen, danach dunkler. Ohne das
  // bleibt der Klang ueber die ganze Dauer gleich hell und wirkt synthetisch.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.5;
  filter.frequency.setValueAtTime(Math.min(NOTE_HZ * 18, 16000), t);
  filter.frequency.exponentialRampToValueAtTime(NOTE_HZ * 3.2, t + Math.min(2.4, maxDecay));

  filter.connect(master);
  if (send) filter.connect(send);

  // Zwei Seiten statt einer Mitte: die beiden Moden eines Paares gehen leicht
  // auseinander. Zusammen mit der Schwebung ergibt das die Bewegung, an der
  // man ein Blech von einem Oszillator unterscheidet. Ohne StereoPanner
  // (aeltere Safari-Versionen) laeuft alles mittig - der Klang bleibt, nur die
  // Breite fehlt.
  const stereo = typeof ctx.createStereoPanner === 'function';
  const side = (pan: number): AudioNode => {
    if (!stereo) return filter;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(filter);
    return panner;
  };

  const left = side(-0.3);
  const right = side(0.3);

  for (const [ratio, gain, decay, beat, attack] of MODES) {
    const stop = Math.min(decay, maxDecay);
    if (stop <= attack) continue;

    // Ein Modenpaar statt eines Oszillators: die beiden leicht verstimmten
    // Frequenzen erzeugen die Schwebung, die den Ton lebendig macht.
    const spread = beat > 0 ? [-beat / 2, beat / 2] : [0];

    for (const [index, offset] of spread.entries()) {
      voice(ctx, spread.length > 1 ? (index === 0 ? left : right) : filter, t, {
        freq: NOTE_HZ * ratio + offset,
        level: (gain * NORM) / spread.length,
        attack,
        decay: stop,
        glide: ratio <= 4,
      });
    }
  }

  // Die Nachbarfelder. Sie kommen spaeter und leiser - angeregt, nicht
  // angeschlagen - und sitzen dem Modenpaar gegenueber im Bild.
  const sympatheticStop = Math.min(SYMPATHETIC_DECAY_S, maxDecay);
  if (sympatheticStop > SYMPATHETIC_ATTACK_S) {
    for (const [index, [ratio, gain]] of SYMPATHETIC.entries()) {
      voice(ctx, index === 0 ? right : left, t, {
        freq: NOTE_HZ * ratio,
        level: gain * NORM,
        attack: SYMPATHETIC_ATTACK_S,
        decay: sympatheticStop,
        glide: false,
      });
    }
  }

  // Korpusresonanz: gibt dem Anschlag Fundament, ohne die Tonhoehe zu stoeren.
  const bodyStop = Math.min(0.9, maxDecay);
  if (bodyStop > 0.012) {
    voice(ctx, filter, t, {
      freq: BODY_HZ,
      level: 0.1 * NORM,
      attack: 0.012,
      decay: bodyStop,
      glide: false,
    });
  }

  strikeNoise(ctx, filter, t, 0.05 * NORM);
}
