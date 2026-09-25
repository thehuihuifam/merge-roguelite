import { describe, expect, it } from 'vitest';
import { BOARD, HUD_LAYOUT, SPAWN_Y, TEXT, WARNING_ZONE_HEIGHT } from '@/config/gameConfig';
import {
  RoundGaugeAnimator,
  dangerTintAlpha,
  drawDangerTint,
  drawRoundProgressGauge,
  roundProgressOf,
} from '@/render/DiegeticBoardRenderer';
import { drawHud } from '@/render/HudRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';

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

function roundOf(partial: Partial<RoundHudState>): RoundHudState {
  return {
    index: 1,
    targetScore: 150,
    scoreProgress: 0,
    dropsUsed: 0,
    dropBudget: 15,
    ...partial,
  };
}

interface RectCall {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fillStyle: string;
  readonly shadowBlur: number;
}

/** Records fillRect calls (gauge + tint) so the Node suite can assert layout. */
function createRectStub(): { ctx: CanvasRenderingContext2D; rects: RectCall[] } {
  const rects: RectCall[] = [];
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
    fillRect: (x: number, y: number, width: number, height: number): void => {
      rects.push({
        x,
        y,
        width,
        height,
        fillStyle: String(stub.fillStyle),
        shadowBlur: stub.shadowBlur,
      });
    },
    fillText: noop,
  };
  return { ctx: stub as unknown as CanvasRenderingContext2D, rects };
}

describe('round progress (diegetic gauge)', () => {
  it('maps the round score progress to 0..1 and guards degenerate rounds', () => {
    expect(roundProgressOf(baseSnapshot())).toBe(0);
    expect(roundProgressOf({ ...baseSnapshot(), round: roundOf({ scoreProgress: 75 }) })).toBe(0.5);
    expect(roundProgressOf({ ...baseSnapshot(), round: roundOf({ scoreProgress: 400 }) })).toBe(1);
    expect(
      roundProgressOf({ ...baseSnapshot(), round: roundOf({ targetScore: 0, scoreProgress: 5 }) }),
    ).toBe(0);
  });

  it('fills a 4px strip of the bottom frame proportional to the progress', () => {
    const { ctx, rects } = createRectStub();
    drawRoundProgressGauge(ctx, 0.5, 0);

    const { thickness } = HUD_LAYOUT.roundGauge;
    const y = BOARD.height - thickness;
    expect(rects).toHaveLength(2);
    // Track: the full frame width, panel colour.
    const track = rects[0];
    expect(track).toEqual({
      x: 0,
      y,
      width: BOARD.width,
      height: thickness,
      fillStyle: PALETTE.bg.panel,
      shadowBlur: 0,
    });
    // Fill: exactly half the board, accent colour, no glow while incomplete.
    const fill = rects[1];
    if (fill === undefined) {
      throw new Error('gauge fill missing');
    }
    expect(fill.width).toBeCloseTo(BOARD.width * 0.5, 6);
    expect(fill.height).toBe(thickness);
    expect(fill.y).toBe(y);
    expect(fill.fillStyle).toBe(PALETTE.accent.primary);
    expect(fill.shadowBlur).toBe(0);
  });

  it('glows briefly when the gauge reaches 100%, then decays', () => {
    const animator = new RoundGaugeAnimator();
    animator.update(0.9, 16);
    expect(animator.glow).toBe(0);

    animator.update(1, 16);
    expect(animator.glow).toBeGreaterThan(0.9);

    animator.update(1, HUD_LAYOUT.roundGauge.glowMs / 2);
    expect(animator.glow).toBeCloseTo(0.5, 1);
    animator.update(1, HUD_LAYOUT.roundGauge.glowMs);
    expect(animator.glow).toBe(0);

    // A completed round draws the success colour with a live shadowBlur.
    const { ctx, rects } = createRectStub();
    drawRoundProgressGauge(ctx, 1, 1);
    const fill = rects[1];
    if (fill === undefined) {
      throw new Error('gauge fill missing');
    }
    expect(fill.fillStyle).toBe(PALETTE.accent.success);
    expect(fill.shadowBlur).toBe(HUD_LAYOUT.roundGauge.glowBlur);
    expect(fill.width).toBe(BOARD.width);

    // Rising edge fires again after the progress resets (next round).
    animator.update(0.2, 16);
    animator.update(1, 16);
    expect(animator.glow).toBeGreaterThan(0.9);
  });
});

