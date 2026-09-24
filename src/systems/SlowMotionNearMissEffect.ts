import { SLOW_MOTION } from '@/config/gameConfig';
import type { INearMissEffect } from '@/core/interfaces/INearMissEffect';
import type { TimeController } from '@/core/time/TimeController';
import type { NearMissSample } from '@/core/types';

/**
 * Near-miss presentation (v0.2.0, first implementation): when a ball comes to
 * rest inside the warning zone below the danger line, the shared game time
 * drops into the slow-motion window so the "almost lost the run" moment reads
 * clearly. Severity is stored as-is and exposed via `getIntensity()` for the
 * renderer's red vignette and danger-line tint.
 */
export class SlowMotionNearMissEffect implements INearMissEffect {
  private readonly time: TimeController;
  private intensity = 0;

  constructor(time: TimeController) {
    this.time = time;
  }

  onNearMissEnter(sample: NearMissSample): void {
    this.intensity = sample.severity;
    this.time.startSlowMotion(SLOW_MOTION.durationMs, SLOW_MOTION.timeScale);
  }

  onNearMissUpdate(sample: NearMissSample): void {
    this.intensity = sample.severity;
  }

  onNearMissExit(): void {
    this.intensity = 0;
  }

  getIntensity(): number {
    return this.intensity;
  }
}
