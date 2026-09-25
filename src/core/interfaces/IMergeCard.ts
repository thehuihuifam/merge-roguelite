import type { MergeEvent } from '@/core/types';

export type MergeCardKind = 'reward' | 'risk';

/** Runtime context a card can act on when applied. Extended by future PRs, never shrunk. */
export interface MergeCardContext {
  readonly merge: MergeEvent;
  readonly currentScore: number;
  /** Adds (or, for risk cards, removes) score immediately. */
  readonly addScore: (delta: number) => void;
  /** Registers a temporary multiplier applied to subsequent merges. */
  readonly pushScoreMultiplier: (multiplier: number, remainingMerges: number) => void;
  /** Shifts the danger line in board units; a positive delta moves it down. */
  readonly shiftDangerLine: (deltaY: number) => void;
  /**
   * Forces the next `count` new dispenser balls up to at least `minTier`
   * (field added by Task 2.16, `spawn_larger_balls` penalty). Optional:
   * hosts that do not implement it simply refuse such cards.
   */
  readonly raiseSpawnTierFloor?: (minTier: number, count: number) => void;
}

export interface MergeCard {
  readonly id: string;
  readonly kind: MergeCardKind;
  readonly title: string;
  readonly description: string;
  apply(context: MergeCardContext): void;
}

export type RiskPenaltyKind = 'score_loss' | 'spawn_larger_balls' | 'raise_danger_line';

/**
 * Exactly one of the three cards offered during a merge moment is a risk card:
 * a tempting upside coupled with a visible penalty.
 */
export interface RiskCard extends MergeCard {
  readonly kind: 'risk';
  readonly penalty: RiskPenaltyKind;
  /** 0..1 – how badly the penalty bites; used for UI intensity. */
  readonly severity: number;
}

export function isRiskCard(card: MergeCard): card is RiskCard {
  return card.kind === 'risk';
}

/** Supplies the deck. v0.1.0 ships no provider; v0.2.0 adds one under src/systems/cards/. */
export interface IMergeCardProvider {
  /** Returns `count` cards; exactly `riskCount` of them must be RiskCards. */
  draw(merge: MergeEvent, count: number, riskCount: number): MergeCard[];
}