describe('danger tint (diegetic board reaction)', () => {
  it('stays transparent until a ball rests within the threshold of the line', () => {
    expect(dangerTintAlpha(0)).toBe(0);
    // Intensity that corresponds to exactly `thresholdPx` below the line.
    const atThreshold = 1 - HUD_LAYOUT.dangerTint.thresholdPx / WARNING_ZONE_HEIGHT;
    expect(dangerTintAlpha(atThreshold)).toBe(0);
    expect(dangerTintAlpha(atThreshold - 0.05)).toBe(0);
  });

  it('ramps to the configured maximum as the ball touches the danger line', () => {
    const atThreshold = 1 - HUD_LAYOUT.dangerTint.thresholdPx / WARNING_ZONE_HEIGHT;
    const halfway = atThreshold + (1 - atThreshold) / 2;
    expect(dangerTintAlpha(halfway)).toBeCloseTo(HUD_LAYOUT.dangerTint.maxAlpha / 2, 6);
    expect(dangerTintAlpha(1)).toBe(HUD_LAYOUT.dangerTint.maxAlpha);
    expect(dangerTintAlpha(2)).toBe(HUD_LAYOUT.dangerTint.maxAlpha);
    // Subtle by design: the vignette remains the loud alarm.
    expect(HUD_LAYOUT.dangerTint.maxAlpha).toBeLessThanOrEqual(0.15);
  });

  it('paints the whole board with the near-miss colour only while threatened', () => {
    const calm = createRectStub();
    drawDangerTint(calm.ctx, 0.2);
    expect(calm.rects).toHaveLength(0);

    const danger = createRectStub();
    drawDangerTint(danger.ctx, 1);
    expect(danger.rects).toHaveLength(1);
    const tint = danger.rects[0];
    if (tint === undefined) {
      throw new Error('tint rect missing');
    }
    expect(tint).toMatchObject({ x: 0, y: 0, width: BOARD.width, height: BOARD.height });
    expect(tint.fillStyle).toContain(PALETTE.nearMissVignetteRgb);
  });
});

describe('diegetic NEXT preview placement', () => {
  interface TextCall {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly align: string;
  }

  function createHudStub(): {
    ctx: CanvasRenderingContext2D;
    texts: TextCall[];
    translates: Array<{ x: number; y: number }>;
  } {
    const texts: TextCall[] = [];
    const translates: Array<{ x: number; y: number }> = [];
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
      arc: noop,
      fill: noop,
      stroke: noop,
      fillText: (text: string, x: number, y: number): void => {
        texts.push({ text, x, y, align: String(stub.textAlign) });
      },
    };
    return { ctx: stub as unknown as CanvasRenderingContext2D, texts, translates };
  }

  it('draws the NEXT ball beside the spawn point instead of a screen corner', () => {
    const { ctx, translates, texts } = createHudStub();
    drawHud(ctx, baseSnapshot(), { roundEmphasized: false });

    const spawnColumn = BOARD.width / 2 + HUD_LAYOUT.next.offsetX;
    expect(translates).toContainEqual({ x: spawnColumn, y: SPAWN_Y });

    const label = texts.find((call) => call.text === TEXT.nextLabel);
    if (label === undefined) {
      throw new Error('NEXT label missing');
    }
    expect(label.align).toBe('center');
    expect(label.x).toBe(spawnColumn);
    expect(label.y).toBe(
      HUD_LAYOUT.next.previewY + HUD_LAYOUT.next.previewRadius + HUD_LAYOUT.next.labelGap,
    );
    // Diegetic slot: the label stays above the danger line.
    expect(label.y).toBeLessThan(120);
  });

  it('keeps the preview clear of the centred SCORE column and the spawn column itself', () => {
    // The preview offset must leave room for the display-size score around
    // the centre while still reading as part of the spawn area.
    expect(HUD_LAYOUT.next.offsetX).toBeGreaterThan(0);
    expect(HUD_LAYOUT.next.offsetX + HUD_LAYOUT.next.previewRadius).toBeLessThan(
      BOARD.width / 2 - HUD_LAYOUT.margin,
    );
    expect(HUD_LAYOUT.next.previewY).toBe(SPAWN_Y);
  });
});
