import { BOARD, DESIGN, FONT_STACK, GAME_OVER, TEXT } from '@/config/gameConfig';
import { clamp01, easeOutCubic } from '@/render/motion';
import { traceRoundedRect } from '@/render/paths';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { GameState } from '@/core/state/GameState';

const FONT = FONT_STACK;

/** A rectangle in board coordinates. */
export interface GameOverRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The restart button's rectangle (board space), bottom of the screen. */
export function restartButtonRect(): GameOverRect {
  const { buttonY, buttonWidth, buttonHeight } = GAME_OVER.layout;
  return {
    x: (BOARD.width - buttonWidth) / 2,
    y: buttonY - buttonHeight / 2,
    width: buttonWidth,
    height: buttonHeight,
  };
}

/**
 * The score shown at count-up progress `t` (0..1), eased with the canvas
 * counterpart of `DESIGN.easing.decelerate`.
 */
export function countUpScore(finalScore: number, t: number): number {
  const target = Number.isFinite(finalScore) ? Math.max(0, finalScore) : 0;
  return Math.round(target * easeOutCubic(t));
}

/**
 * Time-driven presentation of the game-over screen: when it appeared (score
 * count-up), the NEW BEST badge heartbeat and the chromatic-aberration pulse
 * schedule. `CanvasRenderer` advances it once per frame with its own clock;
 * tests drive it by hand. Pure presentation — no game state is touched.
 */
export class GameOverPresenter {
  private lastState: GameState | null = null;
  private startedAtMs: number | null = null;
  private nowMs = 0;
  private pulsesFired = 0;
  private nextPulseMs = 0;

  update(snapshot: GameSnapshot, nowMs: number): void {
    this.nowMs = nowMs;
    if (snapshot.state !== 'game_over') {
      this.lastState = snapshot.state;
      this.startedAtMs = null;
      this.pulsesFired = 0;
      return;
    }
    if (this.lastState !== 'game_over' || this.startedAtMs === null) {
      // Rising edge: the screen just appeared — start the count-up and arm
      // the celebration pulses (the first one lands immediately).
      this.startedAtMs = nowMs;
      this.pulsesFired = 0;
      this.nextPulseMs = nowMs;
    }
    this.lastState = snapshot.state;
  }

  /** The clock the presenter was last advanced with. */
  get now(): number {
    return this.nowMs;
  }

  /** Count-up progress 0..1 (1 before the screen ever appeared). */
  countUpProgress(nowMs: number): number {
    if (this.startedAtMs === null) {
      return 1;
    }
    return clamp01((nowMs - this.startedAtMs) / GAME_OVER.countUpMs);
  }

  /** Badge heartbeat 0..1, or 0 when there is no NEW BEST badge. */
  badgePulse(nowMs: number, isNewBest: boolean): number {
    if (!isNewBest || this.startedAtMs === null) {
      return 0;
    }
    const period = GAME_OVER.newBest.pulsePeriodMs;
    const phase = ((((nowMs - this.startedAtMs) % period) + period) % period) / period;
    return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  }

  /**
   * Consumes a due NEW BEST chromatic-aberration pulse: true at most
   * `GAME_OVER.newBest.pulseCount` times, one period apart, starting the
   * instant the screen appears.
   */
  consumeAberrationPulse(nowMs: number, isNewBest: boolean): boolean {
    if (!isNewBest || this.startedAtMs === null) {
      return false;
    }
    if (this.pulsesFired >= GAME_OVER.newBest.pulseCount || nowMs < this.nextPulseMs) {
      return false;
    }
    this.pulsesFired += 1;
    this.nextPulseMs = nowMs + GAME_OVER.newBest.pulsePeriodMs;
    return true;
  }
}

// Fallback presenter for two-argument `drawGameOver` callers: wall-clock
// driven, so the count-up still animates without an injected presenter.
const fallbackPresenter = new GameOverPresenter();

function advanceFallbackPresenter(snapshot: GameSnapshot): GameOverPresenter {
  fallbackPresenter.update(snapshot, performance.now());
  return fallbackPresenter;
}

