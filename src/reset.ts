// reset.ts — restores the original state saved in the snapshot.
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSnapshot, type Snapshot } from "./state.ts";
import { realGSettingsWithSchemaDir, type GSettingsRunner } from "./gsettings.ts";
import { ensureParent } from "./fsutil.ts";
import { locateBlock } from "./managedBlock.ts";
import {
  ghosttyConfigPath,
  ghosttyThemesDir,
  gtk4CssPath,
  libreofficeConfigPath,
  paperwmUserCssPath,
  userThemesDir,
  userThemeSchemaDir,
  vscodeSettingsPath,
} from "./paths.ts";
import { GTK3_THEME_NAME } from "./render/gtk3.ts";
import { MARKER as GTK4_MARKER } from "./render/gtk4.ts";
import { MARKER as SHELL_MARKER, END_MARKER as SHELL_END_MARKER, CLOSER_HINT as SHELL_CLOSER_HINT } from "./render/shell.ts";
import { USER_THEME_SCHEMA } from "./render/shellTheme.ts";

/** Ubuntu default, in case an earlier snapshot already contained our GTK theme. */
export const UBUNTU_DEFAULT_GTK_THEME = "Yaru";
/** Old GTK theme name generated before the generic naming scheme. */
export const LEGACY_GTK3_THEME_NAME = "RosePineDawn";
/** Ghostty 1.3 starts dark without a theme entry; Ubuntu light fallback. */
export const GHOSTTY_DEFAULT_THEME = "GitHub Light Default";

/** A snapshot must never restore the tool-generated theme name as the original. */
export function restoreGtkTheme(snapshotTheme: string | null): { theme: string | null; migrated: boolean } {
  const theme = snapshotTheme?.replace(/^'|'$/gu, "") ?? null;
  if (theme === GTK3_THEME_NAME || theme === LEGACY_GTK3_THEME_NAME) {
    return { theme: UBUNTU_DEFAULT_GTK_THEME, migrated: true };
  }
  return { theme, migrated: false };
}

/** Earlier snapshots could mistakenly capture our Ghostty line as the original. */
export function restoreGhosttyConfig(snapshotText: string | null): { text: string; migrated: boolean } | null {
  if (snapshotText === null) return null;
  if (/^\s*theme\s*=\s*rose-pine(?:-dawn)?(?:\.conf)?\s*$/mu.test(snapshotText)) {
    return { text: `theme = ${GHOSTTY_DEFAULT_THEME}\n`, migrated: true };
  }
  return { text: snapshotText, migrated: false };
}

export type ResetTarget = "ghostty" | "gtk3" | "gtk4" | "libreoffice" | "vscode" | "wallpaper" | "shell" | "shell-theme";

export interface ResetOptions {
  dry: boolean;
  stateDir?: string;
  themesDir?: string;
  /** Base config directory (default: $XDG_CONFIG_HOME|~/.config) — overridable for tests */
  configHome?: string;
  /** LibreOffice config (default: ~/.config/libreoffice/…) — overridable for tests */
  libreofficeConfigFile?: string;
  /** VS Code settings (default: Code) — overridable for tests */
  vscodeSettingsFile?: string;
  /** PaperWM user.css (default) — overridable for tests */
  paperwmUserCssFile?: string;
  /** If omitted: restore everything */
  target?: ResetTarget;
  gs: GSettingsRunner;
}

function paperwmUserCssFile(opts: ResetOptions): string {
  return opts.paperwmUserCssFile ?? paperwmUserCssPath();
}

function vscodeSettingsFile(opts: ResetOptions): string {
  return opts.vscodeSettingsFile ?? vscodeSettingsPath();
}

async function writeEnsured(path: string, text: string): Promise<void> {
  await ensureParent(path);
  await writeFile(path, text);
}

function ghosttyConfigFile(opts: ResetOptions): string {
  return ghosttyConfigPath(opts.configHome);
}

function ghosttyThemeFile(opts: ResetOptions): string {
  return join(ghosttyThemesDir(opts.configHome), "rose-pine-dawn.conf");
}

function gtk4CssFile(opts: ResetOptions): string {
  return gtk4CssPath(opts.configHome);
}

function libreofficeConfigFile(opts: ResetOptions): string {
  return opts.libreofficeConfigFile ?? libreofficeConfigPath();
}

