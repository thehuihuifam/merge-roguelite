/**
 * Shared canvas path helpers. Tracing only — callers decide fill/stroke so
 * shadow and line styles stay under their control.
 */

/** Traces a rounded-rectangle path (radius clamped to half the short side). */
export function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(right, y, right, bottom, r);
  ctx.arcTo(right, bottom, x, bottom, r);
  ctx.arcTo(x, bottom, x, y, r);
  ctx.arcTo(x, y, right, y, r);
  ctx.closePath();
}
