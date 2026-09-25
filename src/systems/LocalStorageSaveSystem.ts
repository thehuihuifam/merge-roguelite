import { type ISaveSystem, type SaveData } from '@/core/interfaces/ISaveSystem';

export const SAVE_STORAGE_KEY = 'merge-roguelite:save';
export const SAVE_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function defaultSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    bestScore: 0,
    totalRuns: 0,
    lastSeed: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSaveData(raw: string | null): SaveData | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    const version = typeof parsed.version === 'number' ? parsed.version : SAVE_VERSION;
    const bestScore = typeof parsed.bestScore === 'number' && Number.isFinite(parsed.bestScore) ? Math.max(0, Math.floor(parsed.bestScore)) : 0;
    const totalRuns = typeof parsed.totalRuns === 'number' && Number.isFinite(parsed.totalRuns) ? Math.max(0, Math.floor(parsed.totalRuns)) : 0;
    const lastSeed = typeof parsed.lastSeed === 'number' && Number.isFinite(parsed.lastSeed) ? parsed.lastSeed >>> 0 : null;
    return {
      version,
      bestScore,
      totalRuns,
      lastSeed,
    };
  } catch {
    return null;
  }
}

function resolveStorage(explicit?: StorageLike | null): StorageLike {
  if (explicit !== undefined && explicit !== null) {
    return explicit;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Probe localStorage availability (Safari private mode can throw on access).
      const probeKey = '__merge_roguelite_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return window.localStorage as unknown as StorageLike;
    }
  } catch {
    // Fall through to memory storage.
  }
  return new MemoryStorage();
}

/**
 * localStorage-backed ISaveSystem.
 * Stores best score, total runs and last seed as JSON.
 * Safe to use in Node tests via injected StorageLike or memory fallback.
 */
export class LocalStorageSaveSystem implements ISaveSystem {
  private readonly storage: StorageLike;
  private readonly key: string;

  constructor(storage?: StorageLike | null, key: string = SAVE_STORAGE_KEY) {
    this.storage = resolveStorage(storage);
    this.key = key;
  }

  load(): SaveData {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      raw = null;
    }
    const parsed = parseSaveData(raw);
    if (parsed === null) {
      return defaultSaveData();
    }
    // If version mismatches, keep bestScore/totalRuns/lastSeed but bump version.
    if (parsed.version !== SAVE_VERSION) {
      return {
        version: SAVE_VERSION,
        bestScore: parsed.bestScore,
        totalRuns: parsed.totalRuns,
        lastSeed: parsed.lastSeed,
      };
    }
    return parsed;
  }

  save(data: SaveData): void {
    const toSave: SaveData = {
      version: SAVE_VERSION,
      bestScore: Math.max(0, Math.floor(data.bestScore)),
      totalRuns: Math.max(0, Math.floor(data.totalRuns)),
      lastSeed: data.lastSeed === null ? null : data.lastSeed >>> 0,
    };
    try {
      this.storage.setItem(this.key, JSON.stringify(toSave));
    } catch {
      // Ignore quota or unavailable storage errors — game remains playable.
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Ignore.
    }
  }
}