/**
 * The redesigned game-over screen (session B, Task 3):
 *
 * - the final score counts up from 0 over `GAME_OVER.countUpMs` with a
 *   decelerating ease, at the largest type size in the game;
 * - a NEW BEST badge heartbeats (scale + glow) and pulses the post-process
 *   chromatic aberration when the run set a record;
 * - the round reached is stated under the score;
 * - a filled accent restart button anchors the bottom, with the click/touch/R
 *   hint kept under it.
 *
 * Restart itself stays exactly as before (any click/touch or R restarts) —
 * the button is the visual affordance, not a new input path.
 */
export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  presenter?: GameOverPresenter,
): void {
  const screen = presenter ?? advanceFallbackPresenter(snapshot);
  const nowMs = screen.now;
  const isNewBest = snapshot.isNewBest === true;
  const { caption, body, display } = DESIGN.fontSize;
  const { medium, black } = DESIGN.fontWeight;
  const layout = GAME_OVER.layout;

  ctx.save();
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title.
  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${black} ${display}px ${FONT}`;
  ctx.fillText(TEXT.runOverTitle, BOARD.width / 2, layout.titleY);

  // NEW BEST badge — only when the run set a record.
  if (isNewBest) {
    drawNewBestBadge(ctx, screen.badgePulse(nowMs, isNewBest));
  }

  // Count-up score: the one big number of the screen.
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${caption}px ${FONT}`;
  ctx.fillText(TEXT.scoreLabel, BOARD.width / 2, layout.scoreLabelY);
  ctx.fillStyle = PALETTE.text.primary;
  ctx.shadowColor = PALETTE.bg.deep;
  ctx.shadowBlur = DESIGN.shadow.strong;
  ctx.font = `${black} ${GAME_OVER.scoreFontSize}px ${FONT}`;
  ctx.fillText(
    countUpScore(snapshot.score, screen.countUpProgress(nowMs)).toLocaleString('ko-KR'),
    BOARD.width / 2,
    layout.scoreY,
  );
  ctx.shadowBlur = 0;

  // Best score.
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${body}px ${FONT}`;
  ctx.fillText(
    TEXT.bestSummary(snapshot.best.toLocaleString('ko-KR')),
    BOARD.width / 2,
    layout.bestY,
  );

  // Round reached — only when the run carried a round structure.
  if (snapshot.round !== undefined) {
    ctx.fillStyle = PALETTE.text.secondary;
    ctx.font = `${medium} ${caption}px ${FONT}`;
    ctx.fillText(TEXT.roundReached(snapshot.round.index), BOARD.width / 2, layout.roundY);
  }

  // Restart button (accent) + the classic hint under it.
  drawRestartButton(ctx);
  ctx.fillStyle = PALETTE.text.dim;
  ctx.font = `${medium} ${caption}px ${FONT}`;
  ctx.fillText(TEXT.restartHint, BOARD.width / 2, layout.hintY);
  ctx.restore();
}

function drawNewBestBadge(ctx: CanvasRenderingContext2D, pulse: number): void {
  const { badgeWidth, badgeHeight, badgeScaleMax } = GAME_OVER.newBest;
  const scale = 1 + (badgeScaleMax - 1) * clamp01(pulse);
  ctx.save();
  ctx.translate(BOARD.width / 2, GAME_OVER.layout.badgeY);
  ctx.scale(scale, scale);
  traceRoundedRect(
    ctx,
    -badgeWidth / 2,
    -badgeHeight / 2,
    badgeWidth,
    badgeHeight,
    badgeHeight / 2,
  );
  ctx.fillStyle = PALETTE.accent.warning;
  ctx.shadowColor = PALETTE.accent.warning;
  ctx.shadowBlur = DESIGN.glow.subtle + (DESIGN.glow.medium - DESIGN.glow.subtle) * clamp01(pulse);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.card.badgeText;
  ctx.font = `${DESIGN.fontWeight.black} ${DESIGN.fontSize.body}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TEXT.newBestBadge, 0, 1);
  ctx.restore();
}

function drawRestartButton(ctx: CanvasRenderingContext2D): void {
  const rect = restartButtonRect();
  ctx.save();
  traceRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, GAME_OVER.layout.buttonRadius);
  ctx.fillStyle = PALETTE.accent.primary;
  ctx.shadowColor = PALETTE.accent.primary;
  ctx.shadowBlur = DESIGN.glow.medium;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.card.badgeText;
  ctx.font = `${DESIGN.fontWeight.black} ${DESIGN.fontSize.body}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TEXT.restartButton, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
  ctx.restore();
}
