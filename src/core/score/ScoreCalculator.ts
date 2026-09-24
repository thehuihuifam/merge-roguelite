import { CHAIN_MULTIPLIER_STEP, MAX_TIER_MERGE_BONUS } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import type { IScoreModifier, ScoreContext } from '@/core/interfaces/IScoreModifier';

export interface ScoreBreakdown {
  readonly base: number;
  readonly chainMultiplier: number;
  readonly modified: number;
  readonly total: number;
}

export function chainMultiplierFor(chainIndex: number): number {
  return 1 + Math.max(0, chainIndex) * CHAIN_MULTIPLIER_STEP;
}

/**
 * Computes the score for a single merge:
 *   base (value of the new ball) × chain multiplier, then passed through
 *   every registered IScoreModifier (multiplier cards, round bonuses, ...).
 */
export class ScoreCalculator {
  private readonly modifiers: IScoreModifier[] = [];

  addModifier(modifier: IScoreModifier): () => void {
    this.modifiers.push(modifier);
    return (): void => {
      const index = this.modifiers.indexOf(modifier);
      if (index >= 0) {
        this.modifiers.splice(index, 1);
      }
    };
  }

  get modifierCount(): number {
    return this.modifiers.length;
  }

  baseScoreFor(resultTier: number | null): number {
    if (resultTier === null) {
      return MAX_TIER_MERGE_BONUS;
    }
    return getTierSpec(resultTier).value;
  }

  calculate(context: ScoreContext): ScoreBreakdown {
    const base = this.baseScoreFor(context.resultTier);
    const chainMultiplier = chainMultiplierFor(context.chainIndex);
    const beforeModifiers = base * chainMultiplier;
    let modified = beforeModifiers;
    for (const modifier of this.modifiers) {
      modified = modifier.modify(modified, context);
    }
    const total = Math.max(0, Math.round(modified));
    return { base, chainMultiplier, modified, total };
  }
}
