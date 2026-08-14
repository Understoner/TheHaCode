// Hintergrundmusik waehrend einer Session.
//
// ACHTUNG, Abweichung von CLAUDE.md: dort stehen "Audiodateien fuer Cues oder
// Musik" unter Verboten und "Hintergrundmusik" unter Nicht in V1. Das hier ist
// eine bewusste Entscheidung des Teams gegen die eigene Regel, keine
// Unachtsamkeit. Der technische Grund, aus dem die Regel entstand, gilt
// unveraendert weiter (SAD §7.5): eine durchgehende Wiedergabe greift auf dem
// iPhone den Audiofokus und beendet die Musik, die der Nutzer in seiner
// eigenen App laufen hat. Deshalb ist Musik hier standardmaessig AUS und muss
// bewusst eingeschaltet werden.
//
// Die Dateien liegen in public/musik/ und damit ausserhalb des Bundles: der
// statische Export kopiert public/ unveraendert nach dist/, der Browser laedt
// ein Stueck erst beim Auswaehlen und streamt es per Range-Request. Eine
// eingebundene 15-MB-Datei muesste dagegen beim ersten Seitenaufruf komplett
// mitgeladen werden.

export type TrackId = 'afternoon-highway' | 'doku-marimba';

export const TRACKS: { id: TrackId; src: string }[] = [
  { id: 'afternoon-highway', src: '/musik/afternoon-highway.mp3' },
  { id: 'doku-marimba', src: '/musik/doku-marimba.mp3' },
];

// Deutlich leiser als die Phasentoene: die Musik traegt den Hintergrund, die
// Toene markieren den Wechsel und muessen sich darueber durchsetzen.
const DEFAULT_VOLUME = 0.18;

export type MusicPlayer = {
  play: (id: TrackId) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
};

/**
 * Schlanker Steuersatz um ein einzelnes Audio-Element. Bewusst kein Hook und
 * kein Zustand in React: die Wiedergabe ueberlebt jedes Neuzeichnen, und ein
 * laufendes Stueck soll bei einem Phasenwechsel nicht stocken.
 */
export function createMusicPlayer(): MusicPlayer {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    const noop = () => undefined;
    return { play: noop, stop: noop, pause: noop, resume: noop, dispose: noop };
  }

  let element: HTMLAudioElement | null = null;
  let current: TrackId | null = null;

  const play = (id: TrackId) => {
    const track = TRACKS.find((t) => t.id === id);
    if (!track) return;

    if (element && current === id) {
      void element.play();
      return;
    }

    element?.pause();
    element = new Audio(track.src);
    element.loop = true;
    element.volume = DEFAULT_VOLUME;
    element.preload = 'none';
    current = id;
    // Schlaegt die Wiedergabe fehl (Autoplay-Sperre, Datei fehlt), bleibt es
    // still - eine Session ohne Musik ist kein Fehlerfall, der den Player
    // anhalten duerfte.
    void element.play().catch(() => undefined);
  };

  const stop = () => {
    element?.pause();
    if (element) element.currentTime = 0;
    element = null;
    current = null;
  };

  return {
    play,
    stop,
    pause: () => element?.pause(),
    resume: () => {
      if (element) void element.play().catch(() => undefined);
    },
    dispose: stop,
  };
}
