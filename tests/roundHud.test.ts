import { describe, expect, it } from 'vitest';
import { ROUNDS, TEXT } from '@/config/gameConfig';
import type { Game } from '@/core/Game';
import { EventBus } from '@/core/events/EventBus';
import { drawHud } from '@/render/HudRenderer';
import { BasicRoundSystem } from '@/systems/BasicRoundSystem';
import { RoundRunner } from '@/systems/RoundRunner';
import { createRoundClearChoice } from '@/systems/cards/RoundClearRewardCard';
import type { GameSnapshot } from '@/core/Game';
import type { GameEventMap } from '@/core/events/GameEvents';
import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { IRoundSystem, RoundDefinition } from '@/core/interfaces/IRoundSystem';

/** `IRoundSystem` without the optional HUD field (pre-Task-2.12 providers). */
function createHudlessRounds(): IRoundSystem {
  const inner = new BasicRoundSystem();
  return {
    currentRound: (): RoundDefinition => inner.currentRound(),
    onDrop: (): void => {
      inner.onDrop();
    },
    onScoreChanged: (score: number): void => {
      inner.onScoreChanged(score);
    },
    isRoundCleared: (): boolean => inner.isRoundCleared(),
    isDropBudgetExhausted: (): boolean => inner.isDropBudgetExhausted(),
    advance: (): RoundDefinition => inner.advance(),
    reset: (): void => {
      inner.reset();
    },
  };
}

function createFakeGame(): Game {
  const game = {
    events: new EventBus<GameEventMap>(),
    openRewardChoice: (_cards: readonly MergeCard[]): boolean => true,
    applyRewardCard: (_card: MergeCard): boolean => true,
  } as unknown as Game;
  return game;
}

function baseSnapshot(): GameSnapshot {
  return {
    state: 'aiming',
    score: 0,
    best: 0,
    balls: [],
    held: null,
    nextTier: 0,
    dangerLineY: 120,
    nearMissIntensity: 0,
    timeScale: 1,
    pendingCards: [],
    seed: 1,
    chainIndex: 0,
    nextSpecial: null,
  };
}

/** Records the text `drawHud` emits so the Node suite can assert on it. */
function createStubContext(): { ctx: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = [];
  const noop = (): void => {
    return;
  };
  const stub = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: '',
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillText: (text: string): void => {
      texts.push(text);
    },
  };
  return { ctx: stub as unknown as CanvasRenderingContext2D, texts };
}

describe('BasicRoundSystem.getHudState', () => {
  it('starts at round 1 with zero progress and a full drop budget', () => {
    const rounds = new BasicRoundSystem();
    expect(rounds.getHudState()).toEqual({
      index: 1,
      targetScore: ROUNDS.firstTargetScore,
      scoreProgress: 0,
      dropsUsed: 0,
      dropBudget: ROUNDS.firstDropBudget,
    });
  });

  it('tracks score progress and spent drops inside the current round', () => {
    const rounds = new BasicRoundSystem();
    rounds.onScoreChanged(120);
    rounds.onDrop();
    rounds.onDrop();
    expect(rounds.getHudState()).toEqual({
      index: 1,
      targetScore: ROUNDS.firstTargetScore,
      scoreProgress: 120,
      dropsUsed: 2,
      dropBudget: ROUNDS.firstDropBudget,
    });
  });

  it('rescopes progress and drops when the round advances', () => {
    const rounds = new BasicRoundSystem();
    rounds.onScoreChanged(ROUNDS.firstTargetScore);
    rounds.advance();
    rounds.onScoreChanged(ROUNDS.firstTargetScore + 30);
    rounds.onDrop();
    expect(rounds.getHudState()).toEqual({
      index: 2,
      targetScore: ROUNDS.firstTargetScore + ROUNDS.targetScoreStep,
      scoreProgress: 30,
      dropsUsed: 1,
      dropBudget: ROUNDS.firstDropBudget + ROUNDS.dropBudgetStep,
    });
  });

  it('clamps progress at zero when a score loss drops below the round start', () => {
    const rounds = new BasicRoundSystem();
    rounds.onScoreChanged(ROUNDS.firstTargetScore);
    rounds.advance();
    rounds.onScoreChanged(ROUNDS.firstTargetScore - 40);
    expect(rounds.getHudState().scoreProgress).toBe(0);
  });
});

describe('RoundRunner.getHudState', () => {
  it('exposes the live round state while the run progresses', () => {
    const game = createFakeGame();
    const rounds = new BasicRoundSystem();
    const runner = new RoundRunner(game, rounds, (round): MergeCard[] =>
      createRoundClearChoice(round.index),
    );

    game.events.emit('score:changed', { score: 120, best: 120, delta: 120 });
    expect(runner.getHudState()).toEqual({
      index: 1,
      targetScore: ROUNDS.firstTargetScore,
      scoreProgress: 120,
      dropsUsed: 0,
      dropBudget: ROUNDS.firstDropBudget,
    });

    game.events.emit('score:changed', {
      score: ROUNDS.firstTargetScore,
      best: ROUNDS.firstTargetScore,
      delta: 30,
    });
    expect(runner.getHudState()?.index).toBe(2);
    runner.dispose();
  });

  it('returns null when the round system predates the HUD field', () => {
    const game = createFakeGame();
    const runner = new RoundRunner(game, createHudlessRounds(), (round): MergeCard[] =>
      createRoundClearChoice(round.index),
    );
    expect(runner.getHudState()).toBeNull();
    runner.dispose();
  });
});

describe('round HUD drawing', () => {
  it('shows the round number, target progress and drops left', () => {
    const { ctx, texts } = createStubContext();
    drawHud(ctx, {
      ...baseSnapshot(),
      round: {
        index: 2,
        targetScore: 250,
        scoreProgress: 120,
        dropsUsed: 3,
        dropBudget: 18,
      },
    });
    expect(texts).toContain(TEXT.roundStatus(2, 15));
    expect(texts).toContain(TEXT.scoreProgress(120, 250));
  });

  it('clamps the drops-left readout at zero past the budget', () => {
    const { ctx, texts } = createStubContext();
    drawHud(ctx, {
      ...baseSnapshot(),
      round: {
        index: 1,
        targetScore: ROUNDS.firstTargetScore,
        scoreProgress: 0,
        dropsUsed: ROUNDS.firstDropBudget + 4,
        dropBudget: ROUNDS.firstDropBudget,
      },
    });
    expect(texts).toContain(TEXT.roundStatus(1, 0));
  });

  it('draws no round readout when the snapshot carries no round state', () => {
    const { ctx, texts } = createStubContext();
    drawHud(ctx, baseSnapshot());
    expect(texts.some((text) => text.startsWith('라운드'))).toBe(false);
    // The pre-existing score HUD still draws — now Korean.
    expect(texts).toContain(TEXT.scoreLabel);
    expect(texts).toContain(TEXT.bestLabel);
  });
});
