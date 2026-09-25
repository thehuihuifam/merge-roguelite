import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, MERGE_CARDS, PHYSICS_STEP_MS, SLOW_MOTION } from '@/config/gameConfig';
import { Game } from '@/core/Game';
import { isRiskCard } from '@/core/interfaces/IMergeCard';
import { SeededRandom } from '@/core/rng/SeededRandom';
import {
  BasicMergeCardProvider,
  CARD_IDS,
  createBonusScoreCard,
  createDoubleMultiplierCard,
  createRaiseDangerLineCard,
  createScoreLossCard,
  createTripleMultiplierCard,
} from '@/systems/cards/BasicMergeCardProvider';
import type { MergeCard, MergeCardContext } from '@/core/interfaces/IMergeCard';
import type { ISlowMotionSelector, SlowMotionRequest } from '@/core/interfaces/ISlowMotionSelector';
import type { MergeEvent } from '@/core/types';

const mergeEvent: MergeEvent = {
  sourceIds: [1, 2],
  resultTier: 2,
  position: { x: 120, y: 400 },
  chainIndex: 0,
  scoreGained: 24,
};

interface RecordedContext {
  readonly context: MergeCardContext;
  readonly deltas: number[];
  readonly multipliers: Array<{ multiplier: number; uses: number }>;
}

function recordContext(currentScore: number): RecordedContext {
  const deltas: number[] = [];
  const multipliers: Array<{ multiplier: number; uses: number }> = [];
  const context: MergeCardContext = {
    merge: mergeEvent,
    currentScore,
    addScore: (delta: number): void => {
      deltas.push(delta);
    },
    pushScoreMultiplier: (multiplier: number, remainingMerges: number): void => {
      multipliers.push({ multiplier, uses: remainingMerges });
    },
  };
  return { context, deltas, multipliers };
}

/**
 * Drops balls at x one step at a time and stops the very frame the merge-moment
 * choice opens, so the test sees the run while it is still in slowmo_select.
 */
function dropUntilSlowMoSelect(game: Game, x: number, budget = 600): boolean {
  for (let i = 0; i < budget && game.state !== 'game_over'; i += 1) {
    if (game.state === 'aiming') {
      game.setAimX(x);
      game.drop();
    }
    game.update(PHYSICS_STEP_MS);
    if (game.state === 'slowmo_select') {
      return true;
    }
  }
  return false;
}

describe('BasicMergeCardProvider.draw', () => {
  it('returns exactly count cards with exactly riskCount of them being risk cards', () => {
    const provider = new BasicMergeCardProvider(new SeededRandom(2024));
    const hand = provider.draw(mergeEvent, SLOW_MOTION.cardCount, SLOW_MOTION.riskCardCount);

    expect(hand).toHaveLength(SLOW_MOTION.cardCount);
    expect(hand.filter(isRiskCard)).toHaveLength(SLOW_MOTION.riskCardCount);
  });

  it('honours the risk contract for every seed in the deck', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const provider = new BasicMergeCardProvider(new SeededRandom(seed));
      const hand = provider.draw(mergeEvent, 3, 1);
      expect(hand).toHaveLength(3);
      expect(hand.filter(isRiskCard)).toHaveLength(1);
    }
  });

  it('offers distinct cards within one hand', () => {
    const provider = new BasicMergeCardProvider(new SeededRandom(11));
    const hand = provider.draw(mergeEvent, 3, 1);
    const ids = hand.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns the same hand for the same seed', () => {
    const first = new BasicMergeCardProvider(new SeededRandom(777)).draw(mergeEvent, 3, 1);
    const second = new BasicMergeCardProvider(new SeededRandom(777)).draw(mergeEvent, 3, 1);

    expect(second.map((card) => card.id)).toEqual(first.map((card) => card.id));
    expect(second.map((card) => card.title)).toEqual(first.map((card) => card.title));
  });

  it('can draw a hand without risk cards and a hand that is all risk cards', () => {
    const safe = new BasicMergeCardProvider(new SeededRandom(5)).draw(mergeEvent, 3, 0);
    expect(safe.filter(isRiskCard)).toHaveLength(0);

    const risky = new BasicMergeCardProvider(new SeededRandom(5)).draw(mergeEvent, 2, 2);
    expect(risky).toHaveLength(2);
    expect(risky.filter(isRiskCard)).toHaveLength(2);
  });

  it('spends every reward card when the hand is bigger than the risk pool', () => {
    const hand = new BasicMergeCardProvider(new SeededRandom(5)).draw(mergeEvent, 4, 1);
    expect(hand).toHaveLength(4);
    expect(hand.filter(isRiskCard)).toHaveLength(1);
    expect(new Set(hand.map((card) => card.id)).size).toBe(4);
  });

  it('rejects draws the deck cannot satisfy', () => {
    const provider = new BasicMergeCardProvider(new SeededRandom(1));
    expect(() => provider.draw(mergeEvent, 2, 3)).toThrow(RangeError);
    expect(() => provider.draw(mergeEvent, 0, 0)).toThrow(RangeError);
    expect(() => provider.draw(mergeEvent, 5, 1)).toThrow(RangeError);
    expect(() => provider.draw(mergeEvent, 3, 3)).toThrow(RangeError);
    expect(() => provider.draw(mergeEvent, 1.5, 0)).toThrow(RangeError);
  });
});

