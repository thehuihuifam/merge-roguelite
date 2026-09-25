import { ROUNDS } from '@/config/gameConfig';
import {
  createDoubleMultiplierCard,
  createTripleMultiplierCard,
} from '@/systems/cards/BasicMergeCardProvider';
import type { MergeCard, MergeCardContext } from '@/core/interfaces/IMergeCard';

/** Stable identity for the round-clear reward card. */
export const ROUND_CLEAR_CARD_ID = 'reward-round-clear';

/**
 * Round-clear reward (Task 2.2): a flat point bonus that grows with the round
 * index. Since Task 2.13 it heads the round-clear choice hand; `RoundRunner`
 * only applies it immediately when the board is too busy for a choice.
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

/**
 * Round-clear choice hand (Task 2.13): the flat bonus plus two multiplier
 * rewards, all `reward` kind — a cleared round is payday, not a gamble.
 * The flat card stays first so the busy-board fallback and the choice
 * timeout both bank the same deterministic bonus.
 */
export function createRoundClearChoice(roundIndex: number): MergeCard[] {
  return [
    createRoundClearRewardCard(roundIndex),
    createDoubleMultiplierCard(),
    createTripleMultiplierCard(),
  ];
}
