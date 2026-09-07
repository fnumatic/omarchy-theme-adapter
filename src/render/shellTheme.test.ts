import { test, expect } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertValidCss } from "../cssutil.ts";
import { fakeGSettings } from "../gsettings.ts";
import { parseColors } from "../colors.ts";
import {
  renderShellOverride,
  renderShellTheme,
  installShellTheme,
  shellThemeName,
  USER_THEME_SCHEMA,
} from "./shellTheme.ts";

const base = parseColors(
  'background = "#faf4ed"\ndark_background = "#ede7e1"\nlighter_background = "#f2e9e1"\nforeground = "#575279"\ndark_foreground = "#9893a5"\naccent = "#56949f"\nselection = "#dfdad9"\n',
);

test("renderShellOverride enthält Rose-Pine-Farben für Kernflächen", () => {
  const css = renderShellOverride(base);
  expect(css).toContain("#panel");
  expect(css).toContain("background-color: transparent");
  expect(css).toContain("#575279");
  expect(css).toContain("background-color: #ede7e1");
  expect(css).toContain("background-color: #56949f");
});

test("renderShellTheme hängt Override an eine vollständige Basis an (valid)", () => {
  const full = renderShellTheme("/* basis */\nstage { color: #222; }", renderShellOverride(base));
  expect(full.startsWith("/* basis */")).toBe(true);
  assertValidCss(full, "shell-theme");
});

test("assertValidCss akzeptiert das gerenderte Theme (praktische Strukturprüfung)", () => {
  // css-tree ist strukturell tolerant; es darf zumindest das erzeugte Theme nie ablehnen,
  // und der definitive Maßstab ist GNOME Shell (Journal) beim Laden.
  assertValidCss(renderShellTheme("stage {}\n", renderShellOverride(base)), "shell-theme");
});

test("installShellTheme schreibt Datei, validiert CSS und setzt User-Themes (mock)", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-shtheme-"));
  const themesDir = join(home, "themes");
  const gs = fakeGSettings({});
  let didReload = false;

  const baseFull = renderShellTheme("stage {}\n", renderShellOverride(base));
  const res = await installShellTheme("RosePineShell", baseFull, {
    dry: false,
    themesDir,
    gs,
    skipReload: true,
  });

  expect(res.cssFile.endsWith("RosePineShell/gnome-shell/gnome-shell.css")).toBe(true);
  const written = await readFile(res.cssFile, "utf8");
  expect(written).toContain("#575279");
  expect(gs.sets).toContainEqual([USER_THEME_SCHEMA, "name", "RosePineShell"]);
  await rm(home, { recursive: true, force: true });
});

test("installShellTheme --dry-run schreibt nichts", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-shtheme-dry-"));
  const themesDir = join(home, "themes");
  const gs = fakeGSettings();
  await installShellTheme("RosePineShell", "stage {}",
    { dry: true, themesDir, gs, skipReload: true });
  const fits = await readFile(join(themesDir, "RosePineShell", "gnome-shell", "gnome-shell.css"))
    .then(() => true)
    .catch(() => false);
  expect(fits).toBe(false);
  expect(gs.sets).toHaveLength(0);
  await rm(home, { recursive: true, force: true });
});

test("shellThemeName hängt 'Shell' an", () => {
  expect(shellThemeName("RosePine")).toBe("RosePineShell");
});