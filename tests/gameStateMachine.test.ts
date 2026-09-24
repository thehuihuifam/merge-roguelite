import { describe, expect, it } from 'vitest';
import { GameStateMachine, InvalidTransitionError } from '@/core/state/GameStateMachine';

describe('GameStateMachine', () => {
  it('starts idle and follows the happy path', () => {
    const fsm = new GameStateMachine();
    expect(fsm.state).toBe('idle');
    expect(fsm.send('start')).toBe('aiming');
    expect(fsm.send('drop')).toBe('dropping');
    expect(fsm.send('settle')).toBe('aiming');
  });

  it('supports the slow-motion selection detour from both active states', () => {
    const fromDropping = new GameStateMachine('dropping');
    expect(fromDropping.send('mergeMoment')).toBe('slowmo_select');
    expect(fromDropping.send('resumeDropping')).toBe('dropping');

    const fromAiming = new GameStateMachine('aiming');
    expect(fromAiming.send('mergeMoment')).toBe('slowmo_select');
    expect(fromAiming.send('resumeAiming')).toBe('aiming');
  });

  it('can overflow from any active state and restart from game_over', () => {
    for (const state of ['aiming', 'dropping', 'slowmo_select'] as const) {
      const fsm = new GameStateMachine(state);
      expect(fsm.send('overflow')).toBe('game_over');
      expect(fsm.send('restart')).toBe('aiming');
    }
  });

  it('rejects invalid transitions', () => {
    const fsm = new GameStateMachine();
    expect(fsm.can('drop')).toBe(false);
    expect(() => fsm.send('drop')).toThrow(InvalidTransitionError);
    expect(fsm.trySend('drop')).toBe(false);
    expect(fsm.state).toBe('idle');
  });

  it('notifies listeners and supports unsubscribe', () => {
    const fsm = new GameStateMachine();
    const seen: string[] = [];
    const off = fsm.onChange((from, to, event) => {
      seen.push(`${from}->${to}:${event}`);
    });
    fsm.send('start');
    off();
    fsm.send('drop');
    expect(seen).toEqual(['idle->aiming:start']);
  });
});
