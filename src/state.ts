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

/**
 * Erfasst den Originalzustand — aber nur, wenn noch kein Snapshot existiert.
 * Gibt zurück, ob ein neuer Snapshot geschrieben wurde.
 */
export async function ensureSnapshot(
  gs: GSettingsRunner,
  overrideDir?: string,
): Promise<{ created: boolean; snapshot: Snapshot }> {
  const existing = await loadSnapshot(overrideDir);
  if (existing) return { created: false, snapshot: existing };

  let ghosttyConfigText: string | null = null;
  let ghosttyConfigExisted = false;
  try {
    ghosttyConfigText = await readFile(ghosttyConfigPath(), "utf8");
    ghosttyConfigExisted = true;
  } catch {
    ghosttyConfigExisted = false;
  }

  const snap: Snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    ghosttyConfigExisted,
    ghosttyConfigText,
    gtkTheme: await gs.get("org.gnome.desktop.interface", "gtk-theme"),
    colorScheme: await gs.get("org.gnome.desktop.interface", "color-scheme"),
  };
  const p = statePath(overrideDir);
  await mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  await writeFile(p, JSON.stringify(snap, null, 2) + "\n");
  return { created: true, snapshot: snap };
}
