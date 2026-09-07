import { test, expect, afterEach } from "bun:test";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeGSettings } from "./gsettings.ts";
import { ensureSnapshot, loadSnapshot } from "./state.ts";
import { resetAll } from "./reset.ts";

const ORIG_XDG_CONFIG = process.env.XDG_CONFIG_HOME;
afterEach(() => {
  if (ORIG_XDG_CONFIG === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = ORIG_XDG_CONFIG;
});

test("ensureSnapshot erfasst Werte und wird nur einmal geschrieben", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "rpg-state-"));
  const gs = fakeGSettings({
    "org.gnome.desktop.interface gtk-theme": "'Yaru'",
    "org.gnome.desktop.interface color-scheme": "'default'",
  });

  const first = await ensureSnapshot(gs, stateDir);
  expect(first.created).toBe(true);
  expect(first.snapshot.gtkTheme).toBe("'Yaru'");

  // Zweiter Aufruf: kein Überschreiben, auch wenn sich gsettings ändert
  await gs.set("org.gnome.desktop.interface", "gtk-theme", "RosePineDawn");
  const second = await ensureSnapshot(gs, stateDir);
  expect(second.created).toBe(false);
  expect((await loadSnapshot(stateDir))?.gtkTheme).toBe("'Yaru'");
});

test("reset ohne Snapshot wirft kontrollierten Fehler", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "rpg-state-empty-"));
  const gs = fakeGSettings();
  let msg = "";
  try {
    await resetAll({ dry: false, gs, stateDir });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("Kein Snapshot");
});

test("reset --dry-run verändert nichts", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-home-"));
  const stateDir = join(home, "state");
  const cfgDir = join(home, "cfg");
  process.env.XDG_CONFIG_HOME = cfgDir;
  await mkdir(join(cfgDir, "ghostty", "themes"), { recursive: true });
  await writeFile(join(cfgDir, "ghostty", "config"), "theme = rose-pine-dawn.conf\n");
  await writeFile(join(cfgDir, "ghostty", "themes", "rose-pine-dawn.conf"), "x\n");

  const gs = fakeGSettings({
    "org.gnome.desktop.interface gtk-theme": "'Yaru'",
    "org.gnome.desktop.interface color-scheme": "'default'",
  });
  // Snapshot mit anderen (Original-)Werten anlegen
  const snapGs = fakeGSettings({
    "org.gnome.desktop.interface gtk-theme": "'Adwaita'",
    "org.gnome.desktop.interface color-scheme": "'prefer-dark'",
  });
  await ensureSnapshot(snapGs, stateDir);

  const themesDir = join(home, "themes");
  await mkdir(join(themesDir, "RosePineDawn", "gtk-3.0"), { recursive: true });
  await writeFile(join(themesDir, "RosePineDawn", "gtk-3.0", "gtk.css"), "x");

  await resetAll({ dry: true, gs, stateDir, themesDir });

  // nichts geändert
  expect(await readFile(join(cfgDir, "ghostty", "config"), "utf8")).toContain("rose-pine-dawn");
  expect(gs.sets).toHaveLength(0);
  expect(await readFile(join(themesDir, "RosePineDawn", "gtk-3.0", "gtk.css"), "utf8")).toBe("x");
});

test("reset stellt Snapshot-Werte wieder her", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-home2-"));
  const stateDir = join(home, "state");
  const cfgDir = join(home, "cfg");
  process.env.XDG_CONFIG_HOME = cfgDir;
  await mkdir(join(cfgDir, "ghostty", "themes"), { recursive: true });
  // Original-Config, die der Snapshot sichert:
  await writeFile(
    join(cfgDir, "ghostty", "config"),
    "theme = light:GitHub Light Default, dark: GitHub Dark\n",
  );

  const snapGs = fakeGSettings({
    "org.gnome.desktop.interface gtk-theme": "'Yaru'",
    "org.gnome.desktop.interface color-scheme": "'prefer-dark'",
  });
  await ensureSnapshot(snapGs, stateDir);

  // … dann wird "installiert" (Zustand danach):
  await writeFile(join(cfgDir, "ghostty", "config"), "theme = rose-pine-dawn.conf\n");
  await writeFile(join(cfgDir, "ghostty", "themes", "rose-pine-dawn.conf"), "theme\n");
  const themesDir = join(home, "themes");
  await mkdir(join(themesDir, "RosePineDawn", "gtk-3.0"), { recursive: true });
  await writeFile(join(themesDir, "RosePineDawn", "gtk-3.0", "gtk.css"), "x");

  const gs = fakeGSettings();
  await resetAll({ dry: false, gs, stateDir, themesDir });

  expect(await readFile(join(cfgDir, "ghostty", "config"), "utf8")).toContain("GitHub Light");
  expect(gs.sets).toContainEqual(["org.gnome.desktop.interface", "gtk-theme", "Yaru"]);
  expect(gs.sets).toContainEqual(["org.gnome.desktop.interface", "color-scheme", "prefer-dark"]);
  // generierte Dateien weg
  let themeGone = false;
  try {
    await readFile(join(cfgDir, "ghostty", "themes", "rose-pine-dawn.conf"), "utf8");
  } catch {
    themeGone = true;
  }
  expect(themeGone).toBe(true);
  let gtkGone = false;
  try {
    await readFile(join(themesDir, "RosePineDawn", "gtk-3.0", "gtk.css"), "utf8");
  } catch {
    gtkGone = true;
  }
  expect(gtkGone).toBe(true);
  await rm(home, { recursive: true, force: true });
});
