// themes.ts — generic Omarchy theme resolver (option B).
//
// Omarchy keeps a directory `themes/<id>/` per theme with:
//   colors.toml      (required, color roles + mode)
//   vscode.json      (optional: { name, extension })
//   icons.theme      (optional: icon theme name, default Yaru-blue)
//   backgrounds/     (optional: wallpapers)
// Just like Omarchy, all derived artifacts are rendered **on the fly** from
// this (Ghostty .conf, GTK3 css, GTK4 overlay, PaperWM block). No
// pre-rendered asset is kept.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Colors } from "./colors.ts";
import { mergeThemeColors, resolvePalette, missingCoreColors, type Palette } from "./palette.ts";
import type { VscodeDescriptor } from "./render/vscode.ts";

/** Root directory of the theme sources (…/themes). */
export function themesRoot(): string {
  return join(fileURLToPath(new URL(".", import.meta.url)), "..", "themes");
}

export interface Theme {
  /** Normalized ID = directory name (e.g. "rose-pine"). */
  id: string;
  /** Absolute path to the theme directory. */
  dir: string;
  /** Display name, title-cased (e.g. "Rose Pine"). */
  displayName: string;
  /** "light" | "dark" per colors.toml. */
  mode: string;
  /** Merged raw colors (colors.toml wins, extended.toml fills gaps). */
  colors: Colors;
  /** Declaratively resolved role palette (renderers use only this). */
  palette: Palette;
  /** GTK3 theme name (no spaces, e.g. "RosePine"). */
  gtkThemeName: string;
  /** Ghostty theme file name/ID (e.g. "rose-pine.conf"). */
  ghosttyThemeName: string;
  /** Optional VS Code metadata. */
  vscode: VscodeDescriptor | null;
  /** Icon theme name from icons.theme (default "Yaru-blue"). */
  iconsTheme: string;
  hasBackgrounds: boolean;
}

export function titleWords(s: string): string {
  return s
    .split(/[-_ ]+/u)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function pascal(s: string): string {
  return titleWords(s).replace(/[^A-Za-z0-9]/gu, "");
}

export function isValidThemeId(id: string): boolean {
  // Like Omarchy: only harmless directory names.
  return /^[a-z0-9][a-z0-9._+-]*$/u.test(id) && !id.includes("..");
}

/** Lists available themes (directory with colors.toml under themesRoot). */
export async function listThemes(root?: string): Promise<string[]> {
  const dir = root ?? themesRoot();
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const ids: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const hasColors = await readFile(join(dir, e.name, "colors.toml"), "utf8")
      .then(() => true)
      .catch(() => false);
    if (hasColors) ids.push(e.name);
  }
  return ids.sort((a, b) => a.localeCompare(b, "en"));
}

async function readOptional<T>(path: string, parse: (text: string) => T): Promise<T | null> {
  try {
    return parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

export interface LoadThemeOptions {
  root?: string;
}

/** Loads a theme completely from `themes/<id>/`. Throws on missing palette. */
export async function loadTheme(id: string, opts: LoadThemeOptions = {}): Promise<Theme> {
  if (!isValidThemeId(id)) throw new Error(`Invalid theme name: '${id}'`);
  const dir = join(opts.root ?? themesRoot(), id);

  const colorsText = await readFile(join(dir, "colors.toml"), "utf8").catch(() => null);
  if (colorsText === null) {
    throw new Error(
      `Theme '${id}' has no themes/${id}/colors.toml. Available: ${(await listThemes(opts.root)).join(", ")}`,
    );
  }
  // extended.toml is optional and only fills gaps (full Rose-Pine roles).
  const extendedText = await readFile(join(dir, "extended.toml"), "utf8").catch(() => null);
  const colors = mergeThemeColors(colorsText, extendedText);
  if (Object.keys(colors).length === 0) {
    throw new Error(`colors.toml of '${id}' could not be parsed: ${join(dir, "colors.toml")}`);
  }
  const missing = missingCoreColors(colors);
  if (missing.length > 0) {
    console.warn(`   [!] Theme '${id}' without ${missing.join("/")} — Fallback #000000`);
  }
  const palette = resolvePalette(colors);

  const vscode = await readOptional(join(dir, "vscode.json"), (t) =>
    JSON.parse(t) as VscodeDescriptor,
  );
  const iconsTheme = await readOptional(join(dir, "icons.theme"), (t) => t.trim());
  const hasBackgrounds = await readdir(join(dir, "backgrounds"))
    .then((f) => f.length > 0)
    .catch(() => false);

  return {
    id,
    dir,
    displayName: titleWords(id),
    mode: (colors.mode ?? "dark").toLowerCase(),
    colors,
    palette,
    gtkThemeName: pascal(id),
    ghosttyThemeName: `${id}.conf`,
    vscode,
    iconsTheme: iconsTheme ?? "Yaru-blue",
    hasBackgrounds,
  };
}