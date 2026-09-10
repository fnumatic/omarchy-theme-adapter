#!/usr/bin/env bun
// cli.ts — Omarchy theme as GNOME theme via colors.toml (Option B).
// TypeScript/Bun: themeswitch parse|render|install|set|reset
// With `set <theme>`, every Omarchy theme (themes/<id>/colors.toml incl.
// optional vscode.json/icons.theme/backgrounds) is applied on the fly to GNOME, Ghostty,
// GTK, VS Code and PaperWM.
import { parseColors, normalize, semanticLines, type Colors } from "./colors.ts";
import { resolvePalette, type Palette } from "./palette.ts";
import { installGhostty, renderGhostty } from "./render/ghostty.ts";
import { installGtk3, renderGtk3 } from "./render/gtk3.ts";
import { installGtk4, renderGtk4 } from "./render/gtk4.ts";
import { installLibreOffice } from "./render/libreoffice.ts";
import { installVscode, defaultCodeTarget } from "./render/vscode.ts";
import { installWallpaper, listWallpapers } from "./render/wallpaper.ts";
import { installShellPaperwm, renderShellPaperwm } from "./render/shell.ts";
import {
  installShellTheme,
  readSystemShellBase,
  renderShellOverride,
  renderShellTheme,
  shellThemeName,
} from "./render/shellTheme.ts";
import { realGSettings } from "./gsettings.ts";
import { ensureSnapshot, setAppliedTheme } from "./state.ts";
import { resetAll, type ResetTarget } from "./reset.ts";
import { loadTheme, listThemes, type Theme } from "./themes.ts";
import { ghosttyThemesDir } from "./paths.ts";
import { join } from "node:path";

const ROOT = import.meta.dir; // …/src
const DEFAULT_COLORS = join(ROOT, "..", "themes", "rose-pine", "colors.toml");
const DEFAULT_THEME = "rose-pine";

const usage = `themeswitch — Omarchy themes as GNOME theme (from colors.toml, Option B)

Usage:
  themeswitch set <theme> [--dry-run]      Apply theme completely (Ghostty,
                                              GTK3, GTK4, VS Code, Wallpaper, PaperWM,
                                              color scheme + icon theme), on the fly
  themeswitch themes                        List available Omarchy themes
  themeswitch parse [--colors FILE]        Output normalized colors.toml
  themeswitch render ghostty|gtk3|gtk4 [--colors FILE]
                                              render a single target to stdout
  themeswitch install <target> [--theme <id>|--dry-run]
                                              Ghostty|GTK3|GTK4|LibreOffice|VS Code|Wallpaper|Shell
  themeswitch apply [--dry-run] [--theme <id>]
                                              Set color scheme + icon theme (system base)
  themeswitch reset [--dry-run|--theme <id>] [target]
                                              Restore original state from snapshot

Targets (install/reset): ghostty|gtk3|gtk4|libreoffice|vscode|wallpaper|shell|shell-theme

Options:
  --theme <id>    Theme name (default: rose-pine)
  --colors FILE   alternative colors.toml (only parse/render)
  --dry-run       only show what would change
  -h, --help      this help
`;

const C = {
  log: (msg: string) => console.log(`\x1b[1;34m[*]\x1b[0m ${msg}`),
  warn: (msg: string) => console.warn(`\x1b[1;33m[!]\x1b[0m ${msg}`),
  die: (msg: string): never => {
    console.error(`\x1b[1;31m[x]\x1b[0m ${msg}`);
    process.exit(1);
  },
};

async function requireColorsText(colorsFile: string): Promise<string> {
  try {
    return await Bun.file(colorsFile).text();
  } catch (e) {
    C.die(`could not read colors.toml: ${colorsFile} (${String(e)})`);
  }
  return ""; // unreachable (C.die exits)
}

interface Args {
  cmds: string[];
  colors: string;
  theme: string;
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { cmds: [], colors: DEFAULT_COLORS, theme: DEFAULT_THEME, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "-h":
      case "--help":
        console.log(usage);
        process.exit(0);
      case "--dry-run":
        args.dry = true;
        break;
      case "--theme":
      case "-t":
        args.theme = argv[++i] ?? C.die("--theme requires a value");
        break;
      case "--colors":
        args.colors = argv[++i] ?? C.die("--colors requires a value");
        break;
      default:
        if (a.startsWith("-")) C.die(`Unknown option: ${a}`);
        args.cmds.push(a);
    }
  }
  return args;
}

async function withColors(args: Args, fn: (c: Colors) => void): Promise<void> {
  const text = await requireColorsText(args.colors);
  const colors = parseColors(text);
  if (Object.keys(colors).length === 0) {
    C.die(`could not parse colors.toml: ${args.colors}`);
  }
  fn(colors);
}

/** Like withColors, but additionally resolves the declarative role palette. */
async function withPalette(args: Args, fn: (p: Palette) => void): Promise<void> {
  await withColors(args, (c) => fn(resolvePalette(c)));
}

