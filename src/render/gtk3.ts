// render/gtk3.ts — GTK3-Theme aus colors.toml rendern + installieren (Option B).
// Mapping siehe docs/architektur.md §3.2.
import type { Colors } from "../colors.ts";
import { realGSettings, type GSettingsRunner } from "../gsettings.ts";

/** Name des GTK-Themes (Verzeichnis unter ~/.themes). */
export const GTK3_THEME_NAME = "RosePineDawn";

const v = (c: Colors, k: string, fb = "#000000"): string => c[k] ?? fb;

/** Erzeugt ein `gtk-3.0/gtk.css` aus der geparsten colors.toml. */
export function renderGtk3(c: Colors): string {
  const bg = v(c, "background");
  const base = v(c, "dark_background", bg); // @theme_base_color
  const raised = v(c, "lighter_background", bg);
  const fg = v(c, "foreground");
  const fgDisabled = v(c, "dark_foreground", fg);
  const muted = v(c, "muted", fg);
  const selection = v(c, "selection");

  return `/* Generiert aus Omarchy colors.toml (Option B) — Rose Pine Dawn */
/* Mapping: docs/architektur.md §3.2 */
@define-color theme_base_color ${base};
@define-color theme_bg_color ${bg};
@define-color theme_fg_color ${fg};
@define-color theme_text_color ${fg};
@define-color theme_selected_bg_color ${selection};
@define-color theme_selected_fg_color ${fg};
@define-color theme_unfocused_bg_color ${raised};
@define-color theme_unfocused_fg_color ${fgDisabled};
@define-color theme_unfocused_text_color ${muted};
@define-color theme_unfocused_selected_bg_color ${selection};
@define-color theme_unfocused_selected_fg_color ${fg};
@define-color borders ${muted};
@define-color content_view_bg ${base};
@define-color insensitive_fg_color ${fgDisabled};

/* Konkrete Blöcke für gängigste Widgets (heller Dawn-Look) */
.window-frame, .window-frame:backdrop { box-shadow: none; border-width: 0; }
button { color: ${fg}; }
entry { color: ${fg}; background-color: ${base}; }
treeview, list, row { background-color: ${bg}; color: ${fg}; }
label { color: ${fg}; }

/* Kompakte Headerbars/Menüleisten (Wunsch: flachere Leisten) */
headerbar, .header-bar {
  min-height: 32px;
  padding-top: 0;
  padding-bottom: 0;
}
headerbar button, headerbar entry,
.header-bar button, .header-bar entry {
  min-height: 28px;
  margin-top: 2px;
  margin-bottom: 2px;
}
menubar, menuitem { padding-top: 2px; padding-bottom: 2px; }
`;
}

/** Stylesheet-Zeile `Themes=...`/index.theme (Metathema-Minimalinhalt). */
export function renderIndexTheme(name: string = GTK3_THEME_NAME): string {
  return `[Desktop Entry]
Name=${name}
Comment=Rose Pine Dawn (aus Omarchy colors.toml, Option B)
Encoding=UTF-8
Type=X-GNOME-Metatheme
GtkTheme=${name}
`;
}

export interface InstallGtk3Options {
  dry: boolean;
  /** Oberverzeichnis für Themes (Default: ~/.themes) */
  themesDir?: string;
  gs?: GSettingsRunner;
}

/** Setzt gtk-theme. Gibt exitCode zurück (oder -1 bei dry). */
async function setGtkTheme(gs: GSettingsRunner, name: string, dry: boolean): Promise<number> {
  if (dry) {
    console.log(`  dry-run: gsettings set org.gnome.desktop.interface gtk-theme '${name}'`);
    return -1;
  }
  return gs.set("org.gnome.desktop.interface", "gtk-theme", name);
}

/**
 * Installiert das GTK3-Theme nach `<themesDir>/<GTK3_THEME_NAME>/` und setzt das
 * gtk-theme via gsettings. Bei dry=true wird nichts geschrieben.
 */
export async function installGtk3(
  css: string,
  opts: InstallGtk3Options = { dry: false },
): Promise<{ cssFile: string; indexFile: string }> {
  const themesDir = opts.themesDir ?? `${process.env.HOME}/.themes`;
  const cssFile = `${themesDir}/${GTK3_THEME_NAME}/gtk-3.0/gtk.css`;
  const indexFile = `${themesDir}/${GTK3_THEME_NAME}/index.theme`;

  const gs = opts.gs ?? realGSettings;
  if (opts.dry) {
    console.log(`  dry-run: schreibe ${cssFile}`);
    console.log(`  dry-run: schreibe ${indexFile}`);
    await setGtkTheme(gs, GTK3_THEME_NAME, true);
    return { cssFile, indexFile };
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(`${themesDir}/${GTK3_THEME_NAME}/gtk-3.0`, { recursive: true });
  await writeFile(cssFile, css);
  await writeFile(indexFile, renderIndexTheme());
  console.log(`   ✓ GTK3-Theme geschrieben: ${cssFile}`);

  const code = await setGtkTheme(gs, GTK3_THEME_NAME, false);
  if (code !== 0) console.warn(`   [!] gsettings gtk-theme fehlgeschlagen (${code})`);
  else console.log(`   ✓ gtk-theme gesetzt: ${GTK3_THEME_NAME}`);
  return { cssFile, indexFile };
}