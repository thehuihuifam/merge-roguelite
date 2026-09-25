import { describe, expect, it } from 'vitest';
import { BOARD, DANGER_LINE_Y, PHYSICS_STEP_MS, DESIGN } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import { SPAWN_PENALTY_HUD } from '@/config/gameConfig';
import { drawSpawnPenaltyHud } from '@/render/SpawnPenaltyHudRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { MergeCardContext, RiskCard } from '@/core/interfaces/IMergeCard';

/** Bottom edge of the NEXT preview ball in the HUD (see HudRenderer). */
const NEXT_PREVIEW_BOTTOM = 48 + 18;

function floorCard(): RiskCard {
  return {
    id: 'test-spawn-floor-hud',
    kind: 'risk',
    penalty: 'spawn_larger_balls',
    severity: 0.6,
    title: 'HEAVY LOAD',
    description: 'Next 3 spawns are tier 3+.',
    apply: (context: MergeCardContext): void => {
      context.raiseSpawnTierFloor?.(3, 3);
    },
  };
}

function advance(game: Game, ms: number): void {
  const steps = Math.ceil(ms / PHYSICS_STEP_MS);
  for (let i = 0; i < steps; i += 1) {
    game.update(PHYSICS_STEP_MS);
  }
}

function settle(game: Game, maxMs = 4000): void {
  let elapsed = 0;
  while (elapsed < maxMs) {
    advance(game, PHYSICS_STEP_MS);
    elapsed += PHYSICS_STEP_MS;
    if ((game.state === 'aiming' && game.isSettled()) || game.state === 'game_over') {
      return;
    }
  }
}

function dropOnce(game: Game, index: number): void {
  const xs = [60, 160, 240, 320, 420];
  game.setAimX(xs[index % xs.length] ?? 60);
  game.drop();
  settle(game);
}

function baseSnapshot(): GameSnapshot {
  return {
    state: 'aiming',
    score: 0,
    best: 0,
    balls: [],
    held: null,
    nextTier: 0,
    dangerLineY: DANGER_LINE_Y,
    nearMissIntensity: 0,
    timeScale: 1,
    pendingCards: [],
    seed: 1,
    chainIndex: 0,
    nextSpecial: null,
  };
}

/** Records the text the HUD renderer emits so the Node suite can assert on it. */
function createStubContext(): { ctx: CanvasRenderingContext2D; texts: string[]; styles: string[] } {
  const texts: string[] = [];
  const styles: string[] = [];
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
    beginPath: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    fillText: (text: string): void => {
      texts.push(text);
      styles.push(String(stub.fillStyle));
    },
  };
  return { ctx: stub as unknown as CanvasRenderingContext2D, texts, styles };
}

describe('GameSnapshot.spawnPenalty', () => {
  it('exposes the active penalty as read-only HUD data', () => {
    const game = new Game({ specialSpawnChance: 0 });
    game.start(42);

    expect('spawnPenalty' in game.getSnapshot()).toBe(false);
    expect(game.applyRewardCard(floorCard())).toBe(true);

    expect(game.getSnapshot().spawnPenalty).toEqual({ minTier: 3, remainingIssuances: 3 });
    game.dispose();
  });

  it('counts the remaining issuances down and hides the field once expired', () => {
    const game = new Game({ specialSpawnChance: 0 });
    game.start(42);
    expect(game.applyRewardCard(floorCard())).toBe(true);

    for (let i = 0; i < 2; i += 1) {
      dropOnce(game, i);
      expect(game.getSnapshot().spawnPenalty?.remainingIssuances).toBe(3 - (i + 1));
    }
    dropOnce(game, 2);
    expect('spawnPenalty' in game.getSnapshot()).toBe(false);
    game.dispose();
  });

  it('hides the field after a restart', () => {
    const lowLine = new OverflowDetector({ dangerLineY: BOARD.height - 140, graceMs: 50 });
    const game = new Game({ overflowDetector: lowLine, specialSpawnChance: 0 });
    game.start(42);
    dropOnce(game, 0);
    expect(game.applyRewardCard(floorCard())).toBe(true);
    for (let i = 1; i < 90 && game.state !== 'game_over'; i += 1) {
      dropOnce(game, i);
    }
    expect(game.state).toBe('game_over');

    game.restart(42);
    expect('spawnPenalty' in game.getSnapshot()).toBe(false);
    game.dispose();
  });
});

describe('drawSpawnPenaltyHud', () => {
  it('shows the forced tier and the remaining issuances while active', () => {
    const { ctx, texts, styles } = createStubContext();
    const snapshot = { ...baseSnapshot(), spawnPenalty: { minTier: 3, remainingIssuances: 2 } };

    drawSpawnPenaltyHud(ctx, snapshot);

    expect(texts).toEqual(['스폰 ≥3 · 2개 남음']);
    expect(styles).toEqual([PALETTE.card.riskText]);
  });

  it('draws nothing while the penalty field is absent', () => {
    const { ctx, texts } = createStubContext();

    drawSpawnPenaltyHud(ctx, baseSnapshot());

    expect(texts).toEqual([]);
  });

  it('sits below the NEXT preview and above the danger line, clear of ROUND', () => {
    // Vertical band must fit between the NEXT preview and the danger line;
    // ROUND is drawn on the left column at the same height, so the spawn HUD
    // must stay right-aligned.
    expect(SPAWN_PENALTY_HUD.y).toBeGreaterThanOrEqual(NEXT_PREVIEW_BOTTOM);
    expect(SPAWN_PENALTY_HUD.y + DESIGN.fontSize.caption).toBeLessThanOrEqual(DANGER_LINE_Y);
    expect(SPAWN_PENALTY_HUD.x).toBe(BOARD.width - 14);
    expect(SPAWN_PENALTY_HUD.x).toBeGreaterThan(200);
  });
});