async function withTheme(args: Args, fn: (t: Theme) => Promise<void>): Promise<void> {
  let theme: Theme | null = null;
  try {
    theme = await loadTheme(args.theme);
  } catch (e) {
    const avail = (await listThemes()).join(", ");
    C.die(`${String(e instanceof Error ? e.message : e)}${avail ? `\nAvailable: ${avail}` : ""}`);
  }
  // Capture the original state once before a theme modifies the system.
  await snapshotOnce(args.dry);
  await fn(theme!);
}

const args = parseArgs(process.argv.slice(2));
if (args.cmds.length === 0) {
  console.log(usage);
  process.exit(0);
}

async function snapshotOnce(dry: boolean): Promise<void> {
  if (dry) {
    console.log("  dry-run: would capture snapshot if needed, no change");
    return;
  }
  const { created } = await ensureSnapshot(realGSettings);
  if (created) console.log("   ✓ original state saved (snapshot)");
}

/** Apply the PaperWM topbar block (on the fly from the palette). */
async function applyPaperwm(p: Palette, dry: boolean): Promise<void> {
  await installShellPaperwm(renderShellPaperwm(p), { dry });
}

/** Install the complete GNOME Shell theme (system Yaru + override). */
async function applyShellTheme(p: Palette, gtkName: string, dry: boolean): Promise<void> {
  const base = await readSystemShellBase();
  const css = renderShellTheme(base, renderShellOverride(p));
  await installShellTheme(shellThemeName(gtkName), css, { dry });
}

/** Set color scheme + icon theme (system base, like omarchy-theme-set-gnome). */
async function applySystemSettings(t: Theme, dry: boolean): Promise<void> {
  const scheme = t.mode === "light" ? "prefer-light" : "prefer-dark";
  if (dry) {
    console.log(`  dry-run: gsettings color-scheme → ${scheme}`);
    console.log(`  dry-run: gsettings icon-theme → ${t.iconsTheme}`);
    return;
  }
  const code = await realGSettings.set("org.gnome.desktop.interface", "color-scheme", scheme);
  if (code !== 0) C.warn(`gsettings color-scheme failed (${code})`);
  else console.log(`   ✓ color-scheme: ${scheme}`);
  const icode = await realGSettings.set("org.gnome.desktop.interface", "icon-theme", t.iconsTheme);
  if (icode !== 0) C.warn(`gsettings icon-theme failed (${icode})`);
  else console.log(`   ✓ icon-theme: ${t.iconsTheme}`);
}

/** Applies a theme completely to all targets (Ghostty, GTK3, GTK4, VSCode, Wallpaper, Shell). */
async function applyTheme(theme: Theme, dry: boolean): Promise<void> {
  C.log(`Applying ${theme.displayName} (${theme.mode})`);

  const p = theme.palette;

  // Ghostty
  try {
    await installGhostty(renderGhostty(p), { dry, themeName: theme.ghosttyThemeName });
  } catch (e) {
    C.die(`Ghostty failed: ${String(e instanceof Error ? e.message : e)}`);
  }

  // GTK3
  try {
    await installGtk3(renderGtk3(p), { dry, name: theme.gtkThemeName });
  } catch (e) {
    C.die(`GTK3 failed: ${String(e instanceof Error ? e.message : e)}`);
  }

  // GTK4-Overlay
  try {
    await installGtk4(renderGtk4(p), { dry });
  } catch (e) {
    C.die(`GTK4 failed: ${String(e instanceof Error ? e.message : e)}`);
  }

  // VS Code (only if a descriptor is present)
  if (theme.vscode) {
    try {
      await installVscode({ dry, descriptor: theme.vscode, targets: [defaultCodeTarget()] });
    } catch (e) {
      C.die(`VS Code failed: ${String(e instanceof Error ? e.message : e)}`);
    }
  } else {
    console.log("   − VS Code: no vscode.json in theme, skipped");
  }

  // Wallpaper (only if backgrounds are present)
  if (theme.hasBackgrounds) {
    try {
      await installWallpaper({ dry, backgrounds: join(theme.dir, "backgrounds") });
    } catch (e) {
      C.die(`Wallpaper failed: ${String(e instanceof Error ? e.message : e)}`);
    }
  } else {
    console.log("   − Wallpaper: no backgrounds/ in theme, skipped");
  }

  // PaperWM topbar
  try {
    await applyPaperwm(p, dry);
  } catch (e) {
    C.die(`Shell failed: ${String(e instanceof Error ? e.message : e)}`);
  }

  // GNOME Shell theme (complete, base Yaru + recolored override)
  try {
    await applyShellTheme(p, theme.gtkThemeName, dry);
  } catch (e) {
    C.warn(`GNOME-Shell-Theme: ${String(e instanceof Error ? e.message : e)}`);
  }

  // Color scheme + icon theme (system base)
  await applySystemSettings(theme, dry);

  if (!dry) {
    await setAppliedTheme({
      id: theme.id,
      ghosttyThemeFile: join(ghosttyThemesDir(), theme.ghosttyThemeName),
      gtkThemeName: theme.gtkThemeName,
      shellThemeName: shellThemeName(theme.gtkThemeName),
    });
  }
}

