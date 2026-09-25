import {
  BOARD,
  DROP_COOLDOWN_MS,
  RESTING_SPEED_THRESHOLD,
  SLOW_MOTION,
  SPAWN_Y,
  SPAWNABLE_TIER_COUNT,
  SPECIAL_BALLS,
} from '@/config/gameConfig';
import { BallFactory, getTierSpec } from '@/core/ball/BallFactory';
import { BallRegistry } from '@/core/ball/BallRegistry';
import { SpawnTierPenalty } from '@/core/ball/SpawnTierPenalty';
import type { SpawnPenaltyHudState } from '@/core/ball/SpawnTierPenalty';
import { OverflowDetector } from '@/core/danger/OverflowDetector';
import { EventBus } from '@/core/events/EventBus';
import { MergeResolver } from '@/core/merge/MergeResolver';
import { SeededRandom } from '@/core/rng/SeededRandom';
import { ModifierStack } from '@/core/score/ModifierStack';
import { ScoreCalculator } from '@/core/score/ScoreCalculator';
import { ScoreState } from '@/core/score/ScoreState';
import { GameStateMachine } from '@/core/state/GameStateMachine';
import { TimeController } from '@/core/time/TimeController';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { NoopNearMissEffect } from '@/systems/NoopNearMissEffect';
import { SpecialBallRegistry } from '@/systems/special/SpecialBallRegistry';
import { blastScore, blastVictims } from '@/systems/special/BombBallBehavior';
import { NoopSlowMotionSelector } from '@/systems/NoopSlowMotionSelector';
import type { GameEventMap } from '@/core/events/GameEvents';
import type { INearMissEffect } from '@/core/interfaces/INearMissEffect';
import type {
  ISpecialBallBehavior,
  ISpecialBallRegistry,
  SpecialBallKind,
} from '@/core/interfaces/ISpecialBall';
import type { MergeCard, MergeCardContext } from '@/core/interfaces/IMergeCard';
import type { RoundHudState } from '@/core/interfaces/IRoundSystem';
import type { IScoreModifier } from '@/core/interfaces/IScoreModifier';
import type { ISlowMotionSelector, SlowMotionRequest } from '@/core/interfaces/ISlowMotionSelector';
import type { GameState } from '@/core/state/GameState';
import type {
  Ball,
  BallId,
  CollisionPair,
  MergeEvent,
  MergePlan,
  NearMissSample,
} from '@/core/types';

/**
 * Synthetic merge for cards granted outside a merge moment (round clear):
 * no board balls take part, so the sentinel ids are never looked up.
 */
function rewardMergeEvent(): MergeEvent {
  return {
    sourceIds: [-1, -1],
    resultTier: null,
    position: { x: BOARD.width / 2, y: BOARD.height / 2 },
    chainIndex: 0,
    scoreGained: 0,
  };
}

export interface GameDependencies {
  readonly physics?: PhysicsWorld;
  readonly overflowDetector?: OverflowDetector;
  readonly slowMotionSelector?: ISlowMotionSelector;
  readonly nearMissEffect?: INearMissEffect;
  readonly scoreModifiers?: readonly IScoreModifier[];
  readonly initialBest?: number;
  readonly timeController?: TimeController;
  /** Special-ball behaviors (bomb, ...). Empty registry = only ordinary balls. */
  readonly specialBalls?: ISpecialBallRegistry;
  /** Per-drop chance that the dispenser hands out a special ball, 0..1. */
  readonly specialSpawnChance?: number;
}

export interface HeldBall {
  readonly tier: number;
  readonly x: number;
  readonly special: SpecialBallKind | null;
}

