import { BOARD, SPAWN_PENALTY_HUD } from '@/config/gameConfig';
import { PALETTE } from '@/render/palette';
import type { SpawnPenaltyHudState } from '@/core/ball/SpawnTierPenalty';

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * Spawn-pressure HUD (Task 2.19): tells the player how long the
 * `spawn_larger_balls` penalty still bites — the tier floor new balls come out
 * with and how many of those are left. Reads the snapshot only; the game state
 * is never touched. Does nothing when no penalty is active.
 */
export function drawSpawnPenaltyHud(
  ctx: CanvasRenderingContext2D,
  penalty: SpawnPenaltyHudState,
): void {
  if (penalty.remainingCount <= 0) {
    return;
  }
  const x = BOARD.width - SPAWN_PENALTY_HUD.rightMargin;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `600 ${SPAWN_PENALTY_HUD.labelFontSize}px ${FONT}`;
  ctx.fillText('HEAVY DROPS', x, SPAWN_PENALTY_HUD.labelY);

  ctx.fillStyle = PALETTE.spawnPenaltyText;
  ctx.font = `700 ${SPAWN_PENALTY_HUD.valueFontSize}px ${FONT}`;
  ctx.fillText(
    `${penalty.remainingCount} LEFT · TIER ${penalty.floor}+`,
    x,
    SPAWN_PENALTY_HUD.valueY,
  );
  ctx.restore();
}
