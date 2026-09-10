import { test, expect } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fakeGSettings } from "../gsettings.ts";
import { listWallpapers, installWallpaper, DEFAULT_WALLPAPER } from "./wallpaper.ts";

async function twoImages(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rpg-wp-"));
  await writeFile(join(dir, "1-a.webp"), "x");
  await writeFile(join(dir, "2-b.png"), "x");
  await writeFile(join(dir, "notes.txt"), "x");
  return dir;
}

test("DEFAULT_WALLPAPER empty → default is chosen from the sorted list", async () => {
  expect(DEFAULT_WALLPAPER).toBe("");
  const dir = await twoImages();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, backgrounds: dir, gs });
  expect(res.file.endsWith("1-a.webp")).toBe(true);
});

test("listWallpapers lists only images, sorted", async () => {
  const dir = await twoImages();
  expect(await listWallpapers(dir)).toEqual(["1-a.webp", "2-b.png"]);
});

test("installWallpaper --dry-run sets nothing", async () => {
  const dir = await twoImages();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: true, name: "2-b.png", backgrounds: dir, gs });
  expect(res.uri).toBe(`file://${join(dir, "2-b.png")}`);
  expect(gs.sets).toHaveLength(0);
});

test("Default prefers 2-dot-map.webp, otherwise the first sorted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-wp-pref-"));
  await writeFile(join(dir, "1-a.webp"), "x");
  await writeFile(join(dir, "2-dot-map.webp"), "x");
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, backgrounds: dir, gs });
  expect(res.file.endsWith("2-dot-map.webp")).toBe(true);
});

test("installWallpaper sets picture-uri + picture-uri-dark", async () => {
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

test("installWallpaper encodes paths with spaces as a valid file URI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg wp-"));
  await writeFile(join(dir, "1 a.webp"), "x");
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, name: "1 a.webp", backgrounds: dir, gs });
  expect(res.uri).toBe(pathToFileURL(join(dir, "1 a.webp")).href);
  expect(res.uri).not.toContain(" ");
  expect(gs.sets[0]?.[2]).toBe(`'${res.uri}'`);
});

test("installWallpaper rejects an unknown name", async () => {
  const dir = await twoImages();
  let msg = "";
  try {
    await installWallpaper({ dry: false, name: "doesnotexist.webp", backgrounds: dir, gs: fakeGSettings() });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("not found in");
  expect(msg).toContain("1-a.webp");
});
