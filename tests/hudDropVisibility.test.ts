import { describe, expect, it } from 'vitest';
import { HUD_LAYOUT, TEXT } from '@/config/gameConfig';
import { drawHud } from '@/render/HudRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { HudProgression } from '@/render/HudRenderer';

/**
 * Regression tests for the drops-left visibility defect seen in the PR #19
 * play screenshot: "13개 남음" was on screen because the round-start emphasis
 * window drew the drops count unconditionally. The rule now is absolute —
 * the drops text exists only while `dropBudget - dropsUsed <= 5`, in every
 * phase; above 5 it is not drawn at all (not even dimmed).
 */

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

interface TextCall {
  readonly text: string;
  readonly fillStyle: string;
}

/** Records every fillText `drawHud` emits for the given remaining-drops case. */
function drawRoundHud(dropsLeft: number, progression: HudProgression): TextCall[] {
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
    fillText: (text: string): void => {
      calls.push({ text, fillStyle: String(stub.fillStyle) });
    },
  };
  const snapshot: GameSnapshot = {
    ...baseSnapshot(),
    round: {
      index: 1,
      targetScore: 150,
      scoreProgress: 30,
      dropsUsed: 15 - dropsLeft,
      dropBudget: 15,
    },
  };
  drawHud(stub as unknown as CanvasRenderingContext2D, snapshot, progression);
  return calls;
}

function dropsLines(calls: readonly TextCall[]): TextCall[] {
  return calls.filter((call) => call.text.endsWith('개 남음'));
}

const EMPHASIZED: HudProgression = { roundEmphasized: true };
const QUIET: HudProgression = { roundEmphasized: false };
const THRESHOLD = HUD_LAYOUT.round.lowDropsThreshold;

describe('drops-left visibility (≤ 5 only, in every phase)', () => {
  const hiddenCases = [13, 6];
  const shownCases = [5, 4, 0];

  for (const dropsLeft of hiddenCases) {
    it(`draws no drops text at all with ${dropsLeft} left, even inside the emphasis window`, () => {
      for (const [name, progression] of [
        ['emphasized', EMPHASIZED],
        ['quiet', QUIET],
      ] as const) {
        const calls = drawRoundHud(dropsLeft, progression);
        expect(dropsLines(calls), `${name} phase`).toEqual([]);
      }
    });
  }

  for (const dropsLeft of shownCases) {
    it(`draws the drops warning exactly once with ${dropsLeft} left, in both phases`, () => {
      for (const [name, progression] of [
        ['emphasized', EMPHASIZED],
        ['quiet', QUIET],
      ] as const) {
        const calls = drawRoundHud(dropsLeft, progression);
        const lines = dropsLines(calls);
        expect(lines, `${name} phase`).toHaveLength(1);
        expect(lines[0]?.text).toBe(TEXT.dropsRemaining(dropsLeft));
        expect(lines[0]?.fillStyle).toBe(PALETTE.accent.warning);
      }
    });
  }

  it(`uses exactly the configured threshold of ${THRESHOLD}`, () => {
    expect(dropsLines(drawRoundHud(THRESHOLD + 1, QUIET))).toEqual([]);
    expect(dropsLines(drawRoundHud(THRESHOLD, QUIET))).toHaveLength(1);
  });

  it('never reuses the old combined "라운드 N · M개 남음" readout', () => {
    for (const dropsLeft of [13, 6, 5, 4, 0]) {
      for (const progression of [EMPHASIZED, QUIET]) {
        const calls = drawRoundHud(dropsLeft, progression);
        expect(calls.some((call) => call.text.includes('·'))).toBe(false);
      }
    }
  });
});
