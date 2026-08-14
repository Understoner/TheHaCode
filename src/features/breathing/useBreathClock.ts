import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// Schicht 2 der Breathing Engine (SAD §7.4): die Zeitquelle.
//
// Ein einziger Ankerzeitpunkt beim Start, danach ist die verstrichene Zeit
// immer "jetzt minus Anker". Kein setInterval, das eine Restsekunde
// herunterzaehlt - solche Timer feuern nie exakt, und der Fehler summiert
// sich. Nach zehn Minuten liegt so eine Uhr typischerweise Sekunden daneben;
// bei einer Atemuebung ist das der Unterschied zwischen einem
// 5,5-Sekunden-Rhythmus und irgendetwas (CLAUDE.md, SAD §7.1).
export function useBreathClock() {
  const anchorRef = useRef<number | null>(null); // Startzeitpunkt
  const offsetRef = useRef(0); // aufsummierte Zeit vor der letzten Pause
  const [isRunning, setIsRunning] = useState(false);

  const elapsed = useCallback(() => {
    if (anchorRef.current == null) return offsetRef.current;
    return offsetRef.current + (Date.now() - anchorRef.current);
  }, []);

  const start = useCallback(() => {
    anchorRef.current = Date.now();
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (anchorRef.current != null) {
      offsetRef.current += Date.now() - anchorRef.current;
      anchorRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    anchorRef.current = null;
    offsetRef.current = 0;
    setIsRunning(false);
  }, []);

  /** Retention beendet der Nutzer per Tippen: Restzeit wird uebersprungen. */
  const skipRemaining = useCallback((remainingMs: number) => {
    offsetRef.current += remainingMs;
  }, []);

  // Wechselt die App in den Hintergrund, wird pausiert statt weiterzulaufen.
  // Eine Atemuebung, die im Hintergrund weiterlaeuft, produziert falsche
  // Zahlen - der Nutzer hat in der Zeit nicht geatmet.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && anchorRef.current != null) pause();
    });
    return () => sub.remove();
  }, [pause]);

  return { elapsed, start, pause, reset, skipRemaining, isRunning };
}
