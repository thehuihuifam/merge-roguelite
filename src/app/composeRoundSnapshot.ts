import type { GameSnapshot } from '@/core/Game';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';

/**
 * Merges the app-level round HUD state into the snapshot handed to the
 * renderer (Task 2.15). `Game` stays unaware of the roguelite round structure:
 * the app layer reads `RoundRunner.getHudState()` and composes it here, so the
 * core keeps running headless in Node tests.
 *
 * A `null` round means "no round display" (round system without HUD support):
 * the input snapshot is returned unchanged, without a `round` key. The source
 * snapshot is never mutated — callers get a new object when a round exists.
 */
export function composeRoundSnapshot(
  snapshot: GameSnapshot,
  round: RoundHudState | null,
): GameSnapshot {
  if (round === null) {
    return snapshot;
  }
  return { ...snapshot, round };
}
