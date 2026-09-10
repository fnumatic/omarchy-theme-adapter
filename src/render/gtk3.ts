// render/gtk3.ts — GTK3-Theme aus colors.toml rendern + installieren (Option B).
// Mapping siehe docs/architektur.md §3.2.
import type { Palette } from "../palette.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { realGSettings, type GSettingsRunner } from "../gsettings.ts";
import { assertValidCss } from "../cssutil.ts";
import { userThemesDir } from "../paths.ts";

/** Default-/Referenzname des GTK-Themes (Verzeichnis unter ~/.themes) — entspricht `pascal("rose-pine")`. */
export const GTK3_THEME_NAME = "RosePine";

/** Erzeugt ein `gtk-3.0/gtk.css` aus der aufgelösten Rollen-Palette. */
export function renderGtk3(p: Palette): string {
  const bg = p.base;
  const base = p.surface;
  const raised = p.overlay;
  const fg = p.text;
  const fgDisabled = p.muted;
  const muted = p.highlight_high;
  const selection = p.highlight_med;

  return `/* Generiert aus Omarchy colors.toml (Option B) */
/* Basis: eingebautes GTK3-Adwaita (immer verfügbar) als volle Struktur;
   darüber legt dieser Block den Rose-Pine-Recolor + Kompaktierung. */
@import url("resource:///org/gtk/libgtk/theme/Adwaita/gtk-contained.css");
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
@define-color theme_tooltip_bg_color ${base};
@define-color theme_tooltip_fg_color ${fg};

/* Konkrete Blöcke für gängigste Widgets (heller Dawn-Look) */
.window-frame, .window-frame:backdrop { box-shadow: none; border-width: 0; }
/* Opaker Toplevel-Hintergrund — ohne ihn zeichnen GTK3-Fenster (z. B. alacarte,
   menulibre) transparent durchscheinend. */
window, window.background,
.background,
dialog, dialog.background {
  background-color: ${bg};
  color: ${fg};
}
button { color: ${fg}; }
entry { color: ${fg}; background-color: ${base}; }
treeview, list, row { background-color: ${bg}; color: ${fg}; }
label { color: ${fg}; }

/* Kompakte Headerbars/Menüleisten (Wunsch: flachere Leisten).
   Kein !important — GTK-CSS unterstützt das nicht. */
headerbar, .header-bar, .titlebar, menubar {
  min-height: 24px;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}
headerbar button, headerbar entry,
.header-bar button, .header-bar entry,
.titlebar button, .titlebar entry {
  min-height: 20px;
  margin-top: 1px;
  margin-bottom: 1px;
  padding-top: 0;
  padding-bottom: 0;
}
windowcontrols button {
  min-height: 18px;
  min-width: 18px;
  margin: 0;
  padding: 0;
}
menubar, menuitem { padding-top: 1px; padding-bottom: 1px; }

/* Tooltips: Adwaita nutzt einen dunklen Tooltip mit weißem Text. Das globale
   label-Recolor oben hat denselben Selektor-Spezifitätswert und steht danach,
   überschreibt also tooltip * → dunkler Text auf dunklem Grund. Hier explizit
   auf die Theme-Fläche/-Vordergrund setzen (Regeln stehen am Ende → gewinnen). */
tooltip,
tooltip.background {
  background-color: ${base};
  color: ${fg};
  border: 1px solid ${muted};
  text-shadow: none;
}
tooltip * {
  background-color: transparent;
  color: ${fg};
}
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
  /** GTK-Theme-Name (Default: GTK3_THEME_NAME) — für andere Omarchy-Themes */
  name?: string;
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
  const themesDir = opts.themesDir ?? userThemesDir();
  const name = opts.name ?? GTK3_THEME_NAME;
  const cssFile = `${themesDir}/${name}/gtk-3.0/gtk.css`;
  const indexFile = `${themesDir}/${name}/index.theme`;

  const gs = opts.gs ?? realGSettings;
  if (opts.dry) {
    console.log(`  dry-run: schreibe ${cssFile}`);
    console.log(`  dry-run: schreibe ${indexFile}`);
    await setGtkTheme(gs, name, true);
    return { cssFile, indexFile };
  }

  assertValidCss(css, `GTK3-Theme ${name}`);
  await mkdir(`${themesDir}/${name}/gtk-3.0`, { recursive: true });
  await writeFile(cssFile, css);
  await writeFile(indexFile, renderIndexTheme(name));
  console.log(`   ✓ GTK3-Theme geschrieben: ${cssFile}`);

  const code = await setGtkTheme(gs, name, false);
  if (code !== 0) console.warn(`   [!] gsettings gtk-theme fehlgeschlagen (${code})`);
  else console.log(`   ✓ gtk-theme gesetzt: ${name}`);
  return { cssFile, indexFile };
}