// render/gtk4.ts — libadwaita recolor from colors.toml (Option B).
// libadwaita loads ~/.config/gtk-4.0/gtk.css automatically as an overlay; the
// public color names defined there (window_bg_color, accent_bg_color, …)
// color libadwaita apps including the Ghostty window frame. Mapping: docs/architecture.md §3.3.
import type { Palette } from "../palette.ts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { assertValidCss } from "../cssutil.ts";
import { locateBlock } from "../managedBlock.ts";
import { gtk4Dir } from "../paths.ts";

export const MARKER = "Generated from Omarchy colors.toml (Option B)";

/** Generates a libadwaita overlay (`gtk-4.0/gtk.css`) from the role palette. */
export function renderGtk4(p: Palette): string {
  const bg = p.base;
  const surface = p.surface;
  const raised = p.overlay;
  const fg = p.text;
  const fgDisabled = p.muted;
  const muted = p.highlight_high;
  const selection = p.highlight_med;
  const accent = p.accent;
  const red = p.love;
  const green = p.pine;
  const yellow = p.gold;

  return `/* ${MARKER} */
/* Mapping: docs/architecture.md §3.3 */
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

/* Compact headerbars (goal: flatter menubars).
   Note: GTK CSS supports neither 'important' nor fantasy type selectors.
   Valid, specific selectors that libadwaita/GTK actually processes. */
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
/* Sharp window corners (goal: no/minimal rounding).
   Applies to GTK4/CSD windows (confirmed by test); the mutter clip above remains. */
window.csd,
window {
  border-radius: 0;
}

windowcontrols button {
  min-height: 18px;
  min-width: 18px;
  margin: 0;
  padding: 0;
}

/* Tooltips: libadwaita hardcodes background/text (dark/white) and knows
   no color names. Here we switch explicitly to the theme surface/foreground,
   consistent with GTK3. */
tooltip,
tooltip.background {
  background-color: ${surface};
  color: ${fg};
  border: 1px solid ${muted};
}
tooltip label {
  color: ${fg};
}
`;
}

export interface InstallGtk4Options {
  dry: boolean;
  /** gtk-4.0 directory (default: $XDG_CONFIG_HOME|~/.config/gtk-4.0) */
  gtk4Dir?: string;
}

/**
 * Installs the overlay to `<gtk4Dir>/gtk.css`. If a gtk.css already exists,
 * it is only extended when it carries our marker; otherwise the installation
 * is aborted rather than overwriting foreign content.
 */
export async function installGtk4(
  css: string,
  opts: InstallGtk4Options = { dry: false },
): Promise<{ cssFile: string; appended: boolean }> {
  const dir = opts.gtk4Dir ?? gtk4Dir();
  const cssFile = `${dir}/gtk.css`;

  if (opts.dry) {
    console.log(`  dry-run: write/extend ${cssFile}`);
    return { cssFile, appended: false };
  }

  assertValidCss(css, "libadwaita-Overlay");
  await mkdir(dir, { recursive: true });
  let existing = "";
  try {
    existing = await readFile(cssFile, "utf8");
  } catch {
    existing = "";
  }

  const loc = locateBlock(existing, MARKER);
  if (loc.kind === "absent" && existing) {
    throw new Error(
      `${cssFile} exists and does not originate from themeswitch — aborting instead of overwriting. ` +
        `Please back up/merge manually.`,
    );
  }
  if (loc.kind === "corrupt") {
    throw new Error(
      `${cssFile} contains the themeswitch marker without a comment opener — aborting instead of corrupting.`,
    );
  }

  if (loc.kind === "found") {
    // Replace our old block (keep everything before the marker, recreate the rest).
    const head = existing.slice(0, loc.start).replace(/\s+$/u, "");
    await writeFile(cssFile, (head ? head + "\n\n" : "") + css);
    console.log(`   ✓ libadwaita overlay updated: ${cssFile}`);
    return { cssFile, appended: false };
  }

  await writeFile(cssFile, (existing ? existing.replace(/\s+$/u, "") + "\n\n" : "") + css);
  console.log(`   ✓ libadwaita overlay written: ${cssFile}`);
  return { cssFile, appended: existing !== "" };
}
