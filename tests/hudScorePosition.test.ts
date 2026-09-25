import { describe, expect, it } from 'vitest';
import { BOARD, DESIGN, FONT_STACK, HUD_LAYOUT, TEXT } from '@/config/gameConfig';
import { drawHud } from '@/render/HudRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';

/**
 * Regression tests for the misplaced SCORE seen in the PR #19 play
 * screenshot: the score hugged the top-left corner with BEST/round/progress
 * stacked under it. The hierarchy is now enforced — SCORE centred on the
 * board's axis, secondary info split to the corners, SLOW badge under SCORE.
 */

interface TextCall {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: string;
  readonly align: string;
  readonly fillStyle: string;
}

function roundOf(partial: Partial<RoundHudState>): RoundHudState {
  return {
    index: 1,
    targetScore: 150,
    scoreProgress: 40,
    dropsUsed: 0,
    dropBudget: 15,
    ...partial,
  };
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

function drawPositionHud(snapshot: GameSnapshot): TextCall[] {
  const calls: TextCall[] = [];
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
    scale: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillText: (text: string, x: number, y: number): void => {
      calls.push({
        text,
        x,
        y,
        font: String(stub.font),
        align: String(stub.textAlign),
        fillStyle: String(stub.fillStyle),
      });
    },
  };
  drawHud(stub as unknown as CanvasRenderingContext2D, snapshot, { roundEmphasized: false });
  return calls;
}

function callFor(calls: readonly TextCall[], text: string): TextCall {
  const call = calls.find((candidate) => candidate.text === text);
  if (call === undefined) {
    throw new Error(`expected a fillText call for "${text}", got: ${calls.map((c) => c.text)}`);
  }
  return call;
}

const BOARD_CENTRE_X = BOARD.width / 2;

describe('SCORE position and top-strip distribution', () => {
  it(`centres the SCORE value on the board axis (${BOARD_CENTRE_X}) within 5px`, () => {
    const calls = drawPositionHud({ ...baseSnapshot(), score: 42 });
    const score = callFor(calls, '42');
    expect(score.align).toBe(HUD_LAYOUT.score.align);
    expect(Math.abs(score.x - BOARD_CENTRE_X)).toBeLessThanOrEqual(5);
    expect(score.fillStyle).toBe(PALETTE.text.primary);
  });

  it('also centres the "점수" label and a zero score on the same axis', () => {
    const calls = drawPositionHud(baseSnapshot());
    expect(Math.abs(callFor(calls, TEXT.scoreLabel).x - BOARD_CENTRE_X)).toBeLessThanOrEqual(5);
    expect(Math.abs(callFor(calls, '0').x - BOARD_CENTRE_X)).toBeLessThanOrEqual(5);
  });

  it('anchors the score from HUD_LAYOUT.score.anchorX (240), centre-aligned', () => {
    expect(HUD_LAYOUT.score.anchorX).toBe(240);
    expect(HUD_LAYOUT.score.align).toBe('center');
  });

  it('keeps the caption-scale secondary info in the corners, not under SCORE', () => {
    const calls = drawPositionHud({
      ...baseSnapshot(),
      best: 900,
      round: roundOf({}),
    });
    // BEST block: top-left corner gutter.
    const bestLabel = callFor(calls, TEXT.bestLabel);
    const bestValue = callFor(calls, '900');
    expect(bestLabel.x).toBe(HUD_LAYOUT.margin);
    expect(bestValue.x).toBe(HUD_LAYOUT.margin);
    expect(bestValue.font).toContain(`${DESIGN.fontSize.caption}px`);

    // Round readout and target progress: left column as well.
    const round = callFor(calls, TEXT.roundIndexLabel(1));
    const progress = callFor(calls, TEXT.scoreProgress(40, 150));
    expect(round.x).toBe(HUD_LAYOUT.margin);
    expect(progress.x).toBe(HUD_LAYOUT.margin);

    // NEXT group: right of the board axis, above the danger line.
    const next = callFor(calls, TEXT.nextLabel);
    expect(next.x).toBeGreaterThan(BOARD_CENTRE_X);
    expect(next.y).toBeLessThan(120);
  });

  it('centres the SLOW badge under the score while time is slowed', () => {
    const calls = drawPositionHud({ ...baseSnapshot(), timeScale: 0.25 });
    const badge = callFor(calls, TEXT.slowMotionBadgeDynamic('0.25'));
    expect(Math.abs(badge.x - BOARD_CENTRE_X)).toBeLessThanOrEqual(5);
    expect(badge.y).toBe(HUD_LAYOUT.slowBadge.y);
    expect(badge.y).toBeGreaterThan(HUD_LAYOUT.score.valueY);
  });

  it('draws the score value in the display size with the black weight', () => {
    const calls = drawPositionHud({ ...baseSnapshot(), score: 7 });
    const score = callFor(calls, '7');
    expect(score.font).toBe(
      `${DESIGN.fontWeight.black} ${DESIGN.fontSize.display}px ${FONT_STACK}`,
    );
  });
});
