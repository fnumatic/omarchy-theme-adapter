// render/gtk4.ts — libadwaita-Recolor aus colors.toml (Option B).
// libadwaita lädt ~/.config/gtk-4.0/gtk.css automatisch als Overlay; die dort
// definierten öffentlichen Farbnamen (window_bg_color, accent_bg_color, …)
// färben libadwaita-Apps inkl. Ghostty-Fensterrahmen. Mapping: docs/architektur.md §3.3.
import type { Colors } from "../colors.ts";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export const MARKER = "Generiert aus Omarchy colors.toml (Option B)";

const v = (c: Colors, k: string, fb = "#000000"): string => c[k] ?? fb;

/** Erzeugt ein libadwaita-Overlay (`gtk-4.0/gtk.css`) aus der colors.toml. */
export function renderGtk4(c: Colors): string {
  const bg = v(c, "background");
  const surface = v(c, "dark_background", bg);
  const raised = v(c, "lighter_background", bg);
  const fg = v(c, "foreground");
  const fgDisabled = v(c, "dark_foreground", fg);
  const muted = v(c, "muted", fg);
  const selection = v(c, "selection");
  const accent = v(c, "accent");
  const red = v(c, "red");
  const green = v(c, "green");
  const yellow = v(c, "yellow");

  return `/* ${MARKER} */
/* Mapping: docs/architektur.md §3.3 */
@define-color accent_bg_color ${accent};
@define-color accent_fg_color ${bg};
@define-color accent_color ${accent};
@define-color destructive_bg_color ${red};
@define-color destructive_fg_color ${bg};
@define-color destructive_color ${red};
@define-color success_bg_color ${green};
@define-color success_fg_color ${bg};
@define-color success_color ${green};
@define-color warning_bg_color ${yellow};
@define-color warning_fg_color ${fg};
@define-color warning_color ${yellow};
@define-color error_bg_color ${red};
@define-color error_fg_color ${bg};
@define-color error_color ${red};
@define-color window_bg_color ${bg};
@define-color window_fg_color ${fg};
@define-color view_bg_color ${bg};
@define-color view_fg_color ${fg};
@define-color headerbar_bg_color ${surface};
@define-color headerbar_fg_color ${fg};
@define-color headerbar_border_color ${muted};
@define-color headerbar_backdrop_color ${surface};
@define-color headerbar_shade_color ${muted};
@define-color card_bg_color ${raised};
@define-color card_fg_color ${fg};
@define-color dialog_bg_color ${bg};
@define-color dialog_fg_color ${fg};
@define-color popover_bg_color ${bg};
@define-color popover_fg_color ${fg};
@define-color sidebar_bg_color ${surface};
@define-color sidebar_fg_color ${fg};
@define-color shade_color ${muted};
@define-color scrollbar_outline_color ${muted};
@define-color borders ${muted};
@define-color insensitive_fg_color ${fgDisabled};
@define-color theme_selected_bg_color ${selection};
@define-color theme_selected_fg_color ${fg};

/* Kompakte Headerbars (Wunsch: flachere Menüleisten).
   Hinweis: GTK-CSS unterstützt weder 'important' noch Fantasie-Typselektoren.
   Valide, spezifische Selektoren, die libadwaita/GTK tatsächlich verarbeitet. */
window headerbar,
window .header-bar,
window .titlebar {
  min-height: 24px;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}
window headerbar button,
window headerbar entry,
window headerbar menubutton,
window headerbar .titlebutton {
  min-height: 20px;
  min-width: 20px;
  margin: 1px 2px;
  padding: 0;
}
window .tab-bar,
window .tabbar,
window .tab-box tab {
  min-height: 20px;
  padding-top: 0;
  padding-bottom: 0;
}
windowcontrols button {
  min-height: 18px;
  min-width: 18px;
  margin: 0;
  padding: 0;
}
`;
}

export interface InstallGtk4Options {
  dry: boolean;
  /** gtk-4.0-Verzeichnis (Default: $XDG_CONFIG_HOME|~/.config/gtk-4.0) */
  gtk4Dir?: string;
}

function gtk4DirDefault(): string {
  const xdg = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
  return `${xdg}/gtk-4.0`;
}

/**
 * Installiert das Overlay nach `<gtk4Dir>/gtk.css`. Existiert bereits eine
 * gtk.css, wird sie nur erweitert, wenn sie unseren Marker trägt; sonst wird
 * abgebrochen statt fremde Inhalte zu überschreiben.
 */
export async function installGtk4(
  css: string,
  opts: InstallGtk4Options = { dry: false },
): Promise<{ cssFile: string; appended: boolean }> {
  const dir = opts.gtk4Dir ?? gtk4DirDefault();
  const cssFile = `${dir}/gtk.css`;

  if (opts.dry) {
    console.log(`  dry-run: schreibe/erweitere ${cssFile}`);
    return { cssFile, appended: false };
  }

  await mkdir(dir, { recursive: true });
  let existing = "";
  try {
    existing = await readFile(cssFile, "utf8");
  } catch {
    existing = "";
  }

  if (existing && !existing.includes(MARKER)) {
    throw new Error(
      `${cssFile} existiert und stammt nicht von themeswitch — Abbruch statt Überschreiben. ` +
        `Bitte manuell sichern/zusammenführen.`,
    );
  }

  if (existing.includes(MARKER)) {
    // Unseren alten Block ersetzen (Block = ab Marker bis Dateiende unklar,
    // daher: alles vor der ersten Marker-Zeile behalten, Rest neu).
    const head = existing.slice(0, existing.indexOf("/* " + MARKER)).replace(/\s+$/u, "");
    await writeFile(cssFile, (head ? head + "\n\n" : "") + css);
    console.log(`   ✓ libadwaita-Overlay aktualisiert: ${cssFile}`);
    return { cssFile, appended: false };
  }

  await writeFile(cssFile, (existing ? existing.replace(/\s+$/u, "") + "\n\n" : "") + css);
  console.log(`   ✓ libadwaita-Overlay geschrieben: ${cssFile}`);
  return { cssFile, appended: existing !== "" };
}
