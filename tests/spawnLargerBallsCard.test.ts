import { describe, expect, it } from 'vitest';
import { MERGE_CARDS, SPAWNABLE_TIER_COUNT } from '@/config/gameConfig';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import {
  SPAWN_LARGER_BALLS_CARD_ID,
  createSpawnLargerBallsCard,
} from '@/systems/cards/SpawnLargerBallsCard';
import type { MergeCardContext } from '@/core/interfaces/IMergeCard';
import type { MergeEvent } from '@/core/types';

const mergeEvent: MergeEvent = {
  sourceIds: [1, 2],
  resultTier: 3,
  position: { x: 240, y: 500 },
  chainIndex: 1,
  scoreGained: 48,
};

interface RecordedContext {
  readonly context: MergeCardContext;
  readonly floorRaises: Array<{ minTier: number; count: number }>;
  readonly multipliers: Array<{ multiplier: number; uses: number }>;
}

/** Context with the spawn-floor callback a Task 2.17+ host provides. */
function recordContext(withFloorSupport = true): RecordedContext {
  const floorRaises: Array<{ minTier: number; count: number }> = [];
  const multipliers: Array<{ multiplier: number; uses: number }> = [];
  const base: MergeCardContext = {
    merge: mergeEvent,
    currentScore: 500,
    addScore: (): void => {
      return;
    },
    pushScoreMultiplier: (multiplier: number, remainingMerges: number): void => {
      multipliers.push({ multiplier, uses: remainingMerges });
    },
    shiftDangerLine: (): void => {
      return;
    },
  };
  const context: MergeCardContext = withFloorSupport
    ? {
        ...base,
        raiseSpawnTierFloor: (minTier: number, count: number): void => {
          floorRaises.push({ minTier, count });
        },
      }
    : base;
  return { context, floorRaises, multipliers };
}

describe('createSpawnLargerBallsCard', () => {
  it('raises the spawn floor and pays the ×4 in one apply', () => {
    const card = createSpawnLargerBallsCard();
    const { context, floorRaises, multipliers } = recordContext();

    card.apply(context);

    expect(floorRaises).toEqual([
      { minTier: MERGE_CARDS.spawnLargerBallsFloor, count: MERGE_CARDS.spawnLargerBallsCount },
    ]);
    expect(multipliers).toEqual([
      {
        multiplier: MERGE_CARDS.spawnLargerBallsMultiplier,
        uses: MERGE_CARDS.spawnLargerBallsMultiplierUses,
      },
    ]);
  });

  it('refuses to pay out when the host cannot apply the penalty', () => {
    const card = createSpawnLargerBallsCard();
    const { context, floorRaises, multipliers } = recordContext(false);

    card.apply(context);

    expect(floorRaises).toHaveLength(0);
    expect(multipliers).toHaveLength(0);
  });

  it('is a risk card of the spawn_larger_balls penalty with its own identity', () => {
    const card = createSpawnLargerBallsCard();

    expect(card.id).toBe(SPAWN_LARGER_BALLS_CARD_ID);
    expect(isRiskCard(card)).toBe(true);
    expect(card.penalty).toBe('spawn_larger_balls');
    expect(card.severity).toBe(MERGE_CARDS.spawnLargerBallsSeverity);
    expect(card.kind).toBe('risk');
  });

  it('describes the floor, the number of balls and the reward', () => {
    const card = createSpawnLargerBallsCard();

    expect(card.description).toContain(String(MERGE_CARDS.spawnLargerBallsFloor));
    expect(card.description).toContain(String(MERGE_CARDS.spawnLargerBallsCount));
    expect(card.description).toContain(`×${MERGE_CARDS.spawnLargerBallsMultiplier}`);
    expect(card.title).toContain(String(MERGE_CARDS.spawnLargerBallsMultiplier));
  });

  it('keeps its floor inside the tiers the dispenser can actually roll', () => {
    expect(MERGE_CARDS.spawnLargerBallsFloor).toBeGreaterThan(0);
    expect(MERGE_CARDS.spawnLargerBallsFloor).toBeLessThan(SPAWNABLE_TIER_COUNT);
    expect(MERGE_CARDS.spawnLargerBallsMultiplier).toBeGreaterThan(MERGE_CARDS.tripleMultiplier);
    expect(MERGE_CARDS.spawnLargerBallsCount).toBeGreaterThan(0);
  });
});
