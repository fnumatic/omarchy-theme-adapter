import { test, expect } from "bun:test";
import { locateBlock } from "./managedBlock.ts";

const M = "themeswitch: Testblock";
const E = "themeswitch: Ende Testblock";

test("locateBlock: absent without marker", () => {
  expect(locateBlock("a { color: red; }\n", M, E)).toEqual({ kind: "absent" });
});

test("locateBlock: found with start and end marker", () => {
  const css = `/* foreign */\n/* ${M} */\n.x { color: red; }\n/* ${E} */\n`;
  const loc = locateBlock(css, M, E);
  expect(loc.kind).toBe("found");
  if (loc.kind === "found") {
    expect(css.slice(loc.start, loc.end)).toBe(`/* ${M} */\n.x { color: red; }\n/* ${E} */`);
  }
});

test("locateBlock: found without end marker extends to end of file", () => {
  const css = `/* foreign */\n/* ${M} */\n.x { color: red; }\n`;
  const loc = locateBlock(css, M);
  expect(loc.kind).toBe("found");
  if (loc.kind === "found") {
    expect(loc.end).toBe(css.length);
  }
});

test("locateBlock: corrupt on marker without comment opener", () => {
  expect(locateBlock(`${M} without opener\n`, M)).toEqual({ kind: "corrupt" });
});

test("locateBlock: corrupt on missing end marker", () => {
  expect(locateBlock(`/* ${M} */\n.x { color: red; }\n`, M, E)).toEqual({ kind: "corrupt" });
});
