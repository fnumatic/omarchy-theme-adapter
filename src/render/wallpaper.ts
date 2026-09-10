// render/wallpaper.ts — set the Rose-Pine wallpaper (Option B).
//
// Omarchy logic (bin/omarchy-theme-set): sorted backgrounds/ list, on theme
// switch the first one → default = 1-funky-shapes.webp. GNOME implementation:
// picture-uri + picture-uri-dark via gsettings (file:// URI).
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realGSettings, type GSettingsRunner } from "../gsettings.ts";

/** Omarchy default rule: first of the sorted backgrounds (dynamic). */
export const DEFAULT_WALLPAPER = "";

export function backgroundsDir(): string {
  // src/render → ../../themes/rose-pine/backgrounds (default theme)
  return join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "themes", "rose-pine", "backgrounds");
}

export async function listWallpapers(dir?: string): Promise<string[]> {
  const files = await readdir(dir ?? backgroundsDir());
  return files
    .filter((f) => /\.(webp|png|jpe?g)$/iu.test(f))
    .sort((a, b) => a.localeCompare(b, "en"));
}

export interface InstallWallpaperOptions {
  dry: boolean;
  /** File name in backgrounds/ (default: prefer 2-dot-map.webp, otherwise the first sorted) */
  name?: string;
  backgrounds?: string;
  gs?: GSettingsRunner;
}

/** Preferred default (dot map) — if present in the theme. */
export const PREFERRED_DEFAULT = "2-dot-map.webp";

export async function installWallpaper(
  opts: InstallWallpaperOptions,
): Promise<{ file: string; uri: string }> {
  const dir = opts.backgrounds ?? backgroundsDir();
  const available = await listWallpapers(dir).catch(() => [] as string[]);
  const name =
    opts.name ??
    (available.includes(PREFERRED_DEFAULT) ? PREFERRED_DEFAULT : available[0] ?? DEFAULT_WALLPAPER);
  if (!available.includes(name)) {
    throw new Error(
      `Wallpaper '${name}' not found in ${dir}. Available: ${available.join(", ") || "(none)"}`,
    );
  }
  const gs = opts.gs ?? realGSettings;
  const file = join(dir, name);
  const uri = pathToFileURL(file).href;

  if (opts.dry) {
    console.log(`  dry-run: gsettings picture-uri + picture-uri-dark → ${uri}`);
    return { file, uri };
  }

  for (const key of ["picture-uri", "picture-uri-dark"] as const) {
    const code = await gs.set("org.gnome.desktop.background", key, `'${uri}'`);
    if (code !== 0) throw new Error(`gsettings ${key} failed (${code})`);
  }
  console.log(`   ✓ Wallpaper set: ${name}`);
  return { file, uri };
}
