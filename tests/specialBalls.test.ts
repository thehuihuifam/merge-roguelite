import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, PHYSICS_STEP_MS, SPECIAL_BALLS } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/events/EventBus';
import { getTierSpec } from '@/core/ball/BallFactory';
import {
  BombBallBehavior,
  blastScore,
  blastVictims,
} from '@/systems/special/BombBallBehavior';
import { SpecialBallRegistry } from '@/systems/special/SpecialBallRegistry';
import type { GameEventMap } from '@/core/events/GameEvents';
import type { Ball, BallId } from '@/core/types';

function ballAt(id: number, x: number, y: number): Ball {
  return {
    id,
    tier: 0,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    spawnedAt: 0,
  };
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

describe('BombBallBehavior', () => {
  it('never merges and carries the configured blast radius', () => {
    const behavior = new BombBallBehavior(new EventBus<GameEventMap>());
    expect(behavior.kind).toBe('bomb');
    expect(behavior.blastRadius).toBe(SPECIAL_BALLS.bombBlastRadius);
    expect(behavior.canMergeWith()).toBe(false);
  });

  it('announces its life cycle on the event bus', () => {
    const events = new EventBus<GameEventMap>();
    const behavior = new BombBallBehavior(events);
    const spawns: Ball[] = [];
    const contacts: [Ball, Ball][] = [];
    events.on('bomb:spawned', ({ bomb }): void => {
      spawns.push(bomb);
    });
    events.on('bomb:contact', ({ bomb, other }): void => {
      contacts.push([bomb, other]);
    });

    const bomb = ballAt(1, 10, 10);
    const other = ballAt(2, 20, 10);
    behavior.onSpawn(bomb);
    behavior.onCollide(bomb, other);

    expect(spawns).toEqual([bomb]);
    expect(contacts).toEqual([[bomb, other]]);
  });

  it('guards the never-merge invariant on onMerged', () => {
    const behavior = new BombBallBehavior(new EventBus<GameEventMap>());
    expect(() => behavior.onMerged(ballAt(1, 0, 0))).toThrow(/cannot merge/);
  });

  it('rejects a non-positive blast radius', () => {
    const events = new EventBus<GameEventMap>();
    expect(() => new BombBallBehavior(events, 0)).toThrow(RangeError);
    expect(() => new BombBallBehavior(events, -5)).toThrow(RangeError);
  });
});

describe('blastVictims', () => {
  const bomb = ballAt(1, 100, 100);

  it('takes the bomb and every ball inside the radius', () => {
    const near = ballAt(2, 140, 100);
    const far = ballAt(3, 100, 300);
    const victims = blastVictims(bomb, [bomb, near, far], 90);
    expect(victims.map((ball) => ball.id)).toEqual([1, 2]);
  });

  it('always takes the contacted ball even from outside the radius', () => {
    const contact = ballAt(2, 400, 100);
    const bystander = ballAt(3, 460, 100);
    const victims = blastVictims(bomb, [bomb, contact, bystander], 90, contact);
    expect(victims.map((ball) => ball.id)).toEqual([1, 2]);
  });

  it('clears a whole stack within the blast radius', () => {
    const stack: Ball[] = [bomb, ballAt(2, 100, 60), ballAt(3, 150, 120), ballAt(4, 300, 500)];
    const victims = blastVictims(bomb, stack, 90);
    expect(victims.map((ball) => ball.id)).toEqual([1, 2, 3]);
  });
});

describe('blastScore', () => {
  function ballWithTier(id: number, tier: number): Ball {
    return {
      id,
      tier,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      spawnedAt: 0,
    };
  }

  it('pays the configured share of the removed tier values', () => {
    // Tier 0 is worth 2, tier 4 is worth 32: (2 + 32) * 0.5 = 17.
    const victims = [ballWithTier(1, 0), ballWithTier(2, 4)];
    expect(blastScore(victims, SPECIAL_BALLS.blastScoreRatio)).toBe(17);
  });

  it('rounds the payout to whole points', () => {
    expect(blastScore([ballWithTier(1, 1)], 0.5)).toBe(2);
    expect(blastScore([ballWithTier(1, 0), ballWithTier(2, 1)], 0.5)).toBe(3);
    expect(blastScore([ballWithTier(1, 0)], 0.5)).toBe(1);
  });

  it('pays nothing for an empty blast or a zero ratio', () => {
    expect(blastScore([], SPECIAL_BALLS.blastScoreRatio)).toBe(0);
    expect(blastScore([ballWithTier(1, 3)], 0)).toBe(0);
  });

  it('rejects a negative or non-finite ratio', () => {
    const victims = [ballWithTier(1, 0)];
    expect(() => blastScore(victims, -0.5)).toThrow(RangeError);
    expect(() => blastScore(victims, Number.NaN)).toThrow(RangeError);
  });
});

describe('SpecialBallRegistry', () => {
  it('registers behaviors by kind and replaces duplicates', () => {
    const registry = new SpecialBallRegistry();
    const first = new BombBallBehavior(new EventBus<GameEventMap>(), 10);
    const second = new BombBallBehavior(new EventBus<GameEventMap>(), 20);
    expect(registry.get('bomb')).toBeUndefined();
    registry.register(first);
    expect(registry.get('bomb')).toBe(first);
    registry.register(second);
    expect(registry.get('bomb')).toBe(second);
  });
});

describe('bomb balls in a run', () => {
  let game: Game | undefined;

  afterEach(() => {
    game?.dispose();
    game = undefined;
  });

  function createBombGame(spawnChance: number): { game: Game; specialBalls: SpecialBallRegistry } {
    const specialBalls = new SpecialBallRegistry();
    const created = new Game({ specialBalls, specialSpawnChance: spawnChance });
    specialBalls.register(new BombBallBehavior(created.events));
    return { game: created, specialBalls };
  }

  it('hands out bombs on every drop at spawn chance 1 and announces them', () => {
    const created = createBombGame(1);
    game = created.game;
    const spawned: Ball[] = [];
    game.events.on('bomb:spawned', ({ bomb }): void => {
      spawned.push(bomb);
    });

    game.start(2024);
    expect(game.getSnapshot().held?.special).toBe('bomb');
    expect(game.getSnapshot().nextSpecial).toBe('bomb');
    game.setAimX(BOARD.width / 2);
    game.drop();

    const ball = game.getSnapshot().balls[0];
    expect(ball?.special).toBe('bomb');
    expect(spawned.map((bomb) => bomb.id)).toEqual([ball?.id]);
  });

  it('keeps balls ordinary at spawn chance 0', () => {
    const created = createBombGame(0);
    game = created.game;
    game.start(2024);
    expect(game.getSnapshot().held?.special).toBeNull();
    game.setAimX(BOARD.width / 2);
    game.drop();
    expect(game.getSnapshot().balls[0]?.special).toBeUndefined();
  });

  it('lets a lone resting bomb sit armed without detonating', () => {
    const created = createBombGame(1);
    game = created.game;
    const detonations: BallId[][] = [];
    game.events.on('ball:detonated', ({ removedIds }): void => {
      detonations.push([...removedIds]);
    });

    game.start(2024);
    game.setAimX(BOARD.width / 2);
    game.drop();
    settle(game);

    expect(detonations).toHaveLength(0);
    expect(game.ballCount).toBe(1);
  });

  it('detonates on first contact and removes the blast victims', () => {
    const created = createBombGame(1);
    game = created.game;
    const detonations: { bombId: BallId; removedIds: readonly BallId[] }[] = [];
    const contacts: number[] = [];
    game.events.on('ball:detonated', ({ bombId, removedIds }): void => {
      detonations.push({ bombId, removedIds });
    });
    game.events.on('bomb:contact', (): void => {
      contacts.push(1);
    });

    game.start(2024);
    game.setAimX(BOARD.width / 2);
    game.drop();
    settle(game);
    const first = game.getSnapshot().balls[0]?.id;
    expect(first).not.toBeUndefined();

    game.drop();
    for (let elapsed = 0; elapsed < 6000 && detonations.length === 0; elapsed += PHYSICS_STEP_MS) {
      game.update(PHYSICS_STEP_MS);
    }

    expect(detonations).toHaveLength(1);
    expect(contacts).toHaveLength(1);
    const blast = detonations[0];
    expect(blast?.bombId).toBe(first);
    expect(blast?.removedIds.length).toBeGreaterThanOrEqual(2);
    expect(game.ballCount).toBe(0);
  });

  it('pays half the removed balls’ tier values as blast score', () => {
    const created = createBombGame(1);
    game = created.game;
    const detonations: { removedIds: readonly BallId[]; scoreGained: number }[] = [];
    const scoreDeltas: number[] = [];
    game.events.on('ball:detonated', ({ removedIds, scoreGained }): void => {
      detonations.push({ removedIds, scoreGained });
    });
    game.events.on('score:changed', ({ delta }): void => {
      scoreDeltas.push(delta);
    });

    game.start(2024);
    game.setAimX(BOARD.width / 2);
    game.drop();
    settle(game);
    game.drop();
    // Two bombs, nothing else on the board: read their tiers before the blast.
    const tiers = game.getSnapshot().balls.map((ball) => ball.tier);
    expect(tiers).toHaveLength(2);
    const expected = Math.round(
      tiers.reduce((sum, tier) => sum + getTierSpec(tier).value, 0) *
        SPECIAL_BALLS.blastScoreRatio,
    );

    for (let elapsed = 0; elapsed < 6000 && detonations.length === 0; elapsed += PHYSICS_STEP_MS) {
      game.update(PHYSICS_STEP_MS);
    }

    expect(detonations).toHaveLength(1);
    expect(detonations[0]?.removedIds).toHaveLength(2);
    expect(detonations[0]?.scoreGained).toBe(expected);
    expect(expected).toBeGreaterThan(0);
    expect(game.score).toBe(expected);
    expect(scoreDeltas).toEqual([expected]);
  });
});
