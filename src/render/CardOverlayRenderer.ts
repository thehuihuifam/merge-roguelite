import { BOARD, CARD_OVERLAY, DESIGN, FONT_STACK, TEXT } from '@/config/gameConfig';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import { PALETTE } from '@/render/palette';
import type { MergeCard } from '@/core/interfaces/IMergeCard';

const FONT = FONT_STACK;

/** A card's rectangle in board coordinates. Hit-testing and drawing share it. */
export interface CardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Board-space rectangles for a hand of `count` cards, left to right, centred
 * horizontally and anchored above the bottom margin. Exported so pointer input
 * judges hits against the exact shapes that were drawn.
 */
export function cardRects(count: number): CardRect[] {
  const total = Math.max(0, Math.floor(count));
  if (total === 0) {
    return [];
  }
  const { cardWidth, cardHeight, gap, bottomMargin } = CARD_OVERLAY;
  const rowWidth = total * cardWidth + (total - 1) * gap;
  const startX = (BOARD.width - rowWidth) / 2;
  const y = BOARD.height - bottomMargin - cardHeight;
  return Array.from({ length: total }, (_unused, index) => ({
    x: startX + index * (cardWidth + gap),
    y,
    width: cardWidth,
    height: cardHeight,
  }));
}

/** Index of the card covering the board-space point, or null when it misses. */
export function cardIndexAt(cards: readonly MergeCard[], x: number, y: number): number | null {
  const rects = cardRects(cards.length);
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (rect === undefined) {
      continue;
    }
    const inside =
      x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    if (inside) {
      return index;
    }
  }
  return null;
}

/**
 * Draws the card choice over a dimmed board. Reward cards get a neutral frame,
 * risk cards the danger colour plus a `RISK` badge, so the trap is readable in
 * the split second the slow-motion window allows.
 */
export function drawCardOverlay(ctx: CanvasRenderingContext2D, cards: readonly MergeCard[]): void {
  if (cards.length === 0) {
    return;
  }
  ctx.save();

  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${DESIGN.fontWeight.black} ${DESIGN.fontSize.heading}px ${FONT}`;
  ctx.fillText(TEXT.chooseHeader, BOARD.width / 2, CARD_OVERLAY.headerY);
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${DESIGN.fontWeight.medium} ${DESIGN.fontSize.caption}px ${FONT}`;
  ctx.fillText(
    TEXT.chooseSubtext,
    BOARD.width / 2,
    CARD_OVERLAY.headerY + DESIGN.fontSize.heading + DESIGN.space.sm,
  );

  const rects = cardRects(cards.length);
  cards.forEach((card, index) => {
    const rect = rects[index];
    if (rect === undefined) {
      return;
    }
    drawCard(ctx, card, rect);
  });

  ctx.restore();
}

function drawCard(ctx: CanvasRenderingContext2D, card: MergeCard, rect: CardRect): void {
  const risk = isRiskCard(card);
  const innerWidth = rect.width - CARD_OVERLAY.padding * 2;

  ctx.save();
  traceRoundedRect(ctx, rect);
  // Cards hover over the dimmed board with a soft accent glow: violet for
  // rewards, danger red for risks — the frame colour says what a glance needs.
  ctx.shadowColor = risk ? PALETTE.card.riskBorder : PALETTE.card.rewardBorder;
  ctx.shadowBlur = DESIGN.glow.subtle;
  ctx.fillStyle = PALETTE.card.background;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = risk ? CARD_OVERLAY.riskBorderWidth : CARD_OVERLAY.borderWidth;
  ctx.strokeStyle = risk ? PALETTE.card.riskBorder : PALETTE.card.rewardBorder;
  ctx.stroke();

  const centerX = rect.x + rect.width / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = risk ? PALETTE.card.riskText : PALETTE.card.rewardText;
  ctx.font = `${DESIGN.fontWeight.black} ${DESIGN.fontSize.body}px ${FONT}`;
  ctx.fillText(card.title, centerX, rect.y + CARD_OVERLAY.padding, innerWidth);

  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${DESIGN.fontWeight.medium} ${DESIGN.fontSize.caption}px ${FONT}`;
  const lines = wrapText(ctx, card.description, innerWidth);
  let lineY = rect.y + CARD_OVERLAY.padding + DESIGN.fontSize.body + DESIGN.space.sm;
  for (const line of lines) {
    ctx.fillText(line, centerX, lineY, innerWidth);
    lineY += CARD_OVERLAY.bodyLineHeight;
  }

  if (risk) {
    drawRiskBadge(ctx, rect);
  }
  ctx.restore();
}

function drawRiskBadge(ctx: CanvasRenderingContext2D, rect: CardRect): void {
  const badge: CardRect = {
    x: rect.x + (rect.width - CARD_OVERLAY.badgeWidth) / 2,
    y: rect.y + rect.height - CARD_OVERLAY.padding - CARD_OVERLAY.badgeHeight,
    width: CARD_OVERLAY.badgeWidth,
    height: CARD_OVERLAY.badgeHeight,
  };
  traceRoundedRect(ctx, badge);
  ctx.fillStyle = PALETTE.card.riskBadge;
  ctx.fill();
  ctx.fillStyle = PALETTE.card.badgeText;
  ctx.font = `${DESIGN.fontWeight.black} ${DESIGN.fontSize.caption}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    TEXT.riskBadge,
    badge.x + badge.width / 2,
    badge.y + badge.height / 2 + 1,
    badge.width,
  );
}

function traceRoundedRect(ctx: CanvasRenderingContext2D, rect: CardRect): void {
  const radius = Math.min(CARD_OVERLAY.cornerRadius, rect.width / 2, rect.height / 2);
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  ctx.beginPath();
  ctx.moveTo(rect.x + radius, rect.y);
  ctx.arcTo(right, rect.y, right, bottom, radius);
  ctx.arcTo(right, bottom, rect.x, bottom, radius);
  ctx.arcTo(rect.x, bottom, rect.x, rect.y, radius);
  ctx.arcTo(rect.x, rect.y, right, rect.y, radius);
  ctx.closePath();
}

/** Greedy word wrap; the overlay has only a split second to be readable. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (current.length > 0 && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}
