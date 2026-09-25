import { describe, expect, it } from 'vitest';
import { ModifierStack } from '@/core/score/ModifierStack';
import type { ScoreContext } from '@/core/interfaces/IScoreModifier';

function ctx(): ScoreContext {
  return { resultTier: 0, chainIndex: 0, currentScore: 0 };
}

describe('ModifierStack', () => {
  it('applies a single multiplier', () => {
    const stack = new ModifierStack();
    stack.push('x2', 2, 1);
    expect(stack.activeCount).toBe(1);
    expect(stack.apply(10, ctx())).toBe(20);
  });

  it('expires after remaining merges are consumed', () => {
    const stack = new ModifierStack();
    stack.push('x2', 2, 2);
    expect(stack.apply(10, ctx())).toBe(20);
    expect(stack.activeCount).toBe(1);
    expect(stack.apply(10, ctx())).toBe(20);
    expect(stack.activeCount).toBe(0);
    expect(stack.apply(10, ctx())).toBe(10);
  });

  it('stacks multiple multipliers', () => {
    const stack = new ModifierStack();
    stack.push('x2', 2, 2);
    stack.push('x3', 3, 1);
    // 10 *2 *3 =60
    expect(stack.apply(10, ctx())).toBe(60);
    // x3 expired, x2 remains
    expect(stack.activeCount).toBe(1);
    expect(stack.apply(10, ctx())).toBe(20);
    expect(stack.activeCount).toBe(0);
  });

  it('detach removes entry early', () => {
    const stack = new ModifierStack();
    const detach = stack.push('x2', 2, 5);
    expect(stack.activeCount).toBe(1);
    detach();
    expect(stack.activeCount).toBe(0);
    expect(stack.apply(10, ctx())).toBe(10);
  });

  it('clear removes all', () => {
    const stack = new ModifierStack();
    stack.push('x2', 2, 2);
    stack.push('x3', 3, 2);
    stack.clear();
    expect(stack.activeCount).toBe(0);
    expect(stack.apply(10, ctx())).toBe(10);
  });

  it('supports time-based expiry via update', () => {
    const stack = new ModifierStack();
    stack.push('timed', 2, 10, 100);
    expect(stack.activeCount).toBe(1);
    stack.update(50);
    expect(stack.activeCount).toBe(1);
    stack.update(60);
    expect(stack.activeCount).toBe(0);
  });

  it('asModifier delegates to apply', () => {
    const stack = new ModifierStack();
    stack.push('x2', 2, 1);
    const modifier = stack.asModifier();
    expect(modifier.id).toBe('modifier-stack');
    expect(modifier.modify(5, ctx())).toBe(10);
    expect(stack.activeCount).toBe(0);
  });

  it('rejects invalid multiplier or remaining', () => {
    const stack = new ModifierStack();
    expect(() => stack.push('bad', 0, 1)).toThrow(RangeError);
    expect(() => stack.push('bad', -1, 1)).toThrow(RangeError);
    expect(() => stack.push('bad', 2, 0)).not.toThrow(); // clamp to 1
  });

  it('integrates with ScoreCalculator via Game-like flow', () => {
    const stack = new ModifierStack();
    const modifier = stack.asModifier();
    let points = 10;
    stack.push('x2', 2, 2);
    points = modifier.modify(points, ctx());
    expect(points).toBe(20);
    points = 10;
    points = modifier.modify(points, ctx());
    expect(points).toBe(20);
    points = 10;
    points = modifier.modify(points, ctx());
    expect(points).toBe(10);
  });
});
