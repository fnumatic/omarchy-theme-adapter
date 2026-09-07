#!/usr/bin/env bun
// cli.ts — Rose Pine Dawn als GNOME-Theme via Omarchy colors.toml (Option B).
// TypeScript/Bun: rosepine-gnome parse|render|install|apply
import { parseColors, normalize, semanticLines, type Colors } from "./colors.ts";
import {
  installGhostty,
  renderGhostty,
  GHOSTTY_THEME_NAME,
} from "./render/ghostty.ts";
import {
  installGtk3,
  renderGtk3,
  GTK3_THEME_NAME,
} from "./render/gtk3.ts";
import { realGSettings } from "./gsettings.ts";
import { ensureSnapshot } from "./state.ts";
import { resetAll } from "./reset.ts";
import { join } from "node:path";

const ROOT = import.meta.dir; // …/src
const DEFAULT_COLORS = join(ROOT, "..", "themes", "rose-pine", "colors.toml");

const usage = `rosepine-gnome — Rose Pine Dawn als GNOME-Theme (aus Omarchy colors.toml)

Verwendung:
  rosepine-gnome parse [--colors FILE]        colors.toml normalisiert ausgeben
  rosepine-gnome render ghostty [--colors FILE]
                                              Ghostty-Theme (.conf) auf stdout
  rosepine-gnome render gtk3 [--colors FILE]  GTK3 gtk.css auf stdout
  rosepine-gnome install ghostty [--dry-run] [--colors FILE]
                                              Ghostty-Theme installieren + config setzen
  rosepine-gnome install gtk3 [--dry-run] [--colors FILE]
                                              GTK3-Theme + gsettings gtk-theme
  rosepine-gnome apply [--dry-run] [--colors FILE]
                                              System-Light-Schema setzen (MVP)
  rosepine-gnome reset [--dry-run]            Originalzustand aus Snapshot wiederherstellen

Optionen:
  --colors FILE   alternatives colors.toml (Standard: themes/rose-pine/colors.toml)
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
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { cmds: [], colors: DEFAULT_COLORS, dry: false };
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

const args = parseArgs(process.argv.slice(2));
if (args.cmds.length === 0) {
  console.log(usage);
  process.exit(0);
}

async function main(): Promise<void> {
  switch (args.cmds[0]) {
    case "parse":
      await withColors(args, (c) => console.log(semanticLines(normalize(c))));
      break;

    case "render":
      if (args.cmds[1] === "ghostty") {
        await withColors(args, (c) => console.log(renderGhostty(c)));
      } else if (args.cmds[1] === "gtk3") {
        await withColors(args, (c) => console.log(renderGtk3(c)));
      } else {
        C.die(`render: unbekanntes Ziel '${args.cmds[1] ?? ""}' (ghostty|gtk3)`);
      }
      break;

    case "install":
      if (args.cmds[1] === "ghostty") {
        if (!args.dry) {
          const { created } = await ensureSnapshot(realGSettings);
          if (created) console.log("   ✓ Originalzustand gesichert (Snapshot)");
        } else {
          console.log("  dry-run: würde ggf. Snapshot sichern, keine Änderung");
        }
        await withColors(args, async (c) => {
          try {
            await installGhostty(renderGhostty(c), { dry: args.dry });
          } catch (e) {
            C.die(`install ghostty fehlgeschlagen: ${String(e)}`);
          }
        });
      } else if (args.cmds[1] === "gtk3") {
        if (!args.dry) {
          const { created } = await ensureSnapshot(realGSettings);
          if (created) console.log("   ✓ Originalzustand gesichert (Snapshot)");
        } else {
          console.log("  dry-run: würde ggf. Snapshot sichern, keine Änderung");
        }
        await withColors(args, async (c) => {
          try {
            await installGtk3(renderGtk3(c), { dry: args.dry });
          } catch (e) {
            C.die(`install gtk3 fehlgeschlagen: ${String(e)}`);
          }
        });
      } else {
        C.die(`install: unbekanntes Ziel '${args.cmds[1] ?? ""}' (ghostty|gtk3)`);
      }
      break;

    case "apply": {
      C.log(`Anwenden von Rose Pine Dawn`);
      if (args.dry) {
        console.log("  dry-run: gsettings set org.gnome.desktop.interface color-scheme prefer-light");
        console.log(`   − Icon-Theme/Wallpaper: offen (PROJECT.md §13); Ghostty: rosepine-gnome install ghostty`);
        break;
      }
      const { created } = await ensureSnapshot(realGSettings);
      if (created) console.log("   ✓ Originalzustand gesichert (Snapshot)");
      const code = await realGSettings.set("org.gnome.desktop.interface", "color-scheme", "prefer-light");
      if (code !== 0) C.warn(`gsettings-color-scheme fehlgeschlagen (${code})`);
      else console.log("   ✓ color-scheme: prefer-light");
      console.log(`   − Icon-Theme/Wallpaper: offen (PROJECT.md §13); Ghostty: rosepine-gnome install ghostty`);
      break;
    }

    case "reset": {
      C.log(`Originalzustand wiederherstellen`);
      try {
        await resetAll({ dry: args.dry, gs: realGSettings });
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

export { GHOSTTY_THEME_NAME };
