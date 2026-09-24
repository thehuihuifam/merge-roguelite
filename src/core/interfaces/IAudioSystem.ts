export type SoundCue =
  'drop' | 'merge' | 'merge_big' | 'near_miss_loop' | 'game_over' | 'card_show' | 'card_pick';

export interface IAudioSystem {
  play(cue: SoundCue, options?: { pitch?: number; volume?: number }): void;
  stop(cue: SoundCue): void;
  setMuted(muted: boolean): void;
}
