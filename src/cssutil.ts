// cssutil.ts — strukturelle CSS-Validierung mit css-tree.
import { parse } from "css-tree";

/**
 * Wirft, wenn css-tree strukturelle Syntaxfehler meldet. `parse` allein wirft
 * praktisch nie; erst `onParseError` macht die Validierung wirksam.
 */
export function assertValidCss(css: string, label: string): void {
  const errors: string[] = [];
  parse(css, { positions: true, onParseError: (e) => errors.push(e.message) });
  if (errors.length > 0) {
    throw new Error(`CSS ungültig (${label}): ${errors.slice(0, 3).join("; ")}`);
  }
}