// gsettings.ts — testably encapsulated gsettings access.
export interface GSettingsRunner {
  get(schema: string, key: string): Promise<string | null>;
  set(schema: string, key: string, value: string): Promise<number>;
}

/** Real gsettings runner; `env` optionally sets a different environment. */
function makeRealGSettings(env?: Record<string, string | undefined>): GSettingsRunner {
  const spawn = (args: string[]) => (env ? Bun.spawnSync(args, { env }) : Bun.spawnSync(args));
  return {
    async get(schema, key): Promise<string | null> {
      try {
        const out = spawn(["gsettings", "get", schema, key]);
        if (out.exitCode !== 0) return null;
        return new TextDecoder().decode(out.stdout).trim() || null;
      } catch {
        return null;
      }
    },
    async set(schema, key, value): Promise<number> {
      try {
        const out = spawn(["gsettings", "set", schema, key, value]);
        return out.exitCode ?? -1;
      } catch {
        return -1;
      }
    },
  };
}

export const realGSettings: GSettingsRunner = makeRealGSettings();

/** In-memory fake for tests. */
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

/**
 * gsettings runner that sets a language schema dir (needed for extension
 * schemas, e.g. org.gnome.shell.extensions.user-theme, which are not
 * system-compiled).
 */
export function realGSettingsWithSchemaDir(schemaDir: string): GSettingsRunner {
  return makeRealGSettings({ ...process.env, GSETTINGS_SCHEMA_DIR: schemaDir });
}
