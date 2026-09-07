// reset.ts — stellt den im Snapshot gesicherten Originalzustand wieder her.
import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { loadSnapshot } from "./state.ts";
import type { GSettingsRunner } from "./gsettings.ts";
import { GTK3_THEME_NAME } from "./render/gtk3.ts";
import { MARKER as GTK4_MARKER } from "./render/gtk4.ts";

export type ResetTarget = "ghostty" | "gtk3" | "gtk4" | "libreoffice" | "vscode" | "wallpaper";

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
  /** Ohne Angabe: alles wiederherstellen */
  target?: ResetTarget;
  gs: GSettingsRunner;
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
    await writeEnsured(cfg, snap.ghosttyConfigText);
    console.log(`   ✓ Ghostty-Config wiederhergestellt: ${cfg}`);
  } else {
    // Es gab vorher keine Config: nur unsere theme-Zeile entfernen,
    // Datei sonst unangetastet lassen.
    try {
      const text = await readFile(cfg, "utf8");
      const cleaned = text.replace(/^[ \t]*theme[ \t]*=.*$/mu, "").replace(/\n{3,}/gu, "\n\n");
      if (cleaned !== text) {
        await writeFile(cfg, cleaned);
        console.log(`   ✓ theme-Zeile aus ${cfg} entfernt`);
      }
    } catch {
      console.log(`   − keine Ghostty-Config vorhanden, nichts zu tun`);
    }
  }

  // Generiertes Ghostty-Theme löschen (nur unseres)
  const themeFile = ghosttyThemeFile(opts);
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
  const gtkDir = `${themesDir}/${GTK3_THEME_NAME}`;
  if (opts.dry) {
    console.log(`  dry-run: lösche ${gtkDir}`);
  } else {
    await rm(gtkDir, { recursive: true, force: true });
    console.log(`   ✓ GTK3-Theme gelöscht: ${gtkDir}`);
  }

  // gsettings gtk-theme zurücksetzen (nur was im Snapshot stand)
  if (snap.gtkTheme !== null) {
    if (opts.dry) {
      console.log(`  dry-run: gsettings gtk-theme → ${snap.gtkTheme}`);
    } else {
      await opts.gs.set("org.gnome.desktop.interface", "gtk-theme", snap.gtkTheme.replace(/^'|'$/gu, ""));
      console.log(`   ✓ gtk-theme wiederhergestellt: ${snap.gtkTheme}`);
    }
  } else {
    console.log(`   − gtk-theme: kein Original im Snapshot, übersprungen`);
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
        console.log(`   − ${cssFile} enthält keinen rosepine-Block, unangetastet`);
      } else {
        const head = text.slice(0, text.indexOf("/* " + GTK4_MARKER)).replace(/\s+$/u, "");
        if (head) {
          await writeFile(cssFile, head + "\n");
          console.log(`   ✓ rosepine-Block aus ${cssFile} entfernt (Rest erhalten)`);
        } else {
          await rm(cssFile, { force: true });
          console.log(`   ✓ ${cssFile} gelöscht (nur rosepine-Block enthalten)`);
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
  }
}

