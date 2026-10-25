import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Stoppuhr fuer die BOLT-Messung.
 *
 * Dasselbe Prinzip wie die Uhr der Breathing Engine (useBreathClock, SAD
 * §7.1): ein Ankerzeitpunkt beim Start, die Zeit ist immer "jetzt minus
 * Anker". Kein setInterval (CLAUDE.md §Verboten). Die Anzeige zieht ueber
 * requestAnimationFrame nach und rendert nur, wenn sich die angezeigte
 * Zehntelsekunde aendert.
 *
 * Bewusst eine eigene kleine Uhr und nicht useBreathClock: die pausiert,
 * sobald die App in den Hintergrund geht - beim Messen mit zugehaltener Nase
 * ist das egal, aber die Engine soll fuer einen Nebenzweck nicht angefasst
 * werden.
 */
export function useStopwatch() {
  const anchorRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      if (anchorRef.current === null) return;
      const now = Date.now() - anchorRef.current;
      setElapsedMs((prev) => (Math.floor(prev / 100) === Math.floor(now / 100) ? prev : now));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const start = useCallback(() => {
    anchorRef.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
  }, []);

  /** Haelt an und liefert die gemessene Zeit - aus dem Anker, nicht aus der Anzeige. */
  const stop = useCallback((): number => {
    const total = anchorRef.current === null ? 0 : Date.now() - anchorRef.current;
    anchorRef.current = null;
    setRunning(false);
    setElapsedMs(total);
    return total;
  }, []);

  const reset = useCallback(() => {
    anchorRef.current = null;
    setRunning(false);
    setElapsedMs(0);
  }, []);

  return { elapsedMs, running, start, stop, reset };
}
