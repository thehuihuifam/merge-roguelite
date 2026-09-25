/**
 * Numeric motion curves for canvas animation — the canvas-side counterparts
 * of the session-A `DESIGN.easing` CSS tokens (which the DOM layer consumes).
 * Renderers animate with these so both layers share one motion language:
 *
 * - `easeOutCubic`  ↔ `DESIGN.easing.decelerate` — entering elements
 *   decelerate to rest (count-ups, fades, exits).
 * - `easeOutBack`   ↔ `DESIGN.easing.emphasis` — springy overshoot for
 *   rewards and pops (card entrances).
 */

/** Clamps to 0..1; non-finite input collapses to 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/** Decelerating ease-out (canvas counterpart of `DESIGN.easing.decelerate`). */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Springy overshoot (canvas counterpart of `DESIGN.easing.emphasis`). The
 * overshoot amount mirrors the token's 1.56 control point, so card entrances
 * pop exactly as the design system prescribes.
 */
export function easeOutBack(t: number, overshoot = 1.56): number {
  const x = clamp01(t);
  const inv = x - 1;
  return 1 + inv * inv * ((overshoot + 1) * inv + overshoot);
}
