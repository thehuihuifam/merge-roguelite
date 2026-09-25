import { SPAWN_PENALTY_HUD } from '@/config/gameConfig';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * Shows the active `spawn_larger_balls` pressure (Task 2.19): the forced
 * minimum tier and how many dispenser issuances remain. Reads the snapshot
 * only — no game state is touched here — and draws nothing while the field
 * is absent (penalty expired or run restarted).
 */
export function drawSpawnPenaltyHud(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  const penalty = snapshot.spawnPenalty;
  if (penalty === undefined) {
    return;
  }
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.cardRiskText;
  ctx.font = `600 ${SPAWN_PENALTY_HUD.labelFontSize}px ${FONT}`;
  ctx.fillText(
    `SPAWN ≥${penalty.minTier} · ${penalty.remainingIssuances} LEFT`,
    SPAWN_PENALTY_HUD.x,
    SPAWN_PENALTY_HUD.y,
  );
  ctx.restore();
}
