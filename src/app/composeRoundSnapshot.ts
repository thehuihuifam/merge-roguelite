import type { GameSnapshot } from '@/core/Game';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';

/**
 * Merges the round HUD state (Task 2.12) into the snapshot handed to the
 * renderer. `Game` deliberately knows nothing about rounds; the app layer
 * composes `RoundRunner.getHudState()` in here every frame.
 *
 * - `round !== null` → a new snapshot with the `round` field set.
 * - `round === null` → the snapshot without a `round` field (the field is
 *   dropped when present, so HUD-less round systems hide the display).
 * - The input snapshot is never mutated.
 */
export function composeRoundSnapshot(
  snapshot: GameSnapshot,
  round: RoundHudState | null,
): GameSnapshot {
  if (round === null) {
    if (snapshot.round === undefined) {
      return snapshot;
    }
    const { round: _dropped, ...rest } = snapshot;
    return rest;
  }
  return { ...snapshot, round };
}
