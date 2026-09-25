import { MERGE_CARDS, TEXT } from '@/config/gameConfig';
import type { MergeCardContext, RiskCard } from '@/core/interfaces/IMergeCard';

export const SPAWN_LARGER_BALLS_CARD_ID = 'risk-spawn-larger-balls';

/**
 * Risk: the board pressure card (Task 2.18). Accepting it forces the next
 * `spawnLargerSpawns` dispenser issuances up to at least
 * `spawnLargerFloorTier` — big balls eat the board fast — in exchange for a
 * one-shot merge multiplier.
 *
 * When the host context does not implement `raiseSpawnTierFloor` the card
 * refuses to apply at all: it never hands out the multiplier without the
 * penalty, so the pick is simply wasted rather than free value.
 */
export function createSpawnLargerBallsCard(): RiskCard {
  return {
    id: SPAWN_LARGER_BALLS_CARD_ID,
    kind: 'risk',
    penalty: 'spawn_larger_balls',
    severity: MERGE_CARDS.spawnLargerSeverity,
    title: TEXT.heavyLoadTitle,
    description: TEXT.heavyLoadDesc(
      MERGE_CARDS.spawnLargerSpawns,
      MERGE_CARDS.spawnLargerFloorTier,
      MERGE_CARDS.spawnLargerMultiplier,
    ),
    apply: (context: MergeCardContext): void => {
      if (context.raiseSpawnTierFloor === undefined) {
        return;
      }
      context.raiseSpawnTierFloor(MERGE_CARDS.spawnLargerFloorTier, MERGE_CARDS.spawnLargerSpawns);
      context.pushScoreMultiplier(
        MERGE_CARDS.spawnLargerMultiplier,
        MERGE_CARDS.spawnLargerMultiplierUses,
      );
    },
  };
}
