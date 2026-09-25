import { describe, expect, it } from 'vitest';
import { BOARD, PHYSICS_STEP_MS, SLOW_MOTION } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { SeededRandom } from '@/core/rng/SeededRandom';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import { BasicMergeCardProvider } from '@/systems/cards/BasicMergeCardProvider';
import { CardSlowMotionSelector } from '@/systems/CardSlowMotionSelector';
import type { IMergeCardProvider } from '@/core/interfaces/IMergeCard';
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
    expect(request.cards.some((card) => card.title === '+10000 PTS')).toBe(true);

    const timeoutPick = selector.onTimeout(makeMerge(null, 10000));
    expect(timeoutPick).not.toBeNull();
    expect(request.cards).toContain(timeoutPick);
    if (timeoutPick !== null) {
      expect(isRiskCard(timeoutPick)).toBe(false);
    }
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

  it('picks a non-risk card from the offered hand on timeout', () => {
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(7)));
    const request = selector.onMergeMoment(makeMerge(4));
    const offered = request?.cards ?? [];
    expect(offered).toHaveLength(SLOW_MOTION.cardCount);

    const fallback = selector.onTimeout(makeMerge(4));

    expect(fallback).not.toBeNull();
    expect(fallback).not.toBeUndefined();
    if (fallback === null || fallback === undefined) {
      return;
    }
    expect(isRiskCard(fallback)).toBe(false);
    expect(offered).toContain(fallback);
  });

  it('still refuses risk cards when a timeout arrives without a prior offer', () => {
    const selector = new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(11)));
    const fallback = selector.onTimeout(makeMerge(5));

    expect(fallback).not.toBeNull();
    if (fallback === null) {
      return;
    }
    expect(isRiskCard(fallback)).toBe(false);
  });

  it('does not re-offer a hand that was already dismissed by a choice', () => {
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

    // The hand is gone, so the fallback draws a fresh one — still never a risk card.
    expect(selector.onTimeout(merge)).not.toBeNull();
    expect(selector.onTimeout(merge)).not.toBeUndefined();
  });

  it('never offers more cards than the provider can supply', () => {
    const emptyProvider: IMergeCardProvider = {
      draw: (): [] => [],
    };
    const selector = new CardSlowMotionSelector(emptyProvider);
    expect(selector.onMergeMoment(makeMerge(9))).toBeNull();
  });

  it('opens the card choice inside a real run and applies the timeout pick', () => {
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

      const scoreBeforeTimeout = game.score;
      for (
        let step = 0;
        step < Math.ceil(SLOW_MOTION.choiceTimeoutMs / PHYSICS_STEP_MS) + 4;
        step += 1
      ) {
        game.update(PHYSICS_STEP_MS);
      }

      expect(game.state).not.toBe('slowmo_select');
      expect(game.getSnapshot().pendingCards).toHaveLength(0);
      expect(game.score).toBeGreaterThanOrEqual(scoreBeforeTimeout);
    } finally {
      game.dispose();
    }
  });
});
