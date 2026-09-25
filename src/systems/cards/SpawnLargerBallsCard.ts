import { MERGE_CARDS } from '@/config/gameConfig';
import type { MergeCardContext, RiskCard } from '@/core/interfaces/IMergeCard';

/** Stable identity for the spawn-pressure risk card. */
export const SPAWN_LARGER_BALLS_CARD_ID = 'risk-spawn-larger-balls';

/**
 * Risk: `spawn_larger_balls` (Task 2.18). The downside is board pressure —
 * the dispenser hands out nothing smaller than tier
 * `MERGE_CARDS.spawnLargerBallsFloor` for the next
 * `MERGE_CARDS.spawnLargerBallsCount` new balls — paid for with a ×4 on the
 * next merge.
 *
 * The penalty is enforced by the host through
 * `MergeCardContext.raiseSpawnTierFloor`. Hosts that cannot apply it get no
 * upside either: the card refuses to apply instead of handing out a free ×4.
 */
export function createSpawnLargerBallsCard(): RiskCard {
  const floor = MERGE_CARDS.spawnLargerBallsFloor;
  const count = MERGE_CARDS.spawnLargerBallsCount;
  const multiplier = MERGE_CARDS.spawnLargerBallsMultiplier;
  return {
    id: SPAWN_LARGER_BALLS_CARD_ID,
    kind: 'risk',
    penalty: 'spawn_larger_balls',
    severity: MERGE_CARDS.spawnLargerBallsSeverity,
    title: `HEAVY ×${multiplier}`,
    description: `Next ${count} balls start at tier ${floor} or bigger; next merge scores ×${multiplier}.`,
    apply: (context: MergeCardContext): void => {
      const raiseFloor = context.raiseSpawnTierFloor;
      if (raiseFloor === undefined) {
        return;
      }
      raiseFloor(floor, count);
      context.pushScoreMultiplier(multiplier, MERGE_CARDS.spawnLargerBallsMultiplierUses);
    },
  };
}
