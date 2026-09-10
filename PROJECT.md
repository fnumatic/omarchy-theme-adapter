# Project: Rose Pine Dawn as a GNOME theme on Ubuntu 26.04

**Status:** implemented (v1, functional)
**Date:** 2026-09-07
**Target version:** Ubuntu 26.04.1 LTS ("Resolute Raccoon"), GNOME (ubuntu session)
**Related note:** `~/dokumente/brain/.../Rose Pine Dawn auf Ubuntu GNOME.md`

---

## 1. Problem

### What is being solved?
The Omarchy theme "Rose Pine" (light *Dawn* variant) is to be recreated as the
appearance of an **Ubuntu 26.04 GNOME** system — **without** installing Omarchy
(Hyprland desktop) and **without** using a ready-made third-party GTK theme.

**Why pure Option B?** (user decision, 2026-09-07)
Instead of installing the official `rose-pine/gtk` implementation (Option A), the
**Omarchy theme system** (palette → templates) is to serve as the source and be
translated into GNOME's own layers via a **custom GNOME adapter**. This keeps the
approach close to the Omarchy concept and reproduces the look from the original
semantics of `colors.toml` rather than from a foreign recolor.

### Why now?
- There is no ready-made 1:1 solution for "Omarchy theme on GNOME".
- The exact source palette is now verified (`omacom/omarchy`, branch `quattro`).
- The target system (this machine) exists and can be tested directly.

### Who is affected?
- **Primary:** the owner of this system, who wants a consistent Rose Pine Dawn look.
- **Secondary:** anyone who later wants to reuse the repo on an Ubuntu 26.04 GNOME system.

---

## 2. Verified sources (corrections to the brain note)

| Topic | Brain note | Verified (2026-09-07) |
|---|---|---|
| Omarchy repo | `basecamp/omarchy` | **`omacom/omarchy`** (branch `quattro`, by DHH) — `basecamp/` is a placeholder/access path, not the primary repo |
| Source palette | "not yet obtained" | available as **`themes/rose-pine/colors.toml`** in the Omarchy repo |
| Variant | Dawn (light) | confirmed: stock theme is `mode = "light"` with `background = "#faf4ed"` (Rose Pine Dawn) |
| Template mechanics | "`colors.toml` → templates" | confirmed via `default/agents/skills/omarchy/theming.md`; rendering via `$OMARCHY_PATH/default/themed/*.tpl` |

**Reference copy of `colors.toml`** is located under `themes/rose-pine/colors.toml` in this repo.

---

## 3. Source palette (Rose Pine Dawn)

From `themes/rose-pine/colors.toml` (`omacom/omarchy@quattro`):

| Role | Hex |
|---|---|
| `mode` | `light` |
| `accent` | `#56949f` |
| `selection` | `#dfdad9` |
| `muted` | `#cecacd` |
| `background` | `#faf4ed` |
| `dark_background` | `#ede7e1` |
| `darker_background` | `#e1dbd5` |
| `lighter_background` | `#f2e9e1` |
| `foreground` | `#575279` |
| `dark_foreground` | `#9893a5` |
| `light_foreground` | `#6e6a86` |
| `bright_foreground` | `#575279` |
| `red` | `#b4637a` | `yellow` `#ea9d34` | `orange` `#cf8057` | `green` `#286983` |
| `cyan` | `#d7827e` | `blue` `#56949f` | `magenta` `#907aa9` | `brown` `#67402b` |
| `bright_red…bright_magenta` | identical to `red…magenta` |

---

## 4. Solution overview

A tool `themeswitch set` (or `omarchy-gnome-theme set rose-pine`) reads an
Omarchy `colors.toml` and translates it into GNOME's own layers:

1. **GNOME Shell** → generated `gnome-shell-theme.css`
2. **GTK3** → generated `gtk.css` (gtk-theme under `~/.themes`)
3. **GTK4 / libadwaita** → generated CSS or via `libadwaita` recolor
4. **Ghostty (terminal)** → theme file `~/.config/ghostty/themes/rose-pine.conf` + `theme` key
   (mapping per Omarchy `ghostty.conf.tpl`) — **decided 2026-09-07**; Ptyxis discarded
5. **GNOME icon theme** → selected matching icon theme
6. **Light mode** → `gsettings color-scheme = prefer-light`
7. **Wallpaper** → set Rose Pine Dawn background
8. **Cursor** → optional

