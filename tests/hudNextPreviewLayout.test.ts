import { describe, expect, it } from 'vitest';
import { BOARD, DESIGN, HUD_LAYOUT, SPAWN_Y, TEXT } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { drawHud } from '@/render/HudRenderer';
import type { GameSnapshot } from '@/core/Game';

/**
 * Regression tests for the detached NEXT label seen in the PR #19 play
 * screenshot: the "다음" caption sat in the top-right corner while the NEXT
 * preview ball floated beside the spawn point. The label and the ball are now
 * one group — the ball beside the spawn point, the label pinned right under
 * it — and the label is drawn exactly once.
 */

interface TextCall {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly align: string;
}

interface Stub {
  readonly calls: TextCall[];
  readonly translates: Array<{ x: number; y: number }>;
  readonly arcs: Array<{ x: number; y: number; radius: number }>;
}

function drawNextHud(nextTier: number): Stub {
  const calls: TextCall[] = [];
  const translates: Array<{ x: number; y: number }> = [];
  const arcs: Array<{ x: number; y: number; radius: number }> = [];
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
    translate: (x: number, y: number): void => {
      translates.push({ x, y });
    },
    scale: noop,
    beginPath: noop,
    arc: (x: number, y: number, radius: number): void => {
      arcs.push({ x, y, radius });
    },
    fill: noop,
    stroke: noop,
    fillText: (text: string, x: number, y: number): void => {
      calls.push({ text, x, y, align: String(stub.textAlign) });
    },
  };
  const snapshot: GameSnapshot = {
    state: 'aiming',
    score: 42,
    best: 0,
    balls: [],
    held: null,
    nextTier,
    dangerLineY: 120,
    nearMissIntensity: 0,
    timeScale: 1,
    pendingCards: [],
    seed: 1,
    chainIndex: 0,
    nextSpecial: null,
  };
  drawHud(stub as unknown as CanvasRenderingContext2D, snapshot, { roundEmphasized: false });
  return { calls, translates, arcs };
}

function labelCallsOf(stub: Stub): TextCall[] {
  return stub.calls.filter((call) => call.text === TEXT.nextLabel);
}

/** The preview ball's centre in board coordinates. */
function ballCentre(stub: Stub): { x: number; y: number } {
  const expected = {
    x: BOARD.width / 2 + HUD_LAYOUT.next.offsetX,
    y: HUD_LAYOUT.next.previewY,
  };
  const slot = stub.translates.find((t) => t.x === expected.x && t.y === expected.y);
  if (slot === undefined) {
    throw new Error(`NEXT preview was not drawn at its diegetic slot ${JSON.stringify(expected)}`);
  }
  // The ball shape itself is stamped at the translated origin.
  expect(stub.arcs).toContainEqual({ x: 0, y: 0, radius: expect.any(Number) });
  return slot;
}

describe('NEXT label + preview ball group', () => {
  const tiers = [0, 2, 4];

  for (const nextTier of tiers) {
    it(`keeps the label within 30px of the ball centre and within 8px of its edge (tier ${nextTier})`, () => {
      const stub = drawNextHud(nextTier);
      const labels = labelCallsOf(stub);
      expect(labels).toHaveLength(1);

      const ball = ballCentre(stub);
      const label = labels[0] as TextCall;
      // The label hangs centred under the ball.
      expect(label.align).toBe('center');
      expect(label.x).toBe(ball.x);

      // Centre-to-centre distance (label centre sits half a caption down).
      const labelCentreY = label.y + DESIGN.fontSize.caption / 2;
      const centreDistance = Math.hypot(label.x - ball.x, labelCentreY - ball.y);
      expect(centreDistance).toBeLessThanOrEqual(30);

      // The label hugs the ball's underside: ≤ 8px from the drawn edge.
      // Preview scale caps the drawn radius at `previewRadius`.
      const drawnRadius = Math.min(HUD_LAYOUT.next.previewRadius, getTierSpec(nextTier).radius);
      const edgeGap = label.y - (ball.y + drawnRadius);
      expect(edgeGap).toBeGreaterThanOrEqual(0);
      expect(edgeGap).toBeLessThanOrEqual(8);
    });
  }

  it('places the ball beside the real spawn point (296, 60) with the label near (296, 82)', () => {
    const stub = drawNextHud(0);
    const ball = ballCentre(stub);
    expect(ball).toEqual({ x: 240 + HUD_LAYOUT.next.offsetX, y: SPAWN_Y });
    expect(ball).toEqual({ x: 296, y: 60 });

    const label = labelCallsOf(stub)[0];
    expect(label?.x).toBe(296);
    expect(Math.abs((label?.y ?? Number.NaN) - 82)).toBeLessThanOrEqual(2);
    // The whole group stays above the danger line.
    expect(label?.y).toBeLessThan(120);
  });

  it('draws the NEXT label exactly once on the whole screen', () => {
    const stub = drawNextHud(3);
    expect(labelCallsOf(stub)).toHaveLength(1);
    // No other text repeats the label anywhere else on the canvas.
    const allTexts = stub.calls.map((call) => call.text);
    expect(allTexts.filter((text) => text.includes(TEXT.nextLabel))).toHaveLength(1);
  });

  it('derives the label offset from the ball geometry in the config', () => {
    expect(HUD_LAYOUT.next.labelOffsetY).toBe(
      HUD_LAYOUT.next.previewRadius + HUD_LAYOUT.next.labelGap,
    );
  });
});
