#!/usr/bin/env bun
// cli.ts — Omarchy-Theme als GNOME-Theme via colors.toml (Option B).
// TypeScript/Bun: themeswitch parse|render|install|set|reset
// Mit `set <theme>` wird jedes Omarchy-Theme (themes/<id>/colors.toml inkl.
// optionaler vscode.json/icons.theme/backgrounds) on-the-fly auf GNOME, Ghostty,
// GTK, VS Code und PaperWM angewendet.
import { parseColors, normalize, semanticLines, type Colors } from "./colors.ts";
import { installGhostty, renderGhostty } from "./render/ghostty.ts";
import { installGtk3, renderGtk3 } from "./render/gtk3.ts";
import { installGtk4, renderGtk4 } from "./render/gtk4.ts";
import { installLibreOffice } from "./render/libreoffice.ts";
import { installVscode, defaultCodeTarget } from "./render/vscode.ts";
import { realGSettings } from "./gsettings.ts";
import { ensureSnapshot, setAppliedTheme } from "./state.ts";
import { resetAll, type ResetTarget } from "./reset.ts";
import { loadTheme, listThemes, themesRoot, type Theme } from "./themes.ts";
import { join } from "node:path";

const ROOT = import.meta.dir; // …/src
const DEFAULT_COLORS = join(ROOT, "..", "themes", "rose-pine", "colors.toml");
const DEFAULT_THEME = "rose-pine";

