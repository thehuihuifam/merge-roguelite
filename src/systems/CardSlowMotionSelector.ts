import { SLOW_MOTION } from '@/config/gameConfig';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import type { IMergeCardProvider, MergeCard } from '@/core/interfaces/IMergeCard';
import type { ISlowMotionSelector, SlowMotionRequest } from '@/core/interfaces/ISlowMotionSelector';
import type { MergeEvent } from '@/core/types';

/**
 * First real `ISlowMotionSelector` (Task 1.3): ordinary merges that produce at
 * least `SLOW_MOTION.minResultTier` and max-tier annihilations freeze the run
 * into `slowmo_select` and offer cards from the injected `IMergeCardProvider`.
 * The provider guarantees exactly `SLOW_MOTION.riskCardCount` risk cards.
 *
 * The card choice is unlimited (`SLOW_MOTION.choiceTimeoutMs === null`): the
 * window stays open until the player picks, so `onTimeout` never auto-selects.
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
    // The choice window is closed: forget the hand so a later call cannot
    // resurrect cards the player already dismissed.
    this.offeredCards = [];
  }

  offerCards(_merge: MergeEvent, cards: readonly MergeCard[]): void {
    // Round-clear choices (Task 2.13) bypass onMergeMoment; remember the hand
    // for the same defensive bookkeeping.
    this.offeredCards = cards;
  }

  onTimeout(merge: MergeEvent): MergeCard | null {
    // Timer expiry is disabled while choices are unlimited
    // (`SLOW_MOTION.choiceTimeoutMs === null`): the selector never picks a
    // card on the player's behalf. The defensive non-risk fallback below only
    // applies when a host configures a real timeout again.
    if (SLOW_MOTION.choiceTimeoutMs === null) {
      this.offeredCards = [];
      return null;
    }
    const hand = this.offeredCards.length > 0 ? this.offeredCards : this.drawHand(merge);
    this.offeredCards = [];
    return hand.find((card) => !isRiskCard(card)) ?? null;
  }

  private drawHand(merge: MergeEvent): MergeCard[] {
    return this.provider.draw(merge, SLOW_MOTION.cardCount, SLOW_MOTION.riskCardCount);
  }

  /**
   * Small merges are too frequent to interrupt; tier 2 (value 8) and up qualify.
   * A null result tier is the max-tier annihilation and always opens a choice.
   */
  private static isBigEnough(merge: MergeEvent): boolean {
    return merge.resultTier === null || merge.resultTier >= SLOW_MOTION.minResultTier;
  }
}