/** Immutable view handed to renderers each frame. */
export interface GameSnapshot {
  readonly state: GameState;
  readonly score: number;
  readonly best: number;
  readonly balls: readonly Ball[];
  readonly held: HeldBall | null;
  readonly nextTier: number;
  readonly dangerLineY: number;
  readonly nearMissIntensity: number;
  readonly timeScale: number;
  readonly pendingCards: readonly MergeCard[];
  readonly seed: number;
  readonly chainIndex: number;
  readonly nextSpecial: SpecialBallKind | null;
  /**
   * Round progress for the HUD (Task 2.12). `Game` never sets it — the app
   * layer merges `RoundRunner.getHudState()` into the rendered snapshot, so
   * the core stays unaware of the round structure. Absent means no display.
   */
  readonly round?: RoundHudState;
  /**
   * Active spawn pressure (Task 2.19): the tier floor new balls are rolled
   * with and how many of them are left. Read-only copy, absent when no
   * penalty is active — renderers must not mutate game state.
   */
  readonly spawnPenalty?: SpawnPenaltyHudState;
}

/**
 * Orchestrates one run. Pure with respect to rendering and input devices:
 * the app layer feeds it aim/drop commands and time, and reads snapshots.
 */
export class Game {
  readonly events = new EventBus<GameEventMap>();
  readonly time: TimeController;

  private readonly physics: PhysicsWorld;
  private readonly specialBalls: ISpecialBallRegistry;
  private readonly specialSpawnChance: number;
  private readonly slowMo: ISlowMotionSelector;
  private readonly nearMiss: INearMissEffect;
  private readonly scoreCalculator = new ScoreCalculator();
  private readonly modifierStack = new ModifierStack();
  private readonly scoreState: ScoreState;
  private readonly overflow: OverflowDetector;
  private readonly merges = new MergeResolver();
  private readonly registry = new BallRegistry();
  /** Risk-card spawn floor (Task 2.17): caps the tier of new dispenser rolls. */
  private readonly spawnPenalty = new SpawnTierPenalty();
  private readonly fsm = new GameStateMachine();

  private rng = new SeededRandom(1);
  private factory = new BallFactory(this.rng);
  private seed = 1;
  private heldTier = 0;
  private nextTier = 0;
  private heldSpecial: SpecialBallKind | undefined;
  private nextSpecial: SpecialBallKind | undefined;
  private aimX = BOARD.width / 2;
  private cooldownMs = 0;
  private chainIndex = 0;
  private nearMissActive = false;
  private pendingCards: readonly MergeCard[] = [];
  private pendingMerge: MergeEvent | null = null;
  private slowMoTimerMs = 0;
  private resumeEvent: 'resumeAiming' | 'resumeDropping' = 'resumeAiming';

  constructor(deps: GameDependencies = {}) {
    this.time = deps.timeController ?? new TimeController();
    this.physics = deps.physics ?? new PhysicsWorld();
    this.specialBalls = deps.specialBalls ?? new SpecialBallRegistry();
    this.specialSpawnChance = deps.specialSpawnChance ?? SPECIAL_BALLS.bombSpawnChance;
    this.overflow = deps.overflowDetector ?? new OverflowDetector();
    this.slowMo = deps.slowMotionSelector ?? new NoopSlowMotionSelector();
    this.nearMiss = deps.nearMissEffect ?? new NoopNearMissEffect();
    this.scoreState = new ScoreState(deps.initialBest ?? 0);
    // ModifierStack (Task 2.7) owns temporary multipliers; expose as a single
    // IScoreModifier to ScoreCalculator so duration is managed in one place.
    this.scoreCalculator.addModifier(this.modifierStack.asModifier());
    for (const modifier of deps.scoreModifiers ?? []) {
      this.scoreCalculator.addModifier(modifier);
    }
    this.fsm.onChange((from, to) => {
      this.events.emit('state:changed', { from, to });
    });
  }

  get state(): GameState {
    return this.fsm.state;
  }

  get score(): number {
    return this.scoreState.score;
  }

  get best(): number {
    return this.scoreState.best;
  }

  get ballCount(): number {
    return this.registry.size;
  }

