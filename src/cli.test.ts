// cli.test.ts — Integrationstest der `set`-Orchestrierung (nur --dry-run, schreibt nichts).
import { test, expect } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const exists = (p: string): Promise<boolean> => access(p).then(() => true, () => false);

const CLI = join(import.meta.dir, "cli.ts");
const PROJECT_ROOT = join(import.meta.dir, "..");

test("themeswitch set <theme> --dry-run läuft durch und legt keine Artefakte an", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-cli-"));
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_STATE_HOME: join(home, ".local", "state"),
    // `code` & Co. nicht auffindbar → optionale Adapter werden übersprungen.
    PATH: "/nonexistent",
  };
  const out = Bun.spawnSync([process.execPath, CLI, "set", "rose-pine", "--dry-run"], {
    env,
    cwd: PROJECT_ROOT,
  });
  const text = new TextDecoder().decode(out.stdout);
  expect(out.exitCode).toBe(0);
  expect(text).toContain("Rose Pine");
  expect(text).toContain("dry-run");
  // Keine themeswitch-Artefakte (`.bun` ist ein Runtime-Artefakt des Bun-Prozesses).
  expect(await exists(join(home, ".config", "ghostty"))).toBe(false);
  expect(await exists(join(home, ".config", "gtk-4.0"))).toBe(false);
  expect(await exists(join(home, ".themes"))).toBe(false);
  expect(await exists(join(home, ".local", "state", "themeswitch"))).toBe(false);
  await rm(home, { recursive: true, force: true });
});
