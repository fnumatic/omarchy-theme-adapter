// cli.test.ts — integration test of the `set` orchestration (only --dry-run, writes nothing).
import { test, expect } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const exists = (p: string): Promise<boolean> => access(p).then(() => true, () => false);

const CLI = join(import.meta.dir, "cli.ts");
const PROJECT_ROOT = join(import.meta.dir, "..");

test("themeswitch set <theme> --dry-run runs through and creates no artifacts", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-cli-"));
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_STATE_HOME: join(home, ".local", "state"),
    // `code` & co. not found → optional adapters are skipped.
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
  // No themeswitch artifacts (`.bun` is a runtime artifact of the Bun process).
  expect(await exists(join(home, ".config", "ghostty"))).toBe(false);
  expect(await exists(join(home, ".config", "gtk-4.0"))).toBe(false);
  expect(await exists(join(home, ".themes"))).toBe(false);
  expect(await exists(join(home, ".local", "state", "themeswitch"))).toBe(false);
  await rm(home, { recursive: true, force: true });
});