  start(seed: number): void {
    this.resetRun(seed);
    if (this.fsm.is('idle')) {
      this.fsm.send('start');
    } else if (this.fsm.is('game_over')) {
      this.fsm.send('restart');
    } else {
      throw new Error(`Cannot start a run from state "${this.fsm.state}"`);
    }
    this.events.emit('run:started', { seed });
  }

  restart(seed: number): void {
    if (!this.fsm.is('game_over')) {
      throw new Error(`Cannot restart from state "${this.fsm.state}"`);
    }
    this.start(seed);
  }

  setAimX(x: number): void {
    this.aimX = this.clampAimX(x, this.heldTier);
  }

  /** Returns true when a ball was actually dropped. */
  drop(): boolean {
    if (!this.fsm.is('aiming')) {
      return false;
    }
    const tier = this.heldTier;
    const x = this.clampAimX(this.aimX, tier);
    const special = this.heldSpecial;
    const ball = this.factory.create(tier, { x, y: SPAWN_Y }, this.time.gameTimeMs, special);
    this.registry.add(ball);
    this.physics.addBall(ball);
    if (special !== undefined) {
      this.specialBalls.get(special)?.onSpawn(ball);
    }
    this.chainIndex = 0;
    this.cooldownMs = DROP_COOLDOWN_MS;
    this.heldTier = this.nextTier;
    this.heldSpecial = this.nextSpecial;
    // Spawn penalty (Task 2.17): only the freshly rolled ball is floored. The
    // held ball and the NEXT preview the player already sees stay untouched.
    this.nextTier = this.spawnPenalty.apply(this.factory.rollSpawnTier());
    this.nextSpecial = this.factory.rollSpawnSpecial();
    this.aimX = this.clampAimX(this.aimX, this.heldTier);
    this.fsm.send('drop');
    this.events.emit('ball:dropped', { ball });
    return true;
  }

  chooseCard(card: MergeCard): boolean {
    if (!this.fsm.is('slowmo_select') || this.pendingMerge === null) {
      return false;
    }
    const merge = this.pendingMerge;
    card.apply(this.buildCardContext(merge));
    this.slowMo.onCardChosen(card, merge);
    this.clearSlowMotionSelection();
    this.fsm.send(this.resumeEvent);
    return true;
  }

  /**
   * Opens the slow-motion card choice for a reward that is not tied to a
   * merge (round-clear bonus, Task 2.13), reusing the merge-moment flow:
   * same `slowmo_select` state, overlay, pointer/keyboard input and timeout.
   * Returns false when the board is busy or the hand is empty.
   */
  openRewardChoice(cards: readonly MergeCard[]): boolean {
    if (cards.length === 0 || !this.fsm.can('mergeMoment')) {
      return false;
    }
    const merge = rewardMergeEvent();
    this.time.startSlowMotion(SLOW_MOTION.durationMs, SLOW_MOTION.timeScale);
    this.events.emit('time:slowMotionStart', {
      durationMs: SLOW_MOTION.durationMs,
      timeScale: SLOW_MOTION.timeScale,
    });
    this.pendingCards = [...cards];
    this.pendingMerge = merge;
    this.slowMoTimerMs = SLOW_MOTION.durationMs;
    this.resumeEvent = this.fsm.is('dropping') ? 'resumeDropping' : 'resumeAiming';
    this.slowMo.offerCards?.(merge, this.pendingCards);
    this.fsm.send('mergeMoment');
    return true;
  }

  /**
   * Applies a standalone reward card (round-clear fallback and friends)
   * outside the slow-motion choice, through the same context a chosen card
   * gets. Returns false when no run is active.
   */
  applyRewardCard(card: MergeCard): boolean {
    if (this.fsm.is('idle') || this.fsm.is('game_over')) {
      return false;
    }
    card.apply(this.buildCardContext(rewardMergeEvent()));
    return true;
  }

