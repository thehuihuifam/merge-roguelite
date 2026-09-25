import { MERGE_CARDS } from '@/config/gameConfig';
import type {
  IMergeCardProvider,
  MergeCard,
  MergeCardContext,
  RiskCard,
} from '@/core/interfaces/IMergeCard';
import type { SeededRandom } from '@/core/rng/SeededRandom';
import type { MergeEvent } from '@/core/types';

/** Stable card identities so the UI and tests can tell card types apart. */
export const CARD_IDS = {
  bonusScore: 'reward-bonus-score',
  doubleMultiplier: 'reward-multiplier-x2',
  tripleMultiplier: 'reward-multiplier-x3',
  scoreLoss: 'risk-score-loss',
  raiseDangerLine: 'risk-raise-danger-line',
} as const;

/** Reward: pay the points of the merge that triggered this choice one more time. */
export function createBonusScoreCard(points: number): MergeCard {
  return {
    id: CARD_IDS.bonusScore,
    kind: 'reward',
    title: `+${points} PTS`,
    description: 'Bank the points of this merge again.',
    apply: (context: MergeCardContext): void => {
      context.addScore(points);
    },
  };
}

/** Reward: ×2 on each of the next two merges. */
export function createDoubleMultiplierCard(): MergeCard {
  return {
    id: CARD_IDS.doubleMultiplier,
    kind: 'reward',
    title: `SCORE ×${MERGE_CARDS.doubleMultiplier}`,
    description: `Next ${MERGE_CARDS.doubleMultiplierUses} merges score double.`,
    apply: (context: MergeCardContext): void => {
      context.pushScoreMultiplier(MERGE_CARDS.doubleMultiplier, MERGE_CARDS.doubleMultiplierUses);
    },
  };
}

/** Reward: ×3 on the next merge. */
export function createTripleMultiplierCard(): MergeCard {
  return {
    id: CARD_IDS.tripleMultiplier,
    kind: 'reward',
    title: `SCORE ×${MERGE_CARDS.tripleMultiplier}`,
    description: 'Next merge scores triple.',
    apply: (context: MergeCardContext): void => {
      context.pushScoreMultiplier(MERGE_CARDS.tripleMultiplier, MERGE_CARDS.tripleMultiplierUses);
    },
  };
}

/** Risk: give up a share of the banked score for a ×4 on the next merge. */
export function createScoreLossCard(): RiskCard {
  return {
    id: CARD_IDS.scoreLoss,
    kind: 'risk',
    penalty: 'score_loss',
    severity: MERGE_CARDS.scoreLossSeverity,
    title: `GAMBLE ×${MERGE_CARDS.scoreLossMultiplier}`,
    description: `Lose ${Math.round(MERGE_CARDS.scoreLossRatio * 100)}% of your score, then score ×${MERGE_CARDS.scoreLossMultiplier} once.`,
    apply: (context: MergeCardContext): void => {
      const lost = Math.round(context.currentScore * MERGE_CARDS.scoreLossRatio);
      context.addScore(-lost);
      context.pushScoreMultiplier(
        MERGE_CARDS.scoreLossMultiplier,
        MERGE_CARDS.scoreLossMultiplierUses,
      );
    },
  };
}

/** Risk: pay points to raise the danger line and earn a ×4 on the next merge. */
export function createRaiseDangerLineCard(): RiskCard {
  return {
    id: CARD_IDS.raiseDangerLine,
    kind: 'risk',
    penalty: 'raise_danger_line',
    severity: MERGE_CARDS.dangerLineSeverity,
    title: 'PRESSURE',
    description: `Pay ${MERGE_CARDS.dangerLineScoreCost} points to move the danger line down ${MERGE_CARDS.dangerLineShiftPx}px; next merge scores ×${MERGE_CARDS.dangerLineMultiplier}.`,
    apply: (context: MergeCardContext): void => {
      context.addScore(-MERGE_CARDS.dangerLineScoreCost);
      context.shiftDangerLine(MERGE_CARDS.dangerLineShiftPx);
      context.pushScoreMultiplier(
        MERGE_CARDS.dangerLineMultiplier,
        MERGE_CARDS.dangerLineMultiplierUses,
      );
    },
  };
}

/**
 * The default deck: three reward cards and two risk cards. Draws are sampled
 * from an injected `SeededRandom`, so the same seed always offers the same
 * hand, and exactly `riskCount` of the returned cards are risk cards.
 */
export class BasicMergeCardProvider implements IMergeCardProvider {
  private readonly rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  draw(merge: MergeEvent, count: number, riskCount: number): MergeCard[] {
    if (!Number.isInteger(count) || count <= 0) {
      throw new RangeError(`draw: count must be a positive integer, got ${count}`);
    }
    if (!Number.isInteger(riskCount) || riskCount < 0) {
      throw new RangeError(`draw: riskCount must be a non-negative integer, got ${riskCount}`);
    }
    if (riskCount > count) {
      throw new RangeError(`draw: riskCount (${riskCount}) cannot exceed count (${count})`);
    }
    const risks = this.riskPool();
    const rewards = this.rewardPool(merge);
    if (riskCount > risks.length) {
      throw new RangeError(
        `draw: deck holds ${risks.length} risk cards, ${riskCount} were requested`,
      );
    }
    const rewardTake = count - riskCount;
    if (rewardTake > rewards.length) {
      throw new RangeError(
        `draw: deck holds ${rewards.length} reward cards, ${rewardTake} were requested`,
      );
    }
    const hand: MergeCard[] = [
      ...this.sampleWithoutReplacement(risks, riskCount),
      ...this.sampleWithoutReplacement(rewards, rewardTake),
    ];
    return this.shuffle(hand);
  }

  private rewardPool(merge: MergeEvent): MergeCard[] {
    return [
      createBonusScoreCard(merge.scoreGained),
      createDoubleMultiplierCard(),
      createTripleMultiplierCard(),
    ];
  }

  private riskPool(): RiskCard[] {
    return [createScoreLossCard(), createRaiseDangerLineCard()];
  }

  /** Takes `take` distinct cards; the pool must hold at least that many. */
  private sampleWithoutReplacement<T>(pool: readonly T[], take: number): T[] {
    const remaining: T[] = [...pool];
    const picked: T[] = [];
    for (let i = 0; i < take; i += 1) {
      const index = this.rng.nextInt(0, remaining.length - 1);
      const [card] = remaining.splice(index, 1);
      if (card === undefined) {
        throw new RangeError('draw: card pool exhausted while sampling');
      }
      picked.push(card);
    }
    return picked;
  }

  /** Fisher-Yates so the risk card is not always offered in the same slot. */
  private shuffle(cards: MergeCard[]): MergeCard[] {
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = this.rng.nextInt(0, i);
      const a = cards[i];
      const b = cards[j];
      if (a === undefined || b === undefined) {
        throw new RangeError('draw: shuffle index out of bounds');
      }
      cards[i] = b;
      cards[j] = a;
    }
    return cards;
  }
}
