import { describe, expect, it } from 'vitest';
import { BOARD } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import type { Ball } from '@/core/types';

function ball(id: number, tier: number, y: number, vy = 0): Ball {
  return { id, tier, position: { x: 100, y }, velocity: { x: 0, y: vy }, spawnedAt: 0 };
}

describe('OverflowDetector', () => {
  const lineY = 100;
  const options = { dangerLineY: lineY, warningZoneHeight: 50, graceMs: 500, restingSpeed: 1 };

  it('does not flag balls resting below the line', () => {
    const detector = new OverflowDetector(options);
    const report = detector.update([ball(1, 0, 400)], 1000);
    expect(report.overflow).toBe(false);
    expect(report.nearMiss).toBeNull();
    expect(report.ballsAboveLine).toEqual([]);
  });

  it('flags overflow only after the grace period while resting above the line', () => {
    const detector = new OverflowDetector(options);
    const radius = getTierSpec(0).radius;
    const resting = ball(1, 0, lineY + radius - 5);
    expect(detector.update([resting], 200).overflow).toBe(false);
    expect(detector.update([resting], 200).overflow).toBe(false);
    const report = detector.update([resting], 200);
    expect(report.overflow).toBe(true);
    expect(report.ballsAboveLine).toEqual([1]);
  });

  it('ignores fast-moving balls passing through the danger zone', () => {
    const detector = new OverflowDetector(options);
    const falling = ball(1, 0, 50, 8);
    expect(detector.update([falling], 10000).overflow).toBe(false);
  });

  it('resets the timer when a ball leaves the zone', () => {
    const detector = new OverflowDetector(options);
    const radius = getTierSpec(0).radius;
    detector.update([ball(1, 0, lineY + radius - 5)], 400);
    detector.update([ball(1, 0, 500)], 16);
    expect(detector.update([ball(1, 0, lineY + radius - 5)], 400).overflow).toBe(false);
  });

  it('reports the most severe near miss inside the warning zone', () => {
    const detector = new OverflowDetector(options);
    const radius = getTierSpec(0).radius;
    const far = ball(1, 0, lineY + radius + 40);
    const close = ball(2, 0, lineY + radius + 10);
    const report = detector.update([far, close], 16);
    expect(report.nearMiss?.ballId).toBe(2);
    expect(report.nearMiss?.severity).toBeCloseTo(0.8);
    expect(report.nearMiss?.distanceToLine).toBeCloseTo(10);
  });

  it('moves the threshold down and applies overflow to balls now above it', () => {
    const detector = new OverflowDetector(options);
    const radius = getTierSpec(0).radius;
    const stationary = ball(1, 0, lineY + radius + 5);

    const beforeShift = detector.update([stationary], 500);
    expect(beforeShift.overflow).toBe(false);
    expect(beforeShift.nearMiss?.severity).toBeCloseTo(0.9);

    detector.shiftDangerLine(30);
    expect(detector.lineY).toBe(lineY + 30);
    const afterShift = detector.update([stationary], 500);
    expect(afterShift.overflow).toBe(true);
    expect(afterShift.nearMiss?.severity).toBe(1);
  });

  it('clamps line movement to the board and rejects non-finite shifts', () => {
    const detector = new OverflowDetector(options);

    expect(() => detector.shiftDangerLine(Number.NaN)).toThrow(RangeError);
    expect(() => detector.shiftDangerLine(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    detector.shiftDangerLine(BOARD.height * 2);
    expect(detector.lineY).toBe(BOARD.height);
    detector.shiftDangerLine(-BOARD.height * 2);
    expect(detector.lineY).toBe(0);
  });

  it('restores the configured line after reset', () => {
    const detector = new OverflowDetector(options);
    detector.shiftDangerLine(25);
    expect(detector.lineY).toBe(lineY + 25);

    detector.reset();

    expect(detector.lineY).toBe(lineY);
  });

  it('forgets balls that disappeared', () => {
    const detector = new OverflowDetector(options);
    const radius = getTierSpec(0).radius;
    detector.update([ball(1, 0, lineY + radius - 5)], 400);
    detector.update([], 16);
    expect(detector.update([ball(1, 0, lineY + radius - 5)], 400).overflow).toBe(false);
  });
});
