import { TRANSITIONS } from '@/core/state/GameState';
import type { GameState, GameStateEvent } from '@/core/state/GameState';

export type StateChangeListener = (from: GameState, to: GameState, event: GameStateEvent) => void;

export class InvalidTransitionError extends Error {
  constructor(
    readonly state: GameState,
    readonly event: GameStateEvent,
  ) {
    super(`Invalid transition: event "${event}" is not allowed in state "${state}"`);
    this.name = 'InvalidTransitionError';
  }
}

export class GameStateMachine {
  private current: GameState;
  private readonly listeners = new Set<StateChangeListener>();

  constructor(initial: GameState = 'idle') {
    this.current = initial;
  }

  get state(): GameState {
    return this.current;
  }

  is(state: GameState): boolean {
    return this.current === state;
  }

  can(event: GameStateEvent): boolean {
    return TRANSITIONS[this.current][event] !== undefined;
  }

  /** Applies the event, throwing when the transition is not allowed. */
  send(event: GameStateEvent): GameState {
    const next = TRANSITIONS[this.current][event];
    if (next === undefined) {
      throw new InvalidTransitionError(this.current, event);
    }
    const from = this.current;
    this.current = next;
    for (const listener of Array.from(this.listeners)) {
      listener(from, next, event);
    }
    return next;
  }

  /** Applies the event only when allowed; returns whether a transition happened. */
  trySend(event: GameStateEvent): boolean {
    if (!this.can(event)) {
      return false;
    }
    this.send(event);
    return true;
  }

  onChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }
}
