// themes.ts — generischer Omarchy-Theme-Resolver (Option B).
//
// Omarchy hält pro Theme ein Verzeichnis `themes/<id>/` mit:
//   colors.toml      (Pflicht, Farbrollen + mode)
//   vscode.json      (optional: { name, extension })
//   icons.theme      (optional: Icon-Theme-Name, Default Yaru-blue)
//   backgrounds/     (optional: Wallpapers)
// Genau wie bei Omarchy werden daraus alle abgeleiteten Artefakte **on the fly**
// gerendert (Ghostty .conf, GTK3 css, GTK4-Overlay, PaperWM-Block). Es wird
// kein vorgerendertes Asset mitgeführt.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Colors } from "./colors.ts";
import { mergeThemeColors, resolvePalette, missingCoreColors, type Palette } from "./palette.ts";
import type { VscodeDescriptor } from "./render/vscode.ts";

/** Root-Verzeichnis der Theme-Quellen (…/themes). */
export function themesRoot(): string {
  return join(fileURLToPath(new URL(".", import.meta.url)), "..", "themes");
}

export interface Theme {
  /** Normalisierte ID = Verzeichnisname (z. B. "rose-pine"). */
  id: string;
  /** Absoluter Pfad zum Theme-Verzeichnis. */
  dir: string;
  /** Anzeigename, Titel-cased (z. B. "Rose Pine"). */
  displayName: string;
  /** "light" | "dark" laut colors.toml. */
  mode: string;
  /** Gemergte Roh-Farben (colors.toml gewinnt, extended.toml füllt Lücken). */
  colors: Colors;
  /** Deklarativ aufgelöste Rollen-Palette (Renderer arbeiten nur hiermit). */
  palette: Palette;
  /** GTK3-Theme-Name (keine Leerzeichen, z. B. "RosePine"). */
  gtkThemeName: string;
  /** Ghostty-Theme-Dateiname/-ID (z. B. "rose-pine.conf"). */
  ghosttyThemeName: string;
  /** Optionales VS-Code-Metadatum. */
  vscode: VscodeDescriptor | null;
  /** Icon-Theme-Name aus icons.theme (Default "Yaru-blue"). */
  iconsTheme: string;
  hasBackgrounds: boolean;
}

export function titleWords(s: string): string {
  return s
    .split(/[-_ ]+/u)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function pascal(s: string): string {
  return titleWords(s).replace(/[^A-Za-z0-9]/gu, "");
}

export function isValidThemeId(id: string): boolean {
  // Wie Omarchy: nur harmlose Verzeichnisnamen.
  return /^[a-z0-9][a-z0-9._+-]*$/u.test(id) && !id.includes("..");
}

/** Listet verfügbare Themes (Verzeichnis mit colors.toml unter themesRoot). */
export async function listThemes(root?: string): Promise<string[]> {
  const dir = root ?? themesRoot();
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const ids: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const hasColors = await readFile(join(dir, e.name, "colors.toml"), "utf8")
      .then(() => true)
      .catch(() => false);
    if (hasColors) ids.push(e.name);
  }
  return ids.sort((a, b) => a.localeCompare(b, "en"));
}

async function readOptional<T>(path: string, parse: (text: string) => T): Promise<T | null> {
  try {
    return parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

export interface LoadThemeOptions {
  root?: string;
}

/** Lädt ein Theme vollständig aus `themes/<id>/`. Wirft bei fehlender Palette. */
export async function loadTheme(id: string, opts: LoadThemeOptions = {}): Promise<Theme> {
  if (!isValidThemeId(id)) throw new Error(`Ungültiger Theme-Name: '${id}'`);
  const dir = join(opts.root ?? themesRoot(), id);

  const colorsText = await readFile(join(dir, "colors.toml"), "utf8").catch(() => null);
  if (colorsText === null) {
    throw new Error(
      `Theme '${id}' hat kein themes/${id}/colors.toml. Verfügbar: ${(await listThemes(opts.root)).join(", ")}`,
    );
  }
  // extended.toml ist optional und füllt nur Lücken (volle Rose-Pine-Rollen).
  const extendedText = await readFile(join(dir, "extended.toml"), "utf8").catch(() => null);
  const colors = mergeThemeColors(colorsText, extendedText);
  if (Object.keys(colors).length === 0) {
    throw new Error(`colors.toml von '${id}' konnte nicht geparst werden: ${join(dir, "colors.toml")}`);
  }
  const missing = missingCoreColors(colors);
  if (missing.length > 0) {
    console.warn(`   [!] Theme '${id}' ohne ${missing.join("/")} — Fallback #000000`);
  }
  const palette = resolvePalette(colors);

  const vscode = await readOptional(join(dir, "vscode.json"), (t) =>
    JSON.parse(t) as VscodeDescriptor,
  );
  const iconsTheme = await readOptional(join(dir, "icons.theme"), (t) => t.trim());
  const hasBackgrounds = await readdir(join(dir, "backgrounds"))
    .then((f) => f.length > 0)
    .catch(() => false);

  return {
    id,
    dir,
    displayName: titleWords(id),
    mode: (colors.mode ?? "dark").toLowerCase(),
    colors,
    palette,
    gtkThemeName: pascal(id),
    ghosttyThemeName: `${id}.conf`,
    vscode,
    iconsTheme: iconsTheme ?? "Yaru-blue",
    hasBackgrounds,
  };
}