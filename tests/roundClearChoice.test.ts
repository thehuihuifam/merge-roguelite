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

  it('resumes dropping when a card is picked after an unlimited wait', () => {
    const game = new Game();
    game.start(11);
    game.drop();
    expect(game.state).toBe('dropping');

    expect(game.openRewardChoice(createRoundClearChoice(1))).toBe(true);
    // Far beyond the former 2,500ms auto-pick window: still waiting, no score.
    const steps = Math.ceil(5000 / PHYSICS_STEP_MS);
    for (let i = 0; i < steps; i += 1) {
      game.update(PHYSICS_STEP_MS);
    }
    expect(game.state).toBe('slowmo_select');
    expect(game.score).toBe(0);

    const picked = game.getSnapshot().pendingCards[0];
    expect(picked).not.toBeUndefined();
    if (picked === undefined) {
      game.dispose();
      return;
    }
    expect(game.chooseCard(picked)).toBe(true);
    expect(game.state).toBe('dropping');
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

  it('keeps the offered hand waiting instead of auto-picking on timeout', () => {
    expect(SLOW_MOTION.choiceTimeoutMs).toBeNull();
    const selector = createSelector();
    const hand = [rewardCard('custom-a', 10), rewardCard('custom-b', 20)];
    selector.offerCards(syntheticMerge(), hand);
    // Unlimited choice: no card is ever picked for the player.
    expect(selector.onTimeout(syntheticMerge())).toBeNull();
  });

  it('never hands a risk card out on a timeout call', () => {
    const selector = createSelector();
    const reward = rewardCard('custom-safe', 10);
    selector.offerCards(syntheticMerge(), [createScoreLossCard(), reward]);
    expect(selector.onTimeout(syntheticMerge())).toBeNull();
  });

  it('returns no fallback after the choice is made', () => {
    const selector = createSelector();
    const hand = [rewardCard('custom-a', 10), rewardCard('custom-b', 20)];
    selector.offerCards(syntheticMerge(), hand);
    const picked = hand[0];
    expect(picked).not.toBeUndefined();
    if (picked === undefined) {
      return;
    }
    selector.onCardChosen(picked, syntheticMerge());
    expect(selector.onTimeout(syntheticMerge())).toBeNull();
  });
});
