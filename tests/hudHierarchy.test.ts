import { describe, expect, it } from 'vitest';
import { BOARD, DESIGN, FONT_STACK, HUD_LAYOUT, TEXT } from '@/config/gameConfig';
import { HudProgressionAnimator, drawHud } from '@/render/HudRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { HudProgression } from '@/render/HudRenderer';
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

interface TextCall {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: string;
  readonly align: string;
  readonly fillStyle: string;
}

interface StubContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly calls: TextCall[];
  readonly scales: Array<{ x: number; y: number }>;
  readonly translates: Array<{ x: number; y: number }>;
}

/** Records everything `drawHud` emits so the Node suite can assert layout. */
function createStubContext(): StubContext {
  const calls: TextCall[] = [];
  const scales: Array<{ x: number; y: number }> = [];
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
    scale: (x: number, y: number): void => {
      scales.push({ x, y });
    },
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
  return { ctx: stub as unknown as CanvasRenderingContext2D, calls, scales, translates };
}

function callFor(calls: readonly TextCall[], text: string): TextCall {
  const call = calls.find((candidate) => candidate.text === text);
  if (call === undefined) {
    throw new Error(`expected a fillText call for "${text}", got: ${calls.map((c) => c.text)}`);
  }
  return call;
}

function staticProgression(roundEmphasized: boolean): HudProgression {
  return { roundEmphasized };
}

const DISPLAY_FONT = `${DESIGN.fontWeight.black} ${DESIGN.fontSize.display}px ${FONT_STACK}`;
const CAPTION_FONT_FRAGMENT = `${DESIGN.fontSize.caption}px`;

describe('HUD information hierarchy', () => {
  it('draws SCORE as the single primary element: top centre, display size, brightest', () => {
    const { ctx, calls } = createStubContext();
    // A short score: no shrink, no slide — dead centre at the display size.
    drawHud(ctx, { ...baseSnapshot(), score: 42 }, staticProgression(false));

    const score = callFor(calls, '42');
    expect(score.font).toBe(DISPLAY_FONT);
    expect(score.align).toBe('center');
    expect(score.x).toBe(BOARD.width / 2);
    expect(score.y).toBe(HUD_LAYOUT.score.valueY);
    expect(score.fillStyle).toBe(PALETTE.text.primary);
    // Exactly one element on the whole HUD uses the display size.
    expect(calls.filter((call) => call.font === DISPLAY_FONT)).toHaveLength(1);
  });

  it('draws BEST and NEXT as small caption-scale secondary blocks', () => {
    const { ctx, calls } = createStubContext();
    drawHud(ctx, { ...baseSnapshot(), best: 900 }, staticProgression(false));

    const bestLabel = callFor(calls, TEXT.bestLabel);
    expect(bestLabel.font).toContain(CAPTION_FONT_FRAGMENT);
    expect(bestLabel.align).toBe('left');
    expect(bestLabel.x).toBe(HUD_LAYOUT.margin);

    const bestValue = callFor(calls, '900');
    expect(bestValue.font).toContain(CAPTION_FONT_FRAGMENT);
    expect(bestValue.x).toBe(HUD_LAYOUT.margin);

    // NEXT lives beside the spawn point (diegetic, session B Task 2).
    const nextLabel = callFor(calls, TEXT.nextLabel);
    expect(nextLabel.font).toContain(CAPTION_FONT_FRAGMENT);
    expect(nextLabel.align).toBe('center');
    expect(nextLabel.x).toBe(BOARD.width / 2 + HUD_LAYOUT.next.offsetX);
  });

  it('shows the SLOW badge only while time is slowed', () => {
    const normal = createStubContext();
    drawHud(normal.ctx, baseSnapshot(), staticProgression(false));
    expect(normal.calls.some((call) => call.text.startsWith('슬로우'))).toBe(false);

    const slowed = createStubContext();
    drawHud(slowed.ctx, { ...baseSnapshot(), timeScale: 0.25 }, staticProgression(false));
    const badge = callFor(slowed.calls, TEXT.slowMotionBadgeDynamic('0.25'));
    expect(badge.font).toContain(CAPTION_FONT_FRAGMENT);
    expect(badge.y).toBe(HUD_LAYOUT.slowBadge.y);
  });
});

