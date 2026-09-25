import { SLOW_MOTION } from '@/config/gameConfig';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import type { IMergeCardProvider, MergeCard } from '@/core/interfaces/IMergeCard';
import type { ISlowMotionSelector, SlowMotionRequest } from '@/core/interfaces/ISlowMotionSelector';
import type { MergeEvent } from '@/core/types';

/**
 * First real `ISlowMotionSelector` (Task 1.3): every merge that produces at
 * least `SLOW_MOTION.minResultTier` freezes the run into `slowmo_select` and
 * offers a hand of cards from the injected `IMergeCardProvider`. The provider
 * guarantees the hand holds exactly `SLOW_MOTION.riskCardCount` risk cards.
 *
 * The hand drawn for the current merge is remembered so `onTimeout` can pick
 * from the very cards the player was looking at instead of drawing a new hand.
 */
export class CardSlowMotionSelector implements ISlowMotionSelector {
  private readonly provider: IMergeCardProvider;
  private offeredCards: readonly MergeCard[] = [];

  constructor(provider: IMergeCardProvider) {
    this.provider = provider;
  }

  onMergeMoment(merge: MergeEvent): SlowMotionRequest | null {
    if (!CardSlowMotionSelector.isBigEnough(merge)) {
      return null;
    }
    const cards = this.drawHand(merge);
    if (cards.length === 0) {
      return null;
    }
    this.offeredCards = cards;
    return {
      durationMs: SLOW_MOTION.durationMs,
      timeScale: SLOW_MOTION.timeScale,
      cards,
    };
  }

  onCardChosen(_card: MergeCard, _merge: MergeEvent): void {
    // The choice window is closed: forget the hand so a later timeout cannot
    // resurrect cards the player already dismissed.
    this.offeredCards = [];
  }

  onTimeout(merge: MergeEvent): MergeCard | null {
    // Normally the hand is the one drawn in onMergeMoment. Drawing a fresh one
    // keeps the fallback correct even if a timeout ever arrives without an
    // active offer (defensive: the player must never be handed a risk card).
    const hand = this.offeredCards.length > 0 ? this.offeredCards : this.drawHand(merge);
    this.offeredCards = [];
    return hand.find((card) => !isRiskCard(card)) ?? null;
  }

  private drawHand(merge: MergeEvent): MergeCard[] {
    return this.provider.draw(merge, SLOW_MOTION.cardCount, SLOW_MOTION.riskCardCount);
  }

  /**
   * Small merges (and the max-tier annihilation, which has no result tier) are
   * too frequent to interrupt; only tier 2 (value 8) and up open the choice.
   */
  private static isBigEnough(merge: MergeEvent): boolean {
    return merge.resultTier !== null && merge.resultTier >= SLOW_MOTION.minResultTier;
  }
}
