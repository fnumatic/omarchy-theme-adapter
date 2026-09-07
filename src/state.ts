// state.ts — Snapshot der Originaleinstellungen vor dem ersten Eingriff.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { GSettingsRunner } from "./gsettings.ts";

export interface Snapshot {
  version: 1;
  createdAt: string;
  ghosttyConfigExisted: boolean;
  ghosttyConfigText: string | null;
  gtkTheme: string | null;
  colorScheme: string | null;
  gtk4CssExisted: boolean | null;
  gtk4CssText: string | null;
  libreofficeConfigExisted: boolean | null;
  libreofficeConfigText: string | null;
  vscodeSettingsExisted: boolean | null;
  vscodeSettingsText: string | null;
  wallpaperPictureUri: string | null;
  wallpaperPictureUriDark: string | null;
}

export function statePath(overrideDir?: string): string {
  const base =
    overrideDir ?? process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`;
  return `${base}/rosepine-gnome/state.json`;
}

export async function loadSnapshot(overrideDir?: string): Promise<Snapshot | null> {
  try {
    const text = await readFile(statePath(overrideDir), "utf8");
    return JSON.parse(text) as Snapshot;
  } catch {
    return null;
  }
}

function ghosttyConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
  return `${xdg}/ghostty/config`;
}

function gtk4CssPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
  return `${xdg}/gtk-4.0/gtk.css`;
}

function libreofficeConfigPath(): string {
  return `${process.env.HOME}/.config/libreoffice/4/user/registrymodifications.xcu`;
}

function vscodeSettingsPath(): string {
  return `${process.env.HOME}/.config/Code/User/settings.json`;
}

async function readOptional(path: string): Promise<{ existed: boolean; text: string | null }> {
  try {
    return { existed: true, text: await readFile(path, "utf8") };
  } catch {
    return { existed: false, text: null };
  }
}

/**
 * Erfasst den Originalzustand — aber nur, wenn noch kein Snapshot existiert.
 * Fehlen in einem alten Snapshot neuere Felder (Migration), werden sie aus dem
 * aktuellen System nacherfasst. Gibt zurück, ob neu geschrieben wurde.
 */
export async function ensureSnapshot(
  gs: GSettingsRunner,
  overrideDir?: string,
): Promise<{ created: boolean; snapshot: Snapshot }> {
  const existing = await loadSnapshot(overrideDir);
  if (existing) {
    // Migration alter Snapshots (ohne neuere Felder)
    const raw = existing as unknown as Record<string, unknown>;
    const needsGtk4 = !("gtk4CssText" in raw);
    const needsLO = !("libreofficeConfigText" in raw);
    const needsVscode = !("vscodeSettingsText" in raw);
    const needsWallpaper = !("wallpaperPictureUri" in raw);
    if (needsGtk4 || needsLO || needsVscode || needsWallpaper) {
      const g = needsGtk4 ? await readOptional(gtk4CssPath()) : null;
      const lo = needsLO ? await readOptional(libreofficeConfigPath()) : null;
      const vs = needsVscode ? await readOptional(vscodeSettingsPath()) : null;
      const migrated: Snapshot = {
        ...existing,
        ...(needsGtk4 ? { gtk4CssExisted: g!.existed, gtk4CssText: g!.text } : {}),
        ...(needsLO
          ? { libreofficeConfigExisted: lo!.existed, libreofficeConfigText: lo!.text }
          : {}),
        ...(needsVscode
          ? { vscodeSettingsExisted: vs!.existed, vscodeSettingsText: vs!.text }
          : {}),
        ...(needsWallpaper
          ? {
              wallpaperPictureUri: await gs.get("org.gnome.desktop.background", "picture-uri"),
              wallpaperPictureUriDark: await gs.get("org.gnome.desktop.background", "picture-uri-dark"),
            }
          : {}),
      };
      const p = statePath(overrideDir);
      await mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
      await writeFile(p, JSON.stringify(migrated, null, 2) + "\n");
      console.log("   ✓ Snapshot erweitert (Migration)");
      return { created: false, snapshot: migrated };
    }
    return { created: false, snapshot: existing };
  }

  const ghostty = await readOptional(ghosttyConfigPath());
  const gtk4 = await readOptional(gtk4CssPath());
  const lo = await readOptional(libreofficeConfigPath());
  const vs = await readOptional(vscodeSettingsPath());

  const snap: Snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    ghosttyConfigExisted: ghostty.existed,
    ghosttyConfigText: ghostty.text,
    gtkTheme: await gs.get("org.gnome.desktop.interface", "gtk-theme"),
    colorScheme: await gs.get("org.gnome.desktop.interface", "color-scheme"),
    gtk4CssExisted: gtk4.existed,
    gtk4CssText: gtk4.text,
    libreofficeConfigExisted: lo.existed,
    libreofficeConfigText: lo.text,
    vscodeSettingsExisted: vs.existed,
    vscodeSettingsText: vs.text,
    wallpaperPictureUri: await gs.get("org.gnome.desktop.background", "picture-uri"),
    wallpaperPictureUriDark: await gs.get("org.gnome.desktop.background", "picture-uri-dark"),
  };
  const p = statePath(overrideDir);
  await mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  await writeFile(p, JSON.stringify(snap, null, 2) + "\n");
  return { created: true, snapshot: snap };
}