describe('HUD progressive disclosure', () => {
  it('emphasizes the round readout for 3 s after the round starts, then quiets down', () => {
    const animator = new HudProgressionAnimator();
    const snapshot: GameSnapshot = {
      ...baseSnapshot(),
      round: roundOf({
        index: 2,
        targetScore: 250,
        scoreProgress: 120,
        dropsUsed: 3,
        dropBudget: 18,
      }),
    };

    animator.update(snapshot, 16);
    expect(animator.roundEmphasized).toBe(true);
    const loud = createStubContext();
    drawHud(loud.ctx, snapshot, animator);
    // Full readout (round + drops left) at body size while emphasized.
    const status = callFor(loud.calls, TEXT.roundStatus(2, 15));
    expect(status.font).toContain(`${DESIGN.fontSize.body}px`);
    expect(loud.calls.map((call) => call.text)).toContain(TEXT.scoreProgress(120, 250));

    animator.update(snapshot, HUD_LAYOUT.round.emphasisMs);
    expect(animator.roundEmphasized).toBe(false);
    const quiet = createStubContext();
    drawHud(quiet.ctx, snapshot, animator);
    const quietTexts = quiet.calls.map((call) => call.text);
    // The combined readout is gone; only the compact caption lines remain…
    expect(quietTexts).not.toContain(TEXT.roundStatus(2, 15));
    expect(quietTexts).toContain(TEXT.roundIndexLabel(2));
    expect(quietTexts).toContain(TEXT.scoreProgress(120, 250));
    // …and 15 drops left is not a concern, so no drops line is drawn.
    expect(quietTexts.some((text) => text.endsWith('개 남음'))).toBe(false);
    const label = callFor(quiet.calls, TEXT.roundIndexLabel(2));
    expect(label.font).toContain(CAPTION_FONT_FRAGMENT);
  });

  it('reopens the emphasis window when the round advances and on a new run seed', () => {
    const animator = new HudProgressionAnimator();
    const roundOne: GameSnapshot = { ...baseSnapshot(), seed: 5, round: roundOf({ index: 1 }) };
    animator.update(roundOne, 16);
    animator.update(roundOne, HUD_LAYOUT.round.emphasisMs + 1);
    expect(animator.roundEmphasized).toBe(false);

    const roundTwo: GameSnapshot = { ...baseSnapshot(), seed: 5, round: roundOf({ index: 2 }) };
    animator.update(roundTwo, 16);
    expect(animator.roundEmphasized).toBe(true);

    animator.update(roundTwo, HUD_LAYOUT.round.emphasisMs + 1);
    expect(animator.roundEmphasized).toBe(false);
    // Same round index but a fresh run (new seed) → emphasize again.
    const rerun: GameSnapshot = { ...baseSnapshot(), seed: 6, round: roundOf({ index: 2 }) };
    animator.update(rerun, 16);
    expect(animator.roundEmphasized).toBe(true);
  });

  it('surfaces drops left with warning colour and a slight scale-up only at 5 or fewer', () => {
    const animator = new HudProgressionAnimator();
    const comfortable: GameSnapshot = {
      ...baseSnapshot(),
      round: roundOf({ index: 1, dropBudget: 15, dropsUsed: 7 }),
    };
    animator.update(comfortable, 16);
    animator.update(comfortable, HUD_LAYOUT.round.emphasisMs + 1);
    expect(animator.roundEmphasized).toBe(false);

    const plenty = createStubContext();
    drawHud(plenty.ctx, comfortable, animator);
    expect(plenty.calls.some((call) => call.text === TEXT.dropsRemaining(8))).toBe(false);

    const scarce: GameSnapshot = {
      ...baseSnapshot(),
      round: roundOf({ index: 1, dropBudget: 15, dropsUsed: 12 }),
    };
    animator.update(scarce, 16);
    animator.update(scarce, HUD_LAYOUT.round.emphasisMs + 1);
    const warning = createStubContext();
    drawHud(warning.ctx, scarce, animator);
    const drops = callFor(warning.calls, TEXT.dropsRemaining(3));
    expect(drops.fillStyle).toBe(PALETTE.accent.warning);
    expect(warning.scales).toContainEqual({
      x: HUD_LAYOUT.round.lowDropsScale,
      y: HUD_LAYOUT.round.lowDropsScale,
    });
  });

  it('keeps the whole tertiary layer hidden when the snapshot carries no round', () => {
    const { ctx, calls } = createStubContext();
    drawHud(ctx, baseSnapshot(), staticProgression(true));
    expect(calls.some((call) => call.text.startsWith('라운드'))).toBe(false);
    expect(calls.some((call) => call.text.endsWith('개 남음'))).toBe(false);
  });
});
