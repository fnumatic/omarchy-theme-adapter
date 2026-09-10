// render/gtk3.ts — render + install GTK3 theme from colors.toml (Option B).
// Mapping see docs/architecture.md §3.2.
import type { Palette } from "../palette.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { realGSettings, type GSettingsRunner } from "../gsettings.ts";
import { assertValidCss } from "../cssutil.ts";
import { userThemesDir } from "../paths.ts";

/** Default/reference name of the GTK theme (directory under ~/.themes) — corresponds to `pascal("rose-pine")`. */
export const GTK3_THEME_NAME = "RosePine";

/** Generates a `gtk-3.0/gtk.css` from the resolved role palette. */
export function renderGtk3(p: Palette): string {
  const bg = p.base;
  const base = p.surface;
  const raised = p.overlay;
  const fg = p.text;
  const fgDisabled = p.muted;
  const muted = p.highlight_high;
  const selection = p.highlight_med;

  return `/* Generated from Omarchy colors.toml (Option B) */
/* Base: built-in GTK3 Adwaita (always available) as the full structure;
   this block layers the Rose Pine recolor + compaction on top. */
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

/* Concrete blocks for the most common widgets (light Dawn look) */
.window-frame, .window-frame:backdrop { box-shadow: none; border-width: 0; }
/* Opaque toplevel background — without it GTK3 windows (e.g. alacarte,
   menulibre) render transparently. */
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

/* Compact headerbars/menubars (goal: flatter bars).
   No !important — GTK CSS does not support it. */
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

/* Tooltips: Adwaita uses a dark tooltip with white text. The global
   label recolor above has the same selector specificity and comes after it,
   so it overrides tooltip * → dark text on a dark background. Here we set it
   explicitly to the theme surface/foreground (rules come last → they win). */
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

/** Stylesheet line `Themes=...`/index.theme (minimal metatheme content). */
export function renderIndexTheme(name: string = GTK3_THEME_NAME): string {
  return `[Desktop Entry]
Name=${name}
Comment=Rose Pine Dawn (from Omarchy colors.toml, Option B)
Encoding=UTF-8
Type=X-GNOME-Metatheme
GtkTheme=${name}
`;
}

export interface InstallGtk3Options {
  dry: boolean;
  /** Parent directory for themes (default: ~/.themes) */
  themesDir?: string;
  /** GTK theme name (default: GTK3_THEME_NAME) — for other Omarchy themes */
  name?: string;
  gs?: GSettingsRunner;
}

/** Sets gtk-theme. Returns exitCode (or -1 on dry). */
async function setGtkTheme(gs: GSettingsRunner, name: string, dry: boolean): Promise<number> {
  if (dry) {
    console.log(`  dry-run: gsettings set org.gnome.desktop.interface gtk-theme '${name}'`);
    return -1;
  }
  return gs.set("org.gnome.desktop.interface", "gtk-theme", name);
}

/**
 * Installs the GTK3 theme to `<themesDir>/<GTK3_THEME_NAME>/` and sets the
 * gtk-theme via gsettings. With dry=true nothing is written.
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
    console.log(`  dry-run: write ${cssFile}`);
    console.log(`  dry-run: write ${indexFile}`);
    await setGtkTheme(gs, name, true);
    return { cssFile, indexFile };
  }

  assertValidCss(css, `GTK3 theme ${name}`);
  await mkdir(`${themesDir}/${name}/gtk-3.0`, { recursive: true });
  await writeFile(cssFile, css);
  await writeFile(indexFile, renderIndexTheme(name));
  console.log(`   ✓ GTK3 theme written: ${cssFile}`);

  const code = await setGtkTheme(gs, name, false);
  if (code !== 0) console.warn(`   [!] gsettings gtk-theme failed (${code})`);
  else console.log(`   ✓ gtk-theme set: ${name}`);
  return { cssFile, indexFile };
}