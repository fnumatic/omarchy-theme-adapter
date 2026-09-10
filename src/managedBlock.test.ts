import { test, expect } from "bun:test";
import { locateBlock } from "./managedBlock.ts";

const M = "themeswitch: Testblock";
const E = "themeswitch: Ende Testblock";

test("locateBlock: absent ohne Marker", () => {
  expect(locateBlock("a { color: red; }\n", M, E)).toEqual({ kind: "absent" });
});

test("locateBlock: found mit Start- und Endmarker", () => {
  const css = `/* fremd */\n/* ${M} */\n.x { color: red; }\n/* ${E} */\n`;
  const loc = locateBlock(css, M, E);
  expect(loc.kind).toBe("found");
  if (loc.kind === "found") {
    expect(css.slice(loc.start, loc.end)).toBe(`/* ${M} */\n.x { color: red; }\n/* ${E} */`);
  }
});

test("locateBlock: found ohne Endmarker reicht bis Dateiende", () => {
  const css = `/* fremd */\n/* ${M} */\n.x { color: red; }\n`;
  const loc = locateBlock(css, M);
  expect(loc.kind).toBe("found");
  if (loc.kind === "found") {
    expect(loc.end).toBe(css.length);
  }
});

test("locateBlock: corrupt bei Marker ohne Kommentar-Opener", () => {
  expect(locateBlock(`${M} ohne opener\n`, M)).toEqual({ kind: "corrupt" });
});

test("locateBlock: corrupt bei fehlendem Endmarker", () => {
  expect(locateBlock(`/* ${M} */\n.x { color: red; }\n`, M, E)).toEqual({ kind: "corrupt" });
});
