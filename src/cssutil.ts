// cssutil.ts — strukturelle CSS-Validierung mit css-tree.
import { parse } from "css-tree";

/** Wirft, wenn der Text kein gültiges CSS ist. Gibt sonst den Text zurück. */
export function assertValidCss(css: string, label: string): void {
  try {
    parse(css, { positions: true });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`CSS ungültig (${label}): ${detail}`);
  }
}