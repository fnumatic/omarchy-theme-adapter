import { test, expect } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setColorTheme, installVscode } from "./vscode.ts";

const DESC = { name: "Rosé Pine Dawn", extension: "mvllow.rose-pine" };

test("setColorTheme replaces an existing theme JSONC-safely", () => {
  const src = '{\n  // comment remains\n  "workbench.colorTheme": "Light Modern",\n  "editor.fontSize": 13,\n}\n';
  const out = setColorTheme(src, "Rosé Pine Dawn");
  expect(out).toContain('"workbench.colorTheme": "Rosé Pine Dawn"');
  expect(out).toContain("// comment remains");
  expect(out).toContain('"editor.fontSize": 13');
});

test("setColorTheme inserts a missing theme", () => {
  const out = setColorTheme('{\n  "editor.fontSize": 13\n}\n', "Rosé Pine Dawn");
  expect(out).toContain('"workbench.colorTheme": "Rosé Pine Dawn"');
  expect(out).toContain('"editor.fontSize": 13');
});

function fakeRun(state: { installed: string[]; log: string[][] }) {
  return (cmd: string, args: string[]) => {
    state.log.push([cmd, ...args]);
    if (args[0] === "--version") return { exitCode: 0, stdout: "1.99.0" };
    if (args[0] === "--list-extensions") return { exitCode: 0, stdout: state.installed.join("\n") };
    if (args[0] === "--install-extension") {
      state.installed.push(args[1]!);
      return { exitCode: 0, stdout: "ok" };
    }
    return { exitCode: 0, stdout: "" };
  };
}

test("installVscode installs the extension and sets the theme (dry-run changes nothing)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-vs-dry-"));
  const settings = join(dir, "settings.json");
  await writeFile(settings, '{\n  "workbench.colorTheme": "Light Modern"\n}\n');
  const state = { installed: [] as string[], log: [] as string[][] };

  await installVscode({
    dry: true,
    descriptor: DESC,
    targets: [{ cmd: "code", settingsPath: settings }],
    run: fakeRun(state),
  });
  expect(await readFile(settings, "utf8")).toContain("Light Modern");
  expect(state.installed).toHaveLength(0);
});

test("installVscode writes settings and installs a missing extension", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-vs-ok-"));
  const settings = join(dir, "settings.json");
  await writeFile(settings, '{\n  "workbench.colorTheme": "Light Modern",\n}\n');
  const state = { installed: [] as string[], log: [] as string[][] };

  await installVscode({
    dry: false,
    descriptor: DESC,
    targets: [{ cmd: "code", settingsPath: settings }],
    run: fakeRun(state),
  });
  expect(state.installed).toContain("mvllow.rose-pine");
  const out = await readFile(settings, "utf8");
  expect(out).toContain('"workbench.colorTheme": "Rosé Pine Dawn"');
  expect(out).not.toContain("Light Modern");
});

test("installVscode skips an existing extension but still sets the theme", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-vs-have-"));
  const settings = join(dir, "settings.json");
  await writeFile(settings, '{}\n');
  const state = { installed: ["mvllow.rose-pine"], log: [] as string[][] };

  await installVscode({
    dry: false,
    descriptor: DESC,
    targets: [{ cmd: "code", settingsPath: settings }],
    run: fakeRun(state),
  });
  expect(state.installed.filter((e) => e === "mvllow.rose-pine")).toHaveLength(1);
  expect(await readFile(settings, "utf8")).toContain("Rosé Pine Dawn");
});

test("installVscode sets the theme in an empty settings.json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-vs-empty-"));
  const settings = join(dir, "settings.json");
  await writeFile(settings, "");
  const state = { installed: [] as string[], log: [] as string[][] };

  await installVscode({
    dry: false,
    descriptor: DESC,
    targets: [{ cmd: "code", settingsPath: settings }],
    run: fakeRun(state),
  });
  expect(await readFile(settings, "utf8")).toContain("Rosé Pine Dawn");
});

test("installVscode skips a missing editor", async () => {
  const res = await installVscode({
    dry: false,
    descriptor: DESC,
    targets: [{ cmd: "doesnotexist", settingsPath: "/tmp/x.json" }],
    run: () => ({ exitCode: 1, stdout: "" }),
  });
  expect(res).toHaveLength(0);
});

test("installVscode rejects an invalid extension ID", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-vs-bad-"));
  let msg = "";
  try {
    await installVscode({
      dry: false,
      descriptor: { name: "X", extension: "evil;rm -rf" },
      targets: [{ cmd: "code", settingsPath: join(dir, "s.json") }],
      run: fakeRun({ installed: [], log: [] }),
    });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("Invalid extension ID");
});
