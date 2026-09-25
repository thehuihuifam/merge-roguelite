import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, DANGER_LINE_Y, PHYSICS_STEP_MS, SLOW_MOTION } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { ISlowMotionSelector, SlowMotionRequest } from '@/core/interfaces/ISlowMotionSelector';
import type { MergeEvent } from '@/core/types';

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
    if (game.state === 'aiming' && game.isSettled()) {
      return;
    }
    if (game.state === 'game_over') {
      return;
    }
  }
}

/** Drops balls at x until one merge is observed, or the attempt budget runs out. */
function dropUntilMerge(game: Game, x: number, budget = 40): MergeEvent | null {
  let merge: MergeEvent | null = null;
  const off = game.events.on('merge:resolved', (event) => {
    if (merge === null) {
      merge = event;
    }
  });
  for (let i = 0; i < budget && merge === null && game.state !== 'game_over'; i += 1) {
    game.setAimX(x);
    game.drop();
    settle(game);
  }
  off();
  return merge;
}

describe('Game', () => {
  let game: Game;

  afterEach(() => {
    game.dispose();
  });

  it('starts in idle and moves to aiming on start', () => {
    game = new Game();
    expect(game.state).toBe('idle');
    game.start(1);
    expect(game.state).toBe('aiming');
    const snapshot = game.getSnapshot();
    expect(snapshot.held).not.toBeNull();
    expect(snapshot.balls).toHaveLength(0);
    expect(snapshot.score).toBe(0);
  });

  it('drops a ball, waits for the cooldown, then returns to aiming', () => {
    game = new Game();
    game.start(1);
    expect(game.drop()).toBe(true);
    expect(game.state).toBe('dropping');
    expect(game.ballCount).toBe(1);
    expect(game.drop()).toBe(false);
    settle(game);
    expect(game.state).toBe('aiming');
    expect(game.getSnapshot().balls[0]?.position.y).toBeGreaterThan(BOARD.height / 2);
  });

  it('clamps the aim position inside the board', () => {
    game = new Game();
    game.start(1);
    game.setAimX(-500);
    expect(game.getSnapshot().held?.x).toBeGreaterThan(0);
    game.setAimX(5000);
    expect(game.getSnapshot().held?.x).toBeLessThan(BOARD.width);
  });

  it('merges equal balls stacked on the same column and awards score', () => {
    game = new Game();
    game.start(2024);
    const merge = dropUntilMerge(game, BOARD.width / 2);
    expect(merge).not.toBeNull();
    if (merge === null) {
      return;
    }
    expect(merge.resultTier).not.toBeNull();
    expect(merge.scoreGained).toBeGreaterThan(0);
    expect(game.score).toBeGreaterThanOrEqual(merge.scoreGained);
    expect(game.best).toBe(game.score);
  });

  it('is deterministic for a given seed', () => {
    const run = (seed: number): number[] => {
      const g = new Game();
      g.start(seed);
      const tiers: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        tiers.push(g.getSnapshot().held?.tier ?? -1);
        g.drop();
        settle(g);
      }
      g.dispose();
      return tiers;
    };
    game = new Game();
    expect(run(7)).toEqual(run(7));
  });

  it('ends the run when balls pile above the danger line and can restart', () => {
    const lowLine = new OverflowDetector({ dangerLineY: BOARD.height - 140, graceMs: 300 });
    game = new Game({ overflowDetector: lowLine });
    game.start(3);
    let over = false;
    game.events.on('run:over', () => {
      over = true;
    });
    const columns = [40, BOARD.width - 40, BOARD.width / 2];
    for (let i = 0; i < 80 && game.state !== 'game_over'; i += 1) {
      game.setAimX(columns[i % columns.length] ?? 40);
      game.drop();
      settle(game, 1200);
    }
    expect(over).toBe(true);
    expect(game.state).toBe('game_over');
    expect(game.getSnapshot().dangerLineY).toBe(BOARD.height - 140);
    expect(new Game().getSnapshot().dangerLineY).toBe(DANGER_LINE_Y);
    game.restart(4);
    expect(game.state).toBe('aiming');
    expect(game.ballCount).toBe(0);
    expect(game.score).toBe(0);
  });

  it('routes merges through the slow-motion selector extension point', () => {
    const card: MergeCard = {
      id: 'test-card',
      kind: 'reward',
      title: '+100',
      description: 'adds one hundred points',
      apply: (ctx) => {
        ctx.addScore(100);
      },
    };
    const chosen: MergeCard[] = [];
    const selector: ISlowMotionSelector = {
      onMergeMoment: (): SlowMotionRequest => ({
        durationMs: SLOW_MOTION.durationMs,
        timeScale: SLOW_MOTION.timeScale,
        cards: [card],
      }),
      onCardChosen: (picked) => {
        chosen.push(picked);
      },
      onTimeout: () => card,
    };
    game = new Game({ slowMotionSelector: selector });
    game.start(2024);
    let reachedSelect = false;
    game.events.on('state:changed', ({ to }) => {
      if (to === 'slowmo_select') {
        reachedSelect = true;
      }
    });
    const merge = dropUntilMerge(game, BOARD.width / 2);
    expect(merge).not.toBeNull();
    expect(reachedSelect).toBe(true);
    // The choice is unlimited: nothing is picked for the player, no matter
    // how much real time passes.
    advance(game, 5000);
    expect(game.state).toBe('slowmo_select');
    expect(chosen).toHaveLength(0);
    const pending = game.getSnapshot().pendingCards[0];
    expect(pending).not.toBeUndefined();
    if (pending === undefined) {
      return;
    }
    expect(game.chooseCard(pending)).toBe(true);
    expect(chosen).toEqual([card]);
    expect(game.score).toBeGreaterThanOrEqual((merge?.scoreGained ?? 0) + 100);
  });

  it('applies a reward card outside the card choice through the shared context', () => {
    game = new Game();
    game.start(1);
    let seenScore = -1;
    const multiplierCalls: [number, number][] = [];
    const card: MergeCard = {
      id: 'round-clear-test',
      kind: 'reward',
      title: '+30',
      description: 'standalone bonus',
      apply: (ctx) => {
        seenScore = ctx.currentScore;
        ctx.addScore(30);
        ctx.pushScoreMultiplier(2, 2);
      },
    };

    expect(game.applyRewardCard(card)).toBe(true);
    expect(seenScore).toBe(0);
    expect(game.score).toBe(30);
    expect(multiplierCalls).toHaveLength(0);
  });

  it('rejects reward cards when no run is active', () => {
    game = new Game();
    let applied = false;
    const card: MergeCard = {
      id: 'idle-reward',
      kind: 'reward',
      title: '+1',
      description: 'never applied',
      apply: (ctx) => {
        applied = true;
        ctx.addScore(1);
      },
    };
    expect(game.applyRewardCard(card)).toBe(false);
    expect(applied).toBe(false);
  });
});
