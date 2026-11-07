import { useWearableAutoSync } from './useWearables';

/** Gleicht Oura still ab, wenn es faellig ist (useWearableAutoSync). Zeigt nichts. */
export function WearableAutoSync() {
  useWearableAutoSync();
  return null;
}
