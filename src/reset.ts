// reset.ts — stellt den im Snapshot gesicherten Originalzustand wieder her.
import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { loadSnapshot } from "./state.ts";
import { realGSettingsWithSchemaDir, type GSettingsRunner } from "./gsettings.ts";
import { GTK3_THEME_NAME } from "./render/gtk3.ts";
import { MARKER as GTK4_MARKER } from "./render/gtk4.ts";
import { MARKER as SHELL_MARKER, END_MARKER as SHELL_END_MARKER, CLOSER_HINT as SHELL_CLOSER_HINT } from "./render/shell.ts";
import { USER_THEME_SCHEMA } from "./render/shellTheme.ts";

/** Ubuntu-Standard, falls ein früher Snapshot bereits unser GTK-Theme enthielt. */
export const UBUNTU_DEFAULT_GTK_THEME = "Yaru";
/** Ghostty 1.3 startet ohne Theme-Eintrag dunkel; Ubuntu-heller Fallback. */
export const GHOSTTY_DEFAULT_THEME = "GitHub Light Default";

/** Ein Snapshot darf nie den vom Tool erzeugten Theme-Namen als Original zurückspielen. */
export function restoreGtkTheme(snapshotTheme: string | null): { theme: string | null; migrated: boolean } {
  const theme = snapshotTheme?.replace(/^'|'$/gu, "") ?? null;
  if (theme === GTK3_THEME_NAME) return { theme: UBUNTU_DEFAULT_GTK_THEME, migrated: true };
  return { theme, migrated: false };
}

/** Frühere Snapshots konnten unsere Ghostty-Zeile fälschlich als Original sichern. */
export function restoreGhosttyConfig(snapshotText: string | null): { text: string; migrated: boolean } | null {
  if (snapshotText === null) return null;
  if (/^\s*theme\s*=\s*rose-pine-dawn(?:\.conf)?\s*$/mu.test(snapshotText)) {
    return { text: `theme = ${GHOSTTY_DEFAULT_THEME}\n`, migrated: true };
  }
  return { text: snapshotText, migrated: false };
}

export type ResetTarget = "ghostty" | "gtk3" | "gtk4" | "libreoffice" | "vscode" | "wallpaper" | "shell" | "shell-theme";

export interface ResetOptions {
  dry: boolean;
  stateDir?: string;
  themesDir?: string;
  /** Basis-Config-Verzeichnis (Default: $XDG_CONFIG_HOME|~/.config) — für Tests überschreibbar */
  configHome?: string;
  /** LibreOffice-Config (Default: ~/.config/libreoffice/…) — für Tests überschreibbar */
  libreofficeConfigFile?: string;
  /** VS-Code-settings (Default: Code) — für Tests überschreibbar */
  vscodeSettingsFile?: string;
  /** PaperWM-user.css (Default) — für Tests überschreibbar */
  paperwmUserCssFile?: string;
  /** Ohne Angabe: alles wiederherstellen */
  target?: ResetTarget;
  gs: GSettingsRunner;
}

function paperwmUserCssFile(opts: ResetOptions): string {
  return opts.paperwmUserCssFile ?? `${process.env.HOME}/.config/paperwm/user.css`;
}

function vscodeSettingsFile(opts: ResetOptions): string {
  return opts.vscodeSettingsFile ?? `${process.env.HOME}/.config/Code/User/settings.json`;
}

async function writeEnsured(path: string, text: string): Promise<void> {
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await writeFile(path, text);
}

