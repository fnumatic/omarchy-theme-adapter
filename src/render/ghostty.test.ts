import { test, expect, beforeEach } from "bun:test";
import { parseColors, type Colors } from "../colors.ts";
import {
  renderGhostty,
  installGhostty,
  GHOSTTY_THEME_NAME,
  GHOSTTY_THEME_FILE,
} from "./ghostty.ts";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let base: Colors;

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
});

test("renderGhostty enthält Basis- und selection-Zeilen", () => {
  const out = renderGhostty(base);
  expect(out).toContain("background = #faf4ed");
  expect(out).toContain("foreground = #575279");
  expect(out).toContain("cursor-color = #575279");
  expect(out).toContain("selection-background = #dfdad9");
});

test("renderGhostty: Palette 0..15 in Omarchy-Reihenfolge", () => {
  const out = renderGhostty(base);
  expect(out).toContain("palette = 0=#faf4ed"); // background
  expect(out).toContain("palette = 1=#b4637a"); // red
  expect(out).toContain("palette = 2=#286983"); // green
  expect(out).toContain("palette = 3=#ea9d34"); // yellow
  expect(out).toContain("palette = 4=#56949f"); // blue
  expect(out).toContain("palette = 8=#cecacd"); // muted
  expect(out).toContain("palette = 13=#907aa9"); // bright_magenta
  expect(out).toContain("palette = 15=#575279"); // bright_foreground
});

test("renderGhostty endet mit newline", () => {
  expect(renderGhostty(base).endsWith("\n")).toBe(true);
});

test("installGhostty --dry-run ändert nichts auf der Platte", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-dry-"));
  const res = await installGhostty(renderGhostty(base), { dry: true, configDir: dir });
  expect(res.themeFile).toContain(GHOSTTY_THEME_NAME);
  const existing = await readFile(join(dir, "config")).catch(() => null);
  expect(existing).toBeNull();
});

test("installGhostty schreibt Theme und setzt theme-Zeile (mit Backup)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-inst-"));
  await mkdir(join(dir, "themes"), { recursive: true });
  const cfgPath = join(dir, "config");
  await writeFile(cfgPath, 'background = "#111"\ntheme = light:GitHub Light Default, dark: GitHub Dark\n');

  const res = await installGhostty(renderGhostty(base), { dry: false, configDir: dir });

  // Theme-Datei und theme-Referenz sind identisch (Ghostty listet User-Themes MIT Endung)
  expect(res.themeFile.endsWith(`/${GHOSTTY_THEME_FILE}`)).toBe(true);
  const themeText = await readFile(join(dir, "themes", GHOSTTY_THEME_FILE), "utf8");
  expect(themeText).toContain("palette = 13=#907aa9");

  // Config: theme ersetzt
  const newCfg = await readFile(cfgPath, "utf8");
  expect(newCfg).toContain(`theme = ${GHOSTTY_THEME_NAME}`);
  expect(newCfg).not.toContain("GitHub Light");

  // Backup vorhanden mit Original
  expect(res.backupFile).toBeDefined();
  const backupText = await readFile(res.backupFile!, "utf8");
  expect(backupText).toContain("GitHub Light");
});