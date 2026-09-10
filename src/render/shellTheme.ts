// render/shellTheme.ts — GNOME-Shell-Theme aus colors.toml (Option B).
//
// Die User-Themes-Extension ersetzt das vollständige Shell-Stylesheet
// (Main.setThemeStylesheet). Ein eigenes Shell-Theme muss deshalb auf einer
// vollständigen Basis aufbauen, sonst verliert die Shell ihre Standard-Regeln.
// Wir verwenden das System-Yaru-Shell-Theme als Basis (on-the-fly gelesen) und
// hängen einen Rose-Pine-Override-Block an, der die sichtbaren Oberflächen
// (Panel, Uhr, Icons, Übersicht, Dash, Popover/QuickSettings, OSD) rekoloziert.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { Palette } from "../palette.ts";
import { realGSettingsWithSchemaDir, type GSettingsRunner } from "../gsettings.ts";
import { assertValidCss } from "../cssutil.ts";
import { userThemeSchemaDir, userThemesDir } from "../paths.ts";

/** Basis des System-Shell-Themes (Ubuntu Yaru). */
export function systemShellBasePath(): string {
  return "/usr/share/gnome-shell/theme/Yaru/gnome-shell.css";
}

export const USER_THEME_UUID = "user-theme@gnome-shell-extensions.gcampax.github.com";
export const USER_THEME_SCHEMA = "org.gnome.shell.extensions.user-theme";

/** Shell-Theme-Name (z. B. "RosePine" → "RosePineShell"). */
export function shellThemeName(gtkThemeName: string): string {
  return `${gtkThemeName}Shell`;
}

/**
 * Rose-Pine-Override-Block für die sichtbaren Shell-Oberflächen.
 * Selektoren sind Yaru-kompatibel und bewusst hochspezifisch (flat CSS).
 * Farben kommen ausschließlich aus der deklarativen Rollen-Palette.
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

  return `/* themeswitch: GNOME-Shell-Override (aus Omarchy colors.toml) */
/* Flacher Hugo: Yaru-Basis bleibt, teils gesetzt auf Theme-Farben. */

/* Panel ist bei PaperWM transparent; hier nur Schrift/Farben sicherstellen. */
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

/* Aktivitäten-/Workspace-Anzeige.
   Die aktive Workspace-'Pill' und die inaktiven Punkte sind allesamt
   '.workspace-dot' (Aktiv: volle Skala/Deckkraft, inaktiv: halbtransparent).
   Yaru erzwingt am Stylesheet-Ende weiße Dots per '!important' (#f2f2f2) —
   auf hellem Topbar unsichtbar. '!important' ist im Shell-CSS zulässig (anders
   als bei GTK) und nötig, um Yarus End-Override zu schlagen. */
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

/* Übersicht & Dash */
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

/* Popover / Menüs / QuickSettings / OSD */
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

/* Quick Settings nach dem WhiteSur-Muster: Inaktiv ist die Basisregel
   (mit '!important', sonst schlägt Yaru durch); ':checked' liegt darüber.
   Kein ':not()' — das unterstützt St-Theme-CSS nicht zuverlässig.
   Aktiv = Omarchy-Akzent mit hellem Text; inaktiv = Theme-Surface. */
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
/* Lautstärkeregler: Yaru färbt die aktive Füllung über '-st-accent-color'
   (systemweit Orange). Eigene Barlevel-Farben setzen den Theme-Akzent. */
.slider {
  color: ${fg};
  -barlevel-background-color: ${muted};
  -barlevel-active-background-color: ${accent};
}
.quick-slider .slider-bin:focus {
  box-shadow: none;
  background-color: ${raised};
}
/* Framework Fan Control hat keine eigene Kachel-CSS und fällt bei Fehlern auf
   ein helles symbolisches Icon zurück. Theme-Foreground erzwingt Kontrast. */
.fw-fctrl-popup-menu,
.fw-fctrl-popup-menu StIcon,
.fw-fctrl-popup-menu StLabel {
  color: ${fg};
}

/* Scharfe Ecken für aufgeklappte Panels (Popups, QuickSettings, OSD, …).
   Yaru rundet diese Container (20px/999px); konsistent zur scharfen Fenster-
   Gestaltung wird die Eckenrundung aufgehoben. */
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

/** Liest das System-Yaru-Shell-CSS als Basis (für on-the-fly). */
export async function readSystemShellBase(path = systemShellBasePath()): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    throw new Error(`System-Shell-Basis konnte nicht gelesen werden: ${path} (${String(e)})`);
  }
}

/** Vervollständigt eine Basis um den Return-CSS-Override. */
export function renderShellTheme(baseCss: string, override: string): string {
  const head = baseCss.replace(/\s+$/u, "");
  return head + "\n\n" + override.trimEnd() + "\n";
}

export interface InstallShellThemeOptions {
  dry: boolean;
  /** ~/.themes-Verzeichnis (Default: $HOME/.themes) */
  themesDir?: string;
  /** Basis-Shell-CSS (Default: System-Yaru) — für Tests überschreibbar */
  baseCss?: string;
  gs?: GSettingsRunner;
  /** Extension-Reload überspringen (für Tests) */
  skipReload?: boolean;
}

/** Installiert ein Shell-Theme und aktiviert es über User Themes. */
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
    console.log(`  dry-run: schreibe ${cssFile}`);
    console.log(`  dry-run: ${USER_THEME_SCHEMA} name → '${name}'`);
    return { cssFile, themeDir };
  }

  await mkdir(`${themeDir}/gnome-shell`, { recursive: true });
  assertValidCss(css, `GNOME-Shell-Theme ${name}`);
  await writeFile(cssFile, css);
  console.log(`   ✓ GNOME-Shell-Theme geschrieben: ${cssFile}`);

  const code = await gs.set(USER_THEME_SCHEMA, "name", name);
  if (code !== 0) throw new Error(`User-Themes-Name setzen fehlgeschlagen (${code})`);
  console.log(`   ✓ User-Themes active: ${name}`);

  if (!opts.skipReload) {
    Bun.spawnSync(["gnome-extensions", "disable", USER_THEME_UUID]);
    Bun.spawnSync(["gnome-extensions", "enable", USER_THEME_UUID]);
    console.log("   → User-Themes neu geladen");
  }

  return { cssFile, themeDir };
}
