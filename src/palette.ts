// palette.ts — declarative role resolution for Rose-Pine themes.
//
// Instead of scattered `v(c, "dark_background", bg)` chains in every renderer,
// there is exactly ONE table (ROLE_SOURCES): Rose-Pine role → candidate keys in
// the merged theme colors (colors.toml wins, extended.toml fills gaps).
// Renderers work only with role names (Palette).
//
// Roles and usage: https://github.com/rose-pine/palette (spec).
import type { Colors } from "./colors.ts";
import { parseColors } from "./colors.ts";

/** The 15 canonical Rose-Pine roles. */
export const ROSE_PINE_ROLES = [
  "base",
  "surface",
  "overlay",
  "muted",
  "subtle",
  "text",
  "love",
  "gold",
  "rose",
  "pine",
  "foam",
  "iris",
  "highlight_low",
  "highlight_med",
  "highlight_high",
] as const;

export type Role = (typeof ROSE_PINE_ROLES)[number];

/**
 * Declarative fallback chains: role → raw keys (first match wins).
 * The order deliberately prefers the keys renderers used so far, so that
 * existing themes keep their look; extended.toml roles take effect where
 * Omarchy keys are missing.
 */
export const ROLE_SOURCES: Record<Role, string[]> = {
  base: ["background"],
  surface: ["dark_background", "surface", "background"],
  overlay: ["lighter_background", "overlay", "surface", "dark_background", "background"],
  muted: ["dark_foreground", "subtle", "muted", "highlight_high"],
  subtle: ["light_foreground", "subtle", "dark_foreground", "foreground"],
  text: ["foreground", "text"],
  love: ["red", "love", "bright_red"],
  gold: ["yellow", "gold", "bright_yellow"],
  rose: ["cyan", "rose", "bright_cyan"],
  pine: ["green", "pine", "bright_green"],
  foam: ["accent", "foam", "blue", "bright_blue"],
  iris: ["magenta", "iris", "bright_magenta"],
  highlight_low: ["lighter_background", "highlight_low", "surface", "dark_background"],
  highlight_med: ["selection", "highlight_med"],
  highlight_high: ["muted", "highlight_high"],
};

/** Omarchy-wide selection of the active accent (not a Rose-Pine role). */
const ACCENT_SOURCES = ["accent", "foam", "iris"];

/** Fully resolved palette: only role names, no raw keys. */
export interface Palette extends Record<Role, string> {
  mode: string;
  /** Active accent (Omarchy `accent`, e.g. Dawn Foam). */
  accent: string;
  /** 16 terminal cells in Ghostty order (Omarchy template exact). */
  ansi16: string[];
}

/** Ghostty palette order: index → raw key (Omarchy template). */
const ANSI16_KEYS = [
  "background",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "foreground",
  "muted",
  "bright_red",
  "bright_green",
  "bright_yellow",
  "bright_blue",
  "bright_magenta",
  "bright_cyan",
  "bright_foreground",
];

/** Core keys without which the palette falls back to #000000. */
export function missingCoreColors(c: Colors): string[] {
  return ["background", "foreground"].filter((k) => !c[k]);
}

/** First match from the chain, otherwise fallback. */
function first(c: Colors, chain: string[], fb: string): string {
  for (const k of chain) {
    const val = c[k];
    if (val !== undefined && val !== "") return val;
  }
  return fb;
}

/** Resolves all roles from merged theme colors. */
export function resolvePalette(c: Colors): Palette {
  const p = {} as Record<Role, string>;
  for (const role of ROSE_PINE_ROLES) {
    p[role] = first(c, ROLE_SOURCES[role]!, "#000000");
  }
  const accent = first(c, ACCENT_SOURCES, p.foam!);
  const ansi16 = ANSI16_KEYS.map((k) => c[k] ?? "#000000");
  return { ...p, mode: (c.mode ?? "dark").toLowerCase(), accent, ansi16 };
}

/**
 * Merges colors.toml + extended.toml: colors.toml wins, extended.toml only
 * fills gaps (missing keys). Returns the merged raw colors.
 */
export function mergeThemeColors(colorsText: string, extendedText: string | null): Colors {
  const merged = parseColors(extendedText ?? "");
  Object.assign(merged, parseColors(colorsText));
  return merged;
}
