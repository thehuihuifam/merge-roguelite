export interface SlowMotionState {
  readonly active: boolean;
  readonly timeScale: number;
  readonly remainingMs: number;
}

/**
 * Converts real elapsed time into game time. Slow motion is expressed as a
 * temporary time scale; the physics world only ever sees scaled time.
 */
export class TimeController {
  private scale = 1;
  private slowMoRemainingMs = 0;
  private slowMoScale = 1;
  private elapsedGameMs = 0;

  get timeScale(): number {
    return this.slowMoRemainingMs > 0 ? this.slowMoScale : this.scale;
  }

  get gameTimeMs(): number {
    return this.elapsedGameMs;
  }

  get slowMotion(): SlowMotionState {
    return {
      active: this.slowMoRemainingMs > 0,
      timeScale: this.timeScale,
      remainingMs: this.slowMoRemainingMs,
    };
  }

  setBaseScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new RangeError(`timeScale must be a positive number, got ${scale}`);
    }
    this.scale = scale;
  }

  startSlowMotion(durationMs: number, timeScale: number): void {
    if (durationMs <= 0 || timeScale <= 0 || timeScale > 1) {
      throw new RangeError(`Invalid slow motion: duration=${durationMs} scale=${timeScale}`);
    }
    this.slowMoRemainingMs = Math.max(this.slowMoRemainingMs, durationMs);
    this.slowMoScale = Math.min(this.slowMoScale === 1 ? timeScale : this.slowMoScale, timeScale);
  }

  cancelSlowMotion(): void {
    this.slowMoRemainingMs = 0;
    this.slowMoScale = 1;
  }

  /** Advances by real time and returns the amount of game time that passed. */
  advance(realDeltaMs: number): number {
    const delta = Math.max(0, realDeltaMs);
    const scaled = delta * this.timeScale;
    if (this.slowMoRemainingMs > 0) {
      this.slowMoRemainingMs = Math.max(0, this.slowMoRemainingMs - delta);
      if (this.slowMoRemainingMs === 0) {
        this.slowMoScale = 1;
      }
    }
    this.elapsedGameMs += scaled;
    return scaled;
  }

  reset(): void {
    this.scale = 1;
    this.slowMoRemainingMs = 0;
    this.slowMoScale = 1;
    this.elapsedGameMs = 0;
  }
}