const usage = `themeswitch — Omarchy-Themes als GNOME-Theme (aus colors.toml, Option B)

Verwendung:
  themeswitch set <theme> [--dry-run]      Theme vollständig anwenden (Ghostty,
                                              GTK3, GTK4, VS Code, Wallpaper, PaperWM,
                                              Farbschema + Icon-Theme), on-the-fly
  themeswitch themes                        Verfügbare Omarchy-Themes auflisten
  themeswitch parse [--colors FILE]        colors.toml normalisiert ausgeben
  themeswitch render ghostty|gtk3|gtk4 [--colors FILE]
                                              einzelnes Ziel auf stdout rendern
  themeswitch install <ziel> [--theme <id>|--dry-run]
                                              Ghostty|GTK3|GTK4|LibreOffice|VS-Code|Wallpaper|Shell
  themeswitch apply [--dry-run] [--theme <id>]
                                              Farbschema + Icon-Theme setzen (System-Grundlage)
  themeswitch reset [--dry-run|--theme <id>] [ziel]
                                              Originalzustand aus Snapshot wiederherstellen

Ziele (install/reset): ghostty|gtk3|gtk4|libreoffice|vscode|wallpaper|shell|shell-theme

Optionen:
  --theme <id>    Theme-Name (Default: rose-pine)
  --colors FILE   alternatives colors.toml (nur parse/render)
  --dry-run       nur anzeigen, was geändert würde
  -h, --help      diese Hilfe
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
    C.die(`colors.toml konnte nicht gelesen werden: ${colorsFile} (${String(e)})`);
  }
  return ""; // unreachable (C.die terminiert)
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
        args.theme = argv[++i] ?? C.die("--theme braucht einen Wert");
        break;
      case "--colors":
        args.colors = argv[++i] ?? C.die("--colors braucht einen Wert");
        break;
      default:
        if (a.startsWith("-")) C.die(`Unbekannte Option: ${a}`);
        args.cmds.push(a);
    }
  }
  return args;
}

async function withColors(args: Args, fn: (c: Colors) => void): Promise<void> {
  const text = await requireColorsText(args.colors);
  const colors = parseColors(text);
  if (Object.keys(colors).length === 0) {
    C.die(`colors.toml konnte nicht geparst werden: ${args.colors}`);
  }
  fn(colors);
}

async function withTheme(args: Args, fn: (t: Theme) => Promise<void>): Promise<void> {
  let theme: Theme | null = null;
  try {
    theme = await loadTheme(args.theme);
  } catch (e) {
    const avail = (await listThemes()).join(", ");
    C.die(`${String(e instanceof Error ? e.message : e)}${avail ? `\nVerfügbar: ${avail}` : ""}`);
  }
  await fn(theme!);
}

const args = parseArgs(process.argv.slice(2));
if (args.cmds.length === 0) {
  console.log(usage);
  process.exit(0);
}

async function snapshotOnce(dry: boolean): Promise<void> {
  if (dry) {
    console.log("  dry-run: würde ggf. Snapshot sichern, keine Änderung");
    return;
  }
  const { created } = await ensureSnapshot(realGSettings);
  if (created) console.log("   ✓ Originalzustand gesichert (Snapshot)");
}

/** Wendet ein Theme vollständig auf alle Ziele an (Ghostty, GTK3, GTK4, VSCode, Wallpaper, Shell). */
async function applyTheme(theme: Theme, dry: boolean): Promise<void> {
  await snapshotOnce(dry);
  C.log(`${theme.displayName} (${theme.mode}) anwenden`);

  const c = theme.colors;

  // Ghostty
  try {
    await installGhostty(renderGhostty(c), { dry, themeName: theme.ghosttyThemeName });
  } catch (e) {
    C.die(`Ghostty fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`);
  }

  // GTK3
  try {
    await installGtk3(renderGtk3(c), { dry, name: theme.gtkThemeName });
  } catch (e) {
    C.die(`GTK3 fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`);
  }

  // GTK4-Overlay
  try {
    await installGtk4(renderGtk4(c), { dry });
  } catch (e) {
    C.die(`GTK4 fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`);
  }

  // VS Code (nur wenn Deskriptor vorhanden)
  if (theme.vscode) {
    try {
      await installVscode({ dry, descriptor: theme.vscode, targets: [defaultCodeTarget()] });
    } catch (e) {
      C.die(`VS Code fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`);
    }
  } else {
    console.log("   − VS Code: kein vscode.json im Theme, übersprungen");
  }

  // Wallpaper (nur wenn backgrounds vorhanden)
  if (theme.hasBackgrounds) {
    try {
      const { installWallpaper } = await import("./render/wallpaper.ts");
      await installWallpaper({ dry, backgrounds: join(theme.dir, "backgrounds") });
    } catch (e) {
      C.die(`Wallpaper fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`);
    }
  } else {
    console.log("   − Wallpaper: kein backgrounds/ im Theme, übersprungen");
  }

  // PaperWM-Topbar
  try {
    const { installShellPaperwm, renderShellPaperwm } = await import("./render/shell.ts");
    await installShellPaperwm(renderShellPaperwm(c), { dry });
  } catch (e) {
    C.die(`Shell fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`);
  }

  // GNOME-Shell-Theme (vollständig, Basis Yaru + rekolorierter Override)
  try {
    const {
      readSystemShellBase,
      renderShellOverride,
      renderShellTheme,
      installShellTheme,
      shellThemeName,
    } = await import("./render/shellTheme.ts");
    const base = await readSystemShellBase();
    const css = renderShellTheme(base, renderShellOverride(c));
    await installShellTheme(shellThemeName(theme.gtkThemeName), css, { dry });
  } catch (e) {
    C.warn(`GNOME-Shell-Theme: ${String(e instanceof Error ? e.message : e)}`);
  }

  // Farbschema + Icon-Theme (System-Grundlage, wie omarchy-theme-set-gnome)
  const scheme = theme.mode === "light" ? "prefer-light" : "prefer-dark";
  if (dry) {
    console.log(`  dry-run: gsettings color-scheme → ${scheme}`);
    console.log(`  dry-run: gsettings icon-theme → ${theme.iconsTheme}`);
  } else {
    const code = await realGSettings.set("org.gnome.desktop.interface", "color-scheme", scheme);
    if (code !== 0) C.warn(`gsettings color-scheme fehlgeschlagen (${code})`);
    else console.log(`   ✓ color-scheme: ${scheme}`);
    const icode = await realGSettings.set("org.gnome.desktop.interface", "icon-theme", theme.iconsTheme);
    if (icode !== 0) C.warn(`gsettings icon-theme fehlgeschlagen (${icode})`);
    else console.log(`   ✓ icon-theme: ${theme.iconsTheme}`);

    await setAppliedTheme(
      {
        id: theme.id,
        ghosttyThemeFile: `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/ghostty/themes/${theme.ghosttyThemeName}`,
        gtkThemeName: theme.gtkThemeName,
        shellThemeName: `${theme.gtkThemeName}Shell`,
      },
      realGSettings,
    );
  }
}

async function installOne(args: Args): Promise<void> {
  const target = args.cmds[1];
  switch (target) {
    case "ghostty":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        await installGhostty(renderGhostty(t.colors), { dry: args.dry, themeName: t.ghosttyThemeName })
          .catch((e) => C.die(`install ghostty fehlgeschlagen: ${String(e)}`));
      });
      break;
    case "gtk3":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        await installGtk3(renderGtk3(t.colors), { dry: args.dry, name: t.gtkThemeName })
          .catch((e) => C.die(`install gtk3 fehlgeschlagen: ${String(e)}`));
      });
      break;
    case "gtk4":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        await installGtk4(renderGtk4(t.colors), { dry: args.dry })
          .catch((e) => C.die(`install gtk4 fehlgeschlagen: ${String(e)}`));
      });
      break;
    case "libreoffice":
      await snapshotOnce(args.dry);
      await installLibreOffice({ dry: args.dry })
        .catch((e) => C.die(`install libreoffice fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`));
      break;
    case "vscode":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        if (!t.vscode) {
          C.warn(`Theme '${args.theme}' hat kein vscode.json`);
          return;
        }
        await installVscode({ dry: args.dry, descriptor: t.vscode, targets: [defaultCodeTarget()] })
          .catch((e) => C.die(`install vscode fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    case "wallpaper":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        if (!t.hasBackgrounds) {
          C.warn(`Theme '${args.theme}' hat kein backgrounds/`);
          return;
        }
        const { listWallpapers, installWallpaper } = await import("./render/wallpaper.ts");
        const name = args.cmds[2];
        const bgs = join(t.dir, "backgrounds");
        if (name !== undefined) {
          const available = await listWallpapers(bgs);
          if (!available.includes(name)) C.die(`Unbekanntes Wallpaper '${name}'. Verfügbar: ${available.join(", ")}`);
        }
        await installWallpaper({ dry: args.dry, name, backgrounds: bgs })
          .catch((e) => C.die(`install wallpaper fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    case "shell-theme":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        const {
          readSystemShellBase,
          renderShellOverride,
          renderShellTheme,
          installShellTheme,
          shellThemeName,
        } = await import("./render/shellTheme.ts");
        const base = await readSystemShellBase().catch((e) =>
          C.die(`GNOME-Shell-Theme fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`),
        );
        const css = renderShellTheme(base, renderShellOverride(t.colors));
        await installShellTheme(shellThemeName(t.gtkThemeName), css, { dry: args.dry })
          .catch((e) => C.die(`install shell-theme fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    case "shell":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        const { installShellPaperwm, renderShellPaperwm } = await import("./render/shell.ts");
        await installShellPaperwm(renderShellPaperwm(t.colors), { dry: args.dry })
          .catch((e) => C.die(`install shell fehlgeschlagen: ${String(e instanceof Error ? e.message : e)}`));
      });
      break;
    default:
      C.die(`install: unbekanntes Ziel '${target ?? ""}' (ghostty|gtk3|gtk4|libreoffice|vscode|wallpaper|shell)`);
  }
}

