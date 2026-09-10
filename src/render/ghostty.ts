// render/ghostty.ts — render + install Ghostty theme from colors.toml.
// Logic (Option B): mirrors omarchy default/themed/ghostty.conf.tpl.
import type { Palette } from "../palette.ts";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { timestamp } from "../fsutil.ts";
import { ghosttyConfigDir } from "../paths.ts";

/**
 * Renders a valid Ghostty theme (.conf) from the parsed colors.toml.
 * Palette index/order exactly as in the Omarchy template.
 */
export function renderGhostty(p: Palette): string {
  const lines: string[] = [
    `background = ${p.base}`,
    `foreground = ${p.text}`,
    `cursor-color = ${p.ansi16[15]}`,
    `selection-background = ${p.highlight_med}`,
    `selection-foreground = ${p.text}`,
  ];

  for (let idx = 0; idx < p.ansi16.length; idx++) {
    lines.push(`palette = ${idx}=${p.ansi16[idx]}`);
  }
  return lines.join("\n") + "\n";
}

export interface InstallOptions {
  dry: boolean;
  /** Ghostty config directory (default: $XDG_CONFIG_HOME|~/.config + /ghostty) */
  configDir?: string;
  /** Theme file name/ID (e.g. "rose-pine.conf") — derived from the theme ID. */
  themeName: string;
}

export interface InstallResult {
  themeFile: string;
  configFile: string;
  backupFile?: string;
}

/**
 * Writes theme to <configDir>/themes/<name>.conf and sets `theme = <name>`
 * in <configDir>/config (with backup). With dry=true nothing is written.
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
  opts: InstallOptions,
): Promise<InstallResult> {
  const configDir = opts.configDir ?? ghosttyConfigDir();
  const themesDir = join(configDir, "themes");
  const themeName = opts.themeName;
  const themeFile = join(themesDir, themeName);
  const configFile = join(configDir, "config");

  const result: InstallResult = { themeFile, configFile };

  if (opts.dry) {
    console.log(`  dry-run: mkdir -p ${themesDir}`);
    console.log(`  dry-run: write ${themeFile}`);
    console.log(`  dry-run: theme line → "theme = ${themeName}" in ${configFile}`);
    return result;
  }

  await mkdir(themesDir, { recursive: true });
  await writeFile(themeFile, theme);
  console.log(`   ✓ theme written: ${themeFile}`);

  let cfgText = "";
  if (!(await exists(configFile))) {
    await writeFile(configFile, "");
  } else {
    cfgText = await readFile(configFile, "utf8");
  }

  const themeRe = /^[ \t]*theme[ \t]*=.*$/mu;
  if (themeRe.test(cfgText)) {
    const backupFile = `${configFile}.bak-${timestamp()}`;
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
  console.log(`   ✓ config updated: ${configFile}`);
  return result;
}
