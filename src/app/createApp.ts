import { GameLoop } from '@/app/GameLoop';
import { Game } from '@/core/Game';
import { SeededRandom, createSeed } from '@/core/rng/SeededRandom';
import { TimeController } from '@/core/time/TimeController';
import { PointerInput } from '@/input/PointerInput';
import { CanvasRenderer } from '@/render/CanvasRenderer';
import { cardIndexAt } from '@/render/CardOverlayRenderer';
import { BasicRoundSystem } from '@/systems/BasicRoundSystem';
import { BombBallBehavior } from '@/systems/special/BombBallBehavior';
import { SpecialBallRegistry } from '@/systems/special/SpecialBallRegistry';
import { CardSlowMotionSelector } from '@/systems/CardSlowMotionSelector';
import { LocalStorageSaveSystem } from '@/systems/LocalStorageSaveSystem';
import { RoundRunner } from '@/systems/RoundRunner';
import { SlowMotionNearMissEffect } from '@/systems/SlowMotionNearMissEffect';
import { BasicMergeCardProvider } from '@/systems/cards/BasicMergeCardProvider';
import { createRoundClearRewardCard } from '@/systems/cards/RoundClearRewardCard';
import type { RoundDefinition } from '@/core/interfaces/IRoundSystem';
import type { MergeCard } from '@/core/interfaces/IMergeCard';

export interface App {
  readonly game: Game;
  readonly start: () => void;
  readonly dispose: () => void;
}

/** Wires core, physics, rendering, input and the frame loop together. */
export function createApp(root: HTMLElement): App {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.setAttribute('aria-label', 'Merge Roguelite board');
  root.appendChild(canvas);

  const time = new TimeController();
  // Card draws run on their own seeded stream, reseeded per run so that the
  // same run seed always offers the same hands.
  const cardRandom = new SeededRandom(createSeed());
  const cardProvider = new BasicMergeCardProvider(cardRandom);
  const slowMotionSelector = new CardSlowMotionSelector(cardProvider);
  // Persistent save (Task 2.4): best score, total runs, last seed.
  const saveSystem = new LocalStorageSaveSystem();
  const saved = saveSystem.load();
  // Special balls (Task 2.3): register after construction so behaviors can
  // announce their life-cycle on the game's event bus.
  const specialBalls = new SpecialBallRegistry();
  const game = new Game({
    timeController: time,
    nearMissEffect: new SlowMotionNearMissEffect(time),
    slowMotionSelector,
    specialBalls,
    initialBest: saved.bestScore,
  });
  specialBalls.register(new BombBallBehavior(game.events));
  game.events.on('run:started', ({ seed }) => {
    cardRandom.reseed(seed);
    try {
      const current = saveSystem.load();
      saveSystem.save({ ...current, lastSeed: seed });
    } catch {
      // Ignore storage errors — game remains playable.
    }
  });
  game.events.on('run:over', ({ score, best }) => {
    try {
      const current = saveSystem.load();
      const newBest = Math.max(current.bestScore, best, score);
      saveSystem.save({
        version: current.version,
        bestScore: newBest,
        totalRuns: current.totalRuns + 1,
        lastSeed: current.lastSeed,
      });
    } catch {
      // Ignore storage errors.
    }
  });
  // Roguelite rounds (Task 2.2): score targets, drop budget, clear-reward card.
  const roundRunner = new RoundRunner(
    game,
    new BasicRoundSystem(),
    (round: RoundDefinition): MergeCard => createRoundClearRewardCard(round.index),
  );
  const renderer = new CanvasRenderer(canvas);
  let lastAimX = Number.NaN;

  const beginRun = (): void => {
    game.start(createSeed());
  };

  const input = new PointerInput(canvas, {
    onAim: (clientX: number): void => {
      lastAimX = renderer.toBoardX(clientX);
      game.setAimX(lastAimX);
    },
    onDrop: (clientX: number): void => {
      if (game.state === 'idle' || game.state === 'game_over') {
        beginRun();
        return;
      }
      // While the card overlay is up, a release belongs to the cards, not the board.
      if (game.state === 'slowmo_select') {
        return;
      }
      if (Number.isFinite(clientX)) {
        game.setAimX(renderer.toBoardX(clientX));
      }
      game.drop();
    },
    onSelect: (clientX: number, clientY: number): void => {
      if (game.state !== 'slowmo_select') {
        return;
      }
      const cards = game.getSnapshot().pendingCards;
      const index = cardIndexAt(cards, renderer.toBoardX(clientX), renderer.toBoardY(clientY));
      if (index === null) {
        return;
      }
      const card = cards[index];
      if (card === undefined) {
        return;
      }
      game.chooseCard(card);
    },
    onRestart: (): void => {
      if (game.state === 'game_over' || game.state === 'idle') {
        beginRun();
      }
    },
    onNudge: (deltaX: number): void => {
      const current = Number.isFinite(lastAimX) ? lastAimX : (game.getSnapshot().held?.x ?? 0);
      lastAimX = current + deltaX;
      game.setAimX(lastAimX);
    },
  });

  const loop = new GameLoop({
    update: (stepMs: number): void => {
      game.update(stepMs);
    },
    render: (): void => {
      renderer.render(game.getSnapshot());
    },
  });

  const onResize = (): void => {
    renderer.resize();
  };

  return {
    game,
    start: (): void => {
      input.attach();
      window.addEventListener('resize', onResize);
      onResize();
      loop.start();
    },
    dispose: (): void => {
      loop.stop();
      input.detach();
      window.removeEventListener('resize', onResize);
      roundRunner.dispose();
      game.dispose();
      canvas.remove();
    },
  };
}
