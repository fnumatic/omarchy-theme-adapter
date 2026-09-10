import { test, expect } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertValidCss } from "../cssutil.ts";
import { fakeGSettings } from "../gsettings.ts";
import { parseColors } from "../colors.ts";
import { resolvePalette } from "../palette.ts";
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
const pal = resolvePalette(base);

test("renderShellOverride contains Rose-Pine colors for core surfaces", () => {
  const css = renderShellOverride(pal);
  expect(css).toContain("#panel");
  expect(css).toContain("background-color: transparent");
  expect(css).toContain("#575279");
  expect(css).toContain("background-color: #ede7e1");
  expect(css).toContain("background-color: #56949f");
  expect(css).toContain("background-color: #56949f !important");
  expect(css).toContain(".quick-toggle:checked");
  expect(css).toContain(".quick-toggle-has-menu .quick-toggle-menu-button");
  expect(css).toContain("background-color: #f2e9e1 !important");
  expect(css).toContain("background-color: #56949f !important;");
  expect(css).toContain(".fw-fctrl-popup-menu");
  expect(css).toContain("-barlevel-active-background-color: #56949f");
});

test("renderShellTheme appends the override to a complete base (valid)", () => {
  const full = renderShellTheme("/* base */\nstage { color: #222; }", renderShellOverride(pal));
  expect(full.startsWith("/* base */")).toBe(true);
  assertValidCss(full, "shell-theme");
});

test("assertValidCss accepts the rendered theme (practical structure check)", () => {
  // assertValidCss uses css-tree's onParseError; the proven-valid theme
  // must never be rejected. The definitive benchmark remains GNOME Shell (journal) at load time.
  assertValidCss(renderShellTheme("stage {}\n", renderShellOverride(pal)), "shell-theme");
});

test("installShellTheme writes the file, validates CSS and sets User Themes (mock)", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-shtheme-"));
  const themesDir = join(home, "themes");
  const gs = fakeGSettings({});

  const baseFull = renderShellTheme("stage {}\n", renderShellOverride(pal));
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

test("installShellTheme --dry-run writes nothing", async () => {
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

test("shellThemeName appends 'Shell'", () => {
  expect(shellThemeName("RosePine")).toBe("RosePineShell");
});