/** Restore the active user theme original (if present in the snapshot). */
async function restoreUserTheme(opts: ResetOptions, snap: Snapshot): Promise<void> {
  if (snap.userThemeName !== undefined && snap.userThemeName !== null) {
    if (opts.dry) {
      console.log(`  dry-run: ${USER_THEME_SCHEMA} name → ${snap.userThemeName}`);
    } else {
      await realGSettingsWithSchemaDir(userThemeSchemaDir()).set(USER_THEME_SCHEMA, "name", snap.userThemeName);
      console.log(`   ✓ user themes restored: ${snap.userThemeName}`);
    }
  } else {
    console.log(`   − user theme original: no value in snapshot`);
  }
}

/** Restore Ghostty config + generated theme. */
async function resetGhostty(opts: ResetOptions, snap: Snapshot): Promise<void> {
  const cfg = ghosttyConfigFile(opts);
  if (opts.dry) {
    console.log(`  dry-run: would restore ${cfg} from snapshot`);
  } else if (snap.ghosttyConfigExisted && snap.ghosttyConfigText !== null) {
    const ghosttyRestore = restoreGhosttyConfig(snap.ghosttyConfigText)!;
    await writeEnsured(cfg, ghosttyRestore.text);
    console.log(
      ghosttyRestore.migrated
        ? `   ✓ Ghostty default theme set: ${GHOSTTY_DEFAULT_THEME} (migrated faulty old snapshot)`
        : `   ✓ Ghostty config restored: ${cfg}`,
    );
  } else {
    // There was no config before. Without a theme entry, Ghostty 1.3 uses
    // Dark Modern; for the light Ubuntu default we therefore write an
    // explicit built-in theme entry.
    try {
      const text = await readFile(cfg, "utf8");
      const replaced = text.replace(/^[ \t]*theme[ \t]*=.*$/mu, `theme = ${GHOSTTY_DEFAULT_THEME}`);
      const next = replaced === text && text.trim() === ""
        ? `theme = ${GHOSTTY_DEFAULT_THEME}\n`
        : replaced;
      if (next !== text) {
        await writeEnsured(cfg, next);
        console.log(`   ✓ Ghostty default theme set: ${GHOSTTY_DEFAULT_THEME}`);
      }
    } catch {
      await writeEnsured(cfg, `theme = ${GHOSTTY_DEFAULT_THEME}\n`);
      console.log(`   ✓ Ghostty default theme set: ${GHOSTTY_DEFAULT_THEME}`);
    }
  }

  // Delete generated Ghostty theme (only ours)
  const themeFile = snap.appliedTheme?.ghosttyThemeFile ?? ghosttyThemeFile(opts);
  if (opts.dry) {
    console.log(`  dry-run: would delete ${themeFile}`);
  } else {
    await rm(themeFile, { force: true });
    console.log(`   ✓ Ghostty theme deleted: ${themeFile}`);
  }
}

/** Delete generated GTK3 theme and reset gtk-theme. */
async function resetGtk3(opts: ResetOptions, snap: Snapshot): Promise<void> {
  const themesDir = opts.themesDir ?? userThemesDir();
  const gtkName = snap.appliedTheme?.gtkThemeName ?? GTK3_THEME_NAME;
  const gtkDir = `${themesDir}/${gtkName}`;
  if (opts.dry) {
    console.log(`  dry-run: would delete ${gtkDir}`);
  } else {
    await rm(gtkDir, { recursive: true, force: true });
    console.log(`   ✓ GTK3 theme deleted: ${gtkDir}`);
  }

  // Earlier snapshots could already contain RosePine/RosePineDawn;
  // migrate this known poisoned value.
  const gtkRestore = restoreGtkTheme(snap.gtkTheme);
  if (gtkRestore.theme !== null) {
    if (opts.dry) {
      console.log(`  dry-run: gsettings gtk-theme → ${gtkRestore.theme}`);
    } else {
      await opts.gs.set("org.gnome.desktop.interface", "gtk-theme", gtkRestore.theme);
      console.log(
        gtkRestore.migrated
          ? `   ✓ gtk-theme restored: ${gtkRestore.theme} (migrated faulty old snapshot)`
          : `   ✓ gtk-theme restored: ${gtkRestore.theme}`,
      );
    }
  } else {
    console.log(`   − gtk-theme: no original in snapshot, skipped`);
  }
}