  /** Advances the simulation by `realDeltaMs` of wall-clock time. */
  update(realDeltaMs: number): void {
    if (this.fsm.is('idle') || this.fsm.is('game_over')) {
      return;
    }
    const gameDelta = this.time.advance(realDeltaMs);
    this.modifierStack.update(gameDelta);

    if (this.fsm.is('slowmo_select')) {
      this.tickSlowMotionSelection(realDeltaMs);
    }

    this.physics.step(gameDelta);
    this.physics.sync(this.registry.all());
    this.resolveMerges();
    this.physics.sync(this.registry.all());

    const report = this.overflow.update(this.registry.all(), gameDelta);
    this.updateNearMiss(report.nearMiss);
    if (report.overflow) {
      this.endRun();
      return;
    }

    if (this.fsm.is('dropping')) {
      this.cooldownMs = Math.max(0, this.cooldownMs - gameDelta);
      if (this.cooldownMs === 0) {
        this.fsm.send('settle');
      }
    }
  }

  getSnapshot(): GameSnapshot {
    const held: HeldBall | null = this.fsm.is('aiming')
      ? { tier: this.heldTier, x: this.aimX, special: this.heldSpecial ?? null }
      : null;
    return {
      state: this.fsm.state,
      score: this.scoreState.score,
      best: this.scoreState.best,
      balls: this.registry.all(),
      held,
      nextTier: this.fsm.is('aiming') ? this.nextTier : this.heldTier,
      nextSpecial: (this.fsm.is('aiming') ? this.nextSpecial : this.heldSpecial) ?? null,
      dangerLineY: this.overflow.lineY,
      nearMissIntensity: this.nearMiss.getIntensity(),
      timeScale: this.time.timeScale,
      pendingCards: this.pendingCards,
      seed: this.seed,
      chainIndex: this.chainIndex,
      ...(this.isSpawnPenaltyActive() ? { spawnPenalty: this.spawnPenaltyState() } : {}),
    };
  }

  /** True when every ball is (almost) at rest. Useful for tests and bots. */
  isSettled(): boolean {
    return this.physics.maxSpeed() < RESTING_SPEED_THRESHOLD;
  }

  dispose(): void {
    this.physics.dispose();
    this.events.clear();
  }

  private resetRun(seed: number): void {
    this.seed = seed >>> 0;
    this.rng = new SeededRandom(this.seed);
    this.factory = new BallFactory(this.rng, SPAWNABLE_TIER_COUNT, this.specialSpawnChance);
    this.registry.clear();
    this.physics.clearBalls();
    this.overflow.reset();
    this.scoreState.resetRun();
    this.modifierStack.clear();
    this.spawnPenalty.reset();
    this.time.reset();
    this.heldTier = this.factory.rollSpawnTier();
    this.nextTier = this.factory.rollSpawnTier();
    this.heldSpecial = this.factory.rollSpawnSpecial();
    this.nextSpecial = this.factory.rollSpawnSpecial();
    this.aimX = BOARD.width / 2;
    this.cooldownMs = 0;
    this.chainIndex = 0;
    this.clearSlowMotionSelection();
    if (this.nearMissActive) {
      this.nearMissActive = false;
      this.nearMiss.onNearMissExit();
    }
  }

  private isSpawnPenaltyActive(): boolean {
    return this.spawnPenalty.isActive;
  }

  /** Read-only copy for the HUD, so renderers cannot poke at the state object. */
  private spawnPenaltyState(): SpawnPenaltyHudState {
    return { floor: this.spawnPenalty.floor, remainingCount: this.spawnPenalty.remainingCount };
  }

  private clampAimX(x: number, tier: number): number {
    const radius = getTierSpec(tier).radius;
    const min = radius + 1;
    const max = BOARD.width - radius - 1;
    if (!Number.isFinite(x)) {
      return BOARD.width / 2;
    }
    return Math.min(max, Math.max(min, x));
  }

