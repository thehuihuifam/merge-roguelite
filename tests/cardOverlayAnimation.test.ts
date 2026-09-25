import { describe, expect, it } from 'vitest';
import { CARD_OVERLAY, DESIGN } from '@/config/gameConfig';
import { CardOverlayAnimator } from '@/render/CardOverlayAnimator';
import { cardRects, drawCardOverlay } from '@/render/CardOverlayRenderer';
import { easeOutBack, easeOutCubic } from '@/render/motion';
import { PALETTE, withAlpha } from '@/render/palette';
import type { CardOverlayPresentation } from '@/render/CardOverlayAnimator';
import type { MergeCard, RiskCard } from '@/core/interfaces/IMergeCard';

function handOf(count: number, prefix = 'card'): MergeCard[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `${prefix}-${index}`,
    kind: 'reward' as const,
    title: `CARD ${index}`,
    description: 'Test card used to verify the overlay animation.',
    apply: (): void => {
      return;
    },
  }));
}

function riskCard(id: string): RiskCard {
  return {
    id,
    kind: 'risk',
    penalty: 'score_loss',
    severity: 0.7,
    title: 'GAMBLE',
    description: 'Risk card used to verify the blush gradient.',
    apply: (): void => {
      return;
    },
  };
}

interface FillRecord {
  readonly alpha: number;
  readonly fillStyle: string;
  readonly shadowBlur: number;
}

interface GradientRecord {
  readonly stops: Array<{ offset: number; color: string }>;
}

interface OverlayStub {
  readonly ctx: CanvasRenderingContext2D;
  readonly texts: string[];
  readonly fills: FillRecord[];
  readonly scales: Array<{ x: number; y: number }>;
  readonly translates: Array<{ x: number; y: number }>;
  readonly gradients: GradientRecord[];
}

function createStubContext(): OverlayStub {
  const texts: string[] = [];
  const fills: FillRecord[] = [];
  const scales: Array<{ x: number; y: number }> = [];
  const translates: Array<{ x: number; y: number }> = [];
  const gradients: GradientRecord[] = [];
  const noop = (): void => {
    return;
  };
  const stub = {
    fillStyle: '' as string | object,
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    save: noop,
    restore: noop,
    fillRect: noop,
    translate: (x: number, y: number): void => {
      translates.push({ x, y });
    },
    scale: (x: number, y: number): void => {
      scales.push({ x, y });
    },
    beginPath: noop,
    moveTo: noop,
    arcTo: noop,
    closePath: noop,
    fill: (): void => {
      fills.push({
        alpha: stub.globalAlpha,
        fillStyle: typeof stub.fillStyle === 'string' ? stub.fillStyle : String(stub.fillStyle),
        shadowBlur: stub.shadowBlur,
      });
    },
    stroke: noop,
    fillText: (text: string): void => {
      texts.push(text);
    },
    measureText: (text: string): { width: number } => ({ width: text.length * 6 }),
    createLinearGradient: (): { addColorStop: (offset: number, color: string) => void } => {
      const record: { stops: Array<{ offset: number; color: string }> } = { stops: [] };
      gradients.push(record);
      return {
        addColorStop: (offset: number, color: string): void => {
          record.stops.push({ offset, color });
        },
      };
    },
  };
  return {
    ctx: stub as unknown as CanvasRenderingContext2D,
    texts,
    fills,
    scales,
    translates,
    gradients,
  };
}

function presentationOf(partial: Partial<CardOverlayPresentation>): CardOverlayPresentation {
  return {
    entrance: 1,
    exit: null,
    selectedIndex: null,
    hoverIndex: null,
    ...partial,
  };
}

