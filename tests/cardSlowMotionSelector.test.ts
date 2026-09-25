import { describe, expect, it } from 'vitest';
import { BOARD, PHYSICS_STEP_MS, SLOW_MOTION } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { SeededRandom } from '@/core/rng/SeededRandom';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import { BasicMergeCardProvider } from '@/systems/cards/BasicMergeCardProvider';
import { CardSlowMotionSelector } from '@/systems/CardSlowMotionSelector';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { Ball } from '@/core/types';
import type { IMergeCardProvider, MergeCard } from '@/core/interfaces/IMergeCard';
import type { MergeEvent } from '@/core/types';

function makeMerge(resultTier: number | null, scoreGained = 16): MergeEvent {
  return {
    sourceIds: [1, 2],
    resultTier,
    position: { x: BOARD.width / 2, y: BOARD.height / 2 },
    chainIndex: 0,
    scoreGained,
  };
}

describe('CardSlowMotionSelector', () => {
  it('ignores merges below the minimum result tier', () => {
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(1)));
    expect(selector.onMergeMoment(makeMerge(0))).toBeNull();
    expect(selector.onMergeMoment(makeMerge(SLOW_MOTION.minResultTier - 1))).toBeNull();
  });

  it('opens a card choice for the max-tier annihilation and its 10,000-point bonus', () => {
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(1)));
    const request = selector.onMergeMoment(makeMerge(null, 10000));

    expect(request).not.toBeNull();
    if (request === null) {
      return;
    }
    expect(request.cards).toHaveLength(SLOW_MOTION.cardCount);
    expect(request.cards.filter(isRiskCard)).toHaveLength(SLOW_MOTION.riskCardCount);
    expect(request.cards.some((card) => card.title === '+10000 점')).toBe(true);
  });

  it('opens the choice with the configured hand and timing', () => {
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(99)));
    const request = selector.onMergeMoment(makeMerge(SLOW_MOTION.minResultTier));

    expect(request).not.toBeNull();
    expect(request?.durationMs).toBe(SLOW_MOTION.durationMs);
    expect(request?.timeScale).toBe(SLOW_MOTION.timeScale);
    expect(request?.cards).toHaveLength(SLOW_MOTION.cardCount);
    expect(request?.cards.filter(isRiskCard)).toHaveLength(SLOW_MOTION.riskCardCount);
  });

  it('is deterministic for a given provider seed', () => {
    const drawWith = (seed: number): string[] => {
      const selector = new CardSlowMotionSelector(
        new BasicMergeCardProvider(new SeededRandom(seed)),
      );
      const request = selector.onMergeMoment(makeMerge(3));
      return (request?.cards ?? []).map((card) => card.id);
    };
    expect(drawWith(2024)).toEqual(drawWith(2024));
  });

  it('never auto-picks while the choice is unlimited', () => {
    expect(SLOW_MOTION.choiceTimeoutMs).toBeNull();
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(7)));
    const request = selector.onMergeMoment(makeMerge(4));
    const offered = request?.cards ?? [];
    expect(offered).toHaveLength(SLOW_MOTION.cardCount);

    // The window never expires on its own, so the selector picks nothing.
    expect(selector.onTimeout(makeMerge(4))).toBeNull();
  });

  it('returns no fallback pick when no offer was ever made', () => {
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(11)));
    expect(selector.onTimeout(makeMerge(5))).toBeNull();
  });

  it('offers a fresh hand after a choice dismissed the previous one', () => {
    const provider = new BasicMergeCardProvider(new SeededRandom(3));
    const selector = new CardSlowMotionSelector(provider);
    const merge = makeMerge(2);
    const offered = selector.onMergeMoment(merge)?.cards ?? [];
    const safe = offered.find((card) => !isRiskCard(card));
    expect(safe).not.toBeUndefined();
    if (safe === undefined) {
      return;
    }

    selector.onCardChosen(safe, merge);
    expect(selector.onTimeout(merge)).toBeNull();

    // The next qualifying merge still draws and offers a new hand.
    const next = selector.onMergeMoment(makeMerge(3));
    expect(next).not.toBeNull();
    expect(next?.cards).toHaveLength(SLOW_MOTION.cardCount);
  });

  it('never offers more cards than the provider can supply', () => {
    const emptyProvider: IMergeCardProvider = {
      draw: (): [] => [],
    };
    const selector = new CardSlowMotionSelector(emptyProvider);
    expect(selector.onMergeMoment(makeMerge(9))).toBeNull();
  });

  it('opens the card choice inside a real run and waits for the player', () => {
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(4242)));
    const game = new Game({ slowMotionSelector: selector });
    try {
      game.start(2024);
      let qualifying: MergeEvent | null = null;
      const off = game.events.on('merge:resolved', (event) => {
        if (qualifying === null && (event.resultTier ?? -1) >= SLOW_MOTION.minResultTier) {
          qualifying = event;
        }
      });

      const stepUntilMerge = (): void => {
        for (let step = 0; step < 240; step += 1) {
          game.update(PHYSICS_STEP_MS);
          if (qualifying !== null) {
            return;
          }
        }
      };

      for (let drop = 0; drop < 60 && qualifying === null; drop += 1) {
        game.setAimX(BOARD.width / 2);
        game.drop();
        stepUntilMerge();
        if (game.state === 'game_over') {
          break;
        }
      }
      off();

      expect(qualifying).not.toBeNull();
      expect(game.state).toBe('slowmo_select');
      const snapshot = game.getSnapshot();
      expect(snapshot.pendingCards).toHaveLength(SLOW_MOTION.cardCount);
      expect(snapshot.pendingCards.filter(isRiskCard)).toHaveLength(SLOW_MOTION.riskCardCount);
      expect(snapshot.timeScale).toBe(SLOW_MOTION.timeScale);

      // Far beyond the former auto-select window: the choice is still open.
      const scoreBeforeWait = game.score;
      for (let step = 0; step < Math.ceil(5000 / PHYSICS_STEP_MS); step += 1) {
        game.update(PHYSICS_STEP_MS);
      }
      expect(game.state).toBe('slowmo_select');
      expect(game.getSnapshot().pendingCards).toHaveLength(SLOW_MOTION.cardCount);
      expect(game.score).toBe(scoreBeforeWait);

      // The player takes as long as they want; the pick still applies.
      const safe = game.getSnapshot().pendingCards.find((card) => !isRiskCard(card));
      expect(safe).not.toBeUndefined();
      if (safe === undefined) {
        return;
      }
      expect(game.chooseCard(safe)).toBe(true);
      expect(game.state).not.toBe('slowmo_select');
      expect(game.getSnapshot().pendingCards).toHaveLength(0);
    } finally {
      game.dispose();
    }
  });

  it('keeps the simulation running under the overlay during an unlimited wait', () => {
    // A physics stand-in that records step deltas and keeps a dropped ball
    // falling, so "background physics continues" is directly observable.
    const stepDeltas: number[] = [];
    const physics = {
      addBall: (): void => {
        return;
      },
      removeBall: (): void => {
        return;
      },
      step: (deltaMs: number): void => {
        stepDeltas.push(deltaMs);
      },
      sync: (balls: Iterable<Ball>): void => {
        for (const ball of balls) {
          ball.position = { x: ball.position.x, y: ball.position.y + 3 };
          ball.velocity = { x: 0, y: 3 };
        }
      },
      drainCollisions: (): [] => [],
      clearBalls: (): void => {
        return;
      },
      dispose: (): void => {
        return;
      },
      maxSpeed: (): number => 3,
    } as unknown as PhysicsWorld;

    const hand: MergeCard[] = [
      { id: 'wait-a', kind: 'reward', title: 'A', description: 'd', apply: (): void => {} },
      { id: 'wait-b', kind: 'reward', title: 'B', description: 'd', apply: (): void => {} },
      { id: 'wait-c', kind: 'reward', title: 'C', description: 'd', apply: (): void => {} },
    ];
    const game = new Game({ physics });
    try {
      game.start(7);
      game.drop();
      expect(game.openRewardChoice(hand)).toBe(true);
      expect(game.state).toBe('slowmo_select');
      expect(game.getSnapshot().timeScale).toBe(SLOW_MOTION.timeScale);

      // The 400ms slow-motion visual effect expires, but the choice holds and
      // physics keeps stepping behind the overlay.
      stepDeltas.length = 0;
      const yBefore = game.getSnapshot().balls[0]?.position.y ?? 0;
      for (let step = 0; step < Math.ceil(1000 / PHYSICS_STEP_MS); step += 1) {
        game.update(PHYSICS_STEP_MS);
      }

      expect(game.state).toBe('slowmo_select');
      expect(game.getSnapshot().pendingCards).toHaveLength(3);
      expect(game.getSnapshot().timeScale).toBe(1);
      expect(stepDeltas.length).toBeGreaterThan(0);
      expect(stepDeltas.every((delta) => delta > 0)).toBe(true);
      // Slow motion ended after SLOW_MOTION.durationMs of real time, so later
      // steps are full-size again — the game is not frozen by the open choice.
      expect(stepDeltas.filter((delta) => delta === PHYSICS_STEP_MS).length).toBeGreaterThan(0);
      // The dropped ball physically moved down the board under the overlay.
      const yAfter = game.getSnapshot().balls[0]?.position.y ?? 0;
      expect(yAfter).toBeGreaterThan(yBefore);
    } finally {
      game.dispose();
    }
  });
});
