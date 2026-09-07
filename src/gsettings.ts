// gsettings.ts — testbar kapselter gsettings-Zugriff.
export interface GSettingsRunner {
  get(schema: string, key: string): Promise<string | null>;
  set(schema: string, key: string, value: string): Promise<number>;
}

export const realGSettings: GSettingsRunner = {
  async get(schema, key): Promise<string | null> {
    try {
      const out = Bun.spawnSync(["gsettings", "get", schema, key]);
      if (out.exitCode !== 0) return null;
      return new TextDecoder().decode(out.stdout).trim() || null;
    } catch {
      return null;
    }
  },
  async set(schema, key, value): Promise<number> {
    try {
      const out = Bun.spawnSync(["gsettings", "set", schema, key, value]);
      return out.exitCode ?? -1;
    } catch {
      return -1;
    }
  },
};

/** In-Memory-Fake für Tests. */
export function fakeGSettings(initial: Record<string, string> = {}): GSettingsRunner & {
  store: Record<string, string>;
  sets: Array<[string, string, string]>;
} {
  const store = { ...initial };
  const sets: Array<[string, string, string]> = [];
  return {
    store,
    sets,
    async get(schema, key) {
      return store[`${schema} ${key}`] ?? null;
    },
    async set(schema, key, value) {
      sets.push([schema, key, value]);
      store[`${schema} ${key}`] = value;
      return 0;
    },
  };
}
