import type { Ball, BallId, MergeEvent, NearMissSample, Vec2 } from '@/core/types';
import type { GameState } from '@/core/state/GameState';

export interface GameEventMap {
  'run:started': { seed: number };
  'run:over': { score: number; best: number };
  'state:changed': { from: GameState; to: GameState };
  'ball:spawned': { ball: Ball };
  'ball:dropped': { ball: Ball };
  'merge:resolved': MergeEvent;
  'bomb:spawned': { bomb: Ball };
  'bomb:contact': { bomb: Ball; other: Ball };
  'ball:detonated': { bombId: BallId; removedIds: readonly BallId[]; position: Vec2 };
  'score:changed': { score: number; best: number; delta: number };
  'danger:nearMissEnter': NearMissSample;
  'danger:nearMissUpdate': NearMissSample;
  'danger:nearMissExit': Record<string, never>;
  'time:slowMotionStart': { durationMs: number; timeScale: number };
  'time:slowMotionEnd': Record<string, never>;
}

export type GameEventName = keyof GameEventMap;
