// state.ts — snapshot of the original settings before the first intervention.
import { readFile, writeFile } from "node:fs/promises";
import type { GSettingsRunner } from "./gsettings.ts";
import { ensureParent } from "./fsutil.ts";
import {
  ghosttyConfigPath,
  gtk4CssPath,
  libreofficeConfigPath,
  paperwmUserCssPath,
  stateFilePath,
  userThemeSchemaDir,
  vscodeSettingsPath,
} from "./paths.ts";

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
  /** Original of the active GNOME Shell theme (user themes). */
  userThemeName: string | null;
  paperwmUserCssExisted: boolean | null;
  paperwmUserCssText: string | null;
  /** Last applied theme + generated artifacts (for reset cleanup). */
  appliedTheme: AppliedTheme | null;
}

export interface AppliedTheme {
  id: string;
  ghosttyThemeFile: string;
  gtkThemeName: string;
  shellThemeName: string | null;
}

export function statePath(overrideDir?: string): string {
  return stateFilePath(overrideDir);
}

/** Writes the last applied theme into the snapshot (for reset cleanup). */
export async function setAppliedTheme(
  applied: AppliedTheme,
  overrideDir?: string,
): Promise<void> {
  const snap = await loadSnapshot(overrideDir);
  if (!snap) return;
  const p = statePath(overrideDir);
  const updated: Snapshot = { ...snap, appliedTheme: applied };
  await ensureParent(p);
  await writeFile(p, JSON.stringify(updated, null, 2) + "\n");
}

export async function loadSnapshot(overrideDir?: string): Promise<Snapshot | null> {
  try {
    const text = await readFile(statePath(overrideDir), "utf8");
    return JSON.parse(text) as Snapshot;
  } catch {
    return null;
  }
}

/** Read the active GNOME Shell theme (user themes) — schema dir is extension-specific. */
async function readUserThemeName(): Promise<string | null> {
  const out = await Bun.spawnSync(["gsettings", "get", "org.gnome.shell.extensions.user-theme", "name"], {
    env: { ...process.env, GSETTINGS_SCHEMA_DIR: userThemeSchemaDir() },
  });
  if (out.exitCode !== 0) return null;
  return new TextDecoder().decode(out.stdout).trim().replace(/^'|'$/gu, "") || null;
}

async function readOptional(path: string): Promise<{ existed: boolean; text: string | null }> {
  try {
    return { existed: true, text: await readFile(path, "utf8") };
  } catch {
    return { existed: false, text: null };
  }
}

/**
 * Captures the original state — but only if no snapshot exists yet.
 * If newer fields are missing from an old snapshot (migration), they are
 * captured afterward from the current system. Returns whether it was rewritten.
 */
export async function ensureSnapshot(
  gs: GSettingsRunner,
  overrideDir?: string,
): Promise<{ created: boolean; snapshot: Snapshot }> {
  const existing = await loadSnapshot(overrideDir);
  if (existing) {
    // Migration of old snapshots (without newer fields)
    const raw = existing as unknown as Record<string, unknown>;
    const needsGtk4 = !("gtk4CssText" in raw);
    const needsLO = !("libreofficeConfigText" in raw);
    const needsVscode = !("vscodeSettingsText" in raw);
    const needsWallpaper = !("wallpaperPictureUri" in raw);
    const needsPaperwm = !("paperwmUserCssText" in raw);
    const needsUserTheme = !("userThemeName" in raw);
    if (needsGtk4 || needsLO || needsVscode || needsWallpaper || needsPaperwm || needsUserTheme) {
      const g = needsGtk4 ? await readOptional(gtk4CssPath()) : null;
      const lo = needsLO ? await readOptional(libreofficeConfigPath()) : null;
      const vs = needsVscode ? await readOptional(vscodeSettingsPath()) : null;
      const pw = needsPaperwm ? await readOptional(paperwmUserCssPath()) : null;
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
        ...(needsPaperwm
          ? { paperwmUserCssExisted: pw!.existed, paperwmUserCssText: pw!.text }
          : {}),
        ...(needsUserTheme ? { userThemeName: await readUserThemeName() } : {}),
        appliedTheme: existing.appliedTheme ?? null,
      };
      const p = statePath(overrideDir);
      await ensureParent(p);
      await writeFile(p, JSON.stringify(migrated, null, 2) + "\n");
      console.log("   ✓ Snapshot extended (migration)");
      return { created: false, snapshot: migrated };
    }
    return { created: false, snapshot: existing };
  }

  const ghostty = await readOptional(ghosttyConfigPath());
  const gtk4 = await readOptional(gtk4CssPath());
  const lo = await readOptional(libreofficeConfigPath());
  const vs = await readOptional(vscodeSettingsPath());
  const pw = await readOptional(paperwmUserCssPath());

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
    userThemeName: await readUserThemeName(),
    paperwmUserCssExisted: pw.existed,
    paperwmUserCssText: pw.text,
    appliedTheme: null,
  };
  const p = statePath(overrideDir);
  await ensureParent(p);
  await writeFile(p, JSON.stringify(snap, null, 2) + "\n");
  return { created: true, snapshot: snap };
}
