import { describe, expect, it } from 'vitest';
import { BOARD, DESIGN, GAME_OVER, TEXT } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { ScoreState } from '@/core/score/ScoreState';
import {
  GameOverPresenter,
  countUpScore,
  drawGameOver,
  restartButtonRect,
} from '@/render/GameOverRenderer';
import { PALETTE } from '@/render/palette';
import { createBonusScoreCard } from '@/systems/cards/BasicMergeCardProvider';
import type { GameSnapshot } from '@/core/Game';

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

function gameOverSnapshot(partial: Partial<GameSnapshot> = {}): GameSnapshot {
  return { ...baseSnapshot(), state: 'game_over', score: 1000, best: 1000, ...partial };
}

interface TextCall {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: string;
  readonly fillStyle: string;
}

interface FillCall {
  readonly fillStyle: string;
  readonly shadowBlur: number;
}

/** Records text and fills so the Node suite can assert the screen layout. */
function createStubContext(): {
  ctx: CanvasRenderingContext2D;
  texts: TextCall[];
  fills: FillCall[];
  scales: Array<{ x: number; y: number }>;
} {
  const texts: TextCall[] = [];
  const fills: FillCall[] = [];
  const scales: Array<{ x: number; y: number }> = [];
  const noop = (): void => {
    return;
  };
  const stub = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    save: noop,
    restore: noop,
    translate: noop,
    scale: (x: number, y: number): void => {
      scales.push({ x, y });
    },
    beginPath: noop,
    moveTo: noop,
    arcTo: noop,
    closePath: noop,
    fill: (): void => {
      fills.push({ fillStyle: String(stub.fillStyle), shadowBlur: stub.shadowBlur });
    },
    stroke: noop,
    fillRect: noop,
    fillText: (text: string, x: number, y: number): void => {
      texts.push({ text, x, y, font: String(stub.font), fillStyle: String(stub.fillStyle) });
    },
  };
  return { ctx: stub as unknown as CanvasRenderingContext2D, texts, fills, scales };
}

describe('score count-up', () => {
  it('eases from 0 to the final score with a decelerating curve', () => {
    expect(countUpScore(1000, 0)).toBe(0);
    expect(countUpScore(1000, 1)).toBe(1000);
    // easeOutCubic(0.5) = 0.875 — ahead of linear, decelerating into rest.
    expect(countUpScore(1000, 0.5)).toBe(875);
    expect(countUpScore(1000, 0.25)).toBeGreaterThan(countUpScore(1000, 0.2));
    expect(countUpScore(0, 0.5)).toBe(0);
    expect(countUpScore(-5, 1)).toBe(0);
  });

  it('runs for GAME_OVER.countUpMs from the moment the screen appears', () => {
    const presenter = new GameOverPresenter();
    presenter.update(baseSnapshot(), 0);
    presenter.update(gameOverSnapshot(), 100);
    expect(presenter.countUpProgress(100)).toBe(0);
    expect(presenter.countUpProgress(100 + GAME_OVER.countUpMs / 2)).toBeCloseTo(0.5, 6);
    expect(presenter.countUpProgress(100 + GAME_OVER.countUpMs)).toBe(1);
    expect(presenter.countUpProgress(10_000)).toBe(1);
  });

  it('draws 0 on the first frame and the final score once the count-up lands', () => {
    const presenter = new GameOverPresenter();
    presenter.update(baseSnapshot(), 0);

    presenter.update(gameOverSnapshot(), 100);
    const start = createStubContext();
    drawGameOver(start.ctx, gameOverSnapshot(), presenter);
    expect(start.texts.map((call) => call.text)).toContain('0');

    presenter.update(gameOverSnapshot(), 100 + GAME_OVER.countUpMs);
    const end = createStubContext();
    drawGameOver(end.ctx, gameOverSnapshot(), presenter);
    const texts = end.texts.map((call) => call.text);
    expect(texts).toContain((1000).toLocaleString('ko-KR'));
    expect(texts).not.toContain('0');
    // The score is the biggest type on the screen.
    const score = end.texts.find((call) => call.text === '1,000');
    expect(score?.font).toContain(`${GAME_OVER.scoreFontSize}px`);
    expect(GAME_OVER.scoreFontSize).toBeGreaterThan(DESIGN.fontSize.display);
  });

  it('restarts the count-up when a new run ends again', () => {
    const presenter = new GameOverPresenter();
    presenter.update(gameOverSnapshot(), 0);
    presenter.update(gameOverSnapshot(), GAME_OVER.countUpMs);
    expect(presenter.countUpProgress(GAME_OVER.countUpMs)).toBe(1);
    presenter.update(baseSnapshot(), 1000); // restart → aiming
    presenter.update(gameOverSnapshot({ score: 500 }), 1500);
    expect(presenter.countUpProgress(1500)).toBe(0);
    expect(countUpScore(500, presenter.countUpProgress(1500))).toBe(0);
  });
});

