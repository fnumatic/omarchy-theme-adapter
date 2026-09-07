import { test, expect } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installLibreOffice } from "./libreoffice.ts";

const SAMPLE =
  '<?xml version="1.0"?><oor:component-data><item oor:path="/org.openoffice.Office.UI/ColorScheme"><prop oor:name="CurrentColorScheme" oor:op="fuse"><value>LibreOffice</value></prop></item></oor:component-data>';

const noLO = async () => false;
const yesLO = async () => true;

test("installLibreOffice verweigert bei laufendem LO", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-lo-"));
  const cfg = join(dir, "registrymodifications.xcu");
  await writeFile(cfg, SAMPLE);
  let msg = "";
  try {
    await installLibreOffice({ dry: false, configFile: cfg, isRunning: yesLO });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("läuft noch");
  expect(await readFile(cfg, "utf8")).toBe(SAMPLE);
});

test("installLibreOffice --dry-run ändert nichts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-lo-dry-"));
  const cfg = join(dir, "registrymodifications.xcu");
  await writeFile(cfg, SAMPLE);
  await installLibreOffice({ dry: true, configFile: cfg, isRunning: noLO });
  expect(await readFile(cfg, "utf8")).toBe(SAMPLE);
});

test("installLibreOffice setzt Automatic (mit Backup)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-lo-ok-"));
  const cfg = join(dir, "registrymodifications.xcu");
  await writeFile(cfg, SAMPLE);
  const res = await installLibreOffice({ dry: false, configFile: cfg, isRunning: noLO });
  const next = await readFile(cfg, "utf8");
  expect(next).toContain("<value>Automatic</value>");
  expect(next).not.toContain("<value>LibreOffice</value>");
  expect(res.backupFile).toBeDefined();
  expect(await readFile(res.backupFile!, "utf8")).toBe(SAMPLE);
  expect(res.changed).toBe(true);
});

test("installLibreOffice ist idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-lo-idem-"));
  const cfg = join(dir, "registrymodifications.xcu");
  await writeFile(cfg, SAMPLE);
  await installLibreOffice({ dry: false, configFile: cfg, isRunning: noLO });
  const res = await installLibreOffice({ dry: false, configFile: cfg, isRunning: noLO });
  expect(res.changed).toBe(false);
});
