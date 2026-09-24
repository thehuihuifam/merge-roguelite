export interface SaveData {
  readonly version: number;
  readonly bestScore: number;
  readonly totalRuns: number;
  readonly lastSeed: number | null;
}

export interface ISaveSystem {
  load(): SaveData;
  save(data: SaveData): void;
  clear(): void;
}
