// render/shell.ts — PaperWM top bar in Dawn (Option B).
//
// On this system PaperWM renders the top bar itself (class
// `topbar-transparent-background` on Main.panel, default rgba(0,0,0,0.35)).
// Official entry point: ~/.config/paperwm/user.css (loaded as
// user stylesheet; after a change toggle the extension off/on, no logout needed).
// We only manage our marked block; foreign content stays untouched.
import { readFile, writeFile } from "node:fs/promises";
import type { Palette } from "../palette.ts";
import { ensureParent } from "../fsutil.ts";
import { locateBlock } from "../managedBlock.ts";
import { paperwmUserCssPath } from "../paths.ts";

export const MARKER = "themeswitch: PaperWM top bar (from Omarchy colors.toml)";
export const END_MARKER = "themeswitch: end PaperWM top bar";
/** Marker for the comment closer we add (for an unbalanced file). */
export const CLOSER_HINT = "themeswitch: closes open file comment";
/** Opacity of the top bar (0.95 = 95 % opaque, 5 % transparent). */
export const TOPBAR_ALPHA = 0.95;

export function userCssPath(): string {
  return paperwmUserCssPath();
}

/** Counts whether CSS text ends with an open comment (opens > closes). */
export function hasOpenComment(text: string): boolean {
  const stripped = text
    .split("\n")
    .filter((l) => !l.includes("themeswitch"))
    .join("\n");
  return (stripped.match(/\/\*/gu) ?? []).length > (stripped.match(/\*\//gu) ?? []).length;
}
/**
 * Hex → rgba(r, g, b, a) with the given alpha. Accepts #rgb, #rgba,
 * #rrggbb and #rrggbbaa (embedded alpha is ignored). Throws on invalid hex.
 */
export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim().replace(/^#/u, "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/u.test(h)) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Renders our user.css block from the role palette. */
export function renderShellPaperwm(p: Palette): string {
  const bg = p.base;
  const fg = p.text;
  const surface = p.surface;
  return `/* ${MARKER} */
.topbar-transparent-background {
    background-color: ${hexToRgba(bg, TOPBAR_ALPHA)};
    box-shadow: none;
}
.topbar-transparent-background StLabel,
.topbar-transparent-background .panel-button,
.topbar-transparent-background .panel-button StLabel {
    color: ${fg};
}
.space-workspace-indicator {
    background-color: transparent;
}
.topbar-transparent-background .space-workspace-indicator StLabel {
    color: ${fg};
}
.paperwm-window-position-bar {
    background-color: ${hexToRgba(surface, 0.9)};
}
/* ${END_MARKER} */
`;
}

export interface InstallShellOptions {
  dry: boolean;
  cssFile?: string;
}

/**
 * Inserts or idempotently updates our block in user.css.
 * Foreign content is never changed.
 */
export async function installShellPaperwm(
  block: string,
  opts: InstallShellOptions = { dry: false },
): Promise<{ cssFile: string }> {
  const cssFile = opts.cssFile ?? userCssPath();

  if (opts.dry) {
    console.log(`  dry-run: manage block in ${cssFile}`);
    return { cssFile };
  }

  await ensureParent(cssFile);
  let existing = "";
  try {
    existing = await readFile(cssFile, "utf8");
  } catch {
    existing = "";
  }

  let next: string;
  const loc = locateBlock(existing, MARKER, END_MARKER);
  if (loc.kind === "corrupt") {
    throw new Error(`Marked block in ${cssFile} is corrupt. Please check manually.`);
  }
  if (loc.kind === "found") {
    const head = existing.slice(0, loc.start).replace(/\s+$/u, "");
    const tail = existing.slice(loc.end).replace(/^\s+/u, "");
    next = (head ? head + "\n\n" : "") + block.trimEnd() + "\n" + (tail ? "\n" + tail : "");
    if (!next.endsWith("\n")) next += "\n";
  } else {
    const base = existing.replace(/\s+$/u, "");
    // An unbalanced file (open comment) would swallow our block:
    // close the comment before our block, leave the rest unchanged.
    const closer = base && hasOpenComment(base) ? `\n*/ /* ${CLOSER_HINT} */\n` : "";
    next = (base ? base + "\n" : "") + closer + (closer || base ? "\n" : "") + block.trimEnd() + "\n";
  }

  await writeFile(cssFile, next);
  console.log(`   ✓ PaperWM top bar block managed: ${cssFile}`);
  console.log(`   → effective after: toggling PaperWM off/on (no logout needed)`);
  return { cssFile };
}
