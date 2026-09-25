import { describe, expect, it } from 'vitest';
import { BOARD, CARD_OVERLAY, SLOW_MOTION, TEXT } from '@/config/gameConfig';
import { cardIndexAt, cardRects, drawCardOverlay } from '@/render/CardOverlayRenderer';
import {
  createBonusScoreCard,
  createDoubleMultiplierCard,
  createScoreLossCard,
  createTripleMultiplierCard,
} from '@/systems/cards/BasicMergeCardProvider';
import type { CardRect } from '@/render/CardOverlayRenderer';
import type { MergeCard } from '@/core/interfaces/IMergeCard';

function handOf(count: number): MergeCard[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `card-${index}`,
    kind: 'reward' as const,
    title: `CARD ${index}`,
    description: 'Test card used to verify the overlay layout.',
    apply: (): void => {
      return;
    },
  }));
}

function isInsideBoard(rect: CardRect): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= BOARD.width &&
    rect.y + rect.height <= BOARD.height
  );
}

function overlaps(a: CardRect, b: CardRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function centerOf(rect: CardRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Minimal CanvasRenderingContext2D stand-in: records the text the overlay
 * draws so the draw path can be smoke-tested in the Node test environment.
 */
function createStubContext(): { ctx: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = [];
  const noop = (): void => {
    return;
  };
  const stub = {
    fillStyle: '',
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
    translate: noop,
    scale: noop,
    beginPath: noop,
    moveTo: noop,
    arcTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    fillText: (text: string): void => {
      texts.push(text);
    },
    measureText: (text: string): { width: number } => ({ width: text.length * 6 }),
    // Risk cards blush with a gradient derived from the risk border token.
    createLinearGradient: (): { addColorStop: (offset: number, color: string) => void } => ({
      addColorStop: noop,
    }),
  };
  return { ctx: stub as unknown as CanvasRenderingContext2D, texts };
}

describe('card overlay layout', () => {
  it('draws one rectangle per pending card', () => {
    expect(cardRects(3)).toHaveLength(3);
    expect(cardRects(1)).toHaveLength(1);
    expect(cardRects(0)).toHaveLength(0);
  });

  it('keeps every card inside the board', () => {
    for (const rect of cardRects(SLOW_MOTION.cardCount)) {
      expect(isInsideBoard(rect)).toBe(true);
      expect(rect.width).toBe(CARD_OVERLAY.cardWidth);
      expect(rect.height).toBe(CARD_OVERLAY.cardHeight);
    }
  });

  it('never overlaps two cards', () => {
    const rects = cardRects(SLOW_MOTION.cardCount);
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        if (a === undefined || b === undefined) {
          continue;
        }
        expect(overlaps(a, b)).toBe(false);
      }
    }
  });

  it('spaces the row with the configured gap and centres it', () => {
    const rects = cardRects(3);
    const first = rects[0];
    const second = rects[1];
    const last = rects[rects.length - 1];
    expect(first).not.toBeUndefined();
    expect(second).not.toBeUndefined();
    expect(last).not.toBeUndefined();
    if (first === undefined || second === undefined || last === undefined) {
      return;
    }
    expect(second.x - (first.x + first.width)).toBe(CARD_OVERLAY.gap);
    expect(BOARD.width - (last.x + last.width)).toBeCloseTo(first.x, 6);
  });

  it('anchors the row above the bottom margin, clear of the header', () => {
    const rects = cardRects(SLOW_MOTION.cardCount);
    for (const rect of rects) {
      expect(BOARD.height - (rect.y + rect.height)).toBe(CARD_OVERLAY.bottomMargin);
      expect(rect.y).toBeGreaterThan(CARD_OVERLAY.headerY);
    }
  });

  it('maps a point inside a card to that card index', () => {
    const cards = handOf(SLOW_MOTION.cardCount);
    const rects = cardRects(cards.length);
    rects.forEach((rect, index) => {
      const center = centerOf(rect);
      expect(cardIndexAt(cards, center.x, center.y)).toBe(index);
    });
  });

  it('misses points outside the cards', () => {
    const cards = handOf(SLOW_MOTION.cardCount);
    const rect = cardRects(cards.length)[0];
    expect(rect).not.toBeUndefined();
    if (rect === undefined) {
      return;
    }
    expect(cardIndexAt(cards, rect.x - 1, rect.y + 10)).toBeNull();
    expect(cardIndexAt(cards, rect.x + rect.width + 1, rect.y + 10)).toBeNull();
    expect(cardIndexAt(cards, rect.x + 10, rect.y - 1)).toBeNull();
    expect(cardIndexAt(cards, rect.x + 10, rect.y + rect.height + 1)).toBeNull();
    expect(cardIndexAt(cards, 0, 0)).toBeNull();
  });

  it('returns null for an empty hand', () => {
    expect(cardIndexAt([], BOARD.width / 2, BOARD.height / 2)).toBeNull();
  });
});

describe('card overlay drawing', () => {
  it('draws the real deck hand without touching the DOM', () => {
    const { ctx, texts } = createStubContext();
    const hand: MergeCard[] = [
      createBonusScoreCard(16),
      createDoubleMultiplierCard(),
      createScoreLossCard(),
    ];

    drawCardOverlay(ctx, hand);

    expect(texts).toContain(TEXT.chooseHeader);
    for (const card of hand) {
      expect(texts).toContain(card.title);
    }
    expect(texts.filter((text) => text === TEXT.riskBadge)).toHaveLength(1);
  });

  it('badges every risk card in the hand', () => {
    const { ctx, texts } = createStubContext();

    drawCardOverlay(ctx, [
      createScoreLossCard(),
      createScoreLossCard(),
      createTripleMultiplierCard(),
    ]);

    expect(texts.filter((text) => text === TEXT.riskBadge)).toHaveLength(2);
  });

  it('draws nothing for an empty hand', () => {
    const { ctx, texts } = createStubContext();

    drawCardOverlay(ctx, []);

    expect(texts).toHaveLength(0);
  });
});
