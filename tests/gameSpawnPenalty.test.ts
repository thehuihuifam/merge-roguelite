import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, PHYSICS_STEP_MS } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import type { MergeCard, MergeCardContext } from '@/core/interfaces/IMergeCard';

const SEED = 4242;
const RESTART_SEED = 99;
const PENALTY_TIER = 3;
const PENALTY_COUNT = 2;

function advance(game: Game, ms: number): void {
  const steps = Math.ceil(ms / PHYSICS_STEP_MS);
  for (let i = 0; i < steps; i += 1) {
    game.update(PHYSICS_STEP_MS);
  }
}

function settle(game: Game, maxMs = 6000): void {
  let elapsed = 0;
  while (elapsed < maxMs) {
    advance(game, PHYSICS_STEP_MS);
    elapsed += PHYSICS_STEP_MS;
    if (game.state === 'game_over' || (game.state === 'aiming' && game.isSettled())) {
      return;
    }
  }
}

/** Stand-in risk card: only the spawn-floor penalty matters here. */
function spawnFloorCard(minTier: number, count: number): MergeCard {
  return {
    id: 'test-spawn-floor',
    kind: 'risk',
    title: 'TEST FLOOR',
    description: `Next ${count} balls start at tier ${minTier}.`,
    apply: (context: MergeCardContext): void => {
      context.raiseSpawnTierFloor?.(minTier, count);
    },
  };
}

/**
 * Next-tier values shown after each drop for one seeded run. Applying the card
 * up front must not disturb the seeded stream, so the only difference to the
 * floor-less baseline is the lifted tiers.
 */
function nextTierSequence(seed: number, drops: number, floor: number | null): number[] {
  const game = new Game({ specialSpawnChance: 0 });
  game.start(seed);
  if (floor !== null) {
    expect(game.applyRewardCard(spawnFloorCard(floor, PENALTY_COUNT))).toBe(true);
  }
  const tiers: number[] = [];
  for (let i = 0; i < drops; i += 1) {
    if (game.state !== 'aiming') {
      break;
    }
    expect(game.drop()).toBe(true);
    settle(game);
    if (game.state !== 'aiming') {
      break;
    }
    // The preview is only exposed while aiming, i.e. after the cooldown.
    tiers.push(game.getSnapshot().nextTier);
  }
  game.dispose();
  return tiers;
}

function at(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`missing value at index ${index}`);
  }
  return value;
}

describe('Game spawn-tier penalty', () => {
  let game: Game;

  afterEach(() => {
    game.dispose();
  });

  it('leaves the held ball and the NEXT preview alone when the card is applied', () => {
    game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);
    const before = game.getSnapshot();

    expect(game.applyRewardCard(spawnFloorCard(PENALTY_TIER, PENALTY_COUNT))).toBe(true);

    const after = game.getSnapshot();
    expect(after.held).toEqual(before.held);
    expect(after.nextTier).toBe(before.nextTier);
  });

  it('floors exactly the next N rolls and then follows the seeded stream again', () => {
    const baseline = nextTierSequence(SEED, 4, null);
    const penalized = nextTierSequence(SEED, 4, PENALTY_TIER);

    // The seed is picked so the floor visibly bites twice.
    expect(at(baseline, 0)).toBeLessThan(PENALTY_TIER);
    expect(at(baseline, 1)).toBeLessThan(PENALTY_TIER);
    expect(at(penalized, 0)).toBe(PENALTY_TIER);
    expect(at(penalized, 1)).toBe(PENALTY_TIER);
    // Charges spent: the run is back on the untouched seeded roll sequence.
    expect(at(penalized, 2)).toBe(at(baseline, 2));
    expect(at(penalized, 3)).toBe(at(baseline, 3));
  });

  it('applies a card taken mid-run to later drops only', () => {
    game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);
    const openingPreview = game.getSnapshot().nextTier;
    const baseline = nextTierSequence(SEED, 3, null);

    game.drop();
    settle(game);
    expect(game.getSnapshot().nextTier).toBe(at(baseline, 0));

    // Taken now, the card must not rewrite the ball already in hand.
    expect(game.applyRewardCard(spawnFloorCard(PENALTY_TIER, PENALTY_COUNT))).toBe(true);
    expect(game.getSnapshot().held?.tier).toBe(openingPreview);

    game.drop();
    settle(game);
    expect(game.getSnapshot().nextTier).toBe(Math.max(at(baseline, 1), PENALTY_TIER));
    game.drop();
    settle(game);
    expect(game.getSnapshot().nextTier).toBe(Math.max(at(baseline, 2), PENALTY_TIER));
  });

  it('clears the penalty when the run restarts', () => {
    const lowLine = new OverflowDetector({ dangerLineY: BOARD.height - 140, graceMs: 300 });
    game = new Game({ overflowDetector: lowLine, specialSpawnChance: 0 });
    game.start(SEED);
    game.applyRewardCard(spawnFloorCard(PENALTY_TIER, 3));

    const columns = [40, BOARD.width - 40, BOARD.width / 2];
    for (let i = 0; i < 80 && game.state !== 'game_over'; i += 1) {
      game.setAimX(columns[i % columns.length] ?? 40);
      game.drop();
      settle(game, 1200);
    }
    expect(game.state).toBe('game_over');

    game.restart(RESTART_SEED);
    const penalizedRestart = nextTierSequence(RESTART_SEED, 2, null);
    expect(game.drop()).toBe(true);
    settle(game);

    // The fresh run rolls on the untouched stream, so nothing is lifted.
    expect(game.getSnapshot().nextTier).toBe(at(penalizedRestart, 0));
  });
});
