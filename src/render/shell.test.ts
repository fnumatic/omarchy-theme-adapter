import { test, expect } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hexToRgba,
  renderShellPaperwm,
  installShellPaperwm,
  MARKER,
  END_MARKER,
} from "./shell.ts";
import { parseColors } from "../colors.ts";
import { resolvePalette } from "../palette.ts";

const base = parseColors(
  `background = "#faf4ed"\ndark_background = "#ede7e1"\nforeground = "#575279"\n`,
);
const pal = resolvePalette(base);

test("hexToRgba converts Dawn colors correctly", () => {
  expect(hexToRgba("#faf4ed", 0.85)).toBe("rgba(250, 244, 237, 0.85)");
  expect(hexToRgba("#575279", 1)).toBe("rgba(87, 82, 121, 1)");
});

test("hexToRgba accepts short and 8-digit hex values", () => {
  expect(hexToRgba("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  expect(hexToRgba("#abc", 0.5)).toBe("rgba(170, 187, 204, 0.5)");
  expect(hexToRgba("#abcd", 1)).toBe("rgba(170, 187, 204, 1)");
  expect(hexToRgba("#faf4edff", 0.5)).toBe("rgba(250, 244, 237, 0.5)");
});

test("hexToRgba rejects invalid hex", () => {
  let msg = "";
  try {
    hexToRgba("not-a-color", 1);
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("Invalid hex color");
});

test("renderShellPaperwm colors the PaperWM top bar in Dawn", () => {
  const css = renderShellPaperwm(pal);
  expect(css).toContain(".topbar-transparent-background");
  expect(css).toContain("rgba(250, 244, 237, 0.95)");
  expect(css).toContain("color: #575279");
  expect(css).toContain(MARKER);
  expect(css).toContain(END_MARKER);
});

test("installShellPaperwm --dry-run writes nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-sh-dry-"));
  const cssFile = join(dir, "user.css");
  await installShellPaperwm(renderShellPaperwm(pal), { dry: true, cssFile });
  const existing = await readFile(cssFile).catch(() => null);
  expect(existing).toBeNull();
});

test("installShellPaperwm rejects a corrupt marker", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-sh-bad-"));
  const cssFile = join(dir, "user.css");
  await writeFile(cssFile, MARKER + "\n");
  let msg = "";
  try {
    await installShellPaperwm(renderShellPaperwm(pal), { dry: false, cssFile });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("corrupt");
});

test("installShellPaperwm preserves foreign content and is idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-sh-ok-"));
  const cssFile = join(dir, "user.css");
  await writeFile(cssFile, "/* my notes */\n.workspace-icon-button { padding: 4px; }\n");

  await installShellPaperwm(renderShellPaperwm(pal), { dry: false, cssFile });
  let text = await readFile(cssFile, "utf8");
  expect(text).toContain("my notes");
  expect(text).toContain("rgba(250, 244, 237, 0.95)");

  await installShellPaperwm(renderShellPaperwm(pal), { dry: false, cssFile });
  text = await readFile(cssFile, "utf8");
  expect(text.split(MARKER).length - 1).toBe(1);
  expect(text).toContain("my notes");
});