  private buildCardContext(merge: MergeEvent): MergeCardContext {
    return {
      merge,
      currentScore: this.scoreState.score,
      addScore: (delta: number): void => {
        this.applyScoreDelta(delta);
      },
      pushScoreMultiplier: (multiplier: number, remainingMerges: number): void => {
        this.pushTemporaryMultiplier(multiplier, remainingMerges);
      },
      shiftDangerLine: (deltaY: number): void => {
        this.overflow.shiftDangerLine(deltaY);
      },
      raiseSpawnTierFloor: (minTier: number, count: number): void => {
        this.spawnPenalty.raise(minTier, count);
      },
    };
  }

  private resolveMerges(): void {
    const pairs = this.physics.drainCollisions();
    if (pairs.length === 0) {
      return;
    }
    const detonated = this.resolveDetonations(pairs);
    const rest = pairs.filter((pair) => !detonated.has(pair.a) && !detonated.has(pair.b));
    const plans = this.merges.resolve(rest, (id) => this.registry.get(id));
    for (const plan of plans) {
      this.applyMerge(plan);
    }
  }

  /**
   * Special-ball pass in front of the merge rules: a pair touching a bomb
   * detonates it (bomb + contact + neighbours inside the blast radius) and is
   * consumed before merging. Returns every id consumed by a blast.
   */
  private resolveDetonations(pairs: readonly CollisionPair[]): Set<BallId> {
    const consumed = new Set<BallId>();
    for (const pair of pairs) {
      if (consumed.has(pair.a) || consumed.has(pair.b)) {
        continue;
      }
      const a = this.registry.get(pair.a);
      const b = this.registry.get(pair.b);
      if (a === undefined || b === undefined) {
        continue;
      }
      const armed = this.armedBehavior(a) ?? this.armedBehavior(b);
      const radius = armed?.blastRadius;
      if (armed === null || armed === undefined || radius === undefined) {
        continue;
      }
      const bomb = this.armedBehavior(a) !== null ? a : b;
      const contact = bomb.id === a.id ? b : a;
      this.detonate(armed, bomb, contact, radius);
      consumed.add(a.id);
      consumed.add(b.id);
    }
    return consumed;
  }

  private armedBehavior(ball: Ball): ISpecialBallBehavior | null {
    if (ball.special === undefined) {
      return null;
    }
    const behavior = this.specialBalls.get(ball.special);
    if (behavior === undefined || behavior.blastRadius === undefined) {
      return null;
    }
    return behavior;
  }

  private detonate(
    behavior: ISpecialBallBehavior,
    bomb: Ball,
    contact: Ball,
    radius: number,
  ): void {
    behavior.onCollide(bomb, contact);
    const victims = blastVictims(bomb, this.registry.all(), radius, contact);
    for (const victim of victims) {
      this.registry.remove(victim.id);
      this.physics.removeBall(victim.id);
    }
    // Blast score first (emits score:changed), then the detonation — the same
    // order merges use (score, then merge:resolved).
    const scoreGained = blastScore(victims, SPECIAL_BALLS.blastScoreRatio);
    this.applyScoreDelta(scoreGained);
    this.events.emit('ball:detonated', {
      bombId: bomb.id,
      removedIds: victims.map((victim) => victim.id),
      position: bomb.position,
      scoreGained,
    });
  }

  private applyMerge(plan: MergePlan): void {
    const [idA, idB] = plan.sourceIds;
    const a = this.registry.get(idA);
    const b = this.registry.get(idB);
    if (a === undefined || b === undefined) {
      return;
    }
    const inheritedVelocity = {
      x: (a.velocity.x + b.velocity.x) / 2,
      y: (a.velocity.y + b.velocity.y) / 2,
    };
    this.registry.remove(idA);
    this.registry.remove(idB);
    this.physics.removeBall(idA);
    this.physics.removeBall(idB);

    const breakdown = this.scoreCalculator.calculate({
      resultTier: plan.resultTier,
      chainIndex: this.chainIndex,
      currentScore: this.scoreState.score,
    });
    this.applyScoreDelta(breakdown.total);

    if (plan.resultTier !== null) {
      const merged = this.factory.create(plan.resultTier, plan.position, this.time.gameTimeMs);
      this.registry.add(merged);
      this.physics.addBall(merged, inheritedVelocity);
      this.events.emit('ball:spawned', { ball: merged });
    }

    const mergeEvent: MergeEvent = {
      sourceIds: plan.sourceIds,
      resultTier: plan.resultTier,
      position: plan.position,
      chainIndex: this.chainIndex,
      scoreGained: breakdown.total,
    };
    this.chainIndex += 1;
    this.events.emit('merge:resolved', mergeEvent);
    this.offerSlowMotion(mergeEvent);
  }

