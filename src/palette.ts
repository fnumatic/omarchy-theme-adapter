// palette.ts — deklarative Rollenauflösung für Rose-Pine-Themes.
//
// Statt verstreuter `v(c, "dark_background", bg)`-Ketten in jedem Renderer gibt
// es genau EINE Tabelle (ROLE_SOURCES): Rose-Pine-Rolle → Kandidaten-Keys in
// den gemergten Theme-Farben (colors.toml gewinnt, extended.toml füllt Lücken).
// Renderer arbeiten nur mit Rollennamen (Palette).
//
// Rollen und Verwendung: https://github.com/rose-pine/palette (Spec).
import type { Colors } from "./colors.ts";
import { parseColors } from "./colors.ts";

/** Die 15 kanonischen Rose-Pine-Rollen. */
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
 * Deklarative Fallbackketten: Rolle → Roh-Keys (erster Treffer gewinnt).
 * Reihenfolge bevorzugt bewusst die Keys, die Renderer bisher nutzten, damit
 * bestehende Themes ihr Aussehen behalten; extended.toml-Rollen greifen dort,
 * wo Omarchy-Keys fehlen.
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

/** Omarchy-weite Auswahl des aktiven Akzents (keine Rose-Pine-Rolle). */
const ACCENT_SOURCES = ["accent", "foam", "iris"];

/** Vollständig aufgelöste Palette: nur Rollennamen, keine Roh-Keys. */
export interface Palette extends Record<Role, string> {
  mode: string;
  /** Aktiver Akzent (Omarchy-`accent`, z. B. Dawn-Foam). */
  accent: string;
  /** 16 Terminalzellen in Ghostty-Reihenfolge (Omarchy-Template-exakt). */
  ansi16: string[];
}

/** Ghostty-Palettenreihenfolge: Index → Roh-Key (Omarchy-Template). */
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

/** Erster Treffer aus der Kette, sonst Fallback. */
function first(c: Colors, chain: string[], fb: string): string {
  for (const k of chain) {
    const val = c[k];
    if (val !== undefined && val !== "") return val;
  }
  return fb;
}

/** Löst alle Rollen aus gemergten Theme-Farben auf. */
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
 * Mergt colors.toml + extended.toml: colors.toml gewinnt, extended.toml füllt
 * nur Lücken (fehlende Keys). Gibt die gemergten Roh-Farben zurück.
 */
export function mergeThemeColors(colorsText: string, extendedText: string | null): Colors {
  const merged = parseColors(extendedText ?? "");
  Object.assign(merged, parseColors(colorsText));
  return merged;
}
