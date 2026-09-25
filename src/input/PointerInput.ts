export interface PointerInputHandlers {
  readonly onAim: (clientX: number) => void;
  readonly onDrop: (clientX: number) => void;
  /** Pointer release in board coordinates; used to pick a merge card. */
  readonly onSelect: (clientX: number, clientY: number) => void;
  readonly onRestart: () => void;
  readonly onNudge: (deltaX: number) => void;
}

/**
 * Translates pointer + keyboard events into aim/drop/restart intents.
 * Drop fires on pointer release so touch users can slide before committing.
 */
export class PointerInput {
  private readonly disposers: Array<() => void> = [];
  private activePointerId: number | null = null;

  constructor(
    private readonly target: HTMLElement,
    private readonly handlers: PointerInputHandlers,
  ) {}

  attach(): void {
    this.listen(this.target, 'pointerdown', (event: PointerEvent) => {
      if (this.activePointerId !== null && this.activePointerId !== event.pointerId) {
        return;
      }
      this.activePointerId = event.pointerId;
      this.target.setPointerCapture(event.pointerId);
      this.handlers.onAim(event.clientX);
    });
    this.listen(this.target, 'pointermove', (event: PointerEvent) => {
      if (this.activePointerId !== null && this.activePointerId !== event.pointerId) {
        return;
      }
      this.handlers.onAim(event.clientX);
    });
    this.listen(this.target, 'pointerup', (event: PointerEvent) => {
      if (this.activePointerId !== event.pointerId) {
        return;
      }
      this.activePointerId = null;
      this.handlers.onAim(event.clientX);
      this.handlers.onSelect(event.clientX, event.clientY);
      this.handlers.onDrop(event.clientX);
    });
    this.listen(this.target, 'pointercancel', (event: PointerEvent) => {
      if (this.activePointerId === event.pointerId) {
        this.activePointerId = null;
      }
    });
    this.listen(this.target, 'contextmenu', (event: Event) => {
      event.preventDefault();
    });
    this.listen(window, 'keydown', (event: KeyboardEvent) => {
      switch (event.code) {
        case 'Space':
        case 'ArrowDown':
        case 'Enter':
          event.preventDefault();
          this.handlers.onDrop(Number.NaN);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.handlers.onNudge(-12);
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.handlers.onNudge(12);
          break;
        case 'KeyR':
          this.handlers.onRestart();
          break;
        default:
          break;
      }
    });
  }

  detach(): void {
    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.activePointerId = null;
  }

  private listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ): void;
  private listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
  ): void;
  private listen(target: EventTarget, type: string, listener: (event: never) => void): void {
    const bound = listener as EventListener;
    target.addEventListener(type, bound);
    this.disposers.push(() => {
      target.removeEventListener(type, bound);
    });
  }
}
