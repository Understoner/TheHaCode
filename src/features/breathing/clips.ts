// Einstieg und Ausklang einer Session (Migration 0048, Entscheidung des Users
// vom 06.11.2026): Sie kommen von der gewaehlten Stimme (voice.ts). Eine Aufnahme
// aus dem Bucket session-audio hat fuer ihre Session Vorrang.
//
// ACHTUNG, Abweichung von CLAUDE.md, dieselbe Machart wie voice.ts und
// music.ts: eine bewusste Entscheidung gegen "Audiodateien fuer Cues", keine
// Unachtsamkeit. Die Uhr der Session bleibt die Ankeruhr. Die Aufnahmen haengen
// sich an sie, ohne die Zeitachse aus timeline.ts zu veraendern:
//
//   Einstieg: laeuft VOR dem Start der Uhr, ihr Ende startet die Uhr.
//   Ausklang: setzt so ein, dass er mit der letzten Atemphase endet.
//
// Neben den Ansagen ein eigener Weg: eine Phasenansage bricht die vorige ab,
// ein Ausklang darf davon nicht abgeschnitten werden. Er laeuft auf demselben
// Pegel (Regler "Stimme").

export type ClipPlayer = {
  /** Holt und dekodiert die Aufnahme. false, wenn das nicht geht. */
  load: (url: string) => Promise<boolean>;
  /** Laenge der geladenen Aufnahme, sonst null. */
  durationMs: (url: string) => number | null;
  /** Spielt ab `offsetSeconds`. false, wenn sie (noch) nicht geladen ist. */
  play: (url: string, offsetSeconds?: number, onEnded?: () => void) => boolean;
  isPlaying: () => boolean;
  /** Bricht ab, ohne onEnded auszuloesen. */
  stop: () => void;
  setVolume: (value: number) => void;
};

/**
 * Ab welcher Stelle der Aufnahme der Ausklang jetzt laufen muss; null = es ist
 * noch zu frueh. Ueber den Abstand statt ueber einen festen Startmoment: so
 * steigt er nach "Anhalten" oder einer spaet geladenen Datei an der richtigen
 * Stelle wieder ein. Braeuchte er mehr als die halbe Session, entfaellt er: Er
 * uebertoent die Phasenansagen, und bei kurzen Sessions bliebe davon zu wenig.
 */
export function outroOffsetSeconds(elapsedMs: number, totalMs: number, clipMs: number): number | null {
  if (clipMs * 2 > totalMs) return null;
  const startMs = totalMs - clipMs;
  if (elapsedMs < startMs || elapsedMs >= totalMs) return null;
  return (elapsedMs - startMs) / 1000;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function createClipPlayer(ctx: AudioContext, volume = 0.7): ClipPlayer {
  const master = ctx.createGain();
  master.gain.value = clamp01(volume);
  master.connect(ctx.destination);

  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const ready = new Map<string, AudioBuffer>();
  let current: AudioBufferSourceNode | null = null;

  const load = (url: string): Promise<boolean> => {
    let pending = buffers.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          ready.set(url, buffer);
          return buffer;
        })
        .catch(() => {
          // Eine Session ohne Einstieg ist kein Fehlerfall. Ein zweiter Versuch
          // bleibt moeglich, darum raus aus der Ablage.
          buffers.delete(url);
          return null;
        });
      buffers.set(url, pending);
    }
    return pending.then((buffer) => buffer !== null);
  };

  const stop = () => {
    const source = current;
    current = null;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Eine Quelle, die schon zu Ende ist.
    }
  };

  return {
    load,
    durationMs: (url) => {
      const buffer = ready.get(url);
      return buffer ? buffer.duration * 1000 : null;
    },
    play: (url, offsetSeconds = 0, onEnded) => {
      const buffer = ready.get(url);
      if (!buffer) return false;
      stop();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      source.onended = () => {
        if (current === source) current = null;
        onEnded?.();
      };
      source.start(ctx.currentTime, Math.max(0, offsetSeconds));
      current = source;
      return true;
    },
    isPlaying: () => current !== null,
    stop,
    setVolume: (value) => {
      master.gain.setTargetAtTime(clamp01(value), ctx.currentTime, 0.01);
    },
  };
}
