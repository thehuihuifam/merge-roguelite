import { BOARD, NEAR_MISS_FX } from '@/config/gameConfig';
import { PALETTE } from '@/render/palette';

/**
 * Heartbeat period in ms for a near-miss severity (0..1). The closer a resting
 * ball is to the danger line, the faster the pulse runs: 900ms at severity 0,
 * 450ms at severity 1.
 */
export function heartbeatPeriodMs(severity: number): number {
  const clamped = clamp01(severity);
  const calm = NEAR_MISS_FX.heartbeatPeriodAtSeverityZeroMs;
  const panic = NEAR_MISS_FX.heartbeatPeriodAtSeverityOneMs;
  return calm + (panic - calm) * clamped;
}

/**
 * One heartbeat cycle ("lub-dub") for a phase in [0, 1): a strong bump at
 * phase 0 followed by a softer echo. Returns 0..1.
 */
export function heartbeatPulse(phase: number): number {
  const normalized = ((phase % 1) + 1) % 1;
  const main = beatBump(normalized, 0);
  const echo =
    NEAR_MISS_FX.heartbeatEchoStrength * beatBump(normalized, NEAR_MISS_FX.heartbeatEchoPhase);
  return Math.min(1, main + echo);
}

/**
 * Fade + heartbeat state for the red near-miss vignette. Presentation only:
 * feed it the raw `nearMissIntensity` each frame and sample the display alpha
 * and pulse for the draw call.
 */
export class NearMissVignetteAnimator {
  private alpha = 0;
  private phase = 0;
  private severity = 0;

  /**
   * Advances the animation by `deltaMs`. `hold` freezes the presentation
   * (used on game over so the vignette stays up behind the overlay).
   */
  update(intensity: number, deltaMs: number, hold = false): void {
    const target = clamp01(intensity);
    if (target > 0) {
      this.severity = target;
    }
    if (hold) {
      return;
    }
    if (target > this.alpha) {
      this.alpha = Math.min(target, this.alpha + deltaMs / NEAR_MISS_FX.fadeInMs);
    } else if (target < this.alpha) {
      this.alpha = Math.max(target, this.alpha - deltaMs / NEAR_MISS_FX.fadeOutMs);
    }
    if (this.alpha > 0 && deltaMs > 0) {
      this.phase = (this.phase + deltaMs / heartbeatPeriodMs(this.severity)) % 1;
    }
  }

  /** Display alpha 0..1, after fade in/out. */
  getAlpha(): number {
    return this.alpha;
  }

  /** Heartbeat waveform 0..1 at the current phase. */
  getPulse(): number {
    return heartbeatPulse(this.phase);
  }
}

/**
 * Draws the red screen vignette. `alpha` is the faded display alpha (0..1) and
 * `pulse` the heartbeat waveform (0..1) from `NearMissVignetteAnimator`.
 * Nothing is drawn at alpha 0.
 */
export function drawNearMissVignette(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  pulse: number,
): void {
  if (alpha <= 0) {
    return;
  }
  const strength = NEAR_MISS_FX.heartbeatPulseStrength;
  const brightness = alpha * (1 - strength + strength * clamp01(pulse));
  const edgeAlpha = NEAR_MISS_FX.maxVignetteAlpha * brightness;
  ctx.save();
  const gradient = ctx.createRadialGradient(
    BOARD.width / 2,
    BOARD.height / 2,
    BOARD.height * 0.35,
    BOARD.width / 2,
    BOARD.height / 2,
    BOARD.height * 0.75,
  );
  gradient.addColorStop(0, `rgba(${PALETTE.nearMissVignetteRgb}, 0)`);
  gradient.addColorStop(1, `rgba(${PALETTE.nearMissVignetteRgb}, ${edgeAlpha.toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.restore();
}

/** Smooth "lub" bump centred on `center`, wrapping around the cycle. */
function beatBump(phase: number, center: number): number {
  const direct = Math.abs(phase - center);
  const distance = Math.min(direct, 1 - direct);
  const width = NEAR_MISS_FX.heartbeatBeatWidth;
  if (distance >= width) {
    return 0;
  }
  const t = 1 - distance / width;
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
