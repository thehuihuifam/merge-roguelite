import { BOARD, HUD_LAYOUT, WARNING_ZONE_HEIGHT } from '@/config/gameConfig';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';

/**
 * Diegetic board elements (UX overhaul session B, Task 2): information the
 * board itself carries instead of the HUD chrome —
 *
 * - the round-progress gauge embedded in the bottom frame, with a brief glow
 *   the moment a round hits 100%;
 * - the danger blush: the board background tints red as a resting ball closes
 *   in on the danger line (reuses the existing `nearMissIntensity`).
 *
 * All sizes/colours come from `HUD_LAYOUT` and the session-A tokens.
 */

/** Round score progress 0..1 from the snapshot (0 when no round is shown). */
export function roundProgressOf(snapshot: GameSnapshot): number {
  const round = snapshot.round;
  if (round === undefined || round.targetScore <= 0) {
    return 0;
  }
  return clamp01(round.scoreProgress / round.targetScore);
}

/**
 * Fires the completion glow on the rising edge into 100% and lets it decay
 * over `HUD_LAYOUT.roundGauge.glowMs`. Presentation only — feed it the
 * round progress each frame and read `glow` for the draw call.
 */
export class RoundGaugeAnimator {
  private wasComplete = false;
  private glowRemainingMs = 0;

  update(progress: number, deltaMs: number): void {
    const complete = progress >= 1;
    if (complete && !this.wasComplete) {
      this.glowRemainingMs = HUD_LAYOUT.roundGauge.glowMs;
    }
    this.wasComplete = complete;
    this.glowRemainingMs = Math.max(0, this.glowRemainingMs - Math.max(0, deltaMs));
  }

  /** Glow strength 0..1 (1 at the instant the round completes). */
  get glow(): number {
    return clamp01(this.glowRemainingMs / HUD_LAYOUT.roundGauge.glowMs);
  }
}

/**
 * Draws the bottom-frame progress gauge: a panel-coloured track the width of
 * the board with the round progress filled over it. While `glow` > 0 the fill
 * flips to the success colour and blooms against the frame.
 */
export function drawRoundProgressGauge(
  ctx: CanvasRenderingContext2D,
  progress: number,
  glow: number,
): void {
  const { thickness, glowBlur } = HUD_LAYOUT.roundGauge;
  const fraction = clamp01(progress);
  const strength = clamp01(glow);
  const y = BOARD.height - thickness;
  ctx.save();
  ctx.fillStyle = PALETTE.bg.panel;
  ctx.fillRect(0, y, BOARD.width, thickness);
  if (fraction > 0) {
    ctx.fillStyle = strength > 0 ? PALETTE.accent.success : PALETTE.accent.primary;
    if (strength > 0) {
      ctx.shadowColor = PALETTE.accent.success;
      ctx.shadowBlur = glowBlur * strength;
    }
    ctx.fillRect(0, y, BOARD.width * fraction, thickness);
  }
  ctx.restore();
}

/**
 * Board-background blush alpha for a near-miss intensity. The tint starts at
 * `HUD_LAYOUT.dangerTint.thresholdPx` from the danger line — expressed through
 * the warning-zone ramp the intensity already carries — and saturates at
 * `maxAlpha` when a ball touches the line.
 */
export function dangerTintAlpha(nearMissIntensity: number): number {
  const { thresholdPx, maxAlpha } = HUD_LAYOUT.dangerTint;
  const startIntensity = clamp01(1 - thresholdPx / WARNING_ZONE_HEIGHT);
  const span = Math.max(0.0001, 1 - startIntensity);
  return maxAlpha * clamp01((clamp01(nearMissIntensity) - startIntensity) / span);
}

/** Paints the danger blush over the board background. No-op while calm. */
export function drawDangerTint(ctx: CanvasRenderingContext2D, nearMissIntensity: number): void {
  const alpha = dangerTintAlpha(nearMissIntensity);
  if (alpha <= 0) {
    return;
  }
  ctx.save();
  ctx.fillStyle = `rgba(${PALETTE.nearMissVignetteRgb}, ${alpha.toFixed(3)})`;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.restore();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
