/**
 * Top-level game states.
 *
 *  idle ──start──▶ aiming ──drop──▶ dropping ──settle──▶ aiming
 *                    │  ▲               │  ▲
 *        mergeMoment │  │ resumeAiming  │  │ resumeDropping
 *                    ▼  │   mergeMoment ▼  │
 *                   slowmo_select ◀────────┘
 *  aiming | dropping | slowmo_select ──overflow──▶ game_over ──restart──▶ aiming
 *
 * Merges can happen while aiming (balls keep rolling after the cooldown), so
 * both active states can enter slowmo_select; the Game remembers which one to
 * resume.
 */
export type GameState = 'idle' | 'aiming' | 'dropping' | 'slowmo_select' | 'game_over';

export type GameStateEvent =
  | 'start'
  | 'drop'
  | 'settle'
  | 'mergeMoment'
  | 'resumeAiming'
  | 'resumeDropping'
  | 'overflow'
  | 'restart';

export const TRANSITIONS: Readonly<Record<GameState, Partial<Record<GameStateEvent, GameState>>>> =
  {
    idle: { start: 'aiming' },
    aiming: { drop: 'dropping', mergeMoment: 'slowmo_select', overflow: 'game_over' },
    dropping: { settle: 'aiming', mergeMoment: 'slowmo_select', overflow: 'game_over' },
    slowmo_select: { resumeAiming: 'aiming', resumeDropping: 'dropping', overflow: 'game_over' },
    game_over: { restart: 'aiming' },
  };
