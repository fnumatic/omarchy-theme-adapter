// types/css-tree.d.ts — minimal type safety for css-tree (only uses parse).
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
