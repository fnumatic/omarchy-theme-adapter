// render/ghostty.ts — Ghostty-Theme aus colors.toml rendern + installieren.
// Logik (Option B): spiegelt omarchy default/themed/ghostty.conf.tpl.
import type { Colors } from "../colors.ts";
import { mkdir, writeFile, readFile } from "node:fs/promises";

/** Dateiname des User-Themes (Ghostty listet User-Themes MIT Endung, z. B. `rose-pine-dawn.conf (user)`). */
export const GHOSTTY_THEME_FILE = "rose-pine-dawn.conf";
/** Theme-ID, die in `theme = …` stehen muss — identisch zum Dateinamen. */
export const GHOSTTY_THEME_NAME = GHOSTTY_THEME_FILE;

/**
 * Rendert ein gültiges Ghostty-Theme (.conf) aus der geparsten colors.toml.
 * Paletten-Index/-Reihenfolge exakt wie im Omarchy-Template.
 */
export function renderGhostty(c: Colors): string {
  const lines: string[] = [
    `background = ${c.background ?? "#000000"}`,
    `foreground = ${c.foreground ?? "#ffffff"}`,
    `cursor-color = ${c.bright_foreground ?? c.foreground ?? "#ffffff"}`,
    `selection-background = ${c.selection ?? c.foreground ?? "#000000"}`,
    `selection-foreground = ${c.foreground ?? "#ffffff"}`,
  ];

  const order: Array<[number, string]> = [
    [0, "background"],
    [1, "red"],
    [2, "green"],
    [3, "yellow"],
    [4, "blue"],
    [5, "magenta"],
    [6, "cyan"],
    [7, "foreground"],
    [8, "muted"],
    [9, "bright_red"],
    [10, "bright_green"],
    [11, "bright_yellow"],
    [12, "bright_blue"],
    [13, "bright_magenta"],
    [14, "bright_cyan"],
    [15, "bright_foreground"],
  ];
  for (const [idx, key] of order) {
    lines.push(`palette = ${idx}=${c[key] ?? "#000000"}`);
  }
  return lines.join("\n") + "\n";
}

export interface InstallOptions {
  dry: boolean;
  /** Ghostty-Config-Verzeichnis (Default: $XDG_CONFIG_HOME|~/.config + /ghostty) */
  configDir?: string;
  /** Theme-Dateiname/-ID (Default: GHOSTTY_THEME_NAME) — für andere Omarchy-Themes */
  themeName?: string;
}

export interface InstallResult {
  themeFile: string;
  configFile: string;
  backupFile?: string;
}

/**
 * Schreibt theme nach <configDir>/themes/<name>.conf und setzt `theme = <name>`
 * in <configDir>/config (mit Backup). Bei dry=true wird nichts geschrieben.
 */
async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

export async function installGhostty(
  theme: string,
  opts: InstallOptions = { dry: false },
): Promise<InstallResult> {
  const xdg = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
  const configDir = opts.configDir ?? `${xdg}/ghostty`;
  const themesDir = `${configDir}/themes`;
  const themeName = opts.themeName ?? GHOSTTY_THEME_NAME;
  const themeFile = `${themesDir}/${themeName}`;
  const configFile = `${configDir}/config`;

  const result: InstallResult = { themeFile, configFile };

  if (opts.dry) {
    console.log(`  dry-run: mkdir -p ${themesDir}`);
    console.log(`  dry-run: schreibe ${themeFile}`);
    console.log(`  dry-run: theme-Zeile → "theme = ${themeName}" in ${configFile}`);
    return result;
  }

  await mkdir(themesDir, { recursive: true });
  await writeFile(themeFile, theme);
  console.log(`   ✓ Theme geschrieben: ${themeFile}`);

  let cfgText = "";
  if (!(await exists(configFile))) {
    await writeFile(configFile, "");
  } else {
    cfgText = await readFile(configFile, "utf8");
  }

  const themeRe = /^[ \t]*theme[ \t]*=.*$/mu;
  if (themeRe.test(cfgText)) {
    const stamp = new Date().toISOString().replace(/[-:T]/gu, "").slice(0, 14);
    const backupFile = `${configFile}.bak-${stamp}`;
    await writeFile(backupFile, cfgText);
    result.backupFile = backupFile;
  }

  let next: string;
  if (themeRe.test(cfgText)) {
    next = cfgText.replace(themeRe, `theme = ${themeName}`);
  } else {
    const base = cfgText.replace(/\s+$/u, "");
    next = (base ? base + "\n" : "") + `theme = ${themeName}\n`;
  }

  await writeFile(configFile, next);
  console.log(`   ✓ config aktualisiert: ${configFile}`);
  return result;
}
