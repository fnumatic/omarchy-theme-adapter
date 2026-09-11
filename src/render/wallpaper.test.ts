import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fakeGSettings } from "../gsettings.ts";
import {
  listWallpapers,
  installWallpaper,
  themeIdFromBackgroundsDir,
  DEFAULT_WALLPAPER,
} from "./wallpaper.ts";

async function twoImages(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rpg-wp-"));
  await writeFile(join(dir, "1-a.webp"), "x");
  await writeFile(join(dir, "2-b.png"), "x");
  await writeFile(join(dir, "notes.txt"), "x");
  return dir;
}

async function destDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "rpg-dest-"));
}

test("DEFAULT_WALLPAPER empty → default is chosen from the sorted list", async () => {
  expect(DEFAULT_WALLPAPER).toBe("");
  const dir = await twoImages();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, backgrounds: dir, destDir: await destDir(), gs });
  expect(res.file.endsWith("1-a.webp")).toBe(true);
});

test("listWallpapers lists only images, sorted", async () => {
  const dir = await twoImages();
  expect(await listWallpapers(dir)).toEqual(["1-a.webp", "2-b.png"]);
});

test("themeIdFromBackgroundsDir derives the theme id from the path", () => {
  expect(themeIdFromBackgroundsDir("/home/unf/themes/rose-pine/backgrounds")).toBe("rose-pine");
  expect(themeIdFromBackgroundsDir("themes/catppuccin-latte/backgrounds")).toBe("catppuccin-latte");
});

test("installWallpaper --dry-run copies nothing and sets nothing", async () => {
  const dir = await twoImages();
  const dest = await destDir();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: true, name: "2-b.png", backgrounds: dir, destDir: dest, gs });
  expect(res.uri).toBe(pathToFileURL(join(dest, "2-b.png")).href);
  expect(gs.sets).toHaveLength(0);
  expect(existsSync(join(dest, "2-b.png"))).toBe(false);
});

test("Default prefers 2-dot-map.webp, otherwise the first sorted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg-wp-pref-"));
  await writeFile(join(dir, "1-a.webp"), "x");
  await writeFile(join(dir, "2-dot-map.webp"), "x");
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, backgrounds: dir, destDir: await destDir(), gs });
  expect(res.file.endsWith("2-dot-map.webp")).toBe(true);
});

test("installWallpaper copies into the stable dir and sets picture-uri + picture-uri-dark", async () => {
  const dir = await twoImages();
  const dest = await destDir();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, name: "1-a.webp", backgrounds: dir, destDir: dest, gs });
  const target = join(dest, "1-a.webp");
  expect(res.file).toBe(target);
  expect(await readFile(target, "utf8")).toBe("x");
  expect(res.uri).toBe(pathToFileURL(target).href);
  expect(gs.sets).toContainEqual([
    "org.gnome.desktop.background",
    "picture-uri",
    `'${pathToFileURL(target).href}'`,
  ]);
  expect(gs.sets).toContainEqual([
    "org.gnome.desktop.background",
    "picture-uri-dark",
    `'${pathToFileURL(target).href}'`,
  ]);
});

test("installWallpaper encodes paths with spaces as a valid file URI", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rpg wp-"));
  await writeFile(join(dir, "1 a.webp"), "x");
  const dest = await destDir();
  const gs = fakeGSettings();
  const res = await installWallpaper({ dry: false, name: "1 a.webp", backgrounds: dir, destDir: dest, gs });
  expect(res.uri).toBe(pathToFileURL(join(dest, "1 a.webp")).href);
  expect(res.uri).not.toContain(" ");
  expect(gs.sets[0]?.[2]).toBe(`'${res.uri}'`);
});

test("installWallpaper rejects an unknown name", async () => {
  const dir = await twoImages();
  let msg = "";
  try {
    await installWallpaper({ dry: false, name: "doesnotexist.webp", backgrounds: dir, destDir: await destDir(), gs: fakeGSettings() });
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  expect(msg).toContain("not found in");
  expect(msg).toContain("1-a.webp");
});
