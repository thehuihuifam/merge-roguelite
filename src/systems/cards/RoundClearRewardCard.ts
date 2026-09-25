import { ROUNDS } from '@/config/gameConfig';
import type { MergeCard, MergeCardContext } from '@/core/interfaces/IMergeCard';

/** Stable identity for the round-clear reward card. */
export const ROUND_CLEAR_CARD_ID = 'reward-round-clear';

/**
 * Round-clear reward (Task 2.2): a flat point bonus that grows with the round
 * index. `RoundRunner` applies it immediately through `Game.applyRewardCard`.
 */
export function createRoundClearRewardCard(roundIndex: number): MergeCard {
  const points = ROUNDS.rewardBaseScore + ROUNDS.rewardScorePerRound * Math.max(0, roundIndex - 1);
  return {
    id: ROUND_CLEAR_CARD_ID,
    kind: 'reward',
    title: `ROUND ${roundIndex} CLEAR`,
    description: `Round bonus: +${points} points.`,
    apply: (context: MergeCardContext): void => {
      context.addScore(points);
    },
  };
}
