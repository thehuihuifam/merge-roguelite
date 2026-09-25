import { describe, expect, it } from 'vitest';
import { WebAudioSystem, frequencyForMergeTier } from '@/systems/WebAudioSystem';

describe('WebAudioSystem', () => {
  it('does not throw when AudioContext is unavailable (Node)', () => {
    const audio = new WebAudioSystem();
    expect(() => audio.play('drop')).not.toThrow();
    expect(() => audio.play('merge', { pitch: 440 })).not.toThrow();
    expect(() => audio.play('merge_big')).not.toThrow();
    expect(() => audio.play('game_over')).not.toThrow();
    expect(() => audio.play('card_show')).not.toThrow();
    expect(() => audio.play('card_pick')).not.toThrow();
    expect(() => audio.play('near_miss_loop')).not.toThrow();
    expect(() => audio.stop('near_miss_loop')).not.toThrow();
    expect(() => audio.setMuted(true)).not.toThrow();
    expect(() => audio.setMuted(false)).not.toThrow();
  });

  it('setMuted stops loops and suppresses play', () => {
    const audio = new WebAudioSystem();
    audio.setMuted(true);
    // Should not throw and should not create context.
    audio.play('merge');
    expect(audio.hasContext).toBe(false);
    audio.setMuted(false);
    audio.play('drop');
    // Still no context in Node, but should not throw.
    expect(audio.hasContext).toBe(false);
  });

  it('frequencyForMergeTier increases with tier', () => {
    const f0 = frequencyForMergeTier(0, 0);
    const f1 = frequencyForMergeTier(1, 0);
    const f5 = frequencyForMergeTier(5, 0);
    const fMax = frequencyForMergeTier(null, 0);
    expect(f1).toBeGreaterThan(f0);
    expect(f5).toBeGreaterThan(f1);
    expect(fMax).toBeGreaterThan(f5);
  });

  it('frequencyForMergeTier increases with chain index', () => {
    const fChain0 = frequencyForMergeTier(2, 0);
    const fChain2 = frequencyForMergeTier(2, 2);
    expect(fChain2).toBeGreaterThan(fChain0);
  });

  it('frequencyForMergeTier handles null tier as max', () => {
    const f = frequencyForMergeTier(null, 0);
    expect(f).toBeGreaterThan(0);
    expect(Number.isFinite(f)).toBe(true);
  });

  it('handles all cue types without throwing', () => {
    const audio = new WebAudioSystem();
    const cues = ['drop', 'merge', 'merge_big', 'near_miss_loop', 'game_over', 'card_show', 'card_pick'] as const;
    for (const cue of cues) {
      expect(() => audio.play(cue, { volume: 0.5, pitch: 1.2 })).not.toThrow();
      expect(() => audio.stop(cue)).not.toThrow();
    }
  });
});
