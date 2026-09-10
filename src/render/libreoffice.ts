// render/libreoffice.ts — LibreOffice dem System-Theme folgen lassen (Option B).
//
// Befund: LibreOffice zeichnet Symbolleisten/Randleisten über eigene
// „Anwendungsfarben" (Extras → Optionen → Anwendungsfarben). Das Profil hatte
// ein festes Schema (CurrentColorScheme=LibreOffice) → System-Theme (unser
// Rose-Pine-Dawn-GTK) wurde für die UI-Flächen ignoriert.
// Fix: CurrentColorScheme=Automatic → LO folgt dem System-Theme.
// Wichtig: registrymodifications.xcu nur bei BEENDETEM LibreOffice anfassen
// (LO hält die Config im Speicher und schreibt sie beim Beenden zurück).
import { readFile, writeFile } from "node:fs/promises";
import { ensureParent, timestamp } from "../fsutil.ts";
import { libreofficeConfigPath } from "../paths.ts";

/** true, wenn ein LibreOffice-Prozess läuft (dann nicht anfassen). */
export async function libreofficeRunning(): Promise<boolean> {
  try {
    const out = Bun.spawnSync(["pgrep", "-x", "soffice.bin"]);
    return out.exitCode === 0;
  } catch {
    return false;
  }
}

export interface InstallLibreOfficeOptions {
  dry: boolean;
  configFile?: string;
  /** Prozess-Check (Default: pgrep soffice.bin) — für Tests überschreibbar */
  isRunning?: () => Promise<boolean>;
}

/**
 * Setzt CurrentColorScheme=Automatic (mit Backup). Wirft, wenn LO läuft
 * oder die Config unerwartet aussieht.
 */
export async function installLibreOffice(
  opts: InstallLibreOfficeOptions = { dry: false },
): Promise<{ configFile: string; backupFile?: string; changed: boolean }> {
  const configFile = opts.configFile ?? libreofficeConfigPath();
  const running = await (opts.isRunning ?? libreofficeRunning)();

  if (running) {
    throw new Error(
      "LibreOffice läuft noch — bitte zuerst beenden (die Config wird sonst beim Beenden überschrieben).",
    );
  }

  let text: string;
  try {
    text = await readFile(configFile, "utf8");
  } catch {
    throw new Error(`LibreOffice-Config nicht gefunden: ${configFile}`);
  }

  const re =
    /<item oor:path="\/org\.openoffice\.Office\.UI\/ColorScheme"><prop oor:name="CurrentColorScheme" oor:op="fuse"><value>.*?<\/value><\/prop><\/item>/u;

  if (opts.dry) {
    const m = text.match(re);
    console.log(`  dry-run: CurrentColorScheme ist '${m ? m[0].match(/<value>(.*?)<\/value>/u)?.[1] : "? (Eintrag fehlt)"}' → würde 'Automatic'`);
    console.log(`  dry-run: Backup von ${configFile}`);
    return { configFile, changed: true };
  }

  const backupFile = `${configFile}.bak-${timestamp()}`;
  await ensureParent(configFile);
  await writeFile(backupFile, text);

  let next: string;
  if (re.test(text)) {
    next = text.replace(
      re,
      '<item oor:path="/org.openoffice.Office.UI/ColorScheme"><prop oor:name="CurrentColorScheme" oor:op="fuse"><value>Automatic</value></prop></item>',
    );
  } else {
    // Eintrag fehlt: vor schließendem Tag einfügen.
    const close = "</oor:component-data>";
    if (!text.includes(close)) throw new Error("Unerwartetes Config-Format (kein oor:component-data). Abbruch.");
    next = text.replace(
      close,
      ' <item oor:path="/org.openoffice.Office.UI/ColorScheme"><prop oor:name="CurrentColorScheme" oor:op="fuse"><value>Automatic</value></prop></item>\n' +
        close,
    );
  }

  const changed = next !== text;
  await writeFile(configFile, next);
  console.log(`   ✓ LibreOffice folgt dem System-Theme (CurrentColorScheme=Automatic): ${configFile}`);
  console.log(`   ✓ Backup: ${backupFile}`);
  return { configFile, backupFile, changed };
}
