// render/shellTheme.ts — GNOME Shell theme from colors.toml (Option B).
//
// The User Themes extension replaces the complete shell stylesheet
// (Main.setThemeStylesheet). A custom shell theme must therefore build on a
// complete base, otherwise the shell loses its default rules.
// We use the system Yaru shell theme as the base (read on the fly) and
// append a Rose-Pine override block that recolors the visible surfaces
// (panel, clock, icons, overview, dash, popover/QuickSettings, OSD).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { Palette } from "../palette.ts";
import { realGSettingsWithSchemaDir, type GSettingsRunner } from "../gsettings.ts";
import { assertValidCss } from "../cssutil.ts";
import { userThemeSchemaDir, userThemesDir } from "../paths.ts";

/** Base of the system shell theme (Ubuntu Yaru). */
export function systemShellBasePath(): string {
  return "/usr/share/gnome-shell/theme/Yaru/gnome-shell.css";
}

export const USER_THEME_UUID = "user-theme@gnome-shell-extensions.gcampax.github.com";
export const USER_THEME_SCHEMA = "org.gnome.shell.extensions.user-theme";

/** Shell theme name (e.g. "RosePine" → "RosePineShell"). */
export function shellThemeName(gtkThemeName: string): string {
  return `${gtkThemeName}Shell`;
}

/**
 * Rose-Pine override block for the visible shell surfaces.
 * Selectors are Yaru-compatible and deliberately highly specific (flat CSS).
 * Colors come exclusively from the declarative role palette.
 */
export function renderShellOverride(p: Palette): string {
  const bg = p.base;
  const surface = p.surface;
  const raised = p.overlay;
  const fg = p.text;
  const fgMuted = p.muted;
  const accent = p.accent;
  const selection = p.highlight_med;
  const muted = p.highlight_high;

  return `/* themeswitch: GNOME Shell override (from Omarchy colors.toml) */
/* Flat Hugo: Yaru base remains, partly set to theme colors. */

/* Panel is transparent with PaperWM; here only ensure font/colors. */
#panel {
  background-color: transparent;
  color: ${fg};
}
#panel .panel-button,
#panel .panel-button .clock,
#panel .panel-button .system-status-icon,
#panel .panel-button.clock-display .clock,
#panel StIcon {
  color: ${fg};
  -st-icon-style: symbolic;
}
#panel .panel-button:hover,
#panel .panel-button:focus,
#panel .panel-button:active,
#panel .panel-button:checked {
  background-color: transparent;
  color: ${fg};
  box-shadow: none;
}
#panel .panel-button:hover .clock,
#panel .panel-button:focus .clock {
  color: ${fg};
}
.clock-display-box .clock {
  color: ${fg};
}

/* Activities/workspace indicator.
   The active workspace 'pill' and the inactive dots are all
   '.workspace-dot' (active: full scale/opacity, inactive: semi-transparent).
   Yaru forces white dots at the end of the stylesheet via '!important' (#f2f2f2) —
   invisible on a light top bar. '!important' is allowed in shell CSS (unlike
   GTK) and necessary to beat Yaru's end override. */
.workspaces-indicator,
.workspace-dot,
.activity-button {
  color: ${fg};
}
.workspace-dot,
#panel .panel-button#panelActivities .workspace-dot,
#panel:overview .panel-button#panelActivities .workspace-dot {
  background-color: ${accent} !important;
}

/* Overview & dash */
#overview,
.overview-controls,
.workspace-thumbnail,
.window-caption,
#dash,
.dash-background,
.app-folder,
.show-apps .overview-icon {
  color: ${fg};
}
#dash,
.dash-background {
  background-color: ${surface};
  border-radius: 24px;
  padding: 4px;
}
.dash-item-container .overview-icon:hover,
.dash-item-container .show-apps:hover {
  background-color: ${raised};
}

/* Popover / menus / QuickSettings / OSD */
.popup-menu,
.popup-menu-content,
.popup-menu .popup-menu-item,
.quick-settings,
.quick-settings-system-item,
.quick-toggle,
.message-list,
.osd-window,
.calendar,
.world-clocks-button {
  color: ${fg};
  background-color: ${surface};
}
.popup-menu .popup-menu-item:hover,
.quick-toggle:hover,
.application-menu-box .app-menu {
  background-color: ${raised};
}
.popup-menu .popup-menu-item:active,
.popup-menu .popup-menu-item.selected {
  background-color: ${selection};
  color: ${fg};
}
.message-bin,
.message-notification {
  background-color: ${surface};
  color: ${fg};
}
.popup-menu .popup-menu-item .popup-menu-icon,
.status-label,
.message-title,
.message-content {
  color: ${fg};
}
.popup-menu .popup-menu-item .popup-menu-label.secondary-label,
.message-body,
.message-secondary {
  color: ${fgMuted};
}

/* Quick Settings following the WhiteSur pattern: inactive is the base rule
   (with '!important', otherwise Yaru wins); ':checked' sits above it.
   No ':not()' — St-Theme CSS does not support it reliably.
   Active = Omarchy accent with light text; inactive = theme surface. */
.quick-toggle,
.quick-toggle-has-menu .quick-toggle {
  background-color: ${raised} !important;
  color: ${fg};
  box-shadow: none;
}
.quick-toggle StIcon,
.quick-toggle StLabel,
.quick-toggle-has-menu .quick-toggle StIcon,
.quick-toggle-has-menu .quick-toggle StLabel {
  color: ${fg};
}
.quick-toggle:checked,
.quick-toggle:checked:hover,
.quick-toggle:checked:focus,
.quick-toggle:checked:active,
.quick-toggle-has-menu .quick-toggle:checked {
  background-color: ${accent} !important;
  color: ${bg};
  box-shadow: none;
}
.quick-toggle:checked StIcon,
.quick-toggle:checked StLabel,
.quick-toggle-has-menu .quick-toggle:checked StIcon,
.quick-toggle-has-menu .quick-toggle:checked StLabel {
  color: ${bg} !important;
}
.quick-toggle-has-menu .quick-toggle-menu-button {
  background-color: ${raised} !important;
  color: ${fgMuted};
}
.quick-toggle-has-menu .quick-toggle-menu-button:checked,
.quick-toggle-has-menu .quick-toggle-menu-button:checked:hover,
.quick-toggle-has-menu .quick-toggle-menu-button:checked:focus,
.quick-toggle-has-menu .quick-toggle-menu-button:checked:active {
  background-color: ${accent} !important;
  color: ${bg};
}
.quick-toggle-has-menu .quick-toggle-menu-button:checked StIcon,
.quick-toggle-has-menu .quick-toggle-menu-button:checked StLabel {
  color: ${bg} !important;
}
.quick-toggle-has-menu .quick-toggle-separator {
  background-color: ${muted} !important;
}
.quick-toggle-has-menu:checked .quick-toggle-separator {
  background-color: ${bg} !important;
}
/* Volume slider: Yaru colors the active fill via '-st-accent-color'
   (system-wide orange). Custom bar level colors set the theme accent. */
.slider {
  color: ${fg};
  -barlevel-background-color: ${muted};
  -barlevel-active-background-color: ${accent};
}
.quick-slider .slider-bin:focus {
  box-shadow: none;
  background-color: ${raised};
}
/* Framework Fan Control has no tile CSS of its own and falls back to
   a light symbolic icon on errors. Theme foreground enforces contrast. */
.fw-fctrl-popup-menu,
.fw-fctrl-popup-menu StIcon,
.fw-fctrl-popup-menu StLabel {
  color: ${fg};
}

/* Sharp corners for expanded panels (popups, QuickSettings, OSD, …).
   Yaru rounds these containers (20px/999px); consistent with the sharp window
   design, the corner rounding is removed. */
.popup-menu-content,
.candidate-popup-content,
.quick-settings,
.osd-window,
.calendar,
.message-list,
.world-clocks-button,
.background-menu {
  border-radius: 0;
}
`;
}