function configHomeOf(opts: ResetOptions): string {
  return opts.configHome ?? process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`;
}

function ghosttyConfigPath(opts: ResetOptions): string {
  return `${configHomeOf(opts)}/ghostty/config`;
}

function ghosttyThemeFile(opts: ResetOptions): string {
  return `${configHomeOf(opts)}/ghostty/themes/rose-pine-dawn.conf`;
}

function gtk4CssFile(opts: ResetOptions): string {
  return `${configHomeOf(opts)}/gtk-4.0/gtk.css`;
}

function libreofficeConfigFile(opts: ResetOptions): string {
  return (
    opts.libreofficeConfigFile ??
    `${process.env.HOME}/.config/libreoffice/4/user/registrymodifications.xcu`
  );
}

export async function resetAll(opts: ResetOptions): Promise<void> {
  const snap = await loadSnapshot(opts.stateDir);
  if (!snap) {
    throw new Error(
      "Kein Snapshot vorhanden — nichts wiederherzustellen. " +
        "Es wurde kein Originalzustand erfasst (install/apply wurden noch nie ausgeführt).",
    );
  }
  const want = (t: ResetTarget): boolean => !opts.target || opts.target === t;

  if (want("ghostty")) {
  // Ghostty-Config
  const cfg = ghosttyConfigPath(opts);
  if (opts.dry) {
    console.log(`  dry-run: stelle ${cfg} aus Snapshot wieder her`);
  } else if (snap.ghosttyConfigExisted && snap.ghosttyConfigText !== null) {
    const ghosttyRestore = restoreGhosttyConfig(snap.ghosttyConfigText)!;
    await writeEnsured(cfg, ghosttyRestore.text);
    console.log(
      ghosttyRestore.migrated
        ? `   ✓ Ghostty-Standardtheme gesetzt: ${GHOSTTY_DEFAULT_THEME} (fehlerhaften alten Snapshot migriert)`
        : `   ✓ Ghostty-Config wiederhergestellt: ${cfg}`,
    );
  } else {
    // Es gab vorher keine Config. Ghostty 1.3 verwendet ohne Theme-Eintrag
    // Dark Modern; für den hellen Ubuntu-Standard schreiben wir daher einen
    // expliziten Built-in-Theme-Eintrag.
    try {
      const text = await readFile(cfg, "utf8");
      const replaced = text.replace(/^[ \t]*theme[ \t]*=.*$/mu, `theme = ${GHOSTTY_DEFAULT_THEME}`);
      const next = replaced === text && text.trim() === ""
        ? `theme = ${GHOSTTY_DEFAULT_THEME}\n`
        : replaced;
      if (next !== text) {
        await writeEnsured(cfg, next);
        console.log(`   ✓ Ghostty-Standardtheme gesetzt: ${GHOSTTY_DEFAULT_THEME}`);
      }
    } catch {
      await writeEnsured(cfg, `theme = ${GHOSTTY_DEFAULT_THEME}\n`);
      console.log(`   ✓ Ghostty-Standardtheme gesetzt: ${GHOSTTY_DEFAULT_THEME}`);
    }
  }

  // Generiertes Ghostty-Theme löschen (nur unseres)
  const themeFile = snap.appliedTheme?.ghosttyThemeFile ?? ghosttyThemeFile(opts);
  if (opts.dry) {
    console.log(`  dry-run: lösche ${themeFile}`);
  } else {
    await rm(themeFile, { force: true });
    console.log(`   ✓ Ghostty-Theme gelöscht: ${themeFile}`);
  }
  }

  if (want("gtk3")) {
  // Generiertes GTK3-Theme löschen (nur unseres)
  const themesDir = opts.themesDir ?? `${process.env.HOME}/.themes`;
  const gtkName = snap.appliedTheme?.gtkThemeName ?? GTK3_THEME_NAME;
  const gtkDir = `${themesDir}/${gtkName}`;
  if (opts.dry) {
    console.log(`  dry-run: lösche ${gtkDir}`);
  } else {
    await rm(gtkDir, { recursive: true, force: true });
    console.log(`   ✓ GTK3-Theme gelöscht: ${gtkDir}`);
  }

  // gsettings gtk-theme zurücksetzen. Frühere Snapshots konnten bereits
  // RosePineDawn enthalten; diesen bekannten vergifteten Wert migrieren.
  const gtkRestore = restoreGtkTheme(snap.gtkTheme);
  if (gtkRestore.theme !== null) {
    if (opts.dry) {
      console.log(`  dry-run: gsettings gtk-theme → ${gtkRestore.theme}`);
    } else {
      await opts.gs.set("org.gnome.desktop.interface", "gtk-theme", gtkRestore.theme);
      console.log(
        gtkRestore.migrated
          ? `   ✓ gtk-theme wiederhergestellt: ${gtkRestore.theme} (fehlerhaften alten Snapshot migriert)`
          : `   ✓ gtk-theme wiederhergestellt: ${gtkRestore.theme}`,
      );
    }
  } else {
    console.log(`   − gtk-theme: kein Original im Snapshot, übersprungen`);
  }
  }

  if (want("shell-theme")) {
  // Generiertes Shell-Theme entfernen + aktives User-Theme zurücksetzen
  const themesDir = opts.themesDir ?? `${process.env.HOME}/.themes`;
  const shName = snap.appliedTheme?.shellThemeName;
  if (shName) {
    const shDir = `${themesDir}/${shName}`;
    if (opts.dry) {
      console.log(`  dry-run: lösche ${shDir}`);
    } else {
      await rm(shDir, { recursive: true, force: true });
      console.log(`   ✓ GNOME-Shell-Theme gelöscht: ${shDir}`);
    }
  } else {
    console.log(`   − kein angewandtes GNOME-Shell-Theme im Snapshot, übersprungen`);
  }
  if (snap.userThemeName !== undefined && snap.userThemeName !== null) {
    if (opts.dry) {
      console.log(`  dry-run: ${USER_THEME_SCHEMA} name → ${snap.userThemeName}`);
    } else {
      const dir = `${process.env.HOME}/.local/share/gnome-shell/extensions/user-theme@gnome-shell-extensions.gcampax.github.com/schemas`;
      const ut = realGSettingsWithSchemaDir(dir);
      await ut.set(USER_THEME_SCHEMA, "name", snap.userThemeName);
      console.log(`   ✓ User-Themes wiederhergestellt: ${snap.userThemeName}`);
    }
  } else {
    console.log(`   − User-Themes-Original: kein Wert im Snapshot`);
  }
  }

  if (want("gtk4")) {
  // libadwaita-Overlay (gtk-4.0/gtk.css)
  const cssFile = gtk4CssFile(opts);
  if (snap.gtk4CssText === undefined || snap.gtk4CssExisted === undefined) {
    console.log(`   − gtk-4.0-Overlay: kein Original im Snapshot (alter Snapshot), übersprungen`);
  } else if (opts.dry) {
    console.log(`  dry-run: stelle ${cssFile} aus Snapshot wieder her`);
  } else if (snap.gtk4CssExisted && snap.gtk4CssText !== null) {
    await writeEnsured(cssFile, snap.gtk4CssText);
    console.log(`   ✓ gtk-4.0-Overlay wiederhergestellt: ${cssFile}`);
  } else {
    // Es gab vorher keine gtk.css: nur unseren Block entfernen, fremde Inhalte nie löschen.
    try {
      const text = await readFile(cssFile, "utf8");
      if (!text.includes(GTK4_MARKER)) {
        console.log(`   − ${cssFile} enthält keinen themeswitch-Block, unangetastet`);
      } else {
        const head = text.slice(0, text.indexOf("/* " + GTK4_MARKER)).replace(/\s+$/u, "");
        if (head) {
          await writeFile(cssFile, head + "\n");
          console.log(`   ✓ themeswitch-Block aus ${cssFile} entfernt (Rest erhalten)`);
        } else {
          await rm(cssFile, { force: true });
          console.log(`   ✓ ${cssFile} gelöscht (nur themeswitch-Block enthalten)`);
        }
      }
    } catch {
      console.log(`   − keine gtk-4.0/gtk.css vorhanden, nichts zu tun`);
    }
  }
  }

  if (want("libreoffice")) {
  // LibreOffice-Config (Anwendungsfarben-Schema)
  const loFile = libreofficeConfigFile(opts);
  if (snap.libreofficeConfigText === undefined || snap.libreofficeConfigExisted === undefined) {
    console.log(`   − LibreOffice: kein Original im Snapshot (alter Snapshot), übersprungen`);
  } else if (opts.dry) {
    console.log(`  dry-run: stelle ${loFile} aus Snapshot wieder her`);
  } else if (snap.libreofficeConfigExisted && snap.libreofficeConfigText !== null) {
    await writeEnsured(loFile, snap.libreofficeConfigText);
    console.log(`   ✓ LibreOffice-Config wiederhergestellt: ${loFile}`);
  } else {
    console.log(`   − keine LibreOffice-Config im Snapshot, nichts zu tun`);
  }
  }

  if (want("vscode")) {
  // VS-Code-settings (nur colorTheme wurde von uns gesetzt → ganze Datei aus Snapshot)
  const vsFile = vscodeSettingsFile(opts);
  if (snap.vscodeSettingsText === undefined || snap.vscodeSettingsExisted === undefined) {
    console.log(`   − VS Code: kein Original im Snapshot (alter Snapshot), übersprungen`);
  } else if (opts.dry) {
    console.log(`  dry-run: stelle ${vsFile} aus Snapshot wieder her`);
  } else if (snap.vscodeSettingsExisted && snap.vscodeSettingsText !== null) {
    await writeEnsured(vsFile, snap.vscodeSettingsText);
    console.log(`   ✓ VS-Code-settings wiederhergestellt: ${vsFile}`);
  } else {
    console.log(`   − keine VS-Code-settings im Snapshot, nichts zu tun`);
  }
  }

  if (want("wallpaper")) {
  // Wallpaper-URIs (nur was im Snapshot stand)
  for (const [key, val] of [
    ["picture-uri", snap.wallpaperPictureUri],
    ["picture-uri-dark", snap.wallpaperPictureUriDark],
  ] as const) {
    if (val === undefined) {
      console.log(`   − Wallpaper ${key}: kein Original im Snapshot (alter Snapshot), übersprungen`);
    } else if (val === null) {
      console.log(`   − Wallpaper ${key}: kein Original im Snapshot, übersprungen`);
    } else if (opts.dry) {
      console.log(`  dry-run: gsettings ${key} → ${val}`);
    } else {
      await opts.gs.set("org.gnome.desktop.background", key, val);
      console.log(`   ✓ Wallpaper ${key} wiederhergestellt: ${val}`);
    }
  }
  }

  if (want("shell")) {
  // PaperWM-user.css: Original wiederherstellen bzw. nur unseren Block entfernen
  const pwFile = paperwmUserCssFile(opts);
  if (snap.paperwmUserCssText === undefined || snap.paperwmUserCssExisted === undefined) {
    console.log(`   − PaperWM: kein Original im Snapshot (alter Snapshot), übersprungen`);
  } else if (opts.dry) {
    console.log(`  dry-run: stelle ${pwFile} aus Snapshot wieder her`);
  } else if (snap.paperwmUserCssExisted && snap.paperwmUserCssText !== null) {
    await writeEnsured(pwFile, snap.paperwmUserCssText);
    console.log(`   ✓ PaperWM-user.css wiederhergestellt: ${pwFile}`);
  } else {
    try {
      const text = await readFile(pwFile, "utf8");
      if (!text.includes(SHELL_MARKER)) {
        console.log(`   − ${pwFile} enthält keinen themeswitch-Block, unangetastet`);
      } else {
        const start = text.indexOf(`/* ${SHELL_MARKER}`);
        const endToken = `/* ${SHELL_END_MARKER} */`;
        const end = text.indexOf(endToken, start);
        if (end === -1) throw new Error(`Block beschädigt in ${pwFile}, bitte manuell prüfen.`);
        let head = text.slice(0, start).replace(/\s+$/u, "");
        // Von uns ergänzte Kommentar-Schließung ebenfalls entfernen.
        const closerIdx = head.lastIndexOf(SHELL_CLOSER_HINT);
        if (closerIdx !== -1 && !head.slice(closerIdx).includes("\n\n")) {
          head = head.slice(0, head.lastIndexOf("\n", closerIdx)).replace(/\s+$/u, "");
        }
        const tail = text.slice(end + endToken.length).replace(/^\s+/u, "");
        const next = (head ? head + "\n\n" : "") + (tail ? tail + "\n" : "");
        if (next) await writeFile(pwFile, next);
        else await rm(pwFile, { force: true });
        console.log(`   ✓ themeswitch-Block aus ${pwFile} entfernt (Rest erhalten)`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("beschädigt")) throw e;
      console.log(`   − keine PaperWM-user.css vorhanden, nichts zu tun`);
    }
  }
  }

  if (!opts.target) {
  if (snap.colorScheme !== null) {
    if (opts.dry) {
      console.log(`  dry-run: gsettings color-scheme → ${snap.colorScheme}`);
    } else {
      await opts.gs.set("org.gnome.desktop.interface", "color-scheme", snap.colorScheme.replace(/^'|'$/gu, ""));
      console.log(`   ✓ color-scheme wiederhergestellt: ${snap.colorScheme}`);
    }
  } else {
    console.log(`   − color-scheme: kein Original im Snapshot, übersprungen`);
  }
  if (snap.userThemeName !== undefined && snap.userThemeName !== null) {
    const dir = `${process.env.HOME}/.local/share/gnome-shell/extensions/user-theme@gnome-shell-extensions.gcampax.github.com/schemas`;
    if (opts.dry) {
      console.log(`  dry-run: ${USER_THEME_SCHEMA} name → ${snap.userThemeName}`);
    } else {
      await realGSettingsWithSchemaDir(dir).set(USER_THEME_SCHEMA, "name", snap.userThemeName);
      console.log(`   ✓ User-Themes wiederhergestellt: ${snap.userThemeName}`);
    }
  } else {
    console.log(`   − User-Themes-Original: kein Wert im Snapshot`);
  }
  }
}