Architecture (concept): `colors.toml` (source) → parser → normalized color semantics →
render backends (shell/GTK3/GTK4/terminal) → application via `gsettings`/`dconf`/file copy.

---

## 5. End state (definition of done)

When the project is complete:

- [x] `themeswitch set rose-pine` applies Rose Pine Dawn consistently to the GNOME system.
- [x] GNOME Shell uses the Dawn palette.
- [x] GTK3 and GTK4/libadwaita apps use the Dawn palette.
- [x] Ghostty uses the Dawn colors (theme file `rose-pine.conf`).
- [x] Light-dark preference is set to light.
- [x] A Rose Pine Dawn wallpaper is set as the default.
- [x] A directory standard + installable script exists (docs + setup).
- [x] The tool can be invoked via a single command and is idempotent.
- [x] README/PROJECT docs describe installation, usage and limits.

---

## 6. Success metrics

**Quantitative**

| Metric | Target |
|---|---|
| Number of GNOME layers to configure | 7 (shell, GTK3, GTK4, terminal, icons, light mode, wallpaper) complete |
| Invocability | one command, idempotent, no network at runtime (palette embedded) |
| Reproducibility | verifiable on fresh Ubuntu 26.04 GNOME in a dry run without reboot |

**Qualitative**
- No visible color mismatch between shell and libadwaita apps.
- Light preference is respected correctly.
- No manual intervention needed after the `set` command.

---

## 7. Acceptance criteria

### Feature: GNOME adapter `themeswitch`
- [x] Reads an Omarchy `colors.toml` correctly (including `mode`, fore-/backgrounds, ANSI sets).
- [x] Generates valid GNOME Shell CSS from the palette.
- [x] Generates valid GTK3 CSS from the palette.
- [x] Applies the color semantics to GTK4/libadwaita.
- [x] Missing/contentious keys are handled defensively (default or warning).

### Feature: Ghostty & system
- [x] Sets terminal colors via Ghostty theme file + `theme` key.
- [x] Sets `color-scheme = prefer-light`/`prefer-dark`.
- [x] Sets/links a wallpaper.
- [x] Icon theme setting is set.

### Feature: CLI/robustness
- [x] `themeswitch set rose-pine` idempotent (running multiple times → same result).
- [x] `--dry-run` shows what would change without changing anything.
- [x] Errors for missing programs (e.g. `gsettings`) are reported clearly.
- [x] Docs (README) complete.

---

## 8. Planned directory structure

```
rosepinetheme/
├── PROJECT.md                  # this document
├── README.md                   # quick guide
├── LICENSE                     # MIT (inspired by Omarchy)
├── themes/
│   └── rose-pine/
│       ├── colors.toml         # verified source palette (reference)
│       └── sources.txt         # origin/license/commit hash of the palette
├── src/
│   ├── cli.ts                # CLI entry (Bun): parse/render/install/apply/reset
│   ├── colors.ts             # colors.toml parser + normalization (TS)
│   ├── palette.ts            # declarative role resolution (ROLE_SOURCES → Palette)
│   ├── themes.ts             # theme resolver (colors.toml + vscode/icons/backgrounds)
│   ├── gsettings.ts          # testable gsettings wrapper (real + fake)
│   ├── paths.ts              # central XDG/HOME path resolution
│   ├── fsutil.ts             # ensureParent + backup timestamp
│   ├── managedBlock.ts       # find/validate marked CSS blocks
│   ├── cssutil.ts            # CSS validation (css-tree)
│   ├── state.ts              # snapshot of the original state (only once)
│   ├── reset.ts              # restoration from snapshot
│   └── render/
│       ├── ghostty.ts        # render/install Ghostty theme (TS)
│       ├── gtk3.ts           # render/install GTK3 gtk.css + index.theme (TS)
│       ├── gtk4.ts           # render/install libadwaita overlay (gtk-4.0/gtk.css) (TS)
│       ├── libreoffice.ts    # LO follows the system theme (Automatic, with backup) (TS)
│       ├── vscode.ts         # VS Code theme (extension + colorTheme, JSONC-safe) (TS)
│       ├── wallpaper.ts      # set wallpaper (prefers 2-dot-map, otherwise first sorted) (TS)
│       ├── shell.ts          # PaperWM top bar in Dawn (user.css block) (TS)
│       └── shellTheme.ts     # GNOME Shell theme (Yaru base + override) (TS)
├── bin/
│   └── themeswitch        # wrapper → bun src/cli.ts
└── docs/
    └── architecture.md         # color semantics & mapping tables
```

