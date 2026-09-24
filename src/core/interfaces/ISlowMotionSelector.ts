import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { MergeEvent } from '@/core/types';

export interface SlowMotionRequest {
  readonly durationMs: number;
  /** 0 < timeScale <= 1 */
  readonly timeScale: number;
  readonly cards: readonly MergeCard[];
}

/**
 * Extension point for the "slow-motion choice" mechanic.
 * Returning a request from onMergeMoment freezes gameplay into slowmo_select,
 * shows the cards, and resumes once onCardChosen resolves.
 */
export interface ISlowMotionSelector {
  /** Called right after a merge is resolved. Return null to skip the choice. */
  onMergeMoment(merge: MergeEvent): SlowMotionRequest | null;
  /** Called when the player picks a card (or the timer picks for them). */
  onCardChosen(card: MergeCard, merge: MergeEvent): void;
  /** Called when the slow-motion window expires without a choice. */
  onTimeout(merge: MergeEvent): MergeCard | null;
}
