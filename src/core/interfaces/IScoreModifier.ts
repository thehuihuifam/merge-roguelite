export interface ScoreContext {
  readonly resultTier: number | null;
  readonly chainIndex: number;
  readonly currentScore: number;
}

/** Multiplier cards, round bonuses and special balls plug into scoring through this. */
export interface IScoreModifier {
  readonly id: string;
  modify(points: number, context: ScoreContext): number;
}
