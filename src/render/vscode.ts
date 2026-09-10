// render/vscode.ts — VS Code dem Omarchy-Theme folgen lassen (Option B).
//
// Omarchy-Mechanik (bin/omarchy-theme-set-vscode): Das Theme liefert einen
// Deskriptor (themes/rose-pine/vscode.json = {name, extension}); Omarchy
// installiert die Extension und setzt workbench.colorTheme in settings.json.
// settings.json ist JSONC (Kommentare/trailing commas) → Edit per Regex wie
// bei Omarchy, kein JSON-Roundtrip (kein Reformat, keine Kommentar-Verluste).
import { readFile, writeFile } from "node:fs/promises";
import { ensureParent } from "../fsutil.ts";
import { vscodeSettingsPath } from "../paths.ts";

export interface VscodeDescriptor {
  name: string;
  extension: string;
}

export interface EditorTarget {
  /** Binary, z. B. "code" */
  cmd: string;
  /** settings.json-Pfad */
  settingsPath: string;
}

export function defaultCodeTarget(): EditorTarget {
  return { cmd: "code", settingsPath: vscodeSettingsPath() };
}

export interface InstallVscodeOptions {
  dry: boolean;
  descriptor: VscodeDescriptor;
  targets?: EditorTarget[];
  settingsPath?: string;
  /** Befehls-Runner (Default: Bun.spawnSync) — für Tests überschreibbar */
  run?: (cmd: string, args: string[]) => { exitCode: number; stdout: string };
}

function defaultRun(cmd: string, args: string[]): { exitCode: number; stdout: string } {
  try {
    const out = Bun.spawnSync([cmd, ...args]);
    return { exitCode: out.exitCode ?? -1, stdout: new TextDecoder().decode(out.stdout) };
  } catch {
    return { exitCode: -1, stdout: "" };
  }
}

function commandPresent(run: NonNullable<InstallVscodeOptions["run"]>, cmd: string): boolean {
  return run(cmd, ["--version"]).exitCode === 0;
}

/** Setzt/ersetzt workbench.colorTheme JSONC-sicher (wie Omarchy per sed). */
export function setColorTheme(settingsText: string, themeName: string): string {
  if (!/"workbench\.colorTheme"/u.test(settingsText)) {
    return settingsText.replace(/\{/u, `{\n  "workbench.colorTheme": "${themeName}",`);
  }
  return settingsText.replace(
    /("workbench\.colorTheme"[ \t]*:[ \t]*")[^"]*(")/u,
    `$1${themeName}$2`,
  );
}

export async function installVscode(
  opts: InstallVscodeOptions,
): Promise<{ themeName: string; settingsPath: string }[]> {
  const run = opts.run ?? defaultRun;
  const targets = opts.targets ?? [defaultCodeTarget()];
  const done: { themeName: string; settingsPath: string }[] = [];

  for (const t of targets) {
    if (!commandPresent(run, t.cmd)) {
      console.log(`   − ${t.cmd} nicht vorhanden, übersprungen`);
      continue;
    }
    const settingsPath = opts.settingsPath ?? t.settingsPath;

    // Extension installieren (nur wenn fehlend, ID-Format prüfen wie Omarchy)
    const { extension, name } = opts.descriptor;
    if (!/^[a-zA-Z0-9._-]+$/u.test(extension)) {
      throw new Error(`Ungültige Extension-ID im Deskriptor: ${extension}`);
    }
    const listed = run(t.cmd, ["--list-extensions"]);
    if (!listed.stdout.split("\n").some((l) => l.trim().toLowerCase() === extension.toLowerCase())) {
      if (opts.dry) {
        console.log(`  dry-run: ${t.cmd} --install-extension ${extension}`);
      } else {
        const inst = run(t.cmd, ["--install-extension", extension]);
        if (inst.exitCode !== 0) {
          throw new Error(`${t.cmd} --install-extension ${extension} fehlgeschlagen (${inst.exitCode})`);
        }
        console.log(`   ✓ Extension installiert: ${extension} (${t.cmd})`);
      }
    } else {
      console.log(`   − Extension bereits vorhanden: ${extension} (${t.cmd})`);
    }

    if (opts.dry) {
      console.log(`  dry-run: workbench.colorTheme → "${name}" in ${settingsPath}`);
    } else {
      await ensureParent(settingsPath);
      let text = "";
      try {
        text = await readFile(settingsPath, "utf8");
      } catch {
        text = "{\n}\n";
      }
      // Leere Datei → gültiges JSONC-Gerüst, sonst greift setColorTheme ins Leere.
      if (text.trim() === "") text = "{\n}\n";
      await writeFile(settingsPath, setColorTheme(text, name));
      console.log(`   ✓ workbench.colorTheme → "${name}" (${t.cmd})`);
    }
    done.push({ themeName: name, settingsPath });
  }
  return done;
}
