import { describe, expect, it } from 'vitest';
import { TimeController } from '@/core/time/TimeController';

describe('TimeController', () => {
  it('passes time through 1:1 by default', () => {
    const time = new TimeController();
    expect(time.advance(16)).toBe(16);
    expect(time.gameTimeMs).toBe(16);
  });

  it('scales game time during slow motion and restores afterwards', () => {
    const time = new TimeController();
    time.startSlowMotion(400, 0.25);
    expect(time.timeScale).toBe(0.25);
    expect(time.advance(100)).toBe(25);
    expect(time.slowMotion.remainingMs).toBe(300);
    time.advance(300);
    expect(time.slowMotion.active).toBe(false);
    expect(time.timeScale).toBe(1);
    expect(time.advance(10)).toBe(10);
  });

  it('extends rather than shortens an active slow motion', () => {
    const time = new TimeController();
    time.startSlowMotion(400, 0.5);
    time.startSlowMotion(100, 0.25);
    expect(time.slowMotion.remainingMs).toBe(400);
    expect(time.timeScale).toBe(0.25);
  });

  it('validates arguments and can be cancelled', () => {
    const time = new TimeController();
    expect(() => time.startSlowMotion(0, 0.5)).toThrow(RangeError);
    expect(() => time.startSlowMotion(100, 2)).toThrow(RangeError);
    expect(() => time.setBaseScale(0)).toThrow(RangeError);
    time.startSlowMotion(100, 0.5);
    time.cancelSlowMotion();
    expect(time.timeScale).toBe(1);
  });
});
