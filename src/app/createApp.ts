import { BALL_TIERS, MAX_TIER } from '@/config/gameConfig';
import { GameLoop } from '@/app/GameLoop';
import { Game } from '@/core/Game';
import { getTierSpec } from '@/core/ball/BallFactory';
import { SeededRandom, createSeed } from '@/core/rng/SeededRandom';
import { TimeController } from '@/core/time/TimeController';
import { PointerInput } from '@/input/PointerInput';
import { CanvasRenderer } from '@/render/CanvasRenderer';
import { cardIndexAt } from '@/render/CardOverlayRenderer';
import { BasicParticleSystem } from '@/systems/BasicParticleSystem';
import { BasicRoundSystem } from '@/systems/BasicRoundSystem';
import { BombBallBehavior } from '@/systems/special/BombBallBehavior';
import { SpecialBallRegistry } from '@/systems/special/SpecialBallRegistry';
import { CardSlowMotionSelector } from '@/systems/CardSlowMotionSelector';
import { LocalStorageSaveSystem } from '@/systems/LocalStorageSaveSystem';
import { RoundRunner } from '@/systems/RoundRunner';
import { SlowMotionNearMissEffect } from '@/systems/SlowMotionNearMissEffect';
import { WebAudioSystem, frequencyForMergeTier } from '@/systems/WebAudioSystem';
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
    particles.clear();
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
  // The round HUD (Task 2.12) reads through the same system every frame.
  const roundSystem = new BasicRoundSystem();
  const roundRunner = new RoundRunner(game, roundSystem, (round: RoundDefinition): MergeCard =>
    createRoundClearRewardCard(round.index),
  );
  // Juice: merge particle bursts (Task 2.5).
  const particles = new BasicParticleSystem();
  // Juice: audio SFX (Task 2.6) — WebAudio, merge pitch proportional to tier.
  const audio = new WebAudioSystem();
  const renderer = new CanvasRenderer(canvas, { particles });
  game.events.on('merge:resolved', (merge) => {
    const tier = merge.resultTier;
    const color = tier === null ? '#ffe66d' : (getTierSpec(tier).color ?? BALL_TIERS[Math.min(tier, MAX_TIER)]?.color ?? '#ffffff');
    const intensity = tier === null ? 1 : Math.min(1, 0.4 + tier / (MAX_TIER + 1) + merge.chainIndex * 0.15);
    particles.burst({
      kind: tier === null ? 'merge_max' : 'merge',
      position: merge.position,
      color,
      intensity,
    });
    // Audio: pitch proportional to tier + chain.
    if (tier === null) {
      audio.play('merge_big', { pitch: frequencyForMergeTier(null, merge.chainIndex), volume: 0.9 });
    } else {
      audio.play('merge', { pitch: frequencyForMergeTier(tier, merge.chainIndex), volume: 0.7 });
    }
  });
  game.events.on('ball:dropped', ({ ball }) => {
    const spec = getTierSpec(ball.tier);
    particles.burst({
      kind: 'drop_dust',
      position: { x: ball.position.x, y: ball.position.y + spec.radius },
      color: spec.color,
      intensity: 0.5,
    });
    audio.play('drop', { volume: 0.5 });
  });
  game.events.on('ball:detonated', ({ position }) => {
    particles.burst({
      kind: 'merge_max',
      position,
      color: '#ffdd59',
      intensity: 1,
    });
    audio.play('merge_big', { pitch: frequencyForMergeTier(null, 0), volume: 1 });
  });
  game.events.on('danger:nearMissEnter', (sample) => {
    const ball = game.getSnapshot().balls.find((b) => b.id === sample.ballId);
    const position = ball ? { x: ball.position.x, y: ball.position.y } : { x: 240, y: 120 };
    particles.burst({
      kind: 'danger_spark',
      position,
      color: '#ff4d6d',
      intensity: sample.severity,
    });
    audio.play('near_miss_loop', { volume: 0.3 + sample.severity * 0.4 });
  });
  game.events.on('danger:nearMissExit', () => {
    audio.stop('near_miss_loop');
  });
  game.events.on('time:slowMotionStart', () => {
    audio.play('card_show', { volume: 0.6 });
  });
  game.events.on('run:over', () => {
    audio.stop('near_miss_loop');
    audio.play('game_over', { volume: 0.9 });
  });
  let lastAimX = Number.NaN;

  const beginRun = (): void => {
    game.start(createSeed());
  };

  const choosePendingCard = (cardIndex: number): boolean => {
    if (game.state !== 'slowmo_select') {
      return false;
    }
    const card = game.getSnapshot().pendingCards[cardIndex];
    if (card === undefined || !game.chooseCard(card)) {
      return false;
    }
    audio.play('card_pick', { volume: 0.7 });
    return true;
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
      if (index !== null) {
        choosePendingCard(index);
      }
    },
    onChooseCard: (cardIndex: number): boolean => choosePendingCard(cardIndex),
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
      particles.update(stepMs);
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
