import { MAX_SUBSTEPS_PER_FRAME, PHYSICS_STEP_MS } from '@/config/gameConfig';

export interface GameLoopCallbacks {
  /** Called with a fixed real-time step; may run several times per frame. */
  readonly update: (stepMs: number) => void;
  /** Called once per animation frame after all updates. */
  readonly render: () => void;
}

/** requestAnimationFrame loop with a fixed-step accumulator. */
export class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;

  constructor(private readonly callbacks: GameLoopCallbacks) {}

  get running(): boolean {
    return this.rafId !== null;
  }

  start(): void {
    if (this.rafId !== null) {
      return;
    }
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.rafId === null) {
      return;
    }
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private readonly frame = (now: number): void => {
    const frameDelta = Math.min(250, now - this.lastTime);
    this.lastTime = now;
    this.accumulator += frameDelta;

    let steps = 0;
    while (this.accumulator >= PHYSICS_STEP_MS && steps < MAX_SUBSTEPS_PER_FRAME) {
      this.callbacks.update(PHYSICS_STEP_MS);
      this.accumulator -= PHYSICS_STEP_MS;
      steps += 1;
    }
    if (steps === MAX_SUBSTEPS_PER_FRAME) {
      this.accumulator = 0;
    }

    this.callbacks.render();
    this.rafId = requestAnimationFrame(this.frame);
  };
}