/** Reads the system Yaru shell CSS as the base (for on-the-fly). */
export async function readSystemShellBase(path = systemShellBasePath()): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    throw new Error(`Could not read system shell base: ${path} (${String(e)})`);
  }
}

/** Completes a base with the returned CSS override. */
export function renderShellTheme(baseCss: string, override: string): string {
  const head = baseCss.replace(/\s+$/u, "");
  return head + "\n\n" + override.trimEnd() + "\n";
}

export interface InstallShellThemeOptions {
  dry: boolean;
  /** ~/.themes directory (default: $HOME/.themes) */
  themesDir?: string;
  /** Base shell CSS (default: system Yaru) — overridable for tests */
  baseCss?: string;
  gs?: GSettingsRunner;
  /** Skip extension reload (for tests) */
  skipReload?: boolean;
}

/** Installs a shell theme and activates it via User Themes. */
export async function installShellTheme(
  name: string,
  css: string,
  opts: InstallShellThemeOptions = { dry: false },
): Promise<{ cssFile: string; themeDir: string }> {
  const themesDir = opts.themesDir ?? userThemesDir();
  const themeDir = `${themesDir}/${name}`;
  const cssFile = `${themeDir}/gnome-shell/gnome-shell.css`;
  const gs = opts.gs ?? realGSettingsWithSchemaDir(userThemeSchemaDir());

  if (opts.dry) {
    console.log(`  dry-run: write ${cssFile}`);
    console.log(`  dry-run: ${USER_THEME_SCHEMA} name → '${name}'`);
    return { cssFile, themeDir };
  }

  await mkdir(`${themeDir}/gnome-shell`, { recursive: true });
  assertValidCss(css, `GNOME-Shell-Theme ${name}`);
  await writeFile(cssFile, css);
  console.log(`   ✓ GNOME Shell theme written: ${cssFile}`);

  const code = await gs.set(USER_THEME_SCHEMA, "name", name);
  if (code !== 0) throw new Error(`Setting User Themes name failed (${code})`);
  console.log(`   ✓ User Themes active: ${name}`);

  if (!opts.skipReload) {
    Bun.spawnSync(["gnome-extensions", "disable", USER_THEME_UUID]);
    Bun.spawnSync(["gnome-extensions", "enable", USER_THEME_UUID]);
    console.log("   → User Themes reloaded");
  }

  return { cssFile, themeDir };
}
