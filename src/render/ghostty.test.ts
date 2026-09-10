import { test, expect, beforeEach } from "bun:test";
import { parseColors, type Colors } from "../colors.ts";
import { resolvePalette, type Palette } from "../palette.ts";
import { renderGhostty, installGhostty } from "./ghostty.ts";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Ghostty theme name as produced by the theme resolver (`<id>.conf`). */
const TEST_THEME = "test-theme.conf";

let base: Colors;
let pal: Palette;

beforeEach(() => {
  base = parseColors(
    `mode = "light"
background = "#faf4ed"
foreground = "#575279"
bright_foreground = "#575279"
selection = "#dfdad9"
muted = "#cecacd"
red = "#b4637a"
green = "#286983"
yellow = "#ea9d34"
blue = "#56949f"
magenta = "#907aa9"
cyan = "#d7827e"
bright_red = "#b4637a"
bright_green = "#286983"
bright_yellow = "#ea9d34"
bright_blue = "#56949f"
bright_magenta = "#907aa9"
bright_cyan = "#d7827e"`,
  );
  pal = resolvePalette(base);
});

test("renderGhostty contains base and selection lines", () => {
  const out = renderGhostty(pal);
  expect(out).toContain("background = #faf4ed");
  expect(out).toContain("foreground = #575279");
  expect(out).toContain("cursor-color = #575279");
  expect(out).toContain("selection-background = #dfdad9");
});

test("renderGhostty: palette 0..15 in Omarchy order", () => {
  const out = renderGhostty(pal);
  expect(out).toContain("palette = 0=#faf4ed"); // background
  expect(out).toContain("palette = 1=#b4637a"); // red
  expect(out).toContain("palette = 2=#286983"); // green
  expect(out).toContain("palette = 3=#ea9d34"); // yellow
  expect(out).toContain("palette = 4=#56949f"); // blue
  expect(out).toContain("palette = 8=#cecacd"); // muted
  expect(out).toContain("palette = 13=#907aa9"); // bright_magenta
  expect(out).toContain("palette = 15=#575279"); // bright_foreground
});

test("renderGhostty ends with newline", () => {
  expect(renderGhostty(pal).endsWith("\n")).toBe(true);
});

test("installGhostty --dry-run changes nothing on disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-dry-"));
  const res = await installGhostty(renderGhostty(pal), {
    dry: true,
    configDir: dir,
    themeName: TEST_THEME,
  });
  expect(res.themeFile).toContain(TEST_THEME);
  const existing = await readFile(join(dir, "config")).catch(() => null);
  expect(existing).toBeNull();
});

test("installGhostty writes theme and sets theme line (with backup)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-inst-"));
  await mkdir(join(dir, "themes"), { recursive: true });
  const cfgPath = join(dir, "config");
  await writeFile(cfgPath, 'background = "#111"\ntheme = light:GitHub Light Default, dark: GitHub Dark\n');

  const res = await installGhostty(renderGhostty(pal), {
    dry: false,
    configDir: dir,
    themeName: TEST_THEME,
  });

  // Theme file and theme reference are identical (Ghostty lists user themes WITH extension)
  expect(res.themeFile.endsWith(`/${TEST_THEME}`)).toBe(true);
  const themeText = await readFile(join(dir, "themes", TEST_THEME), "utf8");
  expect(themeText).toContain("palette = 13=#907aa9");

  // Config: theme replaced
  const newCfg = await readFile(cfgPath, "utf8");
  expect(newCfg).toContain(`theme = ${TEST_THEME}`);
  expect(newCfg).not.toContain("GitHub Light");

  // Backup present with original
  expect(res.backupFile).toBeDefined();
  const backupText = await readFile(res.backupFile!, "utf8");
  expect(backupText).toContain("GitHub Light");
});