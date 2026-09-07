import { test, expect } from "bun:test";
import { mkdtemp, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseColors } from "../colors.ts";
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

test("renderGtk3 enthält zentrale @define-color aus dem Mapping", () => {
  const css = renderGtk3(base);
  expect(css).toContain("@define-color theme_bg_color #faf4ed");
  expect(css).toContain("@define-color theme_base_color #ede7e1");
  expect(css).toContain("@define-color theme_fg_color #575279");
  expect(css).toContain("@define-color theme_selected_bg_color #dfdad9");
});

test("renderIndexTheme setzt Name und GtkTheme", () => {
  const t = renderIndexTheme();
  expect(t).toContain("Name=RosePineDawn");
  expect(t).toContain("GtkTheme=RosePineDawn");
  expect(t).toContain("Type=X-GNOME-Metatheme");
});

test("renderGtk3 enthält kompakte Headerbar-Regeln", () => {
  const css = renderGtk3(base);
  expect(css).toContain("min-height: 28px");
});

test("installGtk3 --dry-run schreibt nichts und setzt kein gsettings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg3-dry-"));
  const gs = fakeGSettings();
  await installGtk3(renderGtk3(base), { dry: true, themesDir: dir, gs });
  const exists = await access(join(dir, GTK3_THEME_NAME)).then(() => true).catch(() => false);
  expect(exists).toBe(false);
  expect(gs.sets).toHaveLength(0);
});

test("installGtk3 schreibt gtk.css und index.theme", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg3-inst-"));
  const gs = fakeGSettings();
  const res = await installGtk3(renderGtk3(base), { dry: false, themesDir: dir, gs });
  expect(res.cssFile).toContain("gtk-3.0/gtk.css");

  const css = await readFile(res.cssFile, "utf8");
  expect(css).toContain("@define-color theme_bg_color #faf4ed");

  const index = await readFile(res.indexFile, "utf8");
  expect(index).toContain("GtkTheme=RosePineDawn");

  expect(gs.sets).toContainEqual([
    "org.gnome.desktop.interface",
    "gtk-theme",
    "RosePineDawn",
  ]);
});