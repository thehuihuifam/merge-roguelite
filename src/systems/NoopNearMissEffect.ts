import type { INearMissEffect } from '@/core/interfaces/INearMissEffect';
import type { NearMissSample } from '@/core/types';

/** v0.1.0 default: records intensity so the renderer can tint the danger line, nothing else. */
export class NoopNearMissEffect implements INearMissEffect {
  private intensity = 0;

  onNearMissEnter(sample: NearMissSample): void {
    this.intensity = sample.severity;
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
