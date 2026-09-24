import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, PHYSICS_STEP_MS, SLOW_MOTION } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import { TimeController } from '@/core/time/TimeController';
import { SlowMotionNearMissEffect } from '@/systems/SlowMotionNearMissEffect';
import type { NearMissSample } from '@/core/types';

function sample(severity: number): NearMissSample {
  return { severity, ballId: 1, distanceToLine: 0 };
}

function advance(game: Game, ms: number): void {
  const steps = Math.ceil(ms / PHYSICS_STEP_MS);
  for (let i = 0; i < steps; i += 1) {
    game.update(PHYSICS_STEP_MS);
  }
}

function settle(game: Game, maxMs = 6000): void {
  let elapsed = 0;
  while (elapsed < maxMs) {
    advance(game, PHYSICS_STEP_MS);
    elapsed += PHYSICS_STEP_MS;
    if (game.state === 'aiming' && game.isSettled()) {
      return;
    }
    if (game.state === 'game_over') {
      return;
    }
  }
}

describe('SlowMotionNearMissEffect', () => {
  let game: Game | undefined;

  afterEach(() => {
    game?.dispose();
    game = undefined;
  });

  it('drops the time scale on enter and restores it after the slow-motion window', () => {
    const time = new TimeController();
    const effect = new SlowMotionNearMissEffect(time);

    effect.onNearMissEnter(sample(1));
    expect(time.timeScale).toBe(SLOW_MOTION.timeScale);
    expect(time.timeScale).toBe(0.25);
    expect(time.slowMotion.active).toBe(true);

    effect.onNearMissExit();
    expect(effect.getIntensity()).toBe(0);
    time.advance(SLOW_MOTION.durationMs);
    expect(time.timeScale).toBe(1);
    expect(time.slowMotion.active).toBe(false);
  });

  it('reports the sample severity through getIntensity and clears it on exit', () => {
    const time = new TimeController();
    const effect = new SlowMotionNearMissEffect(time);

    effect.onNearMissEnter(sample(0.4));
    expect(effect.getIntensity()).toBe(0.4);
    effect.onNearMissUpdate(sample(0.9));
    expect(effect.getIntensity()).toBe(0.9);
    effect.onNearMissExit();
    expect(effect.getIntensity()).toBe(0);
  });

  it('does not extend the slow-motion window while the near miss continues', () => {
    const time = new TimeController();
    const effect = new SlowMotionNearMissEffect(time);

    effect.onNearMissEnter(sample(0.5));
    time.advance(200);
    expect(time.slowMotion.remainingMs).toBe(SLOW_MOTION.durationMs - 200);
    effect.onNearMissUpdate(sample(0.7));
    expect(time.slowMotion.remainingMs).toBe(SLOW_MOTION.durationMs - 200);
  });

  it('slows the shared Game time when a ball rests near the danger line', () => {
    const time = new TimeController();
    game = new Game({
      timeController: time,
      nearMissEffect: new SlowMotionNearMissEffect(time),
      // Move the warning zone down to the floor so a resting ball triggers it.
      overflowDetector: new OverflowDetector({ dangerLineY: BOARD.height - 100 }),
    });

    expect(game.time).toBe(time);
    game.start(2024);
    game.setAimX(BOARD.width / 2);
    game.drop();
    settle(game);

    expect(game.state).toBe('aiming');
    expect(game.getSnapshot().timeScale).toBe(SLOW_MOTION.timeScale);
    expect(game.getSnapshot().nearMissIntensity).toBeGreaterThan(0);
    expect(game.getSnapshot().nearMissIntensity).toBeLessThanOrEqual(1);
  });
});