describe('card overlay animation timing (config)', () => {
  it('holds the session-B timing spec: 0.2 s in, 0.15 s out', () => {
    expect(CARD_OVERLAY.entranceMs).toBe(200);
    expect(CARD_OVERLAY.exitMs).toBe(150);
    expect(CARD_OVERLAY.entranceScaleFrom).toBeLessThan(1);
    expect(CARD_OVERLAY.exitScaleTo).toBeGreaterThan(1);
    expect(CARD_OVERLAY.hoverLiftPx).toBe(DESIGN.space.sm);
    expect(CARD_OVERLAY.riskGradientAlpha).toBeGreaterThan(0);
    expect(CARD_OVERLAY.riskGradientAlpha).toBeLessThan(0.5);
  });

  it('springs with the emphasis token counterpart and decelerates on exit', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    // Overshoots past 1 mid-flight (the springy emphasis feel)…
    let overshoot = 0;
    for (let i = 1; i < 100; i += 1) {
      overshoot = Math.max(overshoot, easeOutBack(i / 100));
    }
    expect(overshoot).toBeGreaterThan(1);
    // …and the exit curve decelerates like DESIGN.easing.decelerate.
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
  });
});

describe('CardOverlayAnimator', () => {
  it('springs a fresh hand in over entranceMs', () => {
    const animator = new CardOverlayAnimator();
    const hand = handOf(3);
    expect(animator.getFrame()).toBeNull();

    animator.update(hand, CARD_OVERLAY.entranceMs / 2);
    let frame = animator.getFrame();
    expect(frame?.cards).toEqual(hand);
    expect(frame?.presentation.entrance).toBeCloseTo(0.5, 6);
    expect(frame?.presentation.exit).toBeNull();

    animator.update(hand, CARD_OVERLAY.entranceMs);
    frame = animator.getFrame();
    expect(frame?.presentation.entrance).toBe(1);
  });

  it('keeps the chosen hand on screen for exitMs, then lets it go', () => {
    const animator = new CardOverlayAnimator();
    const hand = handOf(3);
    animator.update(hand, CARD_OVERLAY.entranceMs);
    animator.setHover(2);
    animator.notifyChosen(1);

    animator.update([], CARD_OVERLAY.exitMs / 2);
    const frame = animator.getFrame();
    expect(frame?.cards).toEqual(hand);
    expect(frame?.presentation.exit).toBeCloseTo(0.5, 6);
    expect(frame?.presentation.selectedIndex).toBe(1);
    expect(frame?.presentation.hoverIndex).toBeNull();

    animator.update([], CARD_OVERLAY.exitMs / 2 - 1);
    expect(animator.getFrame()).not.toBeNull();
    animator.update([], 1);
    expect(animator.getFrame()).toBeNull();
  });

  it('ignores a choice without a live hand', () => {
    const animator = new CardOverlayAnimator();
    animator.notifyChosen(0);
    animator.update([], 500);
    expect(animator.getFrame()).toBeNull();
  });

  it('a new hand replaces an exit in flight', () => {
    const animator = new CardOverlayAnimator();
    animator.update(handOf(3, 'a'), CARD_OVERLAY.entranceMs);
    animator.notifyChosen(0);
    animator.update([], CARD_OVERLAY.exitMs / 2);

    const next = handOf(2, 'b');
    animator.update(next, CARD_OVERLAY.entranceMs / 4);
    const frame = animator.getFrame();
    expect(frame?.cards).toEqual(next);
    expect(frame?.presentation.entrance).toBeCloseTo(0.25, 6);
    expect(frame?.presentation.exit).toBeNull();
    expect(frame?.presentation.selectedIndex).toBeNull();
  });
});

