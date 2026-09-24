import { GameLoop } from '@/app/GameLoop';
import { Game } from '@/core/Game';
import { createSeed } from '@/core/rng/SeededRandom';
import { PointerInput } from '@/input/PointerInput';
import { CanvasRenderer } from '@/render/CanvasRenderer';

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

  const game = new Game();
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
      if (Number.isFinite(clientX)) {
        game.setAimX(renderer.toBoardX(clientX));
      }
      game.drop();
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
      game.dispose();
      canvas.remove();
    },
  };
}
