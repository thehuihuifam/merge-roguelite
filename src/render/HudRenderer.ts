import { BOARD, DESIGN, FONT_STACK, HUD_LAYOUT, TEXT } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { drawBallShape } from '@/render/BallRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';

const FONT = FONT_STACK;

/**
 * Time-based presentation state `drawHud` needs beyond the snapshot
 * (progressive disclosure: the emphasis window depends on when the current
 * round began, which the snapshot does not carry).
 */
export interface HudProgression {
  /** True while the current round sits inside its emphasis window. */
  readonly roundEmphasized: boolean;
}

/**
 * Tracks the round emphasis window (`HUD_LAYOUT.round.emphasisMs` after a
 * round starts). `CanvasRenderer` advances it once per frame; tests drive it
 * by hand. The window restarts when the round index changes and when a new
 * run begins (seed change), so every round gets its moment of attention.
 */
export class HudProgressionAnimator implements HudProgression {
  private roundIndex: number | null = null;
  private seed = Number.NaN;
  private elapsedMs = Number.POSITIVE_INFINITY;

  update(snapshot: GameSnapshot, deltaMs: number): void {
    const index = snapshot.round?.index ?? null;
    if (index !== this.roundIndex || snapshot.seed !== this.seed) {
      this.roundIndex = index;
      this.elapsedMs = 0;
    } else {
      this.elapsedMs += Math.max(0, deltaMs);
    }
    this.seed = snapshot.seed;
  }

  get roundEmphasized(): boolean {
    return this.roundIndex !== null && this.elapsedMs < HUD_LAYOUT.round.emphasisMs;
  }
}

// Fallback progression for two-argument `drawHud` callers: wall-clock driven,
// so the emphasis window still behaves without an injected animator.
const fallbackAnimator = new HudProgressionAnimator();
let fallbackLastNowMs: number | null = null;

function advanceFallbackProgression(snapshot: GameSnapshot): HudProgression {
  const nowMs = performance.now();
  const deltaMs = fallbackLastNowMs === null ? 0 : Math.max(0, nowMs - fallbackLastNowMs);
  fallbackLastNowMs = nowMs;
  fallbackAnimator.update(snapshot, deltaMs);
  return fallbackAnimator;
}

/**
 * Draws the in-run HUD in three tiers of attention (session B redesign):
 *
 * 1. primary   — SCORE: top centre, display size, brightest text on screen.
 * 2. secondary — BEST (top-left corner) and NEXT (diegetic: beside the spawn
 *    point): caption size, out of the player's central focus.
 * 3. tertiary  — conditional: the round block is emphasized for
 *    `HUD_LAYOUT.round.emphasisMs` after a round starts and stays as a quiet
 *    compact readout afterwards; the drops-left warning appears only when the
 *    budget runs low; the SLOW badge only while time is slowed. (The spawn
 *    penalty has its own conditional renderer, `SpawnPenaltyHudRenderer`.)
 *
 * All coordinates come from `HUD_LAYOUT`, all sizes/colours from the session-A
 * DESIGN and PALETTE tokens.
 */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  progression?: HudProgression,
): void {
  const hud = progression ?? advanceFallbackProgression(snapshot);
  const { caption, display } = DESIGN.fontSize;
  const { medium, bold, black } = DESIGN.fontWeight;

  // ── Primary: current score, top centre, big and bright. ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${caption}px ${FONT}`;
  ctx.fillText(TEXT.scoreLabel, BOARD.width / 2, HUD_LAYOUT.score.labelY);
  // Soft dark backing keeps the number readable when the held ball or the
  // aim guide passes behind it near the spawn point.
  ctx.shadowColor = PALETTE.bg.deep;
  ctx.shadowBlur = DESIGN.shadow.medium;
  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${black} ${display}px ${FONT}`;
  ctx.fillText(snapshot.score.toLocaleString('ko-KR'), BOARD.width / 2, HUD_LAYOUT.score.valueY);
  ctx.restore();

  // ── Secondary: BEST, top-left corner, caption scale. ──
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${caption}px ${FONT}`;
  ctx.fillText(TEXT.bestLabel, HUD_LAYOUT.margin, HUD_LAYOUT.best.labelY);
  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${bold} ${caption}px ${FONT}`;
  ctx.fillText(snapshot.best.toLocaleString('ko-KR'), HUD_LAYOUT.margin, HUD_LAYOUT.best.valueY);
  ctx.restore();

  // ── Secondary: NEXT, diegetic — beside the actual spawn point. ──
  drawNextPreview(ctx, snapshot);

  // ── Tertiary: only what matters right now. ──
  if (snapshot.round !== undefined) {
    drawRoundInfo(ctx, snapshot.round, hud.roundEmphasized);
  }
  if (snapshot.timeScale < 1) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.accent.primary;
    ctx.font = `${bold} ${caption}px ${FONT}`;
    ctx.fillText(
      TEXT.slowMotionBadgeDynamic(snapshot.timeScale.toFixed(2)),
      BOARD.width / 2,
      HUD_LAYOUT.slowBadge.y,
    );
    ctx.restore();
  }
}

/**
 * Diegetic NEXT preview (session B, Task 2): the mini ball floats right next
 * to the spawn point at the top-centre column — where the held ball and the
 * aim guide already live — with its caption label just under it, so "what
 * comes next" is read in the same glance as "where I am aiming".
 */
function drawNextPreview(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  const { offsetX, previewY, previewRadius, labelGap } = HUD_LAYOUT.next;
  const centerX = BOARD.width / 2 + offsetX;
  const nextSpec = getTierSpec(snapshot.nextTier);
  const previewScale = Math.min(1, previewRadius / nextSpec.radius);
  ctx.save();
  ctx.translate(centerX, previewY);
  ctx.scale(previewScale, previewScale);
  drawBallShape(ctx, 0, 0, snapshot.nextTier, 1, snapshot.nextSpecial);
  ctx.restore();

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${DESIGN.fontWeight.medium} ${DESIGN.fontSize.caption}px ${FONT}`;
  ctx.fillText(TEXT.nextLabel, centerX, previewY + previewRadius + labelGap);
  ctx.restore();
}

