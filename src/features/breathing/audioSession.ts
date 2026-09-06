// Die Audio-Sitzung auf dem iPhone wachhalten - damit Phasenton und Ansage
// ueberhaupt zu hoeren sind.
//
// ---------------------------------------------------------------------------
// WAS AM 06.09.2026 AUF EINEM ECHTEN GERAET HERAUSKAM
// ---------------------------------------------------------------------------
// Auf dem iPhone blieben Ton und Ansage stumm, sobald der Klingelschalter auf
// lautlos stand - aber nur, solange die Hintergrundmusik AUS war. Mit Musik
// lief beides.
//
// Der erste Erklaerungsversuch war die Sitzungskategorie: Safari stellt eine
// Seite auf 'ambient', und ambient wird vom Klingelschalter stummgeschaltet.
// Also wurde navigator.audioSession.type auf 'transient' gesetzt - die
// Kategorie fuer kurze Signaltoene, fachlich genau das Richtige.
//
// ES HAT NICHT GEHOLFEN. Am Geraet geprueft, nicht gemutmasst. Diese Erkenntnis
// steht hier, damit sie niemand ein zweites Mal bezahlen muss: die Kategorie
// allein aendert nichts.
//
// Was hilft, ist etwas anderes, und der Nutzer hat es beim Ausprobieren
// gefunden: Es muss ein MEDIENELEMENT SPIELEN. Dann hebt Safari die Sitzung
// von selbst an, und Web Audio ist hoerbar. Ob man dieses Element hoert, ist
// dabei gleichgueltig - der Nutzer hatte die Musik einfach auf null gedreht
// und sie weiterlaufen lassen.
//
// ---------------------------------------------------------------------------
// WARUM HIER EIN ERZEUGTER SCHNIPSEL LAEUFT UND NICHT DIE MUSIK AUF NULL
// ---------------------------------------------------------------------------
// Der Weg des Nutzers wuerde funktionieren, kostet aber ein Musikstueck von
// drei bis vier Megabyte - heruntergeladen und durchgestreamt fuer etwas, das
// niemand hoert. Auf einem Telefon im Mobilfunknetz ist das kein Detail.
//
// Stattdessen laeuft hier eine halbe Sekunde erzeugter Ton in Schleife: im
// Code gebaut, als data-Adresse uebergeben, rund acht Kilobyte, kein
// Netzverkehr, keine Datei im Verzeichnis. Das entspricht der Machart der
// Phasentoene (CLAUDE.md: Toene kommen aus dem Oszillator, nicht aus Dateien).
//
// Der Schnipsel ist NICHT digitale Stille, sondern ein Ton bei etwa -60 dBFS.
// Das ist unhoerbar, aber es sind Abtastwerte ungleich null - manche Systeme
// behandeln stumme Wiedergabe anders als leise. Zusaetzlich laeuft er ueber
// einen Verstaerker auf null. Beides zusammen heisst: selbst wenn eine der
// beiden Vorkehrungen ausfaellt, hoert niemand etwas.
//
// ---------------------------------------------------------------------------
// WAS DAS KOSTET - UND WARUM ES TROTZDEM NUR AUF SAFARI LAEUFT
// ---------------------------------------------------------------------------
// Ein spielendes Medienelement greift auf dem iPhone den Audiofokus. Die
// Musik, die der Nutzer in seiner eigenen App laufen hat, wird dadurch
// unterbrochen - genau das, was SAD §7.5 vermeiden wollte. Der Weg des
// Nutzers hat dieselbe Eigenschaft; sie haengt am Mechanismus, nicht an der
// Umsetzung. Wer den Ton auf einem stummgeschalteten iPhone hoeren will,
// bezahlt ihn damit. Das gehoert im SAD vermerkt, sobald es bestaetigt ist.
//
// Deshalb laeuft das hier NUR dort, wo das Problem existiert. Erkannt wird es
// an navigator.audioSession - diese Schnittstelle kennt Stand September 2026
// ausschliesslich Safari. Kein anderes System schaltet Web Audio per
// Hardwareschalter stumm, und auf Android wuerde ein spielendes Element die
// Musik des Nutzers ohne jeden Gegenwert anhalten.

