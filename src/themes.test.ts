import { test, expect } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadTheme,
  listThemes,
  isValidThemeId,
  titleWords,
} from "./themes.ts";

async function makeThemeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "rpg-om-themes-"));
}

test("isValidThemeId allows only harmless names", () => {
  expect(isValidThemeId("rose-pine")).toBe(true);
  expect(isValidThemeId("catppuccin-latte")).toBe(true);
  expect(isValidThemeId("a.b_c")).toBe(true);
  expect(isValidThemeId("../etc")).toBe(false);
  expect(isValidThemeId("x/y")).toBe(false);
  expect(isValidThemeId(".hidden")).toBe(false);
});

test("titleWords capitalizes words", () => {
  expect(titleWords("rose-pine")).toBe("Rose Pine");
  expect(titleWords("tokyo-night")).toBe("Tokyo Night");
});

test("listThemes returns only directories with colors.toml", async () => {
  const root = await makeThemeRoot();
  await mkdir(join(root, "rose-pine"), { recursive: true });
  await writeFile(join(root, "rose-pine", "colors.toml"), 'mode = "light"\n');
  await mkdir(join(root, "plain-dir"), { recursive: true });
  await writeFile(join(root, "plain-dir", "notes.txt"), "x");

  expect(await listThemes(root)).toEqual(["rose-pine"]);
});

test("loadTheme derives names and reads optional metadata", async () => {
  const root = await makeThemeRoot();
  const tdir = join(root, "catppuccin-latte");
  await mkdir(join(tdir, "backgrounds"), { recursive: true });
  await writeFile(join(tdir, "colors.toml"), 'mode = "light"\nbackground = "#eff1f5"\nforeground = "#4c4f69"\n');
  await writeFile(join(tdir, "vscode.json"), '{"name":"Catppuccin Latte","extension":"catppuccin.catppuccin-vsc"}');
  await writeFile(join(tdir, "icons.theme"), "Yaru-mocha\n");
  await writeFile(join(tdir, "backgrounds", "a.png"), "x");

  const t = await loadTheme("catppuccin-latte", { root });
  expect(t.displayName).toBe("Catppuccin Latte");
  expect(t.mode).toBe("light");
  expect(t.gtkThemeName).toBe("CatppuccinLatte");
  expect(t.ghosttyThemeName).toBe("catppuccin-latte.conf");
  expect(t.iconsTheme).toBe("Yaru-mocha");
  expect(t.vscode?.extension).toBe("catppuccin.catppuccin-vsc");
  expect(t.hasBackgrounds).toBe(true);
});

test("loadTheme sets icon default Yaru-blue and no backgrounds", async () => {
  const root = await makeThemeRoot();
  const tdir = join(root, "nord");
  await mkdir(tdir, { recursive: true });
  await writeFile(join(tdir, "colors.toml"), 'mode = "dark"\nbackground = "#2e3440"\nforeground = "#d8dee9"\n');

  const t = await loadTheme("nord", { root });
  expect(t.mode).toBe("dark");
  expect(t.iconsTheme).toBe("Yaru-blue");
  expect(t.vscode).toBeNull();
  expect(t.hasBackgrounds).toBe(false);
});

test("loadTheme warns on missing core colors", async () => {
  const root = await makeThemeRoot();
  const tdir = join(root, "broken");
  await mkdir(tdir, { recursive: true });
  await writeFile(join(tdir, "colors.toml"), 'mode = "light"\n');

  const orig = console.warn;
  let warned = "";
  console.warn = (m?: unknown) => {
    warned += String(m);
  };
  try {
    await loadTheme("broken", { root });
  } finally {
    console.warn = orig;
  }
  expect(warned).toContain("Fallback");
  expect(warned).toContain("foreground");
});

test("loadTheme throws for unknown theme/missing colors", async () => {
  const root = await makeThemeRoot();
  let msg = "";
  try {
    await loadTheme("doesnotexist", { root });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("doesnotexist");
});