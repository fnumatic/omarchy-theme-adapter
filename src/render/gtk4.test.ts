import { test, expect } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseColors } from "../colors.ts";
import { resolvePalette } from "../palette.ts";
import { renderGtk4, installGtk4, MARKER } from "./gtk4.ts";

const base = parseColors(
  `background = "#faf4ed"
dark_background = "#ede7e1"
lighter_background = "#f2e9e1"
foreground = "#575279"
dark_foreground = "#9893a5"
muted = "#cecacd"
selection = "#dfdad9"
accent = "#56949f"
red = "#b4637a"
green = "#286983"
yellow = "#ea9d34"`,
);
const pal = resolvePalette(base);

test("renderGtk4 enthält zentrale libadwaita-Farbnamen", () => {
  const css = renderGtk4(pal);
  expect(css).toContain("@define-color window_bg_color #faf4ed");
  expect(css).toContain("@define-color window_fg_color #575279");
  expect(css).toContain("@define-color headerbar_bg_color #ede7e1");
  expect(css).toContain("@define-color accent_bg_color #56949f");
  expect(css).toContain("@define-color card_bg_color #f2e9e1");
  expect(css).toContain(MARKER);
});

test("renderGtk4 enthält kompakte Headerbar-Regeln (spezifisch)", () => {
  const css = renderGtk4(pal);
  expect(css).toContain("window headerbar");
  expect(css).toContain("min-height: 24px");
  expect(css).toContain(".tab-bar");
  expect(css).toContain("windowcontrols");
  expect(css).toContain("border-radius: 0");
});

test("installGtk4 --dry-run schreibt nichts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg4-dry-"));
  const gtk4Dir = join(dir, "gtk-4.0");
  await installGtk4(renderGtk4(pal), { dry: true, gtk4Dir });
  const existing = await readFile(join(gtk4Dir, "gtk.css")).catch(() => null);
  expect(existing).toBeNull();
});

test("installGtk4 schreibt gtk.css neu", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg4-new-"));
  const gtk4Dir = join(dir, "gtk-4.0");
  await installGtk4(renderGtk4(pal), { dry: false, gtk4Dir });
  const text = await readFile(join(gtk4Dir, "gtk.css"), "utf8");
  expect(text).toContain("@define-color headerbar_bg_color #ede7e1");
});

test("installGtk4 verweigert fremde gtk.css statt zu überschreiben", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg4-fremd-"));
  const gtk4Dir = join(dir, "gtk-4.0");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(gtk4Dir, { recursive: true });
  await writeFile(join(gtk4Dir, "gtk.css"), "/* fremder Inhalt */\n");
  let msg = "";
  try {
    await installGtk4(renderGtk4(pal), { dry: false, gtk4Dir });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("nicht von themeswitch");
  expect(await readFile(join(gtk4Dir, "gtk.css"), "utf8")).toBe("/* fremder Inhalt */\n");
});

test("installGtk4 aktualisiert eigenen Block idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg4-idem-"));
  const gtk4Dir = join(dir, "gtk-4.0");
  await installGtk4(renderGtk4(pal), { dry: false, gtk4Dir });
  await installGtk4(renderGtk4(pal), { dry: false, gtk4Dir });
  const text = await readFile(join(gtk4Dir, "gtk.css"), "utf8");
  const count = text.split(MARKER).length - 1;
  expect(count).toBe(1);
});
