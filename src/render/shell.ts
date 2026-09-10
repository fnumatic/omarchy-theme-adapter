// render/shell.ts — PaperWM-Topbar in Dawn (Option B).
//
// Auf diesem System rendert PaperWM die Top-Bar selbst (Klasse
// `topbar-transparent-background` auf Main.panel, Default rgba(0,0,0,0.35)).
// Offizieller Eingriffspunkt: ~/.config/paperwm/user.css (wird als
// User-Stylesheet geladen; nach Änderung Extension aus/ein, kein Logout nötig).
// Wir verwalten nur unseren markierten Block; fremde Inhalte bleiben unangetastet.
import { readFile, writeFile } from "node:fs/promises";
import type { Palette } from "../palette.ts";
import { ensureParent } from "../fsutil.ts";
import { locateBlock } from "../managedBlock.ts";
import { paperwmUserCssPath } from "../paths.ts";

export const MARKER = "themeswitch: PaperWM-Topbar (aus Omarchy colors.toml)";
export const END_MARKER = "themeswitch: Ende PaperWM-Topbar";
/** Markierung für die von uns ergänzte Kommentar-Schließung (bei unbalancierter Datei). */
export const CLOSER_HINT = "themeswitch: schliesst offenen Datei-Kommentar";
/** Deckkraft der Top-Bar (0.95 = 95 % deckend, 5 % transparent). */
export const TOPBAR_ALPHA = 0.95;

export function userCssPath(): string {
  return paperwmUserCssPath();
}

/** Zählt, ob CSS-Text mit offenem Kommentar endet (opens > closes). */
export function hasOpenComment(text: string): boolean {
  const stripped = text
    .split("\n")
    .filter((l) => !l.includes("themeswitch"))
    .join("\n");
  return (stripped.match(/\/\*/gu) ?? []).length > (stripped.match(/\*\//gu) ?? []).length;
}
/**
 * Hex → rgba(r, g, b, a) mit dem übergebenen Alpha. Akzeptiert #rgb, #rgba,
 * #rrggbb und #rrggbbaa (eingebettetes Alpha wird ignoriert). Wirft bei ungültigem Hex.
 */
export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim().replace(/^#/u, "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/u.test(h)) throw new Error(`Ungültige Hex-Farbe: ${hex}`);
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Rendert unseren user.css-Block aus der Rollen-Palette. */
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
 * Fügt unseren Block in user.css ein bzw. aktualisiert ihn idempotent.
 * Fremde Inhalte werden nie verändert.
 */
export async function installShellPaperwm(
  block: string,
  opts: InstallShellOptions = { dry: false },
): Promise<{ cssFile: string }> {
  const cssFile = opts.cssFile ?? userCssPath();

  if (opts.dry) {
    console.log(`  dry-run: verwalte Block in ${cssFile}`);
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
    throw new Error(`Markierter Block in ${cssFile} ist beschädigt. Bitte manuell prüfen.`);
  }
  if (loc.kind === "found") {
    const head = existing.slice(0, loc.start).replace(/\s+$/u, "");
    const tail = existing.slice(loc.end).replace(/^\s+/u, "");
    next = (head ? head + "\n\n" : "") + block.trimEnd() + "\n" + (tail ? "\n" + tail : "");
    if (!next.endsWith("\n")) next += "\n";
  } else {
    const base = existing.replace(/\s+$/u, "");
    // Unbalancierte Datei (offener Kommentar) würde unseren Block verschlucken:
    // Kommentar vor unserem Block schließen, Rest unverändert lassen.
    const closer = base && hasOpenComment(base) ? `\n*/ /* ${CLOSER_HINT} */\n` : "";
    next = (base ? base + "\n" : "") + closer + (closer || base ? "\n" : "") + block.trimEnd() + "\n";
  }

  await writeFile(cssFile, next);
  console.log(`   ✓ PaperWM-Topbar-Block verwaltet: ${cssFile}`);
  console.log(`   → wirksam nach: PaperWM aus-/einschalten (kein Logout nötig)`);
  return { cssFile };
}