---

## 9. Technical considerations / limits

- **GTK4/libadwaita** largely ignores `gtk-theme`; the adapter must cover the
  libadwaita layer (CSS/recolor) via the `GTK_THEME`/CSS mechanism. Known
  Omarchy problem: basecamp/omarchy#7557 (cited in note).
- **Normalization:** `dark/darker/lighter_background`, `dark/light/bright_foreground`
  are Omarchy specifics; the mapping to GNOME Shell/GTK tokens must be defined and
  documented (`docs/architecture.md`).
- **Do not emulate Omarchy:** Omarchy templates such as `neovim.lua`, `vscode.json`,
  `chromium.theme` are irrelevant for GNOME and not controllable via the tool (out of scope).

**Blueprints (from note):**
- `theme-hook-plugin-manager` (thpm, OldJobobo) — GTK plugin translates `colors.toml` into
  Adwaita/GTK CSS; as a reference for the adapter.
- `themix/Oomox` — same core pattern (palette → GTK2/3/shell/icons) without Omarchy binding.

---

## 10. Risks & mitigations

| Risk | Prob. | Impact | Mitigation |
|---|---|---|---|
| libadwaita/GTK4 resists theming | High | High | Mode "GTK4 CSS/native recolor" explicit; possibly `GTK_THEME` fallback; use rose-pine/gtk as reference |
| `colors.toml` schema changes upstream | Medium | Medium | Palette embedded + `sources.txt` with commit hash; explicit update path |
| Effort for custom CSS generators underestimated | Medium | High | MVP first only shell+terms+light mode, GTK3/4 incremental; reuse thpm approach |
| Missing session rights for `gsettings` | Low | Medium | Report errors clearly; dry run beforehand |
| Color deviation server vs. GNOME contexts | Medium | Medium | Matter of doc/architecture.md mapping table + screenshot verification |

---

## 11. Alternatives considered

### Alternative 1 — Option A (install rose-pine/gtk)
- **Pro:** proven, minimal effort, official.
- **Contra:** not built from Omarchy palette semantics; foreign recolor instead of own adapter.
- **Decision:** rejected by the user on 2026-09-07 — pure Option B desired.

### Alternative 2 — Hybrid base (install A + slim B adapter)
- **Pro:** robust GTK foundation, less custom work.
- **Contra:** mixes two origin pipelines; the goal was a unified Omarchy source.
- **Decision:** deferred; can be reconsidered as a fallback for Option B in case of GTK4 problems.

---

## 12. Non-goals (v1)

- **No** installing Omarchy or the Hyprland desktop.
- **No** switching Neovim/VS Code/Chromium/btop templates (Hyprland context).
- **No** blueprint for hybrid Option A as the standard path (only fallback discussion).
- **No** fully automatic detection of all Omarchy templates beyond `colors.toml`.
- **No** multi-user/polkit/system-wide deployment (initially only the current user).

---

## 13. Open points

| Question | Status |
|---|---|
| Color mapping `colors.toml` → GNOME Shell token | to be worked out in `docs/architecture.md` |
| Terminal lever | **done** — Ghostty theme installed (`rose-pine.conf`), Ptyxis discarded (unproductive) |
| GTK4/libadwaita approach (generated CSS vs. `GTK_THEME` fallback) | to be evaluated during implementation |
| Icon theme variant (which matching Dawn icon theme) | to be chosen |
| Wallpaper source (Rose Pine Dawn assets) | to be obtained |
| Script language | **done** — TypeScript, interpreter Bun (`src/*.ts`, `bun run`) |
| Test procedure (dry run + screenshot target comparison) | to be specified |

---

## 14. References

- `omacom/omarchy` @ `quattro`: `themes/rose-pine/colors.toml`, `default/agents/skills/omarchy/theming.md`
- Brain note: `~/dokumente/brain/brain/Atlas/Dots/Things/Rose Pine Dawn auf Ubuntu GNOME.md`
- Blueprints: thpm (OldJobobo), themix/Oomox
