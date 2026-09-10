// render/vscode.ts — make VS Code follow the Omarchy theme (Option B).
//
// Omarchy mechanics (bin/omarchy-theme-set-vscode): the theme provides a
// descriptor (themes/rose-pine/vscode.json = {name, extension}); Omarchy
// installs the extension and sets workbench.colorTheme in settings.json.
// settings.json is JSONC (comments/trailing commas) → edit via regex as
// in Omarchy, no JSON round-trip (no reformat, no comment loss).
import { readFile, writeFile } from "node:fs/promises";
import { ensureParent } from "../fsutil.ts";
import { vscodeSettingsPath } from "../paths.ts";

export interface VscodeDescriptor {
  name: string;
  extension: string;
}

export interface EditorTarget {
  /** Binary, e.g. "code" */
  cmd: string;
  /** settings.json path */
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
  /** Command runner (default: Bun.spawnSync) — overridable for tests */
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

/** Sets/replaces workbench.colorTheme JSONC-safely (like Omarchy via sed). */
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
      console.log(`   − ${t.cmd} not present, skipped`);
      continue;
    }
    const settingsPath = opts.settingsPath ?? t.settingsPath;

    // Install extension (only if missing, validate ID format as in Omarchy)
    const { extension, name } = opts.descriptor;
    if (!/^[a-zA-Z0-9._-]+$/u.test(extension)) {
      throw new Error(`Invalid extension ID in descriptor: ${extension}`);
    }
    const listed = run(t.cmd, ["--list-extensions"]);
    if (!listed.stdout.split("\n").some((l) => l.trim().toLowerCase() === extension.toLowerCase())) {
      if (opts.dry) {
        console.log(`  dry-run: ${t.cmd} --install-extension ${extension}`);
      } else {
        const inst = run(t.cmd, ["--install-extension", extension]);
        if (inst.exitCode !== 0) {
          throw new Error(`${t.cmd} --install-extension ${extension} failed (${inst.exitCode})`);
        }
        console.log(`   ✓ Extension installed: ${extension} (${t.cmd})`);
      }
    } else {
      console.log(`   − Extension already present: ${extension} (${t.cmd})`);
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
      // Empty file → valid JSONC skeleton, otherwise setColorTheme has nothing to match.
      if (text.trim() === "") text = "{\n}\n";
      await writeFile(settingsPath, setColorTheme(text, name));
      console.log(`   ✓ workbench.colorTheme → "${name}" (${t.cmd})`);
    }
    done.push({ themeName: name, settingsPath });
  }
  return done;
}
