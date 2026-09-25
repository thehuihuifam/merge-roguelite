import { describe, expect, it } from 'vitest';
import { MERGE_CARDS, PHYSICS_STEP_MS } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { BasicMergeCardProvider } from '@/systems/cards/BasicMergeCardProvider';
import {
  SPAWN_LARGER_BALLS_CARD_ID,
  createSpawnLargerBallsCard,
} from '@/systems/cards/SpawnLargerBallsCard';
import { SeededRandom } from '@/core/rng/SeededRandom';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import type { MergeCardContext, RiskCard } from '@/core/interfaces/IMergeCard';
import type { MergeEvent } from '@/core/types';

function mergeEvent(): MergeEvent {
  return {
    sourceIds: [-1, -1],
    resultTier: 2,
    position: { x: 240, y: 360 },
    chainIndex: 0,
    scoreGained: 16,
  };
}

interface Recording {
  readonly floors: [number, number][];
  readonly multipliers: [number, number][];
  readonly scoreDeltas: number[];
  readonly dangerShifts: number[];
}

function recordingContext(options: { withFloor?: boolean } = {}): {
  context: MergeCardContext;
  recording: Recording;
} {
  const recording: Recording = { floors: [], multipliers: [], scoreDeltas: [], dangerShifts: [] };
  const context: MergeCardContext = {
    merge: mergeEvent(),
    currentScore: 100,
    addScore: (delta: number): void => {
      recording.scoreDeltas.push(delta);
    },
    pushScoreMultiplier: (multiplier: number, remainingMerges: number): void => {
      recording.multipliers.push([multiplier, remainingMerges]);
    },
    shiftDangerLine: (deltaY: number): void => {
      recording.dangerShifts.push(deltaY);
    },
    ...(options.withFloor === false
      ? {}
      : {
          raiseSpawnTierFloor: (minTier: number, count: number): void => {
            recording.floors.push([minTier, count]);
          },
        }),
  };
  return { context, recording };
}

function advance(game: Game, ms: number): void {
  const steps = Math.ceil(ms / PHYSICS_STEP_MS);
  for (let i = 0; i < steps; i += 1) {
    game.update(PHYSICS_STEP_MS);
  }
}

function dropOnce(game: Game, index: number): number {
  const xs = [60, 160, 240, 320, 420];
  game.setAimX(xs[index % xs.length] ?? 60);
  game.drop();
  let elapsed = 0;
  while (elapsed < 4000) {
    advance(game, PHYSICS_STEP_MS);
    elapsed += PHYSICS_STEP_MS;
    if ((game.state === 'aiming' && game.isSettled()) || game.state === 'game_over') {
      break;
    }
  }
  return game.getSnapshot().nextTier;
}

describe('SpawnLargerBallsCard', () => {
  const card: RiskCard = createSpawnLargerBallsCard();

  it('is the spawn_larger_balls risk card with a self-describing text', () => {
    expect(card.id).toBe(SPAWN_LARGER_BALLS_CARD_ID);
    expect(card.kind).toBe('risk');
    expect(card.penalty).toBe('spawn_larger_balls');
    expect(isRiskCard(card)).toBe(true);
    expect(card.description).toContain(`tier ${MERGE_CARDS.spawnLargerFloorTier}`);
    expect(card.description).toContain(`${MERGE_CARDS.spawnLargerSpawns} spawns`);
    expect(card.description).toContain(`×${MERGE_CARDS.spawnLargerMultiplier}`);
  });

  it('charges the floor penalty and the multiplier reward on a capable context', () => {
    const { context, recording } = recordingContext();

    card.apply(context);

    expect(recording.floors).toEqual([
      [MERGE_CARDS.spawnLargerFloorTier, MERGE_CARDS.spawnLargerSpawns],
    ]);
    expect(recording.multipliers).toEqual([
      [MERGE_CARDS.spawnLargerMultiplier, MERGE_CARDS.spawnLargerMultiplierUses],
    ]);
    expect(recording.scoreDeltas).toEqual([]);
    expect(recording.dangerShifts).toEqual([]);
  });

  it('refuses to apply on a context without floor support (no free reward)', () => {
    const { context, recording } = recordingContext({ withFloor: false });

    card.apply(context);

    expect(recording.floors).toEqual([]);
    expect(recording.multipliers).toEqual([]);
    expect(recording.scoreDeltas).toEqual([]);
    expect(recording.dangerShifts).toEqual([]);
  });

  it('keeps seeded draws deterministic with the enlarged deck', () => {
    const merge = mergeEvent();
    const first = new BasicMergeCardProvider(new SeededRandom(11)).draw(merge, 3, 1);
    const second = new BasicMergeCardProvider(new SeededRandom(11)).draw(merge, 3, 1);

    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id));
    expect(first.filter(isRiskCard)).toHaveLength(1);
  });

  it('deck holds three distinct risk cards, HEAVY LOAD among them', () => {
    const hand = new BasicMergeCardProvider(new SeededRandom(3)).draw(mergeEvent(), 3, 3);

    const riskIds = hand.filter(isRiskCard).map((entry) => entry.id);
    expect(riskIds).toHaveLength(3);
    expect(new Set(riskIds).size).toBe(3);
    expect(riskIds).toContain(SPAWN_LARGER_BALLS_CARD_ID);
  });

  it('raises the real game spawn floor end to end', () => {
    const game = new Game({ specialSpawnChance: 0 });
    game.start(42);

    expect(game.applyRewardCard(createSpawnLargerBallsCard())).toBe(true);
    for (let i = 0; i < MERGE_CARDS.spawnLargerSpawns; i += 1) {
      expect(dropOnce(game, i)).toBeGreaterThanOrEqual(MERGE_CARDS.spawnLargerFloorTier);
    }
    game.dispose();
  });
});
