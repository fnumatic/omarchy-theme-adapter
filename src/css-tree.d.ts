// types/css-tree.d.ts — minimale Typsicherung für css-tree (nutzt nur parse).
declare module "css-tree" {
  export function parse(css: string, options?: { positions?: boolean }): unknown;
}