import type {
  ISpecialBallBehavior,
  ISpecialBallRegistry,
  SpecialBallKind,
} from '@/core/interfaces/ISpecialBall';

/**
 * Lookup from special kind to its behavior (Task 2.3). `Game` consults it in
 * front of the merge rules and executes host-side effects such as detonation.
 * Behaviors can be registered after construction, so they may depend on the
 * running game (event bus, ...).
 */
export class SpecialBallRegistry implements ISpecialBallRegistry {
  private readonly behaviors = new Map<SpecialBallKind, ISpecialBallBehavior>();

  register(behavior: ISpecialBallBehavior): void {
    this.behaviors.set(behavior.kind, behavior);
  }

  get(kind: SpecialBallKind): ISpecialBallBehavior | undefined {
    return this.behaviors.get(kind);
  }
}
