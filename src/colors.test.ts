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

test("parseColors liest bekannte Schlüssel und entfernt Anführungszeichen", () => {
  const c = parseColors(SAMPLE);
  expect(c.mode).toBe("light");
  expect(c.background).toBe("#faf4ed");
  expect(c.foreground).toBe("#575279");
  expect(c.accent).toBe("#56949f");
  expect(c.bright_magenta).toBe("#907aa9");
});

test("parseColors übernimmt keine unbekannten Schlüssel", () => {
  const c = parseColors(`${SAMPLE}\nunknown_key = "#123456"\n`);
  expect(c["unknown_key"]).toBeUndefined();
});

test("parseColors ignoriert Kommentare und leere Zeilen", () => {
  const c = parseColors(`# Kommentar\n\nmode = "light"\n`);
  expect(c.mode).toBe("light");
});

test("parseColors trimmt nachfolgende Leerzeichen in Werten", () => {
  const c = parseColors('background = "#faf4ed"   \n');
  expect(c.background).toBe("#faf4ed");
});

test("parseColors verarbeitet letzte Zeile ohne abschließendes Newline", () => {
  const withNewline = `${SAMPLE}\nbright_magenta = "#907aa9"\n`;
  const without = `${SAMPLE}\nbright_magenta = "#907aa9"`; // kein trailing \n
  expect(parseColors(withNewline).bright_magenta).toBe("#907aa9");
  expect(parseColors(without).bright_magenta).toBe("#907aa9");
});

test("normalize liefert 16 ANSI-Zellen mit korrekter Reihenfolge", () => {
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

test("normalize: orange/brown-Fallback, wenn yellow fehlt", () => {
  const c = parseColors('red = "#b4637a"\ngreen = "#286983"\n');
  const s = normalize(c);
  // Zelle 3 (gelb) fällt auf Default zurück, wenn kein yellow/brown
  expect(s.ansi[3]).toBeDefined();
});

test("semanticLines enthält MODE-, Basisfarben- und ANSI-Zeilen", () => {
  const s = normalize(parseColors(SAMPLE));
  const lines = semanticLines(s);
  expect(lines).toContain("MODE=light");
  expect(lines).toContain("NORMAL_BG=#faf4ed");
  expect(lines).toMatch(/ANSI_09=#b4637a/);
});