// render/wallpaper.ts — Rose-Pine-Wallpaper setzen (Option B).
//
// Omarchy-Logik (bin/omarchy-theme-set): sortierte backgrounds/-Liste, beim
// Theme-Wechsel das erste → Default = 1-funky-shapes.webp. GNOME-Umsetzung:
// picture-uri + picture-uri-dark per gsettings (file://-URI).
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { realGSettings, type GSettingsRunner } from "../gsettings.ts";

/** Omarchy-Default: erstes der sortierten backgrounds. */
export const DEFAULT_WALLPAPER = "1-funky-shapes.webp";

export function backgroundsDir(): string {
  // src/render → ../../themes/rose-pine/backgrounds
  return join(new URL(".", import.meta.url).pathname, "..", "..", "themes", "rose-pine", "backgrounds");
}

export async function listWallpapers(dir?: string): Promise<string[]> {
  const files = await readdir(dir ?? backgroundsDir());
  return files
    .filter((f) => /\.(webp|png|jpe?g)$/iu.test(f))
    .sort((a, b) => a.localeCompare(b, "en"));
}

export interface InstallWallpaperOptions {
  dry: boolean;
  /** Dateiname in backgrounds/ (Default: Omarchy-Default) */
  name?: string;
  backgrounds?: string;
  gs?: GSettingsRunner;
}

export async function installWallpaper(
  opts: InstallWallpaperOptions,
): Promise<{ file: string; uri: string }> {
  const dir = opts.backgrounds ?? backgroundsDir();
  const available = await listWallpapers(dir).catch(() => [] as string[]);
  const name = opts.name ?? DEFAULT_WALLPAPER;
  if (!available.includes(name)) {
    throw new Error(
      `Wallpaper '${name}' nicht in ${dir} gefunden. Verfügbar: ${available.join(", ") || "(keine)"}`,
    );
  }
  const gs = opts.gs ?? realGSettings;
  const file = join(dir, name);
  const uri = `file://${file}`;

  if (opts.dry) {
    console.log(`  dry-run: gsettings picture-uri + picture-uri-dark → ${uri}`);
    return { file, uri };
  }

  for (const key of ["picture-uri", "picture-uri-dark"] as const) {
    const code = await gs.set("org.gnome.desktop.background", key, `'${uri}'`);
    if (code !== 0) throw new Error(`gsettings ${key} fehlgeschlagen (${code})`);
  }
  console.log(`   ✓ Wallpaper gesetzt: ${name}`);
  return { file, uri };
}
