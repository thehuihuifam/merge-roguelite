import type { NearMissSample } from '@/core/types';

/**
 * Extension point for the near-miss presentation (slow motion + red vignette + heartbeat).
 * The core fires these hooks; renderers, audio and time systems react.
 */
export interface INearMissEffect {
  onNearMissEnter(sample: NearMissSample): void;
  onNearMissUpdate(sample: NearMissSample): void;
  onNearMissExit(): void;
  /** Current visual intensity 0..1, sampled by the renderer each frame. */
  getIntensity(): number;
}