async function installOne(args: Args): Promise<void> {
  const target = args.cmds[1];
  switch (target) {
    case "ghostty":
      await withTheme(args, async (t) => {
        await installGhostty(renderGhostty(t.palette), { dry: args.dry, themeName: t.ghosttyThemeName })
          .catch((e) => C.die(`install ghostty failed: ${String(e)}`));
      });
      break;
    case "gtk3":
      await withTheme(args, async (t) => {
        await installGtk3(renderGtk3(t.palette), { dry: args.dry, name: t.gtkThemeName })
          .catch((e) => C.die(`install gtk3 failed: ${String(e)}`));
      });
      break;
    case "gtk4":
      await withTheme(args, async (t) => {
        await installGtk4(renderGtk4(t.palette), { dry: args.dry })
          .catch((e) => C.die(`install gtk4 failed: ${String(e)}`));
      });
      break;
    case "libreoffice":
      await snapshotOnce(args.dry);
      await installLibreOffice({ dry: args.dry })
        .catch((e) => C.die(`install libreoffice failed: ${String(e instanceof Error ? e.message : e)}`));
      break;
    case "vscode":
      await withTheme(args, async (t) => {
        if (!t.vscode) {
          C.warn(`Theme '${args.theme}' has no vscode.json`);
          return;
        }
        await installVscode({ dry: args.dry, descriptor: t.vscode, targets: [defaultCodeTarget()] })
          .catch((e) => C.die(`install vscode failed: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    case "wallpaper":
      await withTheme(args, async (t) => {
        if (!t.hasBackgrounds) {
          C.warn(`Theme '${args.theme}' has no backgrounds/`);
          return;
        }
        const name = args.cmds[2];
        const bgs = join(t.dir, "backgrounds");
        if (name !== undefined) {
          const available = await listWallpapers(bgs);
          if (!available.includes(name)) C.die(`Unknown wallpaper '${name}'. Available: ${available.join(", ")}`);
        }
        await installWallpaper({ dry: args.dry, name, backgrounds: bgs })
          .catch((e) => C.die(`install wallpaper failed: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    case "shell-theme":
      await withTheme(args, async (t) => {
        await applyShellTheme(t.palette, t.gtkThemeName, args.dry)
          .catch((e) => C.die(`install shell-theme failed: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    case "shell":
      await withTheme(args, async (t) => {
        await applyPaperwm(t.palette, args.dry)
          .catch((e) => C.die(`install shell failed: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    default:
      C.die(`install: unknown target '${target ?? ""}' (ghostty|gtk3|gtk4|libreoffice|vscode|wallpaper|shell)`);
  }
}

async function main(): Promise<void> {
  switch (args.cmds[0]) {
    case "themes":
      console.log((await listThemes()).join("\n"));
      break;

    case "set":
      if (!args.cmds[1]) C.die("set requires a theme name, e.g. `set rose-pine` (available: themes)");
      args.theme = args.cmds[1];
      await withTheme(args, (t) => applyTheme(t, args.dry));
      break;

    case "parse":
      await withColors(args, (c) => console.log(semanticLines(normalize(c))));
      break;

    case "render":
      if (args.cmds[1] === "ghostty") await withPalette(args, (p) => console.log(renderGhostty(p)));
      else if (args.cmds[1] === "gtk3") await withPalette(args, (p) => console.log(renderGtk3(p)));
      else if (args.cmds[1] === "gtk4") await withPalette(args, (p) => console.log(renderGtk4(p)));
      else C.die(`render: unknown target '${args.cmds[1] ?? ""}' (ghostty|gtk3|gtk4)`);
      break;

    case "install":
      await installOne(args);
      break;

    case "apply":
      await withTheme(args, async (t) => {
        C.log(`${t.displayName} (${t.mode}) — color scheme + icon theme`);
        await applySystemSettings(t, args.dry);
      });
      break;

    case "reset": {
      C.log(`Restore original state`);
      const t = args.cmds[1];
      const targets = ["ghostty", "gtk3", "gtk4", "libreoffice", "vscode", "wallpaper", "shell", "shell-theme"];
      if (t !== undefined && !targets.includes(t)) {
        C.die(`reset: unknown target '${t}' (${targets.join("|")})`);
      }
      try {
        await resetAll({ dry: args.dry, gs: realGSettings, target: t as ResetTarget | undefined });
      } catch (e) {
        C.die(String(e instanceof Error ? e.message : e));
      }
      break;
    }

    default:
      C.die(`Unknown command: ${args.cmds[0]} (see --help)`);
  }
}

await main();