/** Remove generated GNOME Shell theme and reset user theme. */
async function resetShellTheme(opts: ResetOptions, snap: Snapshot): Promise<void> {
  const themesDir = opts.themesDir ?? userThemesDir();
  const shName = snap.appliedTheme?.shellThemeName;
  if (shName) {
    const shDir = `${themesDir}/${shName}`;
    if (opts.dry) {
      console.log(`  dry-run: would delete ${shDir}`);
    } else {
      await rm(shDir, { recursive: true, force: true });
      console.log(`   ✓ GNOME Shell theme deleted: ${shDir}`);
    }
  } else {
    console.log(`   − no applied GNOME Shell theme in snapshot, skipped`);
  }
  await restoreUserTheme(opts, snap);
}

/** Restore the libadwaita overlay or remove only our block. */
async function resetGtk4(opts: ResetOptions, snap: Snapshot): Promise<void> {
  const cssFile = gtk4CssFile(opts);
  if (snap.gtk4CssText === undefined || snap.gtk4CssExisted === undefined) {
    console.log(`   − gtk-4.0 overlay: no original in snapshot (old snapshot), skipped`);
  } else if (opts.dry) {
    console.log(`  dry-run: would restore ${cssFile} from snapshot`);
  } else if (snap.gtk4CssExisted && snap.gtk4CssText !== null) {
    await writeEnsured(cssFile, snap.gtk4CssText);
    console.log(`   ✓ gtk-4.0 overlay restored: ${cssFile}`);
  } else {
    // There was no gtk.css before: remove only our block, never delete foreign content.
    try {
      const text = await readFile(cssFile, "utf8");
      const loc = locateBlock(text, GTK4_MARKER);
      if (loc.kind === "absent") {
        console.log(`   − ${cssFile} contains no themeswitch block, left untouched`);
      } else if (loc.kind === "corrupt") {
        throw new Error(`Block corrupted in ${cssFile}, please check manually.`);
      } else {
        const head = text.slice(0, loc.start).replace(/\s+$/u, "");
        if (head) {
          await writeFile(cssFile, head + "\n");
          console.log(`   ✓ themeswitch block removed from ${cssFile} (rest preserved)`);
        } else {
          await rm(cssFile, { force: true });
          console.log(`   ✓ ${cssFile} deleted (contained only the themeswitch block)`);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("corrupted")) throw e;
      console.log(`   − no gtk-4.0/gtk.css present, nothing to do`);
    }
  }
}

/** Restore LibreOffice config from snapshot. */
async function resetLibreOffice(opts: ResetOptions, snap: Snapshot): Promise<void> {
  const loFile = libreofficeConfigFile(opts);
  if (snap.libreofficeConfigText === undefined || snap.libreofficeConfigExisted === undefined) {
    console.log(`   − LibreOffice: no original in snapshot (old snapshot), skipped`);
  } else if (opts.dry) {
    console.log(`  dry-run: would restore ${loFile} from snapshot`);
  } else if (snap.libreofficeConfigExisted && snap.libreofficeConfigText !== null) {
    await writeEnsured(loFile, snap.libreofficeConfigText);
    console.log(`   ✓ LibreOffice config restored: ${loFile}`);
  } else {
    console.log(`   − no LibreOffice config in snapshot, nothing to do`);
  }
}

/** Restore VS Code settings from snapshot. */
async function resetVscode(opts: ResetOptions, snap: Snapshot): Promise<void> {
  const vsFile = vscodeSettingsFile(opts);
  if (snap.vscodeSettingsText === undefined || snap.vscodeSettingsExisted === undefined) {
    console.log(`   − VS Code: no original in snapshot (old snapshot), skipped`);
  } else if (opts.dry) {
    console.log(`  dry-run: would restore ${vsFile} from snapshot`);
  } else if (snap.vscodeSettingsExisted && snap.vscodeSettingsText !== null) {
    await writeEnsured(vsFile, snap.vscodeSettingsText);
    console.log(`   ✓ VS Code settings restored: ${vsFile}`);
  } else {
    console.log(`   − no VS Code settings in snapshot, nothing to do`);
  }
}

/** Restore wallpaper URIs from snapshot. */
async function resetWallpaper(opts: ResetOptions, snap: Snapshot): Promise<void> {
  for (const [key, val] of [
    ["picture-uri", snap.wallpaperPictureUri],
    ["picture-uri-dark", snap.wallpaperPictureUriDark],
  ] as const) {
    if (val === undefined) {
      console.log(`   − Wallpaper ${key}: no original in snapshot (old snapshot), skipped`);
    } else if (val === null) {
      console.log(`   − Wallpaper ${key}: no original in snapshot, skipped`);
    } else if (opts.dry) {
      console.log(`  dry-run: gsettings ${key} → ${val}`);
    } else {
      await opts.gs.set("org.gnome.desktop.background", key, val);
      console.log(`   ✓ Wallpaper ${key} restored: ${val}`);
    }
  }
}

/** Restore PaperWM user.css or remove only our block. */
async function resetShell(opts: ResetOptions, snap: Snapshot): Promise<void> {
  const pwFile = paperwmUserCssFile(opts);
  if (snap.paperwmUserCssText === undefined || snap.paperwmUserCssExisted === undefined) {
    console.log(`   − PaperWM: no original in snapshot (old snapshot), skipped`);
  } else if (opts.dry) {
    console.log(`  dry-run: would restore ${pwFile} from snapshot`);
  } else if (snap.paperwmUserCssExisted && snap.paperwmUserCssText !== null) {
    await writeEnsured(pwFile, snap.paperwmUserCssText);
    console.log(`   ✓ PaperWM user.css restored: ${pwFile}`);
  } else {
    try {
      const text = await readFile(pwFile, "utf8");
      const loc = locateBlock(text, SHELL_MARKER, SHELL_END_MARKER);
      if (loc.kind === "absent") {
        console.log(`   − ${pwFile} contains no themeswitch block, left untouched`);
      } else if (loc.kind === "corrupt") {
        throw new Error(`Block corrupted in ${pwFile}, please check manually.`);
      } else {
        let head = text.slice(0, loc.start).replace(/\s+$/u, "");
        // Also remove the comment closer added by us.
        const closerIdx = head.lastIndexOf(SHELL_CLOSER_HINT);
        if (closerIdx !== -1 && !head.slice(closerIdx).includes("\n\n")) {
          head = head.slice(0, head.lastIndexOf("\n", closerIdx)).replace(/\s+$/u, "");
        }
        const tail = text.slice(loc.end).replace(/^\s+/u, "");
        const next = (head ? head + "\n\n" : "") + (tail ? tail + "\n" : "");
        if (next) await writeFile(pwFile, next);
        else await rm(pwFile, { force: true });
        console.log(`   ✓ themeswitch block removed from ${pwFile} (rest preserved)`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("corrupted")) throw e;
      console.log(`   − no PaperWM user.css present, nothing to do`);
    }
  }
}

/** Color scheme + user themes (only for a full reset without a target). */
async function resetSystem(opts: ResetOptions, snap: Snapshot): Promise<void> {
  if (snap.colorScheme !== null) {
    if (opts.dry) {
      console.log(`  dry-run: gsettings color-scheme → ${snap.colorScheme}`);
    } else {
      await opts.gs.set("org.gnome.desktop.interface", "color-scheme", snap.colorScheme.replace(/^'|'$/gu, ""));
      console.log(`   ✓ color-scheme restored: ${snap.colorScheme}`);
    }
  } else {
    console.log(`   − color-scheme: no original in snapshot, skipped`);
  }
  await restoreUserTheme(opts, snap);
}

/** Restores all (or the selected) snapshot targets. */
export async function resetAll(opts: ResetOptions): Promise<void> {
  const snap = await loadSnapshot(opts.stateDir);
  if (!snap) {
    throw new Error(
      "No snapshot available — nothing to restore. " +
        "No original state was captured (install/apply have never been run).",
    );
  }
  const want = (t: ResetTarget): boolean => !opts.target || opts.target === t;

  if (want("ghostty")) await resetGhostty(opts, snap);
  if (want("gtk3")) await resetGtk3(opts, snap);
  if (want("shell-theme")) await resetShellTheme(opts, snap);
  if (want("gtk4")) await resetGtk4(opts, snap);
  if (want("libreoffice")) await resetLibreOffice(opts, snap);
  if (want("vscode")) await resetVscode(opts, snap);
  if (want("wallpaper")) await resetWallpaper(opts, snap);
  if (want("shell")) await resetShell(opts, snap);
  if (!opts.target) await resetSystem(opts, snap);
}
