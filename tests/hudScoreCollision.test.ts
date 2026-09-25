import { describe, expect, it } from 'vitest';
import { BOARD, DESIGN, FONT_STACK, HUD_LAYOUT } from '@/config/gameConfig';
import { drawHud, resolveScoreLayout } from '@/render/HudRenderer';
import type { GameSnapshot } from '@/core/Game';

/**
 * Regression tests for the SCORE / NEXT overlap defect seen in the PR #19
 * play screenshot: a 4-digit score at the 40 px display size reached into the
 * NEXT preview ball. The guard shrinks the font as digits grow (4 → start,
 * 8 → floor) and, when that is not enough, slides the whole SCORE block left
 * so a minimum gap to the NEXT ball always survives.
 */

/** Deterministic stand-in for canvas text metrics (wide bold digits, em). */
function modelWidth(text: string, fontSize: number): number {
  let ems = 0;
  for (const glyph of text) {
    ems += glyph === ',' ? 0.3 : 0.62;
  }
  return ems * fontSize;
}

function fontPx(font: string): number {
  const match = /([\d.]+)px/.exec(font);
  if (match === null) {
    throw new Error(`font string without a px size: ${font}`);
  }
  return Number(match[1]);
}

/** Left edge of the NEXT preview ball, board units. */
const NEXT_LEFT_EDGE = BOARD.width / 2 + HUD_LAYOUT.next.offsetX - HUD_LAYOUT.next.previewRadius;
const MIN_GAP = HUD_LAYOUT.score.minGapToNext;

interface TextCall {
  readonly text: string;
  readonly x: number;
  readonly font: string;
}

/** Records the SCORE-relevant calls `drawHud` emits (Node-safe stub). */
function drawScoreHud(score: number): TextCall[] {
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
    measureText: (text: string): { width: number } => ({
      width: modelWidth(text, fontPx(String(stub.font))),
    }),
    fillText: (text: string, x: number): void => {
      calls.push({ text, x, font: String(stub.font) });
    },
  };
  const snapshot: GameSnapshot = {
    state: 'aiming',
    score,
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
  drawHud(stub as unknown as CanvasRenderingContext2D, snapshot, { roundEmphasized: false });
  return calls;
}

function scoreCallOf(calls: readonly TextCall[], text: string): TextCall {
  const call = calls.find((candidate) => candidate.text === text);
  if (call === undefined) {
    throw new Error(`expected a fillText call for "${text}", got: ${calls.map((c) => c.text)}`);
  }
  return call;
}

describe('SCORE / NEXT collision guard', () => {
  const cases = [999, 1000, 12345, 99999999];

  for (const score of cases) {
    it(`keeps at least ${MIN_GAP}px between the SCORE right edge and the NEXT ball at ${score} points`, () => {
      const calls = drawScoreHud(score);
      const call = scoreCallOf(calls, score.toLocaleString('ko-KR'));
      const width = modelWidth(call.text, fontPx(call.font));
      const rightEdge = call.x + width / 2;

      expect(NEXT_LEFT_EDGE - rightEdge).toBeGreaterThanOrEqual(MIN_GAP);
      // The shrink guard stays within its configured bounds.
      expect(fontPx(call.font)).toBeLessThanOrEqual(HUD_LAYOUT.score.maxFontSize);
      expect(fontPx(call.font)).toBeGreaterThanOrEqual(HUD_LAYOUT.score.minFontSize);
      // The slide never pushes the score off the board's left edge.
      expect(call.x - width / 2).toBeGreaterThanOrEqual(0);
    });
  }

  it(`keeps the display size for scores below ${HUD_LAYOUT.score.shrinkThresholdDigits} digits`, () => {
    expect(resolveScoreLayout(999, modelWidth).fontSize).toBe(HUD_LAYOUT.score.maxFontSize);
    const calls = drawScoreHud(999);
    expect(fontPx(scoreCallOf(calls, '999').font)).toBe(HUD_LAYOUT.score.maxFontSize);
  });

  it('starts shrinking at the threshold and interpolates linearly', () => {
    const { shrinkThresholdDigits, maxFontSize, minFontSize } = HUD_LAYOUT.score;
    // At the threshold the font is still at its maximum — shrink begins there.
    expect(resolveScoreLayout(1000, modelWidth).fontSize).toBe(maxFontSize);
    // One digit past the threshold takes one linear step toward the minimum.
    const step =
      (maxFontSize - minFontSize) / (HUD_LAYOUT.score.minFontSizeDigits - shrinkThresholdDigits);
    expect(resolveScoreLayout(10000, modelWidth).fontSize).toBeCloseTo(maxFontSize - step, 10);
    expect(resolveScoreLayout(12345, modelWidth).fontSize).toBeLessThan(
      resolveScoreLayout(1000, modelWidth).fontSize,
    );
  });

  it('pins scores at 8+ digits to the minimum font size', () => {
    expect(resolveScoreLayout(99999999, modelWidth).fontSize).toBe(HUD_LAYOUT.score.minFontSize);
    expect(resolveScoreLayout(123456789, modelWidth).fontSize).toBe(HUD_LAYOUT.score.minFontSize);
    const calls = drawScoreHud(99999999);
    expect(fontPx(scoreCallOf(calls, '99,999,999').font)).toBe(HUD_LAYOUT.score.minFontSize);
  });

  it('draws the score value with the black display weight for every length', () => {
    for (const score of cases) {
      const calls = drawScoreHud(score);
      const call = scoreCallOf(calls, score.toLocaleString('ko-KR'));
      expect(call.font).toBe(`${DESIGN.fontWeight.black} ${fontPx(call.font)}px ${FONT_STACK}`);
    }
  });
});
