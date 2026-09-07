// reset.ts — stellt den im Snapshot gesicherten Originalzustand wieder her.
import { readFile, rm, writeFile } from "node:fs/promises";
import { loadSnapshot } from "./state.ts";
import type { GSettingsRunner } from "./gsettings.ts";
import { GTK3_THEME_NAME } from "./render/gtk3.ts";

export interface ResetOptions {
  dry: boolean;
  stateDir?: string;
  themesDir?: string;
  gs: GSettingsRunner;
}

function ghosttyConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
  return `${xdg}/ghostty/config`;
}

function ghosttyThemeFile(): string {
  const xdg = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
  return `${xdg}/ghostty/themes/rose-pine-dawn.conf`;
}

export async function resetAll(opts: ResetOptions): Promise<void> {
  const snap = await loadSnapshot(opts.stateDir);
  if (!snap) {
    throw new Error(
      "Kein Snapshot vorhanden — nichts wiederherzustellen. " +
        "Es wurde kein Originalzustand erfasst (install/apply wurden noch nie ausgeführt).",
    );
  }

  // Ghostty-Config
  const cfg = ghosttyConfigPath();
  if (opts.dry) {
    console.log(`  dry-run: stelle ${cfg} aus Snapshot wieder her`);
  } else if (snap.ghosttyConfigExisted && snap.ghosttyConfigText !== null) {
    await writeFile(cfg, snap.ghosttyConfigText);
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
  const themeFile = ghosttyThemeFile();
  if (opts.dry) {
    console.log(`  dry-run: lösche ${themeFile}`);
  } else {
    await rm(themeFile, { force: true });
    console.log(`   ✓ Ghostty-Theme gelöscht: ${themeFile}`);
  }

  // Generiertes GTK3-Theme löschen (nur unseres)
  const themesDir = opts.themesDir ?? `${process.env.HOME}/.themes`;
  const gtkDir = `${themesDir}/${GTK3_THEME_NAME}`;
  if (opts.dry) {
    console.log(`  dry-run: lösche ${gtkDir}`);
  } else {
    await rm(gtkDir, { recursive: true, force: true });
    console.log(`   ✓ GTK3-Theme gelöscht: ${gtkDir}`);
  }

  // gsettings zurücksetzen (nur was im Snapshot stand)
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

