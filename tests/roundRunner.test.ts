import { describe, expect, it } from 'vitest';
import { ROUNDS } from '@/config/gameConfig';
import { EventBus } from '@/core/events/EventBus';
import { Game } from '@/core/Game';
import { BasicRoundSystem } from '@/systems/BasicRoundSystem';
import { RoundRunner } from '@/systems/RoundRunner';
import {
  ROUND_CLEAR_CARD_ID,
  createRoundClearChoice,
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
    shiftDangerLine: (): void => {
      return;
    },
  };
  return { context, deltas };
}

/** A Game stand-in exposing just the surface RoundRunner touches. */
function createFakeGame(canChoose = true): {
  game: Game;
  events: EventBus<GameEventMap>;
  opened: MergeCard[][];
  applied: MergeCard[];
} {
  const events = new EventBus<GameEventMap>();
  const opened: MergeCard[][] = [];
  const applied: MergeCard[] = [];
  const game = {
    events,
    openRewardChoice: (cards: readonly MergeCard[]): boolean => {
      opened.push([...cards]);
      return canChoose;
    },
    applyRewardCard: (card: MergeCard): boolean => {
      applied.push(card);
      return true;
    },
  } as unknown as Game;
  return { game, events, opened, applied };
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

describe('createRoundClearChoice', () => {
  it('offers three distinct reward cards headed by the flat round bonus', () => {
    const hand = createRoundClearChoice(2);
    expect(hand).toHaveLength(3);
    expect(hand.every((card) => card.kind === 'reward')).toBe(true);
    expect(new Set(hand.map((card) => card.id)).size).toBe(3);
    expect(hand[0]?.id).toBe(ROUND_CLEAR_CARD_ID);

    const { context, deltas } = fakeContext();
    hand[0]?.apply(context);
    expect(deltas).toEqual([ROUNDS.rewardBaseScore + ROUNDS.rewardScorePerRound]);
  });
});

describe('RoundRunner', () => {
  it('opens a 3-card choice and advances when the target is met', () => {
    const { game, events, opened, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const granted: RoundDefinition[] = [];
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] => {
      granted.push(round);
      return createRoundClearChoice(round.index);
    });

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });

    expect(granted.map((round) => round.index)).toEqual([1]);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toHaveLength(3);
    expect(opened[0]?.[0]?.id).toBe(ROUND_CLEAR_CARD_ID);
    expect(applied).toHaveLength(0);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('falls back to the head card when the board is too busy for a choice', () => {
    const { game, events, opened, applied } = createFakeGame(false);
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] =>
      createRoundClearChoice(round.index),
    );

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });

    expect(opened).toHaveLength(1);
    expect(applied).toHaveLength(1);
    expect(applied[0]?.id).toBe(ROUND_CLEAR_CARD_ID);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('advances without a reward when the drop budget runs out first', () => {
    const { game, events, opened, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] =>
      createRoundClearChoice(round.index),
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

    expect(opened).toHaveLength(0);
    expect(applied).toHaveLength(0);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('waits while a choice is open, then grants once it closes', () => {
    const { game, events, opened } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] =>
      createRoundClearChoice(round.index),
    );

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });
    expect(opened).toHaveLength(1);
    expect(rounds.currentRound().index).toBe(2);

    // Round 2 clears while its choice is still on screen: no second grant yet.
    const roundTwoClear = ROUNDS.firstTargetScore + ROUNDS.firstTargetScore + ROUNDS.targetScoreStep;
    events.emit('score:changed', { score: roundTwoClear, best: roundTwoClear, delta: 0 });
    expect(opened).toHaveLength(1);
    expect(rounds.currentRound().index).toBe(2);

    events.emit('time:slowMotionEnd', {});
    expect(opened).toHaveLength(2);
    expect(rounds.currentRound().index).toBe(3);
    runner.dispose();
  });

  it('advances without a reward when the provider offers an empty hand', () => {
    const { game, events, opened, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (): MergeCard[] => []);

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });

    expect(opened).toHaveLength(0);
    expect(applied).toHaveLength(0);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('restarts at round 1 whenever a new run begins', () => {
    const { game, events, opened } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] =>
      createRoundClearChoice(round.index),
    );

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });
    events.emit('run:started', { seed: 99 });

    expect(rounds.currentRound().index).toBe(1);
    expect(rounds.isRoundCleared()).toBe(false);
    // The stale open choice no longer blocks the fresh run.
    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });
    expect(opened).toHaveLength(2);
    expect(rounds.currentRound().index).toBe(2);
    runner.dispose();
  });

  it('stops listening after dispose', () => {
    const { game, events, opened, applied } = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] =>
      createRoundClearChoice(round.index),
    );
    runner.dispose();

    events.emit('score:changed', { score: ROUNDS.firstTargetScore, best: 0, delta: 0 });
    events.emit('time:slowMotionEnd', {});

    expect(opened).toHaveLength(0);
    expect(applied).toHaveLength(0);
    expect(rounds.currentRound().index).toBe(1);
  });

  it('runs the full clear loop on a real Game through the card choice', () => {
    const game = new Game();
    const rounds = new BasicRoundSystem();
    const granted: number[] = [];
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] => {
      granted.push(round.index);
      return createRoundClearChoice(round.index);
    });
    game.start(7);

    game.applyRewardCard(pointsCard(ROUNDS.firstTargetScore));
    // Round 1 clears into the card choice instead of an instant bonus.
    expect(granted).toEqual([1]);
    expect(game.state).toBe('slowmo_select');
    expect(game.getSnapshot().pendingCards).toHaveLength(3);
    expect(rounds.currentRound().index).toBe(2);

    const head = game.getSnapshot().pendingCards[0];
    expect(head?.id).toBe(ROUND_CLEAR_CARD_ID);
    expect(head !== undefined && game.chooseCard(head)).toBe(true);
    // The picked bonus lands as income of round 2.
    expect(game.score).toBe(ROUNDS.firstTargetScore + ROUNDS.rewardBaseScore);
    expect(game.state).toBe('aiming');

    const roundTwoTarget = ROUNDS.firstTargetScore + ROUNDS.targetScoreStep;
    // Round 2 already banks the +50 picked for round 1, so it needs 200 more.
    game.applyRewardCard(pointsCard(roundTwoTarget - ROUNDS.rewardBaseScore - 1));
    expect(granted).toEqual([1]);
    game.applyRewardCard(pointsCard(1));
    expect(granted).toEqual([1, 2]);
    expect(game.state).toBe('slowmo_select');
    const secondHead = game.getSnapshot().pendingCards[0];
    expect(secondHead !== undefined && game.chooseCard(secondHead)).toBe(true);
    expect(game.score).toBe(
      ROUNDS.firstTargetScore +
        ROUNDS.rewardBaseScore +
        (roundTwoTarget - ROUNDS.rewardBaseScore) +
        ROUNDS.rewardBaseScore +
        ROUNDS.rewardScorePerRound,
    );
    expect(rounds.currentRound().index).toBe(3);

    runner.dispose();
    game.dispose();
  });
});
