import { describe, expect, it } from 'vitest';
import { BOARD, PHYSICS_STEP_MS } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import type { MergeCardContext, RiskCard } from '@/core/interfaces/IMergeCard';

const SEED = 42;
const DROP_XS = [60, 160, 240, 320, 420];

function advance(game: Game, ms: number): void {
  const steps = Math.ceil(ms / PHYSICS_STEP_MS);
  for (let i = 0; i < steps; i += 1) {
    game.update(PHYSICS_STEP_MS);
  }
}

function settle(game: Game, maxMs = 4000): void {
  let elapsed = 0;
  while (elapsed < maxMs) {
    advance(game, PHYSICS_STEP_MS);
    elapsed += PHYSICS_STEP_MS;
    if (game.state === 'aiming' && game.isSettled()) {
      return;
    }
    if (game.state === 'game_over') {
      return;
    }
  }
}

/** A `spawn_larger_balls` risk card stand-in driving the context callback. */
function floorCard(minTier: number, count: number): RiskCard {
  return {
    id: 'test-spawn-floor',
    kind: 'risk',
    penalty: 'spawn_larger_balls',
    severity: 0.6,
    title: 'HEAVY LOAD',
    description: `Next ${count} spawns are tier ${minTier}+.`,
    apply: (context: MergeCardContext): void => {
      context.raiseSpawnTierFloor?.(minTier, count);
    },
  };
}

/** Drops one ball and returns the NEXT tier issued for it. */
function dropOnce(game: Game, index: number): number {
  game.setAimX(DROP_XS[index % DROP_XS.length] ?? 60);
  game.drop();
  settle(game);
  return game.getSnapshot().nextTier;
}

describe('Game spawn penalty (Task 2.17)', () => {
  it('leaves the held/NEXT preview untouched when the card is applied', () => {
    const game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);

    const nextBefore = game.getSnapshot().nextTier;
    const heldBefore = game.getSnapshot().held?.tier ?? 0;
    expect(game.applyRewardCard(floorCard(4, 3))).toBe(true);

    expect(game.getSnapshot().nextTier).toBe(nextBefore);
    expect(game.getSnapshot().held?.tier ?? 0).toBe(heldBefore);
    game.dispose();
  });

  it('forces the floor onto the next N issuances, then rolls normally again', () => {
    // Same seed without the card: proves the expired penalty restores the
    // exact rolls a clean run would produce.
    const baseline = new Game({ specialSpawnChance: 0 });
    baseline.start(SEED);
    const game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);

    const nextBefore = game.getSnapshot().nextTier;
    expect(game.applyRewardCard(floorCard(4, 3))).toBe(true);

    // First drop still holds the preview the player already saw.
    expect(dropOnce(game, 0)).toBe(4);
    expect(game.getSnapshot().held?.tier ?? 0).toBe(nextBefore);
    expect(dropOnce(game, 1)).toBe(4);
    expect(dropOnce(game, 2)).toBe(4);

    // Penalty spent: issuances match the unpenalised rolls exactly. The
    // baseline first replays the same three drops so both RNG streams sit
    // at the same position.
    for (let i = 0; i < 3; i += 1) {
      dropOnce(baseline, i);
    }
    for (let i = 3; i < 7; i += 1) {
      expect(dropOnce(game, i)).toBe(dropOnce(baseline, i));
    }
    game.dispose();
    baseline.dispose();
  });

  it('keeps the special-ball roll order while the floor is active', () => {
    const game = new Game({ specialSpawnChance: 1 });
    game.start(SEED);
    expect(game.getSnapshot().nextSpecial).toBe('bomb');

    expect(game.applyRewardCard(floorCard(2, 2))).toBe(true);
    for (let i = 0; i < 2; i += 1) {
      expect(dropOnce(game, i)).toBeGreaterThanOrEqual(2);
      expect(game.getSnapshot().nextSpecial).toBe('bomb');
    }
    game.dispose();
  });

  it('releases the penalty when the run restarts', () => {
    const baseline = new Game({ specialSpawnChance: 0 });
    baseline.start(SEED);
    const baselineSeq: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      baselineSeq.push(dropOnce(baseline, i));
    }
    expect(baselineSeq.some((tier) => tier < 4)).toBe(true);

    const lowLine = new OverflowDetector({ dangerLineY: BOARD.height - 140, graceMs: 50 });
    const game = new Game({ overflowDetector: lowLine, specialSpawnChance: 0 });
    game.start(SEED);
    dropOnce(game, 0);
    expect(game.applyRewardCard(floorCard(4, 50))).toBe(true);
    for (let i = 1; i < 90 && game.state !== 'game_over'; i += 1) {
      dropOnce(game, i);
    }
    expect(game.state).toBe('game_over');

    game.restart(SEED);
    expect(game.state).toBe('aiming');
    const afterRestart: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      afterRestart.push(dropOnce(game, i));
    }
    // A surviving floor would pin every issuance to tier 4; a clean restart
    // replays the baseline rolls instead.
    expect(afterRestart).toEqual(baselineSeq);
    game.dispose();
    baseline.dispose();
  });
});
