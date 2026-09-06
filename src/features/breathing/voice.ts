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

/** Kurze Rampe statt Sprung - ein Sprung im Verstaerkungswert knackt. */
const RAMP_S = 0.02;

export type VoicePlayer = {
  /** Sagt die Phase an. Ohne geladene Aufnahme bleibt es still. */
  speak: (kind: PhaseKind) => void;
  /** Holt und dekodiert alle vier Aufnahmen. Mehrfach aufrufbar. */
  preload: () => void;
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
export function createVoicePlayer(ctx: AudioContext, volume = 0.7): VoicePlayer {
  let level = clamp01(volume);

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

  return {
    preload: () => {
      for (const url of Object.values(VOICE_FILES)) load(url);
    },

    speak: (kind: PhaseKind) => {
      const url = VOICE_FILES[kind];
      if (!url) return;

      const buffer = buffers.get(url);
      if (!buffer) {
        // Noch nicht da: nachladen, aber nicht verspaetet abspielen. Eine
        // Ansage, die eine Sekunde zu spaet kommt, sagt das Falsche an.
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
      source.start(t);
      current = source;
    },

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
