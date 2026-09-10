import { test, expect } from "bun:test";
import { mkdtemp, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseColors } from "../colors.ts";
import { resolvePalette } from "../palette.ts";
import { fakeGSettings } from "../gsettings.ts";
import {
  renderGtk3,
  renderIndexTheme,
  installGtk3,
  GTK3_THEME_NAME,
} from "./gtk3.ts";

const base = parseColors(
  `mode = "light"
background = "#faf4ed"
dark_background = "#ede7e1"
lighter_background = "#f2e9e1"
foreground = "#575279"
dark_foreground = "#9893a5"
muted = "#cecacd"
selection = "#dfdad9"`,
);
const pal = resolvePalette(base);

test("renderGtk3 contains central @define-color entries from the mapping", () => {
  const css = renderGtk3(pal);
  expect(css).toContain("@import url(\"resource:///org/gtk/libgtk/theme/Adwaita/gtk-contained.css\")");
  expect(css).toContain("@define-color theme_bg_color #faf4ed");
  expect(css).toContain("@define-color theme_base_color #ede7e1");
  expect(css).toContain("@define-color theme_fg_color #575279");
  expect(css).toContain("@define-color theme_selected_bg_color #dfdad9");
  expect(css).toContain("background-color: #faf4ed"); // opaque toplevel background
});

test("renderGtk3 sets tooltip colors explicitly (readability)", () => {
  const css = renderGtk3(pal);
  expect(css).toContain("@define-color theme_tooltip_bg_color #ede7e1");
  expect(css).toContain("@define-color theme_tooltip_fg_color #575279");
  expect(css).toContain("tooltip *");
  expect(css).toContain("text-shadow: none");
});

test("renderIndexTheme sets Name and GtkTheme", () => {
  const t = renderIndexTheme();
  expect(t).toContain("Name=RosePine");
  expect(t).toContain("GtkTheme=RosePine");
  expect(t).toContain("Type=X-GNOME-Metatheme");
});

test("GTK3_THEME_NAME matches the generated Rose Pine name", async () => {
  const { loadTheme } = await import("../themes.ts");
  const t = await loadTheme("rose-pine");
  expect(GTK3_THEME_NAME).toBe(t.gtkThemeName);
});

test("renderGtk3 contains compact headerbar rules", () => {
  const css = renderGtk3(pal);
  expect(css).toContain("min-height: 24px");
});

test("installGtk3 --dry-run writes nothing and sets no gsettings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg3-dry-"));
  const gs = fakeGSettings();
  await installGtk3(renderGtk3(pal), { dry: true, themesDir: dir, gs });
  const exists = await access(join(dir, GTK3_THEME_NAME)).then(() => true).catch(() => false);
  expect(exists).toBe(false);
  expect(gs.sets).toHaveLength(0);
});

test("installGtk3 rejects invalid CSS", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg3-bad-"));
  let msg = "";
  try {
    await installGtk3("a { color }", { dry: false, themesDir: dir, gs: fakeGSettings() });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("Invalid CSS");
});

test("installGtk3 writes gtk.css and index.theme", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg3-inst-"));
  const gs = fakeGSettings();
  const res = await installGtk3(renderGtk3(pal), { dry: false, themesDir: dir, gs });
  expect(res.cssFile).toContain("gtk-3.0/gtk.css");

  const css = await readFile(res.cssFile, "utf8");
  expect(css).toContain("@define-color theme_bg_color #faf4ed");

  const index = await readFile(res.indexFile, "utf8");
  expect(index).toContain("GtkTheme=RosePine");

  expect(gs.sets).toContainEqual([
    "org.gnome.desktop.interface",
    "gtk-theme",
    "RosePine",
  ]);
});