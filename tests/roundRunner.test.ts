import { describe, expect, it } from 'vitest';
import { ROUNDS } from '@/config/gameConfig';
import { EventBus } from '@/core/events/EventBus';
import { Game } from '@/core/Game';
import { BasicRoundSystem } from '@/systems/BasicRoundSystem';
import { RoundRunner } from '@/systems/RoundRunner';
import {
  ROUND_CLEAR_CARD_ID,
  createRoundClearRewardCard,
} from '@/systems/cards/RoundClearRewardCard';
import type { GameEventMap } from '@/core/events/GameEvents';
import type { MergeCard, MergeCardContext } from '@/core/interfaces/IMergeCard';
import type { RoundDefinition } from '@/core/interfaces/IRoundSystem';

function fakeContext(): { context: MergeCardContext; deltas: number[] } {
  const deltas: number[] = [];
  const context: MergeCardContext = {
    merge: {
      sourceIds: [-1, -1],
      resultTier: null,
      position: { x: 0, y: 0 },
      chainIndex: 0,
      scoreGained: 0,
    },
    currentScore: 0,
    addScore: (delta: number): void => {
      deltas.push(delta);
    },
    pushScoreMultiplier: (): void => {
      return;
    },
  };
  return { context, deltas };
}

/** A Game stand-in exposing just the surface RoundRunner touches. */
function createFakeGame(): {
  game: Game;
  events: EventBus<GameEventMap>;
  applied: MergeCard[];
} {
  const events = new EventBus<GameEventMap>();
  const applied: MergeCard[] = [];
  const game = {
    events,
    applyRewardCard: (card: MergeCard): boolean => {
      applied.push(card);
      return true;
    },
  } as unknown as Game;
  return { game, events, applied };
}

/** Test reward card that banks `points` immediately when applied. */
function pointsCard(points: number): MergeCard {
  return {
    id: `test-points-${points}`,
    kind: 'reward',
    title: `+${points}`,
    description: 'test helper',
    apply: (context: MergeCardContext): void => {
      context.addScore(points);
    },
  };
}

describe('createRoundClearRewardCard', () => {
  it('names the cleared round and scales the bonus with it', () => {
    const first = createRoundClearRewardCard(1);
    expect(first.id).toBe(ROUND_CLEAR_CARD_ID);
    expect(first.kind).toBe('reward');
    expect(first.title).toBe('ROUND 1 CLEAR');
    expect(first.description).toContain(`+${ROUNDS.rewardBaseScore} points`);

    const third = createRoundClearRewardCard(3);
    expect(third.title).toBe('ROUND 3 CLEAR');
    expect(third.description).toContain(
      `+${ROUNDS.rewardBaseScore + 2 * ROUNDS.rewardScorePerRound} points`,
    );
  });

  it('banks the bonus through the card context', () => {
    const { context, deltas } = fakeContext();
    createRoundClearRewardCard(2).apply(context);
    expect(deltas).toEqual([ROUNDS.rewardBaseScore + ROUNDS.rewardScorePerRound]);
  });
});

describe('RoundRunner', () => {
  it('grants the clear-reward card and advances when the target is met', () => {
    const { game, events, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const granted: RoundDefinition[] = [];
    const runner = new RoundRunner(game, rounds, (round): MergeCard => {
      granted.push(round);
      return createRoundClearRewardCard(round.index);
    });

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });

    expect(granted.map((round) => round.index)).toEqual([1]);
    expect(applied).toHaveLength(1);
    expect(applied[0]?.id).toBe(ROUND_CLEAR_CARD_ID);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('advances without a reward when the drop budget runs out first', () => {
    const { game, events, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard =>
      createRoundClearRewardCard(round.index),
    );

    for (let i = 0; i < ROUNDS.firstDropBudget; i += 1) {
      events.emit('ball:dropped', {
        ball: {
          id: i + 1,
          tier: 0,
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          spawnedAt: 0,
        },
      });
    }

    expect(applied).toHaveLength(0);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('keeps the budget from pushing past a round that is already cleared', () => {
    const { game, events, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard =>
      createRoundClearRewardCard(round.index),
    );

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });
    events.emit('ball:dropped', {
      ball: { id: 1, tier: 0, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, spawnedAt: 0 },
    });

    expect(applied).toHaveLength(1);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('restarts at round 1 whenever a new run begins', () => {
    const { game, events } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard =>
      createRoundClearRewardCard(round.index),
    );

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });
    events.emit('run:started', { seed: 99 });

    expect(rounds.currentRound().index).toBe(1);
    expect(rounds.isRoundCleared()).toBe(false);
    runner.dispose();
  });

  it('stops listening after dispose', () => {
    const { game, events, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard =>
      createRoundClearRewardCard(round.index),
    );
    runner.dispose();

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });

    expect(applied).toHaveLength(0);
    expect(rounds.currentRound().index).toBe(1);
  });

  it('runs the full clear loop on a real Game and survives the reward re-entry', () => {
    const game = new Game();
    const rounds = new BasicRoundSystem();
    const granted: number[] = [];
    const runner = new RoundRunner(game, rounds, (round): MergeCard => {
      granted.push(round.index);
      return createRoundClearRewardCard(round.index);
    });
    game.start(7);

    game.applyRewardCard(pointsCard(ROUNDS.firstTargetScore));
    // Round 1 clears at 150 and its +50 bonus lands immediately (score 200).
    expect(granted).toEqual([1]);
    expect(game.score).toBe(ROUNDS.firstTargetScore + ROUNDS.rewardBaseScore);
    expect(rounds.currentRound().index).toBe(2);

    const roundTwoTarget = ROUNDS.firstTargetScore + ROUNDS.targetScoreStep;
    game.applyRewardCard(pointsCard(roundTwoTarget - 1));
    expect(granted).toEqual([1]);
    game.applyRewardCard(pointsCard(1));
    expect(granted).toEqual([1, 2]);
    expect(game.score).toBe(
      ROUNDS.firstTargetScore +
        ROUNDS.rewardBaseScore +
        roundTwoTarget +
        ROUNDS.rewardBaseScore +
        ROUNDS.rewardScorePerRound,
    );
    expect(rounds.currentRound().index).toBe(3);

    runner.dispose();
    game.dispose();
  });
});