describe('BasicMergeCardProvider reward cards', () => {
  it('pays the merge score a second time', () => {
    const { context, deltas, multipliers } = recordContext(500);
    createBonusScoreCard(mergeEvent.scoreGained).apply(context);

    expect(deltas).toEqual([mergeEvent.scoreGained]);
    expect(multipliers).toHaveLength(0);
  });

  it('pushes a ×2 multiplier for two merges', () => {
    const { context, deltas, multipliers } = recordContext(500);
    createDoubleMultiplierCard().apply(context);

    expect(multipliers).toEqual([
      { multiplier: MERGE_CARDS.doubleMultiplier, uses: MERGE_CARDS.doubleMultiplierUses },
    ]);
    expect(deltas).toHaveLength(0);
  });

  it('pushes a ×3 multiplier for one merge', () => {
    const { context, multipliers } = recordContext(500);
    createTripleMultiplierCard().apply(context);

    expect(multipliers).toEqual([
      { multiplier: MERGE_CARDS.tripleMultiplier, uses: MERGE_CARDS.tripleMultiplierUses },
    ]);
  });

  it('names the merge score in the bonus card copy', () => {
    const card = createBonusScoreCard(24);
    expect(card.id).toBe(CARD_IDS.bonusScore);
    expect(card.kind).toBe('reward');
    expect(card.title).toBe('+24 PTS');
  });
});

describe('BasicMergeCardProvider risk cards', () => {
  it('takes a share of the current score and pays back with a ×4', () => {
    const { context, deltas, multipliers } = recordContext(1000);
    const card = createScoreLossCard();
    card.apply(context);

    expect(card.penalty).toBe('score_loss');
    expect(deltas).toEqual([-100]);
    expect(multipliers).toEqual([
      { multiplier: MERGE_CARDS.scoreLossMultiplier, uses: MERGE_CARDS.scoreLossMultiplierUses },
    ]);
  });

  it('rounds the score loss instead of going fractional', () => {
    const { context, deltas } = recordContext(25);
    createScoreLossCard().apply(context);
    expect(deltas).toEqual([-3]);
  });

  it('charges the flat danger-line cost and carries its severity', () => {
    const { context, deltas, multipliers } = recordContext(1000);
    const card = createRaiseDangerLineCard();
    card.apply(context);

    expect(card.penalty).toBe('raise_danger_line');
    expect(card.severity).toBe(MERGE_CARDS.dangerLineSeverity);
    expect(deltas).toEqual([-MERGE_CARDS.dangerLineScoreCost]);
    expect(multipliers).toHaveLength(0);
  });

  it('offers a bigger upside than the reward cards of the same hand', () => {
    const risk = createScoreLossCard();
    expect(risk.severity).toBeGreaterThan(0);
    expect(risk.title).toContain(String(MERGE_CARDS.scoreLossMultiplier));
    expect(MERGE_CARDS.scoreLossMultiplier).toBeGreaterThan(MERGE_CARDS.tripleMultiplier);
  });
});

describe('BasicMergeCardProvider with Game', () => {
  let game: Game | undefined;

  afterEach(() => {
    game?.dispose();
    game = undefined;
  });

  /**
   * Plays a real run until the merge-moment choice opens (deck drawn with
   * `deckSeed`), then picks the risk card the deck guaranteed and reports the
   * score before and after the choice.
   */
  function chooseRiskCardWith(deckSeed: number): {
    riskId: string;
    before: number;
    after: number;
    offered: readonly MergeCard[];
  } {
    const provider = new BasicMergeCardProvider(new SeededRandom(deckSeed));
    let offered: readonly MergeCard[] = [];
    const selector: ISlowMotionSelector = {
      onMergeMoment: (merge: MergeEvent): SlowMotionRequest => {
        offered = provider.draw(merge, SLOW_MOTION.cardCount, SLOW_MOTION.riskCardCount);
        return {
          durationMs: SLOW_MOTION.durationMs,
          timeScale: SLOW_MOTION.timeScale,
          cards: offered,
        };
      },
      onCardChosen: (): void => {},
      onTimeout: (): null => null,
    };
    const liveGame = new Game({ slowMotionSelector: selector });
    game = liveGame;
    liveGame.start(2024);

    expect(dropUntilSlowMoSelect(liveGame, BOARD.width / 2)).toBe(true);
    expect(liveGame.state).toBe('slowmo_select');
    expect(liveGame.getSnapshot().pendingCards).toHaveLength(SLOW_MOTION.cardCount);
    expect(offered.filter(isRiskCard)).toHaveLength(SLOW_MOTION.riskCardCount);

    const risk = offered.find(isRiskCard);
    if (risk === undefined) {
      throw new Error(`deck seed ${deckSeed} offered no risk card`);
    }
    const before = liveGame.score;
    expect(before).toBeGreaterThan(0);
    expect(liveGame.chooseCard(risk)).toBe(true);
    return { riskId: risk.id, before, after: liveGame.score, offered };
  }

  it('charges the flat danger-line cost and resumes the run when that card is picked', () => {
    const { riskId, before, after } = chooseRiskCardWith(4242);

    expect(riskId).toBe(CARD_IDS.raiseDangerLine);
    expect(after).toBe(Math.max(0, before - MERGE_CARDS.dangerLineScoreCost));
    expect(game?.state).not.toBe('slowmo_select');
    expect(game?.getSnapshot().pendingCards).toHaveLength(0);
  });

  it('takes a share of the score when the gamble card is picked', () => {
    const { riskId, before, after } = chooseRiskCardWith(99);

    expect(riskId).toBe(CARD_IDS.scoreLoss);
    expect(after).toBe(before - Math.round(before * MERGE_CARDS.scoreLossRatio));
    expect(after).toBeLessThan(before);
  });
});
