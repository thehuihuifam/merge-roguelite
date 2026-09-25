import { afterEach, describe, expect, it, vi } from 'vitest';
import { PointerInput } from '@/input/PointerInput';
import type { PointerInputHandlers } from '@/input/PointerInput';

class FakePointerTarget extends EventTarget {
  readonly capturedPointerIds: number[] = [];

  setPointerCapture(pointerId: number): void {
    this.capturedPointerIds.push(pointerId);
  }
}

interface PointerCoordinates {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  coordinates: PointerCoordinates,
): void {
  const event = new Event(type);
  Object.defineProperties(event, {
    pointerId: { value: coordinates.pointerId },
    clientX: { value: coordinates.clientX },
    clientY: { value: coordinates.clientY },
  });
  target.dispatchEvent(event);
}

interface KeyModifiers {
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
}

function dispatchKey(target: EventTarget, code: string, modifiers: KeyModifiers = {}): Event {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, {
    code: { value: code },
    altKey: { value: modifiers.altKey ?? false },
    ctrlKey: { value: modifiers.ctrlKey ?? false },
    metaKey: { value: modifiers.metaKey ?? false },
    shiftKey: { value: modifiers.shiftKey ?? false },
  });
  target.dispatchEvent(event);
  return event;
}

function createHandlers(): PointerInputHandlers & {
  onAim: ReturnType<typeof vi.fn>;
  onDrop: ReturnType<typeof vi.fn>;
  onSelect: ReturnType<typeof vi.fn>;
  onChooseCard: ReturnType<typeof vi.fn>;
  onRestart: ReturnType<typeof vi.fn>;
  onNudge: ReturnType<typeof vi.fn>;
} {
  return {
    onAim: vi.fn((_clientX: number): void => undefined),
    onDrop: vi.fn((_clientX: number): void => undefined),
    onSelect: vi.fn((_clientX: number, _clientY: number): void => undefined),
    onChooseCard: vi.fn((_cardIndex: number): boolean => true),
    onRestart: vi.fn((): void => undefined),
    onNudge: vi.fn((_deltaX: number): void => undefined),
  };
}

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('PointerInput touch/pointer handling', () => {
  it('aims while a touch slides and drops/selects at the release point', () => {
    const target = new FakePointerTarget();
    const keyboardTarget = new EventTarget();
    vi.stubGlobal('window', keyboardTarget);
    const handlers = createHandlers();
    const input = new PointerInput(target as unknown as HTMLElement, handlers);
    input.attach();

    dispatchPointer(target, 'pointerdown', { pointerId: 7, clientX: 80, clientY: 100 });
    dispatchPointer(target, 'pointermove', { pointerId: 7, clientX: 125, clientY: 220 });
    dispatchPointer(target, 'pointerup', { pointerId: 7, clientX: 145, clientY: 360 });

    expect(target.capturedPointerIds).toEqual([7]);
    expect(handlers.onAim.mock.calls).toEqual([[80], [125], [145]]);
    expect(handlers.onSelect).toHaveBeenCalledExactlyOnceWith(145, 360);
    expect(handlers.onDrop).toHaveBeenCalledExactlyOnceWith(145);

    input.detach();
  });

  it('does not let another touch finish or steer the active pointer gesture', () => {
    const target = new FakePointerTarget();
    vi.stubGlobal('window', new EventTarget());
    const handlers = createHandlers();
    const input = new PointerInput(target as unknown as HTMLElement, handlers);
    input.attach();

    dispatchPointer(target, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 90 });
    dispatchPointer(target, 'pointerdown', { pointerId: 2, clientX: 300, clientY: 300 });
    dispatchPointer(target, 'pointermove', { pointerId: 2, clientX: 320, clientY: 320 });
    dispatchPointer(target, 'pointerup', { pointerId: 2, clientX: 320, clientY: 320 });
    dispatchPointer(target, 'pointerup', { pointerId: 1, clientX: 60, clientY: 100 });

    expect(target.capturedPointerIds).toEqual([1]);
    expect(handlers.onAim.mock.calls).toEqual([[50], [60]]);
    expect(handlers.onSelect).toHaveBeenCalledExactlyOnceWith(60, 100);
    expect(handlers.onDrop).toHaveBeenCalledExactlyOnceWith(60);

    input.detach();
  });

  it('cancels a touch without dropping and allows the next touch to start', () => {
    const target = new FakePointerTarget();
    vi.stubGlobal('window', new EventTarget());
    const handlers = createHandlers();
    const input = new PointerInput(target as unknown as HTMLElement, handlers);
    input.attach();

    dispatchPointer(target, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 90 });
    dispatchPointer(target, 'pointercancel', { pointerId: 1, clientX: 50, clientY: 90 });
    dispatchPointer(target, 'pointerup', { pointerId: 1, clientX: 50, clientY: 90 });
    dispatchPointer(target, 'pointerdown', { pointerId: 2, clientX: 90, clientY: 120 });
    dispatchPointer(target, 'pointerup', { pointerId: 2, clientX: 100, clientY: 140 });

    expect(handlers.onSelect).toHaveBeenCalledExactlyOnceWith(100, 140);
    expect(handlers.onDrop).toHaveBeenCalledExactlyOnceWith(100);

    input.detach();
  });

  it('maps top-row and numpad 1/2/3 keys to the corresponding card indexes', () => {
    const target = new FakePointerTarget();
    const keyboardTarget = new EventTarget();
    vi.stubGlobal('window', keyboardTarget);
    const handlers = createHandlers();
    const input = new PointerInput(target as unknown as HTMLElement, handlers);
    input.attach();

    const codes = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'];
    const events = codes.map((code) => dispatchKey(keyboardTarget, code));

    expect(handlers.onChooseCard.mock.calls).toEqual([[0], [1], [2], [0], [1], [2]]);
    expect(events.every((event) => event.defaultPrevented)).toBe(true);

    input.detach();
  });

  it('does not prevent a card key when the app declines the selection', () => {
    const target = new FakePointerTarget();
    const keyboardTarget = new EventTarget();
    vi.stubGlobal('window', keyboardTarget);
    const handlers = createHandlers();
    handlers.onChooseCard.mockReturnValue(false);
    const input = new PointerInput(target as unknown as HTMLElement, handlers);
    input.attach();

    const event = dispatchKey(keyboardTarget, 'Digit1');

    expect(handlers.onChooseCard).toHaveBeenCalledExactlyOnceWith(0);
    expect(event.defaultPrevented).toBe(false);

    input.detach();
  });

  it('does not intercept modified number shortcuts', () => {
    const target = new FakePointerTarget();
    const keyboardTarget = new EventTarget();
    vi.stubGlobal('window', keyboardTarget);
    const handlers = createHandlers();
    const input = new PointerInput(target as unknown as HTMLElement, handlers);
    input.attach();

    const event = dispatchKey(keyboardTarget, 'Digit1', { ctrlKey: true });

    expect(handlers.onChooseCard).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    input.detach();
  });

  it('continues to aim from pointer movement while no pointer is pressed', () => {
    const target = new FakePointerTarget();
    vi.stubGlobal('window', new EventTarget());
    const handlers = createHandlers();
    const input = new PointerInput(target as unknown as HTMLElement, handlers);
    input.attach();

    dispatchPointer(target, 'pointermove', { pointerId: 1, clientX: 210, clientY: 30 });

    expect(handlers.onAim).toHaveBeenCalledExactlyOnceWith(210);
    expect(handlers.onDrop).not.toHaveBeenCalled();

    input.detach();
  });
});
