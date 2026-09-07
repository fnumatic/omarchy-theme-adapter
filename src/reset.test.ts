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

test("reset entfernt nur den rosepine-Block aus gtk.css und erhält Fremdinhalt", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-home3-"));
  const stateDir = join(home, "state");
  const cfgDir = join(home, "cfg");
  process.env.XDG_CONFIG_HOME = cfgDir;

  const snapGs = fakeGSettings({});
  await ensureSnapshot(snapGs, stateDir); // sichert: keine gtk.css (existed=false)

  // Fremdinhalt + unser Block (wie nach installGtk4 mit append)
  const cssPath = join(cfgDir, "gtk-4.0", "gtk.css");
  await mkdir(join(cfgDir, "gtk-4.0"), { recursive: true });
  const { renderGtk4 } = await import("./render/gtk4.ts");
  const { parseColors } = await import("./colors.ts");
  const css = renderGtk4(parseColors('background = "#faf4ed"\nforeground = "#575279"\n'));
  await writeFile(cssPath, "/* fremd */\n\n" + css);

  const gs = fakeGSettings();
  await resetAll({ dry: false, gs, stateDir, configHome: cfgDir, themesDir: join(home, "themes") });

  expect(await readFile(cssPath, "utf8")).toBe("/* fremd */\n");
  await rm(home, { recursive: true, force: true });
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

test("reset stellt LibreOffice-Config aus Snapshot wieder her", async () => {
  const home = await mkdtemp(join(tmpdir(), "rpg-home-lo-"));
  const stateDir = join(home, "state");
  const loFile = join(home, "registrymodifications.xcu");
  const ORIGINAL = '<item oor:path="/org.openoffice.Office.UI/ColorScheme"><prop oor:name="CurrentColorScheme" oor:op="fuse"><value>LibreOffice</value></prop></item>';
  await writeFile(loFile, ORIGINAL);

  // Snapshot von Hand anlegen (LO-Pfad ist HOME-fixiert → state.json direkt schreiben)
  await mkdir(join(stateDir, "rosepine-gnome"), { recursive: true });
  await writeFile(
    join(stateDir, "rosepine-gnome", "state.json"),
    JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      ghosttyConfigExisted: false,
      ghosttyConfigText: null,
      gtkTheme: null,
      colorScheme: null,
      gtk4CssExisted: false,
      gtk4CssText: null,
      libreofficeConfigExisted: true,
      libreofficeConfigText: ORIGINAL,
    }),
  );

  await writeFile(loFile, ORIGINAL.replace("LibreOffice</value>", "Automatic</value>"));

  const gs = fakeGSettings();
  await resetAll({ dry: false, gs, stateDir, libreofficeConfigFile: loFile });

  expect(await readFile(loFile, "utf8")).toBe(ORIGINAL);
  await rm(home, { recursive: true, force: true });
});