  private offerSlowMotion(merge: MergeEvent): void {
    if (!this.fsm.can('mergeMoment')) {
      return;
    }
    const request: SlowMotionRequest | null = this.slowMo.onMergeMoment(merge);
    if (request === null || request.cards.length === 0) {
      return;
    }
    this.time.startSlowMotion(request.durationMs, request.timeScale);
    this.events.emit('time:slowMotionStart', {
      durationMs: request.durationMs,
      timeScale: request.timeScale,
    });
    this.pendingCards = request.cards;
    this.pendingMerge = merge;
    this.slowMoTimerMs = request.durationMs;
    this.resumeEvent = this.fsm.is('dropping') ? 'resumeDropping' : 'resumeAiming';
    this.fsm.send('mergeMoment');
  }

  private tickSlowMotionSelection(realDeltaMs: number): void {
    if (this.pendingMerge === null) {
      return;
    }
    this.slowMoTimerMs = Math.max(0, this.slowMoTimerMs - realDeltaMs);
    if (this.slowMoTimerMs > 0) {
      return;
    }
    const merge = this.pendingMerge;
    const fallback = this.slowMo.onTimeout(merge);
    if (fallback !== null) {
      this.chooseCard(fallback);
      return;
    }
    this.clearSlowMotionSelection();
    this.fsm.send(this.resumeEvent);
  }

  private clearSlowMotionSelection(): void {
    if (this.pendingMerge !== null || this.pendingCards.length > 0) {
      this.events.emit('time:slowMotionEnd', {});
    }
    this.pendingCards = [];
    this.pendingMerge = null;
    this.slowMoTimerMs = 0;
    this.time.cancelSlowMotion();
  }

  private applyScoreDelta(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    const before = this.scoreState.score;
    if (delta > 0) {
      this.scoreState.add(delta);
    } else {
      const clamped = Math.max(0, before + delta);
      this.scoreState.resetRun();
      if (clamped > 0) {
        this.scoreState.add(clamped);
      }
    }
    this.events.emit('score:changed', {
      score: this.scoreState.score,
      best: this.scoreState.best,
      delta: this.scoreState.score - before,
    });
  }

  private pushTemporaryMultiplier(multiplier: number, remainingMerges: number): void {
    const id = `temp-multiplier-${multiplier}-${this.time.gameTimeMs}-${this.modifierStack.activeCount}`;
    this.modifierStack.push(id, multiplier, remainingMerges);
  }

  private updateNearMiss(sample: NearMissSample | null): void {
    if (sample === null) {
      if (this.nearMissActive) {
        this.nearMissActive = false;
        this.nearMiss.onNearMissExit();
        this.events.emit('danger:nearMissExit', {});
      }
      return;
    }
    if (!this.nearMissActive) {
      this.nearMissActive = true;
      this.nearMiss.onNearMissEnter(sample);
      this.events.emit('danger:nearMissEnter', sample);
      return;
    }
    this.nearMiss.onNearMissUpdate(sample);
    this.events.emit('danger:nearMissUpdate', sample);
  }

  private endRun(): void {
    if (!this.fsm.can('overflow')) {
      return;
    }
    this.clearSlowMotionSelection();
    this.fsm.send('overflow');
    this.events.emit('run:over', { score: this.scoreState.score, best: this.scoreState.best });
  }
}
