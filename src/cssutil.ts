// cssutil.ts — structural CSS validation with css-tree.
import { parse } from "css-tree";

/**
 * Throws when css-tree reports structural syntax errors. `parse` alone
 * practically never throws; only `onParseError` makes the validation effective.
 */
export function assertValidCss(css: string, label: string): void {
  const errors: string[] = [];
  parse(css, { positions: true, onParseError: (e) => errors.push(e.message) });
  if (errors.length > 0) {
    throw new Error(`Invalid CSS (${label}): ${errors.slice(0, 3).join("; ")}`);
  }
}