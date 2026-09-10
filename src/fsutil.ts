// fsutil.ts — kleine Dateisystem-Helfer (Elternverzeichnis, Backup-Zeitstempel).
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/** Stellt sicher, dass das Elternverzeichnis einer Datei existiert. */
export async function ensureParent(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

/** Kompakter UTC-Zeitstempel für Backups (YYYYMMDDHHMMSS). */
export function timestamp(): string {
  return new Date().toISOString().replace(/[-:T]/gu, "").slice(0, 14);
}