function drawRoundInfo(
  ctx: CanvasRenderingContext2D,
  round: RoundHudState,
  emphasized: boolean,
): void {
  const { caption, body } = DESIGN.fontSize;
  const { medium, bold } = DESIGN.fontWeight;
  const dropsLeft = Math.max(0, round.dropBudget - round.dropsUsed);
  const lowDrops = dropsLeft <= HUD_LAYOUT.round.lowDropsThreshold;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  if (emphasized) {
    // Round-start window: the full readout, bigger and brighter; the drops
    // half flips to the warning colour as soon as the budget runs low.
    ctx.fillStyle = lowDrops ? PALETTE.accent.warning : PALETTE.text.primary;
    ctx.font = `${bold} ${body}px ${FONT}`;
    ctx.fillText(
      TEXT.roundStatus(round.index, dropsLeft),
      HUD_LAYOUT.margin,
      HUD_LAYOUT.round.emphasizedY,
    );
    ctx.fillStyle = PALETTE.text.secondary;
    ctx.font = `${medium} ${caption}px ${FONT}`;
    ctx.fillText(
      TEXT.scoreProgress(round.scoreProgress, round.targetScore),
      HUD_LAYOUT.margin,
      HUD_LAYOUT.round.progressY,
    );
  } else {
    // Quiet mode: a compact caption readout tucked under BEST.
    ctx.fillStyle = PALETTE.text.secondary;
    ctx.font = `${medium} ${caption}px ${FONT}`;
    ctx.fillText(TEXT.roundIndexLabel(round.index), HUD_LAYOUT.margin, HUD_LAYOUT.round.quietY);
    ctx.fillStyle = PALETTE.text.dim;
    ctx.fillText(
      TEXT.scoreProgress(round.scoreProgress, round.targetScore),
      HUD_LAYOUT.margin,
      HUD_LAYOUT.round.quietProgressY,
    );
    // The drops-left warning surfaces only when it is actually a concern.
    if (lowDrops) {
      ctx.fillStyle = PALETTE.accent.warning;
      ctx.font = `${bold} ${caption}px ${FONT}`;
      const scale = HUD_LAYOUT.round.lowDropsScale;
      ctx.translate(HUD_LAYOUT.margin, HUD_LAYOUT.round.dropsY + caption / 2);
      ctx.scale(scale, scale);
      ctx.fillText(TEXT.dropsRemaining(dropsLeft), 0, -caption / 2);
    }
  }
  ctx.restore();
}

export function drawHeldBall(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  spawnY: number,
): void {
  if (snapshot.held === null) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = PALETTE.guide;
  ctx.setLineDash([DESIGN.space.xs, DESIGN.space.xs + DESIGN.space.sm]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(snapshot.held.x, spawnY);
  ctx.lineTo(snapshot.held.x, BOARD.height);
  ctx.stroke();
  ctx.restore();
  drawBallShape(ctx, snapshot.held.x, spawnY, snapshot.held.tier, 1, snapshot.held.special);
}

export function drawIdle(ctx: CanvasRenderingContext2D): void {
  const { display, body } = DESIGN.fontSize;
  const { medium, black } = DESIGN.fontWeight;
  ctx.save();
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${black} ${display}px ${FONT}`;
  ctx.fillText(TEXT.gameTitle, BOARD.width / 2, BOARD.height / 2 - 30);
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${body}px ${FONT}`;
  ctx.fillText(TEXT.startHint, BOARD.width / 2, BOARD.height / 2 + 20);
  ctx.restore();
}
