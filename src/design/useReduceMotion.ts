import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Ob das System weniger Bewegung wuenscht. Bis die Antwort da ist: ja - lieber
 * einen Moment still als einmal ungefragt animiert (wie Ornaments.tsx).
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (active) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
