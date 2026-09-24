import { canMerge, resultTierFor } from '@/core/merge/MergeRules';
import type { Ball, BallId, CollisionPair, MergePlan } from '@/core/types';

export type BallLookup = (id: BallId) => Ball | undefined;

/**
 * Turns raw collision pairs into a conflict-free list of merges.
 * Each ball participates in at most one merge per resolution pass; the first
 * eligible pair wins, which keeps results deterministic given ordered input.
 */
export class MergeResolver {
  resolve(pairs: readonly CollisionPair[], lookup: BallLookup): MergePlan[] {
    const consumed = new Set<BallId>();
    const plans: MergePlan[] = [];

    for (const pair of pairs) {
      if (consumed.has(pair.a) || consumed.has(pair.b)) {
        continue;
      }
      const a = lookup(pair.a);
      const b = lookup(pair.b);
      if (a === undefined || b === undefined) {
        continue;
      }
      if (!canMerge(a, b)) {
        continue;
      }
      consumed.add(a.id);
      consumed.add(b.id);
      plans.push({
        sourceIds: [a.id, b.id],
        resultTier: resultTierFor(a.tier),
        position: {
          x: (a.position.x + b.position.x) / 2,
          y: (a.position.y + b.position.y) / 2,
        },
      });
    }

    return plans;
  }
}
