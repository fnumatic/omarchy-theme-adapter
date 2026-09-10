// paths.ts — central resolution of XDG/HOME paths (single source of truth).
import { homedir } from "node:os";
import { join } from "node:path";

export function home(): string {
  return process.env.HOME || homedir();
}

export function configHome(): string {
  return process.env.XDG_CONFIG_HOME || join(home(), ".config");
}

export function stateHome(): string {
  return process.env.XDG_STATE_HOME || join(home(), ".local", "state");
}

export function dataHome(): string {
  return process.env.XDG_DATA_HOME || join(home(), ".local", "share");
}

/** Theme directory under ~/.themes (base optionally overridable). */
export function userThemesDir(base?: string): string {
  return base ?? join(home(), ".themes");
}

/** Ghostty config directory (base optionally overridable). */
export function ghosttyConfigDir(base: string = configHome()): string {
  return join(base, "ghostty");
}

export function ghosttyConfigPath(base?: string): string {
  return join(ghosttyConfigDir(base), "config");
}

export function ghosttyThemesDir(base?: string): string {
  return join(ghosttyConfigDir(base), "themes");
}

/** gtk-4.0 directory (base optionally overridable). */
export function gtk4Dir(base: string = configHome()): string {
  return join(base, "gtk-4.0");
}

export function gtk4CssPath(base?: string): string {
  return join(gtk4Dir(base), "gtk.css");
}

export function paperwmUserCssPath(base?: string): string {
  return join(base ?? configHome(), "paperwm", "user.css");
}

export function vscodeSettingsPath(base?: string): string {
  return join(base ?? configHome(), "Code", "User", "settings.json");
}

export function libreofficeConfigPath(base?: string): string {
  return join(base ?? configHome(), "libreoffice", "4", "user", "registrymodifications.xcu");
}

/** Schema directory of the user themes extension. */
export function userThemeSchemaDir(): string {
  return join(
    dataHome(),
    "gnome-shell",
    "extensions",
    "user-theme@gnome-shell-extensions.gcampax.github.com",
    "schemas",
  );
}

/** Snapshot path; `base` overrides XDG_STATE_HOME (for tests). */
export function stateFilePath(base?: string): string {
  return join(base ?? stateHome(), "themeswitch", "state.json");
}