async function main(): Promise<void> {
  switch (args.cmds[0]) {
    case "themes":
      console.log((await listThemes()).join("\n"));
      break;

    case "set":
      if (!args.cmds[1]) C.die("set braucht einen Theme-Namen, z. B. `set rose-pine` (verfügbar: themes)");
      args.theme = args.cmds[1];
      await withTheme(args, (t) => applyTheme(t, args.dry));
      break;

    case "parse":
      await withColors(args, (c) => console.log(semanticLines(normalize(c))));
      break;

    case "render":
      if (args.cmds[1] === "ghostty") await withColors(args, (c) => console.log(renderGhostty(c)));
      else if (args.cmds[1] === "gtk3") await withColors(args, (c) => console.log(renderGtk3(c)));
      else if (args.cmds[1] === "gtk4") await withColors(args, (c) => console.log(renderGtk4(c)));
      else C.die(`render: unbekanntes Ziel '${args.cmds[1] ?? ""}' (ghostty|gtk3|gtk4)`);
      break;

    case "install":
      await installOne(args);
      break;

    case "apply":
      await withTheme(args, async (t) => {
        await snapshotOnce(args.dry);
        C.log(`${t.displayName} (${t.mode}) — Farbschema + Icon-Theme`);
        const scheme = t.mode === "light" ? "prefer-light" : "prefer-dark";
        if (args.dry) {
          console.log(`  dry-run: gsettings color-scheme → ${scheme}`);
          console.log(`  dry-run: gsettings icon-theme → ${t.iconsTheme}`);
        } else {
          const code = await realGSettings.set("org.gnome.desktop.interface", "color-scheme", scheme);
          if (code !== 0) C.warn(`gsettings color-scheme fehlgeschlagen (${code})`);
          else console.log(`   ✓ color-scheme: ${scheme}`);
          const icode = await realGSettings.set("org.gnome.desktop.interface", "icon-theme", t.iconsTheme);
          if (icode !== 0) C.warn(`gsettings icon-theme fehlgeschlagen (${icode})`);
          else console.log(`   ✓ icon-theme: ${t.iconsTheme}`);
        }
      });
      break;

    case "reset": {
      C.log(`Originalzustand wiederherstellen`);
      const t = args.cmds[1];
      const targets = ["ghostty", "gtk3", "gtk4", "libreoffice", "vscode", "wallpaper", "shell", "shell-theme"];
      if (t !== undefined && !targets.includes(t)) {
        C.die(`reset: unbekanntes Ziel '${t}' (${targets.join("|")})`);
      }
      try {
        await resetAll({ dry: args.dry, gs: realGSettings, target: t as ResetTarget | undefined });
      } catch (e) {
        C.die(String(e instanceof Error ? e.message : e));
      }
      break;
    }

    default:
      C.die(`Unbekanntes Kommando: ${args.cmds[0]} (siehe --help)`);
  }
}

await main();

export { themesRoot };