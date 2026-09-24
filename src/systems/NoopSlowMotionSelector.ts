import type { MergeCard } from '@/core/interfaces/IMergeCard';
import type { ISlowMotionSelector, SlowMotionRequest } from '@/core/interfaces/ISlowMotionSelector';
import type { MergeEvent } from '@/core/types';

/** v0.1.0 default: merges never open the card choice. */
export class NoopSlowMotionSelector implements ISlowMotionSelector {
  onMergeMoment(_merge: MergeEvent): SlowMotionRequest | null {
    return null;
  }

  onCardChosen(_card: MergeCard, _merge: MergeEvent): void {
    return;
  }

  onTimeout(_merge: MergeEvent): MergeCard | null {
    return null;
  }
}
