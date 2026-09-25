import { describe, expect, it } from 'vitest';
import { composeRoundSnapshot } from '@/app/composeRoundSnapshot';
import { EventBus } from '@/core/events/EventBus';
import { BasicRoundSystem } from '@/systems/BasicRoundSystem';
import { RoundRunner } from '@/systems/RoundRunner';
import type { Game, GameSnapshot } from '@/core/Game';
import type { GameEventMap } from '@/core/events/GameEvents';
import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';

function baseSnapshot(): GameSnapshot {
  return {
    state: 'aiming',
    score: 120,
    best: 400,
    balls: [],
    held: { tier: 1, x: 240, special: null },
    nextTier: 2,
    dangerLineY: 120,
    nearMissIntensity: 0,
    timeScale: 1,
    pendingCards: [],
    seed: 7,
    chainIndex: 0,
    nextSpecial: null,
  };
}

function hudState(): RoundHudState {
  return { index: 3, targetScore: 350, scoreProgress: 120, dropsUsed: 4, dropBudget: 21 };
}

function fakeGame(): Game {
  return {
    events: new EventBus<GameEventMap>(),
    openRewardChoice: (_cards: readonly MergeCard[]): boolean => true,
    applyRewardCard: (_card: MergeCard): boolean => true,
  } as unknown as Game;
}

describe('composeRoundSnapshot', () => {
  it('adds the round HUD state to the rendered snapshot', () => {
    const round = hudState();
    const composed = composeRoundSnapshot(baseSnapshot(), round);

    expect(composed.round).toEqual(round);
    expect(composed.score).toBe(120);
    expect(composed.held?.tier).toBe(1);
  });

  it('returns a new object and leaves the source snapshot untouched', () => {
    const snapshot = baseSnapshot();
    const composed = composeRoundSnapshot(snapshot, hudState());

    expect(composed).not.toBe(snapshot);
    expect('round' in snapshot).toBe(false);
  });

  it('omits the field entirely when the round system has no HUD state', () => {
    const snapshot = baseSnapshot();
    const composed = composeRoundSnapshot(snapshot, null);

    expect('round' in composed).toBe(false);
    expect(composed).toBe(snapshot);
  });

  it('reports the live round through RoundRunner.getHudState()', () => {
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(fakeGame(), rounds, (): MergeCard[] => []);

    const composed = composeRoundSnapshot(baseSnapshot(), runner.getHudState());

    expect(composed.round).toEqual({
      index: 1,
      targetScore: rounds.currentRound().targetScore,
      scoreProgress: 0,
      dropsUsed: 0,
      dropBudget: rounds.currentRound().dropBudget,
    });
    runner.dispose();
  });

  it('lets a HUD-less round system fall back to the plain snapshot', () => {
    const rounds = new BasicRoundSystem();
    const hudless = {
      currentRound: (): ReturnType<BasicRoundSystem['currentRound']> => rounds.currentRound(),
      onDrop: (): void => {
        rounds.onDrop();
      },
      onScoreChanged: (score: number): void => {
        rounds.onScoreChanged(score);
      },
      isRoundCleared: (): boolean => rounds.isRoundCleared(),
      isDropBudgetExhausted: (): boolean => rounds.isDropBudgetExhausted(),
      advance: (): ReturnType<BasicRoundSystem['advance']> => rounds.advance(),
      reset: (): void => {
        rounds.reset();
      },
    };
    const runner = new RoundRunner(fakeGame(), hudless, (): MergeCard[] => []);
    const snapshot = baseSnapshot();

    expect(runner.getHudState()).toBeNull();
    expect(composeRoundSnapshot(snapshot, runner.getHudState())).toBe(snapshot);
    runner.dispose();
  });
});
