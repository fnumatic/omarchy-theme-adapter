// render/libreoffice.ts — make LibreOffice follow the system theme (Option B).
//
// Finding: LibreOffice draws toolbars/sidebars using its own
// "application colors" (Tools → Options → Application Colors). The profile had
// a fixed scheme (CurrentColorScheme=LibreOffice) → the system theme (our
// Rose-Pine-Dawn GTK) was ignored for the UI surfaces.
// Fix: CurrentColorScheme=Automatic → LO follows the system theme.
// Important: only touch registrymodifications.xcu while LibreOffice is CLOSED
// (LO keeps the config in memory and writes it back on exit).
import { readFile, writeFile } from "node:fs/promises";
import { ensureParent, timestamp } from "../fsutil.ts";
import { libreofficeConfigPath } from "../paths.ts";

/** true if a LibreOffice process is running (then leave it alone). */
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
  /** Process check (default: pgrep soffice.bin) — overridable for tests */
  isRunning?: () => Promise<boolean>;
}

/**
 * Sets CurrentColorScheme=Automatic (with backup). Throws if LO is running
 * or the config looks unexpected.
 */
export async function installLibreOffice(
  opts: InstallLibreOfficeOptions = { dry: false },
): Promise<{ configFile: string; backupFile?: string; changed: boolean }> {
  const configFile = opts.configFile ?? libreofficeConfigPath();
  const running = await (opts.isRunning ?? libreofficeRunning)();

  if (running) {
    throw new Error(
      "LibreOffice is still running — please quit it first (otherwise the config is overwritten on exit).",
    );
  }

  let text: string;
  try {
    text = await readFile(configFile, "utf8");
  } catch {
    throw new Error(`LibreOffice config not found: ${configFile}`);
  }

  const re =
    /<item oor:path="\/org\.openoffice\.Office\.UI\/ColorScheme"><prop oor:name="CurrentColorScheme" oor:op="fuse"><value>.*?<\/value><\/prop><\/item>/u;

  if (opts.dry) {
    const m = text.match(re);
    console.log(`  dry-run: CurrentColorScheme is '${m ? m[0].match(/<value>(.*?)<\/value>/u)?.[1] : "? (entry missing)"}' → would become 'Automatic'`);
    console.log(`  dry-run: backup of ${configFile}`);
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
    // Entry missing: insert before the closing tag.
    const close = "</oor:component-data>";
    if (!text.includes(close)) throw new Error("Unexpected config format (no oor:component-data). Aborting.");
    next = text.replace(
      close,
      ' <item oor:path="/org.openoffice.Office.UI/ColorScheme"><prop oor:name="CurrentColorScheme" oor:op="fuse"><value>Automatic</value></prop></item>\n' +
        close,
    );
  }

  const changed = next !== text;
  await writeFile(configFile, next);
  console.log(`   ✓ LibreOffice follows the system theme (CurrentColorScheme=Automatic): ${configFile}`);
  console.log(`   ✓ Backup: ${backupFile}`);
  return { configFile, backupFile, changed };
}
