// types/css-tree.d.ts — minimale Typsicherung für css-tree (nutzt nur parse).
declare module "css-tree" {
  export interface ParseError {
    message: string;
    offset?: number;
    line?: number;
    column?: number;
  }
  export interface ParseOptions {
    positions?: boolean;
    onParseError?: (error: ParseError) => void;
  }
  export function parse(css: string, options?: ParseOptions): unknown;
}
