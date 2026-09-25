import { describe, expect, it } from 'vitest';
import { PHYSICS_STEP_MS, SLOW_MOTION } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { SeededRandom } from '@/core/rng/SeededRandom';
import { CardSlowMotionSelector } from '@/systems/CardSlowMotionSelector';
import {
  BasicMergeCardProvider,
  createScoreLossCard,
} from '@/systems/cards/BasicMergeCardProvider';
import { createRoundClearChoice } from '@/systems/cards/RoundClearRewardCard';
import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { MergeEvent } from '@/core/types';

function rewardCard(id: string, points: number): MergeCard {
  return {
    id,
    kind: 'reward',
    title: `+${points}`,
    description: 'test helper',
    apply: (context): void => {
      context.addScore(points);
    },
  };
}

function syntheticMerge(): MergeEvent {
  return {
    sourceIds: [-1, -1],
    resultTier: null,
    position: { x: 0, y: 0 },
    chainIndex: 0,
    scoreGained: 0,
  };
}

describe('Game.openRewardChoice', () => {
  it('opens the slow-motion choice from aiming and applies the picked card', () => {
    const game = new Game();
    game.start(11);
    const slowStarts: number[] = [];
    game.events.on('time:slowMotionStart', ({ timeScale }): void => {
      slowStarts.push(timeScale);
    });

    const hand = createRoundClearChoice(1);
    expect(game.openRewardChoice(hand)).toBe(true);
    expect(game.state).toBe('slowmo_select');
    expect(game.getSnapshot().pendingCards).toHaveLength(3);
    expect(game.getSnapshot().timeScale).toBe(SLOW_MOTION.timeScale);
    expect(slowStarts).toEqual([SLOW_MOTION.timeScale]);

    const picked = game.getSnapshot().pendingCards[0];
    expect(picked).not.toBeUndefined();
    if (picked === undefined) {
      game.dispose();
      return;
    }
    expect(game.chooseCard(picked)).toBe(true);
    expect(game.score).toBe(50);
    expect(game.state).toBe('aiming');
    game.dispose();
  });

  it('resumes dropping when opened mid-cooldown and left to time out', () => {
    const game = new Game();
    game.start(11);
    game.drop();
    expect(game.state).toBe('dropping');

    expect(game.openRewardChoice(createRoundClearChoice(1))).toBe(true);
    const steps = Math.ceil(SLOW_MOTION.choiceTimeoutMs / PHYSICS_STEP_MS);
    for (let i = 0; i < steps; i += 1) {
      game.update(PHYSICS_STEP_MS);
    }

    // The default no-op selector picks nothing on timeout.
    expect(game.state).toBe('dropping');
    expect(game.score).toBe(0);
    game.dispose();
  });

  it('refuses an empty hand, a busy board and an idle run', () => {
    const game = new Game();
    expect(game.openRewardChoice(createRoundClearChoice(1))).toBe(false);

    game.start(11);
    expect(game.openRewardChoice([])).toBe(false);
    expect(game.state).toBe('aiming');

    expect(game.openRewardChoice(createRoundClearChoice(1))).toBe(true);
    expect(game.openRewardChoice(createRoundClearChoice(2))).toBe(false);
    expect(game.getSnapshot().pendingCards[0]?.title).toContain('라운드 1');
    game.dispose();
  });
});

describe('CardSlowMotionSelector.offerCards', () => {
  function createSelector(): CardSlowMotionSelector {
    return new CardSlowMotionSelector(new BasicMergeCardProvider(new SeededRandom(5)));
  }

  it('falls back to the first shown card on timeout', () => {
    const selector = createSelector();
    const hand = [rewardCard('custom-a', 10), rewardCard('custom-b', 20)];
    selector.offerCards(syntheticMerge(), hand);
    expect(selector.onTimeout(syntheticMerge())).toBe(hand[0]);
  });

  it('never hands a risk card to the timeout fallback', () => {
    const selector = createSelector();
    const reward = rewardCard('custom-safe', 10);
    selector.offerCards(syntheticMerge(), [createScoreLossCard(), reward]);
    expect(selector.onTimeout(syntheticMerge())).toBe(reward);
  });

  it('forgets the offered hand once the choice is made', () => {
    const selector = createSelector();
    const hand = [rewardCard('custom-a', 10), rewardCard('custom-b', 20)];
    selector.offerCards(syntheticMerge(), hand);
    const picked = hand[0];
    expect(picked).not.toBeUndefined();
    if (picked === undefined) {
      return;
    }
    selector.onCardChosen(picked, syntheticMerge());

    const fallback = selector.onTimeout(syntheticMerge());
    expect(fallback).not.toBeNull();
    expect(fallback?.id.startsWith('custom-')).toBe(false);
  });
});
