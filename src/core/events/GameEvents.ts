import type { Ball, MergeEvent, NearMissSample } from '@/core/types';
import type { GameState } from '@/core/state/GameState';

export interface GameEventMap {
  'run:started': { seed: number };
  'run:over': { score: number; best: number };
  'state:changed': { from: GameState; to: GameState };
  'ball:spawned': { ball: Ball };
  'ball:dropped': { ball: Ball };
  'merge:resolved': MergeEvent;
  'score:changed': { score: number; best: number; delta: number };
  'danger:nearMissEnter': NearMissSample;
  'danger:nearMissUpdate': NearMissSample;
  'danger:nearMissExit': Record<string, never>;
  'time:slowMotionStart': { durationMs: number; timeScale: number };
  'time:slowMotionEnd': Record<string, never>;
}

export type GameEventName = keyof GameEventMap;
