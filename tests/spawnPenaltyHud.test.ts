import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, MERGE_CARDS, PHYSICS_STEP_MS, SPAWN_PENALTY_HUD } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import { drawSpawnPenaltyHud } from '@/render/SpawnPenaltyHudRenderer';
import { createSpawnLargerBallsCard } from '@/systems/cards/SpawnLargerBallsCard';

const SEED = 4242;
/** Bottom edge of the NEXT preview ball (label y=12, 24px font, preview at y=48). */
const NEXT_PREVIEW_BOTTOM = 66;

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
    if (game.state === 'game_over' || (game.state === 'aiming' && game.isSettled())) {
      return;
    }
  }
}

/** One issued ball: drop, wait out the cooldown, read the new preview. */
function dropAndSettle(game: Game): void {
  game.drop();
  settle(game);
}

function createStubContext(): { ctx: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = [];
  const noop = (): void => {
    return;
  };
  const stub = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: '',
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    fillText: (text: string): void => {
      texts.push(text);
    },
  };
  return { ctx: stub as unknown as CanvasRenderingContext2D, texts };
}

describe('GameSnapshot.spawnPenalty', () => {
  let game: Game;

  afterEach(() => {
    game.dispose();
  });

  it('is absent while no spawn penalty is active', () => {
    game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);

    expect('spawnPenalty' in game.getSnapshot()).toBe(false);
  });

  it('reports the floor and the remaining new balls once the card is applied', () => {
    game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);

    expect(game.applyRewardCard(createSpawnLargerBallsCard())).toBe(true);

    expect(game.getSnapshot().spawnPenalty).toEqual({
      floor: MERGE_CARDS.spawnLargerBallsFloor,
      remainingCount: MERGE_CARDS.spawnLargerBallsCount,
    });
  });

  it('counts down one per issued ball and disappears when spent', () => {
    game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);
    game.applyRewardCard(createSpawnLargerBallsCard());

    dropAndSettle(game);
    expect(game.getSnapshot().spawnPenalty?.remainingCount).toBe(
      MERGE_CARDS.spawnLargerBallsCount - 1,
    );

    dropAndSettle(game);
    expect(game.getSnapshot().spawnPenalty?.remainingCount).toBe(1);

    dropAndSettle(game);
    expect('spawnPenalty' in game.getSnapshot()).toBe(false);
  });

  it('hands out copies, so a renderer cannot poke at the live state', () => {
    game = new Game({ specialSpawnChance: 0 });
    game.start(SEED);
    game.applyRewardCard(createSpawnLargerBallsCard());

    const first = game.getSnapshot().spawnPenalty;
    const second = game.getSnapshot().spawnPenalty;

    expect(first).not.toBe(second);
    expect(first).toEqual(second);

    (first as { remainingCount: number }).remainingCount = 0;
    expect(game.getSnapshot().spawnPenalty?.remainingCount).toBe(MERGE_CARDS.spawnLargerBallsCount);
  });

  it('clears the field when the run restarts', () => {
    const lowLine = new OverflowDetector({ dangerLineY: BOARD.height - 140, graceMs: 300 });
    game = new Game({ overflowDetector: lowLine, specialSpawnChance: 0 });
    game.start(SEED);
    game.applyRewardCard(createSpawnLargerBallsCard());
    expect(game.getSnapshot().spawnPenalty).toBeDefined();

    const columns = [40, BOARD.width - 40, BOARD.width / 2];
    for (let i = 0; i < 80 && game.state !== 'game_over'; i += 1) {
      game.setAimX(columns[i % columns.length] ?? 40);
      game.drop();
      settle(game, 1200);
    }
    expect(game.state).toBe('game_over');

    game.restart(SEED);
    expect('spawnPenalty' in game.getSnapshot()).toBe(false);
  });
});

describe('drawSpawnPenaltyHud', () => {
  it('draws the remaining count and the tier floor while the penalty is active', () => {
    const { ctx, texts } = createStubContext();

    drawSpawnPenaltyHud(ctx, { floor: 3, remainingCount: 2 });

    expect(texts).toEqual(['HEAVY DROPS', '2 LEFT · TIER 3+']);
  });

  it('draws nothing for an expired penalty', () => {
    const { ctx, texts } = createStubContext();

    drawSpawnPenaltyHud(ctx, { floor: 3, remainingCount: 0 });

    expect(texts).toHaveLength(0);
  });

  it('sits below the NEXT preview so it never overlaps the top-right HUD', () => {
    expect(SPAWN_PENALTY_HUD.labelY).toBeGreaterThan(NEXT_PREVIEW_BOTTOM);
    expect(SPAWN_PENALTY_HUD.valueY).toBeGreaterThan(SPAWN_PENALTY_HUD.labelY);
    // Right column: shares the NEXT margin, far away from the left-aligned ROUND text.
    expect(BOARD.width - SPAWN_PENALTY_HUD.rightMargin).toBeGreaterThan(BOARD.width / 2);
  });
});
