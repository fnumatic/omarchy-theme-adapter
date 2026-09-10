// fsutil.ts — small filesystem helpers (parent directory, backup timestamp).
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/** Ensures that a file's parent directory exists. */
export async function ensureParent(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

/** Compact UTC timestamp for backups (YYYYMMDDHHMMSS). */
export function timestamp(): string {
  return new Date().toISOString().replace(/[-:T]/gu, "").slice(0, 14);
}
