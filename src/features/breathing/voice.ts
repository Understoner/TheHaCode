import type { PhaseKind } from '@/types/breathing';

// Gesprochene Ansagen zur Atemphase.
//
// ACHTUNG, Abweichung von CLAUDE.md - dieselbe Machart wie bei music.ts:
// dort stehen "Audiodateien fuer Cues" unter Verboten und "Sprachansagen"
// unter Nicht in V1. Das hier ist eine bewusste Entscheidung des Teams gegen
// die eigene Regel (06.09.2026), keine Unachtsamkeit.
//
// Der technische Grund hinter der Regel gilt weiterhin und ist hier
// beruecksichtigt: eine DURCHGEHENDE Wiedergabe greift auf dem iPhone den
// Audiofokus und beendet die Musik, die der Nutzer in seiner eigenen App
// laufen hat (SAD §7.5). Eine Ansage ist keine durchgehende Wiedergabe - sie
// dauert eine Sekunde, laeuft ueber denselben AudioContext wie die Toene und
// ist standardmaessig AUS.
//
// WARUM NICHT EIN AUDIO-ELEMENT WIE BEI DER MUSIK
// -----------------------------------------------
// Drei Gruende, und jeder allein wuerde reichen:
//
//   1. ZEITPUNKT. Eine Ansage muss in dem Moment da sein, in dem die Phase
//      wechselt. Ein Audio-Element, das erst beim Wechsel zu laden anfaengt,
//      kaeme irgendwann danach. Hier wird einmal geholt und dekodiert, danach
//      liegt der fertige Puffer im Speicher und startet ohne Verzoegerung.
//   2. WIEDERHOLUNG. Dieselbe Datei laeuft in einer Session dutzendfach.
//      Ein Element neu anzustossen (currentTime = 0, play()) ist auf Mobilgeraeten
//      unzuverlaessig; ein BufferSource ist Wegwerfware und immer sofort da.
//   3. LAUTSTAERKE. element.volume tut auf dem iPhone nichts (siehe music.ts).
//      Ein GainNode wirkt ueberall - und genau darum ging es beim
//      Lautstaerkefehler.

/**
 * Welche Aufnahme zu welcher Phase gehoert.
 *
 * 'free_breathing' steht nicht dabei: dort gibt es nichts anzusagen. Die Pause
 * zwischen zwei Bloecken kommt gar nicht erst an - 'rest' ist kein phase_kind,
 * sondern ein Segment der Zeitachse, und der Player laesst es vorher aus.
 */
export const VOICE_FILES: Partial<Record<PhaseKind, string>> = {
  inhale: '/stimme/einatmen.wav',
  hold_in: '/stimme/halten-1.wav',
  exhale: '/stimme/ausatmen.wav',
  hold_out: '/stimme/halten-2.wav',
};

/**
 * Die Schlussansage am Ende der Session (14.09.2026). Teilnehmer haben das Ende
 * nicht immer erkannt: nach dem letzten Phasenwechsel wird es einfach still.
 * Mit rund vier Sekunden ist sie die laengste Aufnahme - aber sie kommt genau
 * einmal, nicht dutzendfach.
 */
export const END_VOICE_FILE = '/stimme/abschluss.wav';

/**
 * Die Stimmen (06.11.2026). Michael bleibt, wo seine Dateien schon liegen;
 * alte App-Versionen laden sie von dort. Quelle, Namensschema und Aufbereitung
 * stehen in public/stimme/LIESMICH.txt.
 */
export type VoiceId = 'michael' | 'louisa' | 'alexander';

export type VoiceFiles = {
  phases: Partial<Record<PhaseKind, string>>;
  end: string;
  /** Vor der ersten Atemphase, immer wenn die Stimme an ist. */
  intro: string;
  /** Setzt so ein, dass es mit der letzten Atemphase endet (clips.ts). */
  outro: string;
};

function newVoice(folder: VoiceId): VoiceFiles {
  const base = `/stimme/${folder}`;
  return {
    phases: {
      inhale: `${base}/ein.wav`,
      hold_in: `${base}/halten.wav`,
      exhale: `${base}/aus.wav`,
      hold_out: `${base}/aus-halten.wav`,
    },
    end: `${base}/ende.wav`,
    intro: `${base}/intro.mp3`,
    outro: `${base}/outro.mp3`,
  };
}

export const VOICES: Record<VoiceId, VoiceFiles> = {
  michael: {
    phases: VOICE_FILES,
    end: END_VOICE_FILE,
    intro: '/stimme/michael/intro.mp3',
    outro: '/stimme/michael/outro.mp3',
  },
  louisa: newVoice('louisa'),
  alexander: newVoice('alexander'),
};

export const VOICE_IDS: VoiceId[] = ['michael', 'louisa', 'alexander'];
export const DEFAULT_VOICE: VoiceId = 'michael';

/** Ein Wert aus der Datenbank als bekannte Stimme; Unbekanntes wird Michael. */
export function parseVoiceId(value: unknown): VoiceId {
  return VOICE_IDS.includes(value as VoiceId) ? (value as VoiceId) : DEFAULT_VOICE;
}

const REPEAT_FROM_MS = 5000;
const REPEAT_MIN_GAP_S = 1;
const REPEAT_MAX_GAP_S = 6;
/** So lange braucht das laengste Wort. Spaeter ginge es in die naechste Phase hinein. */
const REPEAT_LAST_MS = 1000;