describe('NEW BEST badge', () => {
  it('shows the badge only when the run set a record', () => {
    const plain = createStubContext();
    drawGameOver(plain.ctx, gameOverSnapshot(), new GameOverPresenter());
    expect(plain.texts.map((call) => call.text)).not.toContain(TEXT.newBestBadge);

    const record = createStubContext();
    drawGameOver(record.ctx, gameOverSnapshot({ isNewBest: true }), new GameOverPresenter());
    const badge = record.texts.find((call) => call.text === TEXT.newBestBadge);
    expect(badge).toBeDefined();
    expect(badge?.fillStyle).toBe(PALETTE.card.badgeText);
    // The pill behind it is the warning accent.
    expect(record.fills.some((fill) => fill.fillStyle === PALETTE.accent.warning)).toBe(true);
  });

  it('heartbeats the badge between 1 and badgeScaleMax', () => {
    const presenter = new GameOverPresenter();
    presenter.update(baseSnapshot(), 0);
    presenter.update(gameOverSnapshot({ isNewBest: true }), 0);
    const period = GAME_OVER.newBest.pulsePeriodMs;
    expect(presenter.badgePulse(0, true)).toBeCloseTo(0, 6);
    expect(presenter.badgePulse(period / 2, true)).toBeCloseTo(1, 6);
    expect(presenter.badgePulse(period, true)).toBeCloseTo(0, 6);
    expect(presenter.badgePulse(period / 2, false)).toBe(0);

    const { ctx, scales } = createStubContext();
    presenter.update(gameOverSnapshot({ isNewBest: true }), period / 2);
    drawGameOver(ctx, gameOverSnapshot({ isNewBest: true }), presenter);
    const beat = scales.find((scale) => scale.x > 1);
    expect(beat?.x).toBeCloseTo(GAME_OVER.newBest.badgeScaleMax, 6);
    expect(beat?.y).toBeCloseTo(GAME_OVER.newBest.badgeScaleMax, 6);
  });

  it('pulses the chromatic aberration a bounded number of times, one period apart', () => {
    const presenter = new GameOverPresenter();
    presenter.update(baseSnapshot(), 0);
    presenter.update(gameOverSnapshot({ isNewBest: true }), 100);
    const period = GAME_OVER.newBest.pulsePeriodMs;
    // First pulse lands the instant the screen appears.
    expect(presenter.consumeAberrationPulse(100, true)).toBe(true);
    expect(presenter.consumeAberrationPulse(100 + period - 1, true)).toBe(false);
    for (let i = 1; i < GAME_OVER.newBest.pulseCount; i += 1) {
      expect(presenter.consumeAberrationPulse(100 + period * i, true)).toBe(true);
    }
    // The celebration ends.
    expect(presenter.consumeAberrationPulse(100 + period * 99, true)).toBe(false);
    // No pulses without a record.
    expect(presenter.consumeAberrationPulse(100, false)).toBe(false);
  });
});

describe('game-over layout', () => {
  it('states the round reached only when the run carried a round structure', () => {
    const without = createStubContext();
    drawGameOver(without.ctx, gameOverSnapshot(), new GameOverPresenter());
    expect(without.texts.some((call) => call.text.includes('도달'))).toBe(false);

    const withRound = createStubContext();
    const snapshot = gameOverSnapshot({
      round: { index: 4, targetScore: 450, scoreProgress: 90, dropsUsed: 2, dropBudget: 24 },
    });
    drawGameOver(withRound.ctx, snapshot, new GameOverPresenter());
    expect(withRound.texts.map((call) => call.text)).toContain(TEXT.roundReached(4));
  });

  it('anchors an accent restart button at the bottom and keeps the R-key hint', () => {
    const rect = restartButtonRect();
    expect(rect.x + rect.width / 2).toBe(BOARD.width / 2);
    expect(rect.y).toBeGreaterThan(BOARD.height / 2);
    expect(rect.y + rect.height).toBeLessThan(BOARD.height);

    const { ctx, texts, fills } = createStubContext();
    drawGameOver(ctx, gameOverSnapshot(), new GameOverPresenter());
    expect(fills.some((fill) => fill.fillStyle === PALETTE.accent.primary)).toBe(true);
    const labels = texts.map((call) => call.text);
    expect(labels).toContain(TEXT.restartButton);
    expect(labels).toContain(TEXT.restartHint);
    expect(labels).toContain(TEXT.runOverTitle);
    expect(labels).toContain(TEXT.bestSummary('1,000'));
  });
});

describe('ScoreState new-best tracking', () => {
  it('flags a record only while the run score beats the run-start best', () => {
    const state = new ScoreState(100);
    expect(state.isNewBest).toBe(false);
    state.add(50);
    expect(state.isNewBest).toBe(false);
    state.add(60); // 110 > 100
    expect(state.isNewBest).toBe(true);
    state.resetRun();
    expect(state.isNewBest).toBe(false);
    expect(state.best).toBe(110);
    state.add(105);
    expect(state.isNewBest).toBe(false); // ties the new baseline, no record
    state.add(10);
    expect(state.isNewBest).toBe(true);
  });

  it('keeps the baseline through a mid-run score reset (risk-card loss)', () => {
    const state = new ScoreState(100);
    state.add(150);
    expect(state.isNewBest).toBe(true);
    state.resetScore();
    expect(state.isNewBest).toBe(false);
    state.add(120);
    expect(state.isNewBest).toBe(true); // still above the run-start 100
  });

  it('surfaces isNewBest on the game snapshot while the record stands', () => {
    const game = new Game({ specialSpawnChance: 0, initialBest: 100 });
    game.start(7);
    expect(game.getSnapshot().isNewBest).toBeUndefined();
    expect(game.applyRewardCard(createBonusScoreCard(150))).toBe(true);
    expect(game.getSnapshot().isNewBest).toBe(true);
    game.dispose();

    const comfortable = new Game({ specialSpawnChance: 0, initialBest: 5000 });
    comfortable.start(7);
    expect(comfortable.applyRewardCard(createBonusScoreCard(150))).toBe(true);
    expect(comfortable.getSnapshot().isNewBest).toBeUndefined();
    comfortable.dispose();
  });
});
