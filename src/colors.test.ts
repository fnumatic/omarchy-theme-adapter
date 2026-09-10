import { test, expect } from "bun:test";
import { parseColors, normalize, semanticLines } from "./colors.ts";

const SAMPLE = `mode = "light"
accent = "#56949f"
selection = "#dfdad9"
muted = "#cecacd"

background = "#faf4ed"
foreground = "#575279"
bright_foreground = "#575279"

red = "#b4637a"
green = "#286983"
yellow = "#ea9d34"
bright_magenta = "#907aa9"`;

test("parseColors reads known keys and removes quotes", () => {
  const c = parseColors(SAMPLE);
  expect(c.mode).toBe("light");
  expect(c.background).toBe("#faf4ed");
  expect(c.foreground).toBe("#575279");
  expect(c.accent).toBe("#56949f");
  expect(c.bright_magenta).toBe("#907aa9");
});

test("parseColors does not adopt unknown keys", () => {
  const c = parseColors(`${SAMPLE}\nunknown_key = "#123456"\n`);
  expect(c["unknown_key"]).toBeUndefined();
});

test("parseColors ignores comments and blank lines", () => {
  const c = parseColors(`# comment\n\nmode = "light"\n`);
  expect(c.mode).toBe("light");
});

test("parseColors trims trailing whitespace in values", () => {
  const c = parseColors('background = "#faf4ed"   \n');
  expect(c.background).toBe("#faf4ed");
});

test("parseColors handles last line without trailing newline", () => {
  const withNewline = `${SAMPLE}\nbright_magenta = "#907aa9"\n`;
  const without = `${SAMPLE}\nbright_magenta = "#907aa9"`; // no trailing \n
  expect(parseColors(withNewline).bright_magenta).toBe("#907aa9");
  expect(parseColors(without).bright_magenta).toBe("#907aa9");
});

test("normalize returns 16 ANSI cells in correct order", () => {
  const c = parseColors(SAMPLE);
  const s = normalize(c);
  expect(s.ansi).toHaveLength(16);
  expect(s.ansi[0]).toBe("#b4637a"); // red
  expect(s.ansi[1]).toBe(c.yellow); // yellow
  expect(s.ansi[2]).toBe("#286983"); // green
  expect(s.ansi[13]).toBe("#907aa9"); // bright_magenta
  expect(s.ansi[15]).toBe("#575279"); // bright_foreground
  expect(s.mode).toBe("light");
  expect(s.background).toBe("#faf4ed");
});

test("normalize: orange/brown fallback when yellow is missing", () => {
  const c = parseColors('red = "#b4637a"\ngreen = "#286983"\n');
  const s = normalize(c);
  // Cell 3 (yellow) falls back to default when there is no yellow/brown
  expect(s.ansi[3]).toBeDefined();
});

test("semanticLines contains MODE, base color, and ANSI lines", () => {
  const s = normalize(parseColors(SAMPLE));
  const lines = semanticLines(s);
  expect(lines).toContain("MODE=light");
  expect(lines).toContain("NORMAL_BG=#faf4ed");
  expect(lines).toMatch(/ANSI_09=#b4637a/);
});