describe('card overlay animated drawing', () => {
  it('scales down and fades the hand mid-entrance', () => {
    const stub = createStubContext();
    drawCardOverlay(stub.ctx, handOf(3), presentationOf({ entrance: 0.1 }));

    const expectedScale =
      CARD_OVERLAY.entranceScaleFrom + (1 - CARD_OVERLAY.entranceScaleFrom) * easeOutBack(0.1);
    expect(stub.scales).toHaveLength(3);
    for (const scale of stub.scales) {
      expect(scale.x).toBeCloseTo(expectedScale, 6);
      expect(scale.y).toBeCloseTo(expectedScale, 6);
      expect(scale.x).toBeLessThan(1);
    }
    const expectedAlpha = easeOutCubic(0.1);
    expect(expectedAlpha).toBeLessThan(1);
    for (const fill of stub.fills) {
      expect(fill.alpha).toBeCloseTo(expectedAlpha, 6);
    }
  });

  it('applies no transforms at all in the static (fully visible) draw', () => {
    const stub = createStubContext();
    drawCardOverlay(stub.ctx, handOf(3));
    expect(stub.scales).toHaveLength(0);
    expect(stub.translates).toHaveLength(0);
    expect(stub.texts.length).toBeGreaterThan(0);
    for (const fill of stub.fills) {
      expect(fill.alpha).toBe(1);
    }
  });

  it('lifts exactly the hovered card and deepens its glow', () => {
    const stub = createStubContext();
    drawCardOverlay(stub.ctx, handOf(3), presentationOf({ hoverIndex: 0 }));

    const rect = cardRects(3)[0];
    if (rect === undefined) {
      throw new Error('missing card rect');
    }
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    expect(stub.translates[0]).toEqual({
      x: centerX,
      y: centerY - CARD_OVERLAY.hoverLiftPx,
    });
    // Only the hovered card is transformed (in and back out).
    expect(stub.translates).toHaveLength(2);

    // The hovered card's background fill glows stronger than the others.
    const glows = stub.fills.map((fill) => fill.shadowBlur);
    expect(glows[0]).toBe(DESIGN.glow.medium);
    expect(glows[1]).toBe(DESIGN.glow.subtle);
    expect(glows[2]).toBe(DESIGN.glow.subtle);
  });

  it('grows the chosen card and fades the whole hand on exit', () => {
    const stub = createStubContext();
    drawCardOverlay(stub.ctx, handOf(3), presentationOf({ exit: 0.5, selectedIndex: 1 }));

    const expectedScale = 1 + (CARD_OVERLAY.exitScaleTo - 1) * easeOutCubic(0.5);
    expect(stub.scales).toHaveLength(1); // only the chosen card scales
    expect(stub.scales[0]?.x).toBeCloseTo(expectedScale, 6);
    expect(stub.scales[0]?.x).toBeGreaterThan(1);

    const expectedAlpha = 1 - easeOutCubic(0.5);
    for (const fill of stub.fills) {
      expect(fill.alpha).toBeCloseTo(expectedAlpha, 6);
    }
  });

  it('draws nothing once the exit completes', () => {
    const stub = createStubContext();
    drawCardOverlay(stub.ctx, handOf(3), presentationOf({ exit: 1, selectedIndex: 0 }));
    expect(stub.texts).toHaveLength(0);
    expect(stub.fills).toHaveLength(0);
  });

  it('blushes risk cards with a gradient derived from the risk token', () => {
    const stub = createStubContext();
    drawCardOverlay(stub.ctx, [handOf(1)[0] as MergeCard, riskCard('risk-0')]);

    expect(stub.gradients).toHaveLength(1);
    const gradient = stub.gradients[0];
    expect(gradient?.stops).toEqual([
      {
        offset: 0,
        color: withAlpha(PALETTE.card.riskBorder, CARD_OVERLAY.riskGradientAlpha),
      },
      { offset: 1, color: withAlpha(PALETTE.card.riskBorder, 0) },
    ]);
  });
});

describe('withAlpha palette helper', () => {
  it('derives rgba() strings from hex tokens and clamps the alpha', () => {
    expect(withAlpha('#ff4d6d', 0.5)).toBe('rgba(255, 77, 109, 0.500)');
    expect(withAlpha(PALETTE.card.riskBorder, 0)).toBe('rgba(255, 77, 109, 0.000)');
    expect(withAlpha('#8b5cf6', 2)).toBe('rgba(139, 92, 246, 1.000)');
    expect(withAlpha('#8b5cf6', -1)).toBe('rgba(139, 92, 246, 0.000)');
    expect(withAlpha('not-a-hex', 0.5)).toBe('not-a-hex');
  });
});
