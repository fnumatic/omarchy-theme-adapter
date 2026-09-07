import { test, expect } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeGSettings } from "../gsettings.ts";
import { listWallpapers, installWallpaper, DEFAULT_WALLPAPER } from "./wallpaper.ts";

async function twoImages(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rpg-wp-"));
  await writeFile(join(dir, "1-a.webp"), "x");
  await writeFile(join(dir, "2-b.png"), "x");
  await writeFile(join(dir, "notiz.txt"), "x");
  return dir;
}

test("DEFAULT_WALLPAPER leer → Default wird aus sortierter Liste gewählt", async () => {
  expect(DEFAULT_WALLPAPER).toBe("");
  const dir = await twoImages();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, backgrounds: dir, gs });
  expect(res.file.endsWith("1-a.webp")).toBe(true);
});

test("listWallpapers listet nur Bilder, sortiert", async () => {
  const dir = await twoImages();
  expect(await listWallpapers(dir)).toEqual(["1-a.webp", "2-b.png"]);
});

test("installWallpaper --dry-run setzt nichts", async () => {
  const dir = await twoImages();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: true, name: "2-b.png", backgrounds: dir, gs });
  expect(res.uri).toBe(`file://${join(dir, "2-b.png")}`);
  expect(gs.sets).toHaveLength(0);
});

test("Default bevorzugt 2-dot-map.webp, sonst erste sortierte", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-wp-pref-"));
  await writeFile(join(dir, "1-a.webp"), "x");
  await writeFile(join(dir, "2-dot-map.webp"), "x");
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, backgrounds: dir, gs });
  expect(res.file.endsWith("2-dot-map.webp")).toBe(true);
});

test("installWallpaper setzt picture-uri + picture-uri-dark", async () => {
  const dir = await twoImages();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, name: "1-a.webp", backgrounds: dir, gs });
  expect(res.file.endsWith("1-a.webp")).toBe(true);
  expect(gs.sets).toContainEqual([
    "org.gnome.desktop.background",
    "picture-uri",
    `'file://${join(dir, "1-a.webp")}'`,
  ]);
  expect(gs.sets).toContainEqual([
    "org.gnome.desktop.background",
    "picture-uri-dark",
    `'file://${join(dir, "1-a.webp")}'`,
  ]);
});

test("installWallpaper verweigert unbekannten Namen", async () => {
  const dir = await twoImages();
  let msg = "";
  try {
    await installWallpaper({ dry: false, name: "gibtsnicht.webp", backgrounds: dir, gs: fakeGSettings() });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("nicht in");
  expect(msg).toContain("1-a.webp");
});
