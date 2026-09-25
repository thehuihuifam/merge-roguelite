import { CARD_OVERLAY } from '@/config/gameConfig';
import { clamp01 } from '@/render/motion';
import type { MergeCard } from '@/core/interfaces/IMergeCard';

/**
 * How the card overlay should be presented this frame (session B, Task 4):
 * entrance spring-in, the post-choice exit, and the mouse hover lift.
 * `drawCardOverlay` turns these numbers into transforms and alphas.
 */
export interface CardOverlayPresentation {
  /** Entrance progress 0..1 while the hand scales/fades in. */
  readonly entrance: number;
  /** Exit progress 0..1 while the hand leaves after a choice; null while live. */
  readonly exit: number | null;
  /** The card the player chose, during the exit animation only. */
  readonly selectedIndex: number | null;
  /** Card under the mouse pointer (lift effect); null when none. */
  readonly hoverIndex: number | null;
}

/** One frame of the overlay: which hand to draw and how to present it. */
export interface CardOverlayFrame {
  readonly cards: readonly MergeCard[];
  readonly presentation: CardOverlayPresentation;
}

/**
 * Drives the card overlay animation across the choice window:
 *
 * - a fresh hand (detected by card ids) springs in over
 *   `CARD_OVERLAY.entranceMs`;
 * - `notifyChosen` starts a `CARD_OVERLAY.exitMs` exit during which the
 *   chosen card scales up slightly and the whole overlay fades — the frame
 *   keeps drawing the exiting hand even after the game left
 *   `slowmo_select`;
 * - `setHover` tracks the mouse for the lift effect.
 *
 * Pure presentation state; `CanvasRenderer` advances it once per frame.
 */
export class CardOverlayAnimator {
  private handKey: string | null = null;
  private liveCards: readonly MergeCard[] = [];
  private entranceElapsedMs = 0;
  private exitElapsedMs: number | null = null;
  private exitHand: readonly MergeCard[] = [];
  private selectedIndex: number | null = null;
  private hoverIndex: number | null = null;

  /**
   * Advances the animation. `cards` is the live hand — empty when the choice
   * window is closed.
   */
  update(cards: readonly MergeCard[], deltaMs: number): void {
    const step = Math.max(0, deltaMs);
    if (cards.length > 0) {
      const key = cards.map((card) => card.id).join('|');
      if (key !== this.handKey) {
        // A new hand: spring in from the start, drop any exit in flight.
        this.handKey = key;
        this.entranceElapsedMs = 0;
        this.exitElapsedMs = null;
        this.exitHand = [];
        this.selectedIndex = null;
      }
      this.liveCards = cards;
      this.entranceElapsedMs = Math.min(CARD_OVERLAY.entranceMs, this.entranceElapsedMs + step);
      return;
    }
    this.liveCards = [];
    if (this.exitElapsedMs === null) {
      this.hoverIndex = null;
      return;
    }
    this.exitElapsedMs += step;
    if (this.exitElapsedMs >= CARD_OVERLAY.exitMs) {
      this.finishExit();
    }
  }

  /** Starts the selection exit animation for the card at `index`. */
  notifyChosen(index: number): void {
    if (this.liveCards.length === 0) {
      return;
    }
    this.exitHand = [...this.liveCards];
    this.selectedIndex = index >= 0 && index < this.exitHand.length ? index : null;
    this.exitElapsedMs = 0;
    this.hoverIndex = null;
  }

  /** Sets the card under the mouse pointer, or clears it with null. */
  setHover(index: number | null): void {
    this.hoverIndex = index;
  }

  /** What to draw this frame, or null when there is nothing to present. */
  getFrame(): CardOverlayFrame | null {
    if (this.liveCards.length > 0) {
      return {
        cards: this.liveCards,
        presentation: {
          entrance: clamp01(this.entranceElapsedMs / CARD_OVERLAY.entranceMs),
          exit: null,
          selectedIndex: null,
          hoverIndex: this.hoverIndex,
        },
      };
    }
    if (this.exitElapsedMs !== null && this.exitHand.length > 0) {
      return {
        cards: this.exitHand,
        presentation: {
          entrance: 1,
          exit: clamp01(this.exitElapsedMs / CARD_OVERLAY.exitMs),
          selectedIndex: this.selectedIndex,
          hoverIndex: null,
        },
      };
    }
    return null;
  }

  private finishExit(): void {
    this.exitElapsedMs = null;
    this.exitHand = [];
    this.selectedIndex = null;
    this.handKey = null;
    this.hoverIndex = null;
  }
}
