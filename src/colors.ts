// colors.ts — read and normalize Omarchy colors.toml (TS/Bun).
// Replaces ./src/lib-colors.sh

/** All keys known to Omarchy (only these are adopted). */
const KNOWN = new Set([
  "mode",
  "accent",
  "selection",
  "muted",
  "background",
  "dark_background",
  "darker_background",
  "lighter_background",
  "foreground",
  "dark_foreground",
  "light_foreground",
  "bright_foreground",
  "red",
  "yellow",
  "orange",
  "green",
  "cyan",
  "blue",
  "magenta",
  "brown",
  "bright_red",
  "bright_yellow",
  "bright_green",
  "bright_cyan",
  "bright_blue",
  "bright_magenta",
  // extended.toml: full Rose-Pine roles (gap fillers for colors.toml)
  "surface",
  "overlay",
  "subtle",
  "love",
  "gold",
  "rose",
  "pine",
  "foam",
  "iris",
  "highlight_low",
  "highlight_med",
  "highlight_high",
]);

/** Raw key→value map from a colors.toml (only known keys). */
export type Colors = Record<string, string>;

/** Parse colors.toml text. Unknown lines/keys are ignored. */
export function parseColors(text: string): Colors {
  const out: Colors = {};
  const re = /^[ \t]*([A-Za-z_]+)[ \t]*=[ \t]*(.*)$/;
  for (let raw of text.split("\n")) {
    raw = raw.replace(/[\r\n]+$/u, "");
    if (/^[ \t]*#/u.test(raw) || raw.trim() === "") continue;
    const m = raw.match(re);
    if (!m) continue;
    const key = m[1]!;
    if (!KNOWN.has(key)) continue;
    out[key] = m[2]!.replace(/"/gu, "").replace(/[ \t]+$/u, "");
  }
  return out;
}

/** Normalized color semantics (like Omarchy `colors_semantic`). */
export interface Semantic {
  mode: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSink: string;
  foreground: string;
  fgSecondary: string;
  fgDisabled: string;
  fgBright: string;
  accent: string;
  selectionBg: string;
  muted: string;
  /** 16 ANSI cells 0..15 */
  ansi: string[];
}

const s = (c: Colors, k: string, fb = "#000000"): string => c[k] ?? fb;

/** Derive the normal semantics from a parsed colors.toml. */
export function normalize(c: Colors): Semantic {
  const ansi = [
    s(c, "red"),
    s(c, "yellow"),
    s(c, "green"),
    s(c, "brown", s(c, "yellow")),
    s(c, "blue"),
    s(c, "magenta"),
    s(c, "cyan"),
    s(c, "light_foreground", s(c, "foreground")),
    s(c, "muted", s(c, "dark_foreground")),
    s(c, "bright_red", s(c, "red")),
    s(c, "bright_yellow", s(c, "yellow")),
    s(c, "bright_green", s(c, "green")),
    s(c, "bright_blue", s(c, "blue")),
    s(c, "bright_magenta", s(c, "magenta")),
    s(c, "bright_cyan", s(c, "cyan")),
    s(c, "bright_foreground", s(c, "foreground")),
  ];
  return {
    mode: s(c, "mode", "light"),
    background: s(c, "background"),
    surface: s(c, "dark_background"),
    surfaceRaised: s(c, "lighter_background"),
    surfaceSink: s(c, "darker_background"),
    foreground: s(c, "foreground"),
    fgSecondary: s(c, "light_foreground"),
    fgDisabled: s(c, "dark_foreground"),
    fgBright: s(c, "bright_foreground"),
    accent: s(c, "accent"),
    selectionBg: s(c, "selection"),
    muted: s(c, "muted"),
    ansi,
  };
}

/** Normalized semantics as line-by-line KEY=VALUE (matches `parse` output). */
export function semanticLines(sem: Semantic): string {
  const rows: Array<[string, string]> = [
    ["MODE", sem.mode],
    ["NORMAL_BG", sem.background],
    ["SURFACE", sem.surface],
    ["SURFACE_RAISED", sem.surfaceRaised],
    ["SURFACE_SINK", sem.surfaceSink],
    ["NORMAL_FG", sem.foreground],
    ["FG_SECONDARY", sem.fgSecondary],
    ["FG_DISABLED", sem.fgDisabled],
    ["FG_BRIGHT", sem.fgBright],
    ["ACCENT", sem.accent],
    ["SELECTION_BG", sem.selectionBg],
    ["MUTED", sem.muted],
  ];
  sem.ansi.forEach((v, i) => rows.push([`ANSI_${String(i).padStart(2, "0")}`, v]));
  return rows.map(([k, v]) => `${k}=${v}`).join("\n");
}