/**
 * Wann eine lange Phase noch einmal angesagt wird, in ms ab ihrem Beginn:
 * ab der 5. Sekunde, dann in unregelmaessigen Abstaenden von 1 bis 6 Sekunden.
 *
 * Unregelmaessig, aber fest je Segment (`seed`): Anhalten und Fortsetzen darf
 * den Plan nicht neu wuerfeln, und Tests brauchen kein Math.random.
 */
export function voiceRepeatOffsetsMs(durationMs: number, seed: number): number[] {
  const offsets: number[] = [];
  let state = (Math.abs(Math.trunc(seed)) * 2654435761 + 1) >>> 0;
  for (let at = REPEAT_FROM_MS; at <= durationMs - REPEAT_LAST_MS; ) {
    offsets.push(at);
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const spread = REPEAT_MAX_GAP_S - REPEAT_MIN_GAP_S + 1;
    at += (REPEAT_MIN_GAP_S + Math.floor((state / 2 ** 32) * spread)) * 1000;
  }
  return offsets;
}

/** Kurze Rampe statt Sprung - ein Sprung im Verstaerkungswert knackt. */
const RAMP_S = 0.02;

export type VoicePlayer = {
  /** Sagt die Phase an. Ohne geladene Aufnahme bleibt es still. */
  speak: (kind: PhaseKind) => void;
  /** Die Schlussansage, auf Wunsch um `delaySeconds` verzoegert. */
  speakEnd: (delaySeconds?: number) => void;
  /** Holt und dekodiert alle Aufnahmen samt Schlussansage. Mehrfach aufrufbar. */
  preload: () => void;
  /** Wechselt die Stimme ab der naechsten Ansage und laedt sie. */
  setVoice: (voice: VoiceFiles) => void;
  /** Wirkt sofort, auch auf eine laufende Ansage. 0 bis 1. */
  setVolume: (value: number) => void;
  /** Bricht ab, was gerade gesprochen wird - beim Verlassen des Players. */
  silence: () => void;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Der Ausgangsweg der Ansagen: ein eigener Verstaerker neben dem der Toene und
 * dem der Musik. Drei Regler, drei Wege - eine Ansage soll sich ueber die
 * Musik legen koennen, ohne dass der Phasenton mitwandert.
 */
export function createVoicePlayer(ctx: AudioContext, volume = 0.7, initial: VoiceFiles = VOICES.michael): VoicePlayer {
  let level = clamp01(volume);
  let voice = initial;

  const master = ctx.createGain();
  master.gain.value = level;
  master.connect(ctx.destination);

  const buffers = new Map<string, AudioBuffer>();
  const laufend = new Set<string>();
  // Die zuletzt gestartete Ansage. Faengt eine neue an, waehrend die alte noch
  // laeuft - kurze Phasen, oder jemand tippt sich durch die Sequenz -, hat die
  // neue recht: sie sagt an, was JETZT dran ist.
  let current: AudioBufferSourceNode | null = null;

  const load = (url: string) => {
    if (buffers.has(url) || laufend.has(url)) return;
    laufend.add(url);

    void fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.arrayBuffer();
      })
      // decodeAudioData mit Promise statt Rueckruf - die alte Form verlangt
      // Safari zwar noch, seit iOS 14.5 versteht es aber beide.
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(url, buffer);
      })
      .catch(() => {
        // Eine Session ohne Ansage ist kein Fehlerfall, der den Player
        // anhalten duerfte - genau wie bei der Musik.
      })
      .finally(() => {
        laufend.delete(url);
      });
  };

  const rampTo = (value: number) => {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(value, t + RAMP_S);
  };

  const stopCurrent = () => {
    try {
      current?.stop();
    } catch {
      // Eine Quelle, die nie lief oder schon zu Ende ist. Kein Grund zur Sorge.
    }
    current = null;
  };

  /** Spielt eine geladene Aufnahme. Ohne Puffer: nachladen, aber nicht verspaetet abspielen. */
  const play = (url: string, delaySeconds: number) => {
    const buffer = buffers.get(url);
    if (!buffer) {
      // Eine Ansage, die eine Sekunde zu spaet kommt, sagt das Falsche an.
      load(url);
      return;
    }

    stopCurrent();

    // Nach silence() steht der Verstaerker auf Null. Die naechste Ansage
    // holt ihn zurueck - sonst bliebe der Player nach dem Zurueckkommen
    // stumm.
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(level, t);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    source.start(t + Math.max(0, delaySeconds));
    current = source;
  };

  return {
    preload: () => {
      for (const url of Object.values(voice.phases)) load(url);
      load(voice.end);
    },

    setVoice: (next) => {
      voice = next;
      for (const url of Object.values(voice.phases)) load(url);
      load(voice.end);
    },

    speak: (kind: PhaseKind) => {
      const url = voice.phases[kind];
      if (url) play(url, 0);
    },

    // Eine verzoegerte Ansage ist "current" ab dem Aufruf, nicht erst ab dem
    // Einsatz: silence() und die erste Ansage einer neuen Session brechen sie
    // auch dann ab, wenn sie noch gar nicht angefangen hat.
    speakEnd: (delaySeconds = 0) => play(voice.end, delaySeconds),

    setVolume: (value: number) => {
      level = clamp01(value);
      rampTo(level);
    },

    silence: () => {
      stopCurrent();
      rampTo(0);
    },
  };
}