/** Ein halbe Sekunde langer, unhoerbarer Ton als data-Adresse. */
function keepAliveUri(): string {
  const rate = 8000;
  const frames = rate / 2;
  const bytes = 44 + frames * 2;
  const puffer = new ArrayBuffer(bytes);
  const sicht = new DataView(puffer);

  const text = (offset: number, wert: string) => {
    for (let i = 0; i < wert.length; i += 1) sicht.setUint8(offset + i, wert.charCodeAt(i));
  };

  text(0, 'RIFF');
  sicht.setUint32(4, bytes - 8, true);
  text(8, 'WAVEfmt ');
  sicht.setUint32(16, 16, true); // Laenge des Formatblocks
  sicht.setUint16(20, 1, true); // PCM
  sicht.setUint16(22, 1, true); // mono
  sicht.setUint32(24, rate, true);
  sicht.setUint32(28, rate * 2, true); // Bytes je Sekunde
  sicht.setUint16(32, 2, true); // Bytes je Bild
  sicht.setUint16(34, 16, true); // Bits je Wert
  text(36, 'data');
  sicht.setUint32(40, frames * 2, true);

  // Rund -60 dBFS. Unhoerbar, aber nicht null: manche Systeme behandeln
  // digitale Stille anders als leise Wiedergabe.
  for (let i = 0; i < frames; i += 1) {
    const wert = Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 32);
    sicht.setInt16(44 + i * 2, wert, true);
  }

  let roh = '';
  const daten = new Uint8Array(puffer);
  for (let i = 0; i < daten.length; i += 1) roh += String.fromCharCode(daten[i]);
  return `data:audio/wav;base64,${btoa(roh)}`;
}

/**
 * Braucht diese Plattform die Wachhaltung?
 *
 * navigator.audioSession kennt Stand September 2026 ausschliesslich Safari -
 * und Safari ist das einzige System, das Web Audio per Hardwareschalter
 * stummschaltet. Anderswo waere ein spielendes Element reiner Schaden.
 */
function wirdGebraucht(): boolean {
  return typeof navigator !== 'undefined' && 'audioSession' in navigator;
}

export type SessionKeepAlive = {
  /** Startet die Wachhaltung. Ohne Kontext und ausserhalb von Safari: nichts. */
  start: (ctx: AudioContext | null) => void;
  stop: () => void;
};

export function createSessionKeepAlive(): SessionKeepAlive {
  let element: HTMLAudioElement | null = null;
  let gain: GainNode | null = null;

  const stop = () => {
    element?.pause();
    gain?.disconnect();
    element = null;
    gain = null;
  };

  return {
    start: (ctx: AudioContext | null) => {
      if (element) {
        void element.play().catch(() => undefined);
        return;
      }
      if (!wirdGebraucht() || typeof Audio === 'undefined') return;

      try {
        const audio = new Audio(keepAliveUri());
        audio.loop = true;

        // Zweite Vorkehrung neben dem leisen Inhalt: der Verstaerker steht auf
        // null. Ohne Kontext bleibt es beim leisen Inhalt allein - der ist
        // unhoerbar genug, um niemanden zu stoeren.
        if (ctx && typeof ctx.createMediaElementSource === 'function') {
          const quelle = ctx.createMediaElementSource(audio);
          gain = ctx.createGain();
          gain.gain.value = 0;
          quelle.connect(gain).connect(ctx.destination);
        }

        element = audio;
        void audio.play().catch(() => undefined);
      } catch {
        // Ein Browser, der die data-Adresse nicht mag, oder ein Kontext, der
        // gerade zumacht. Eine Session ohne Wachhaltung ist kein Fehlerfall.
        stop();
      }
    },

    stop,
  };
}
