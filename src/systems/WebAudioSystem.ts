import { AUDIO } from '@/config/gameConfig';
import type { IAudioSystem, SoundCue } from '@/core/interfaces/IAudioSystem';

type AudioContextConstructor = new () => AudioContext;

interface LoopVoice {
  osc: OscillatorNode;
  gain: GainNode;
  started: boolean;
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as unknown as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Returns the frequency for a merge SFX, proportional to tier.
 * Each tier is `semitonePerTier` semitones higher, chain adds extra pitch.
 * Exported for tests and for createApp wiring.
 */
export function frequencyForMergeTier(tier: number | null, chainIndex = 0): number {
  const base = AUDIO.mergeBaseFreq;
  if (tier === null) {
    // Max-tier vanish is the brightest.
    return base * Math.pow(2, (AUDIO.mergeFreqSemitonePerTier * 11 + chainIndex * AUDIO.mergeChainSemitone) / 12);
  }
  const clampedTier = Math.max(0, tier);
  const semitones = clampedTier * AUDIO.mergeFreqSemitonePerTier + chainIndex * AUDIO.mergeChainSemitone;
  return base * Math.pow(2, semitones / 12);
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/**
 * WebAudio-based IAudioSystem.
 * No-ops when AudioContext is unavailable (Node tests, unsupported browsers).
 * All play() calls are fire-and-forget with short envelopes.
 */
export class WebAudioSystem implements IAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private readonly loops = new Map<SoundCue, LoopVoice>();

  private ensureContext(): AudioContext | null {
    if (this.ctx !== null) {
      return this.ctx;
    }
    const Ctor = getAudioContextConstructor();
    if (Ctor === null) {
      return null;
    }
    try {
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = this.muted ? 0 : AUDIO.masterVolume;
      gain.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = gain;
      return ctx;
    } catch {
      return null;
    }
  }

  private ensureResumed(ctx: AudioContext): void {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Ignore — user gesture may be required.
      });
    }
  }

  play(cue: SoundCue, options?: { pitch?: number; volume?: number }): void {
    if (this.muted) {
      return;
    }
    const ctx = this.ensureContext();
    if (ctx === null || this.masterGain === null) {
      return;
    }
    this.ensureResumed(ctx);

    const volume = options?.volume !== undefined ? clamp01(options.volume) : 1;
    const pitch = options?.pitch;

    try {
      switch (cue) {
        case 'drop':
          this.playTone(ctx, 180 * (pitch ?? 1), AUDIO.shortDurationMs * 0.6, 'sine', 0.5 * volume);
          break;
        case 'merge':
          {
            const freq = pitch !== undefined ? 220 * pitch : frequencyForMergeTier(0, 0);
            // pitch option overrides tier-based freq if provided.
            const actualFreq = pitch !== undefined && pitch > 10 ? pitch : freq;
            this.playTone(ctx, actualFreq, AUDIO.shortDurationMs, 'sine', 0.7 * volume);
          }
          break;
        case 'merge_big':
          {
            const freq = pitch !== undefined && pitch > 10 ? pitch : frequencyForMergeTier(null, 0);
            this.playTone(ctx, freq, AUDIO.longDurationMs * 0.6, 'sine', 0.9 * volume);
            this.playTone(ctx, freq * 1.5, AUDIO.longDurationMs * 0.5, 'triangle', 0.4 * volume, 0.05);
          }
          break;
        case 'game_over':
          this.playDescending(ctx, 400 * (pitch ?? 1), 120 * (pitch ?? 1), AUDIO.longDurationMs, 'sawtooth', 0.8 * volume);
          break;
        case 'card_show':
          this.playTone(ctx, 600 * (pitch ?? 1), AUDIO.shortDurationMs, 'sine', 0.5 * volume);
          this.playTone(ctx, 900 * (pitch ?? 1), AUDIO.shortDurationMs, 'sine', 0.3 * volume, 0.06);
          break;
        case 'card_pick':
          this.playTone(ctx, 800 * (pitch ?? 1), AUDIO.shortDurationMs, 'sine', 0.6 * volume);
          this.playTone(ctx, 1200 * (pitch ?? 1), AUDIO.shortDurationMs * 1.2, 'sine', 0.4 * volume, 0.08);
          break;
        case 'near_miss_loop':
          this.startLoop(ctx, cue, 55 * (pitch ?? 1), 'sawtooth', 0.12 * volume);
          break;
        default:
          break;
      }
    } catch {
      // Ignore WebAudio errors — SFX is juice, not core.
    }
  }

  stop(cue: SoundCue): void {
    const loop = this.loops.get(cue);
    if (loop === undefined) {
      return;
    }
    try {
      if (loop.started) {
        loop.gain.gain.linearRampToValueAtTime(0, (this.ctx?.currentTime ?? 0) + 0.08);
        loop.osc.stop((this.ctx?.currentTime ?? 0) + 0.1);
      }
    } catch {
      // Ignore.
    }
    this.loops.delete(cue);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain !== null && this.ctx !== null) {
      try {
        this.masterGain.gain.value = muted ? 0 : AUDIO.masterVolume;
      } catch {
        // Ignore.
      }
    }
    if (muted) {
      // Stop all loops when muted.
      for (const cue of this.loops.keys()) {
        this.stop(cue);
      }
    }
  }

  /** For tests: whether AudioContext was created. */
  get hasContext(): boolean {
    return this.ctx !== null;
  }

  private playTone(
    ctx: AudioContext,
    frequency: number,
    durationMs: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = Math.max(20, frequency);
    const now = ctx.currentTime + delaySec;
    const durationSec = durationMs / 1000;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(this.masterGain as GainNode);
    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  }

  private playDescending(
    ctx: AudioContext,
    fromFreq: number,
    toFreq: number,
    durationMs: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const now = ctx.currentTime;
    const durationSec = durationMs / 1000;
    osc.frequency.setValueAtTime(fromFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), now + durationSec);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(this.masterGain as GainNode);
    osc.start(now);
    osc.stop(now + durationSec + 0.1);
  }

  private startLoop(ctx: AudioContext, cue: SoundCue, frequency: number, type: OscillatorType, volume: number): void {
    if (this.loops.has(cue)) {
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this.masterGain as GainNode);
    osc.start();
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.2);
    this.loops.set(cue, { osc, gain, started: true });
  }
}
