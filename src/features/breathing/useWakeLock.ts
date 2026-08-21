import { useEffect } from 'react';

// Der Bildschirm bleibt wach, solange geatmet wird (Backlog T09).
//
// WARUM DAS UEBERHAUPT NOETIG IST
// -------------------------------
// Eine Atemuebung dauert zehn Minuten und braucht keine Beruehrung. Das
// Betriebssystem hat also keinen Anlass, den Bildschirm anzulassen - und
// schaltet ihn nach der ueblichen halben Minute ab. Genau dann verschwindet
// der Ring, an dem sich der Nutzer orientiert.
//
// Die Screen Wake Lock API loest das mit drei Zeilen. Sie ist nicht ueberall
// da (Safari kennt sie erst seit 16.4, Firefox laenger nicht), deshalb ist
// jeder Zugriff hier abgesichert: fehlt sie, passiert nichts und die Uebung
// laeuft wie bisher weiter. Ein fehlender Wake Lock ist unbequem, kein Fehler.
//
// DIE STELLE, DIE MAN LEICHT VERGISST
// -----------------------------------
// Ein Wake Lock ueberlebt den Wechsel in einen anderen Tab NICHT - der Browser
// gibt ihn von selbst frei. Kommt der Nutzer zurueck, ist er weg und muss neu
// angefordert werden. Deshalb haengt hier zusaetzlich ein Listener auf
// visibilitychange; ohne ihn waere der Bildschirm nach dem ersten Tabwechsel
// wieder ungeschuetzt, und niemandem waere klar, warum.

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> };
type WakeLockLike = { request: (type: 'screen') => Promise<WakeLockSentinelLike> };

function wakeLockApi(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  const candidate = (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock;
  return candidate && typeof candidate.request === 'function' ? candidate : null;
}

/**
 * Haelt den Bildschirm wach, solange `active` wahr ist.
 *
 * Gibt nichts zurueck: es gibt nichts zu entscheiden und nichts anzuzeigen.
 * Klappt es nicht, klappt es nicht.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const api = wakeLockApi();
    if (!api) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let abgebrochen = false;

    const anfordern = async () => {
      try {
        const neu = await api.request('screen');
        // Zwischen Anfrage und Antwort kann der Effekt schon aufgeraeumt worden
        // sein - dann gehoert der frische Lock sofort wieder freigegeben.
        if (abgebrochen) {
          void neu.release();
          return;
        }
        sentinel = neu;
      } catch {
        // Vom Browser abgelehnt, etwa bei niedrigem Akkustand. Kein Grund,
        // irgendetwas zu melden.
      }
    };

    const beiSichtbarkeit = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void anfordern();
      }
    };

    void anfordern();
    document?.addEventListener?.('visibilitychange', beiSichtbarkeit);

    return () => {
      abgebrochen = true;
      document?.removeEventListener?.('visibilitychange', beiSichtbarkeit);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [active]);
}
