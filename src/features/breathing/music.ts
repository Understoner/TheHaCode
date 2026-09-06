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
//
// WARUM DIE LAUTSTAERKE NICHT AN element.volume HAENGT
// ---------------------------------------------------
// Weil sie dort auf dem iPhone nichts tut. Safari auf iOS behandelt
// HTMLMediaElement.volume als schreibgeschuetzt: der Wert laesst sich setzen,
// die Wiedergabe wird davon nicht leiser - Lautstaerke ist dort allein Sache
// der Hardwaretasten. Genau so ist der Regler in der App aufgefallen: er
// bewegte sich, und es aenderte sich nichts.
//
// Ein GainNode dagegen wirkt auf jeder Plattform. Deshalb laeuft das
// Audio-Element durch denselben AudioContext, in dem auch die Phasentoene
// entstehen. Ohne Kontext - serverseitig, oder wenn der Browser keine Web
// Audio API mitbringt - bleibt element.volume als Rueckfall.

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
  setVolume: (value: number) => void;
  dispose: () => void;
};

/**
 * Schlanker Steuersatz um ein einzelnes Audio-Element. Bewusst kein Hook und
 * kein Zustand in React: die Wiedergabe ueberlebt jedes Neuzeichnen, und ein
 * laufendes Stueck soll bei einem Phasenwechsel nicht stocken.
 */
export function createMusicPlayer(getContext?: () => AudioContext | null): MusicPlayer {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    const noop = () => undefined;
    return { play: noop, stop: noop, pause: noop, resume: noop, setVolume: noop, dispose: noop };
  }

  let element: HTMLAudioElement | null = null;
  let current: TrackId | null = null;
  let volume = DEFAULT_VOLUME;
  // Der Verstaerker je Element. createMediaElementSource laesst sich pro
  // Element nur einmal aufrufen, deshalb entsteht er zusammen mit dem Element
  // und verschwindet mit ihm.
  let gain: GainNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;

  /** Die Knoten des vorigen Stuecks abhaengen - sie gehoeren zu einem Element,
   *  das nicht mehr spielt, und blieben sonst am Ausgang haengen. */
  const unroute = () => {
    source?.disconnect();
    gain?.disconnect();
    source = null;
    gain = null;
  };

  /** Element an den Klanggraphen haengen. Ohne Kontext bleibt es beim Element. */
  const route = (audio: HTMLAudioElement) => {
    const ctx = getContext?.() ?? null;
    if (!ctx || typeof ctx.createMediaElementSource !== 'function') {
      audio.volume = volume;
      return;
    }

    try {
      source = ctx.createMediaElementSource(audio);
      gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(ctx.destination);
      // Ab hier regelt der GainNode. Das Element bleibt voll aufgedreht,
      // sonst multiplizierten sich zwei Regelungen.
      audio.volume = 1;
    } catch {
      // Ein Element, das schon einmal verbunden wurde, oder ein Kontext, der
      // gerade zumacht. Musik ohne Regler ist besser als keine Musik.
      source = null;
      gain = null;
      audio.volume = volume;
    }
  };

  const play = (id: TrackId) => {
    const track = TRACKS.find((t) => t.id === id);
    if (!track) return;

    if (element && current === id) {
      void element.play();
      return;
    }

    element?.pause();
    unroute();
    element = new Audio(track.src);
    element.loop = true;
    element.preload = 'none';
    current = id;
    route(element);
    // Schlaegt die Wiedergabe fehl (Autoplay-Sperre, Datei fehlt), bleibt es
    // still - eine Session ohne Musik ist kein Fehlerfall, der den Player
    // anhalten duerfte.
    void element.play().catch(() => undefined);
  };

  const stop = () => {
    element?.pause();
    if (element) element.currentTime = 0;
    unroute();
    element = null;
    current = null;
  };

  return {
    play,
    stop,
    setVolume: (value: number) => {
      volume = Math.min(1, Math.max(0, value));
      if (gain) gain.gain.value = volume;
      else if (element) element.volume = volume;
    },
    pause: () => element?.pause(),
    resume: () => {
      if (element) void element.play().catch(() => undefined);
    },
    dispose: stop,
  };
}
