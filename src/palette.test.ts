import { test, expect } from "bun:test";
import { parseColors } from "./colors.ts";
import { mergeThemeColors, resolvePalette, missingCoreColors, ROLE_SOURCES, ROSE_PINE_ROLES } from "./palette.ts";

const COLORS = `mode = "light"
background = "#faf4ed"
dark_background = "#ede7e1"
lighter_background = "#f2e9e1"
foreground = "#575279"
dark_foreground = "#9893a5"
light_foreground = "#6e6a86"
muted = "#cecacd"
accent = "#56949f"
selection = "#dfdad9"
red = "#b4637a"`;

const EXTENDED = `surface = "#fffaf3"
overlay = "#f2e9e1"
subtle = "#797593"
highlight_low = "#f4ede8"`;

test("mergeThemeColors: colors.toml gewinnt, extended.toml füllt Lücken", () => {
  const merged = mergeThemeColors(COLORS, EXTENDED);
  expect(merged.background).toBe("#faf4ed");
  expect(merged.surface).toBe("#fffaf3");
  expect(merged.overlay).toBe("#f2e9e1");
});

test("mergeThemeColors: ohne extended.toml nur colors.toml", () => {
  const merged = mergeThemeColors(COLORS, null);
  expect(merged.background).toBe("#faf4ed");
  expect(merged.surface).toBeUndefined();
});

test("resolvePalette: alle 15 Rollen sind belegt", () => {
  const p = resolvePalette(mergeThemeColors(COLORS, EXTENDED));
  for (const role of ROSE_PINE_ROLES) {
    expect(p[role]).toMatch(/^#[0-9a-f]{6}$/iu);
  }
  expect(p.mode).toBe("light");
  expect(p.accent).toBe("#56949f");
});

test("resolvePalette: bestehende Theme-Werte bleiben stabil", () => {
  const p = resolvePalette(mergeThemeColors(COLORS, EXTENDED));
  expect(p.base).toBe("#faf4ed");
  expect(p.surface).toBe("#ede7e1");
  expect(p.overlay).toBe("#f2e9e1");
  expect(p.text).toBe("#575279");
  expect(p.muted).toBe("#9893a5");
  expect(p.highlight_med).toBe("#dfdad9");
  expect(p.highlight_high).toBe("#cecacd");
  expect(p.love).toBe("#b4637a");
});

test("resolvePalette: ansi16 in Ghostty-Reihenfolge", () => {
  const p = resolvePalette(parseColors(COLORS));
  expect(p.ansi16).toHaveLength(16);
  expect(p.ansi16[0]).toBe("#faf4ed");
  expect(p.ansi16[1]).toBe("#b4637a");
  expect(p.ansi16[7]).toBe("#575279");
});

test("missingCoreColors meldet fehlende Kern-Keys", () => {
  expect(missingCoreColors(parseColors('background = "#fff"\nforeground = "#000"\n'))).toEqual([]);
  expect(missingCoreColors(parseColors('mode = "light"\n'))).toEqual(["background", "foreground"]);
  expect(missingCoreColors(parseColors('background = "#fff"\n'))).toEqual(["foreground"]);
});

test("ROLE_SOURCES deckt alle Rollen ab", () => {
  for (const role of ROSE_PINE_ROLES) {
    expect(ROLE_SOURCES[role]!.length).toBeGreaterThan(0);
  }
});
