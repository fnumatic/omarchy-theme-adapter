# Architecture: `colors.toml` → GNOME

Version: 2026-09-07 · Status: draft (MVP)

This document defines how the Omarchy color semantics (`colors.toml`) are mapped
to GNOME's own layers. It is the reference for the parser, render backends
and the application via `gsettings`/`dconf`.

## 1. Palette schema: Omarchy keys + Rose Pine roles

Every theme under `themes/<id>/` consists of:

- `colors.toml` (required, Omarchy keys — always wins)
- `extended.toml` (optional, full 15 Rose Pine roles — only fills gaps)

| Category | Keys |
|---|---|
| Mode | `mode` (`light`/`dark`) |
| Base background | `background` |
| Background shades | `dark_background`, `darker_background`, `lighter_background` |
| Base foreground | `foreground` |
| Foreground shades | `dark_foreground`, `light_foreground`, `bright_foreground` |
| Accent | `accent` |
| Selection | `selection`, `muted` |
| ANSI | `red yellow orange green cyan blue magenta brown` + `bright_*` |
| Roles (extended) | `surface overlay subtle love gold rose pine foam iris highlight_low highlight_med highlight_high` |

> Note: `orange` is Omarchy's expansion of the Øle palette; classic ANSI does not
> know orange. Usage: as an accent/highlight color.

### Declarative resolution (`src/palette.ts`)

Renderers **never** work with raw keys, only with the `Palette` (15 roles +
`mode`/`accent`/`ansi16`). Exactly **one** table governs the resolution
(`ROLE_SOURCES`: role → candidate keys, first match wins):

- Precedence: `colors.toml` → `extended.toml` → chain (`mergeThemeColors`, colors.toml wins)
- Chains deliberately prefer the keys that renderers used until now — existing
  themes keep their look; official role values apply when keys are missing.
- Known deliberate deviation (rose-pine): `foreground` #575279 instead of the official
  `text` #464261; Omarchy `muted` #cecacd = `highlight_high` (not the role `muted`).
- Role spec: https://github.com/rose-pine/palette (usage per role).

## 2. Target normal form (internal semantics)

To supply backends robustly, `colors.toml` is translated into a neutral semantics:

```
NORMAL_BG            = background
SURFACE              = dark_background      (standard surface under bg)
SURFACE_RAISED       = lighter_background   (cards/elevation)
SURFACE_SINK         = darker_background    (pressed/inputs)
NORMAL_FG            = foreground
FG_MUTED / SECONDARY = light_foreground
FG_DISABLED          = dark_foreground
FG_BRIGHT            = bright_foreground
ACCENT               = accent
SELECTION_BG         = selection
OUTLINE/MUTED        = muted
ANSI_[0..15]         = red, yellow, green, brown, blue, magenta, cyan,
                       light_foreground, muted, bright_* (order src/colors.ts)
```

> Note: The 16-color order is defined **twice**. `parse` (src/colors.ts) uses the
> order above, while the Ghostty palette (`palette.ts`, `ANSI16_KEYS`) follows exactly
> the Omarchy template (`background, red, green, yellow, blue, magenta, cyan, foreground,
> muted, bright_*`). Both interpretations exist deliberately for their respective consumers.

## 3. Mapping `colors.toml` → GNOME layers

### 3.1 GNOME Shell (background/top bar/windows)
| GNOME element | Source |
|---|---|
| Shell background (login/overview bg) | `background` |
| Top bar/panel surface | `dark_background` (for light rather `lighter`/composited) |
| Top bar text | `foreground` |
| Accent (focus/highlight) | `accent` |
| Highlight/selection | `selection` |

Implementation: custom **GNOME Shell theme CSS** under `~/.themes/<name>Shell/gnome-shell/`
(base Yaru + recolored override, activated via the "User Themes" extension);
see `src/render/shellTheme.ts` and the findings in section 3.8.

### 3.2 GTK3
| GTK3 token | Source |
|---|---|
| `@theme_base_color` | `dark_background` |
| `@theme_bg_color` | `background` |
| `@theme_fg_color` | `foreground` |
| `@theme_selected_bg_color` | `selection` |
| `@theme_selected_fg_color` | `foreground` (light on dark selection) |
| `@theme_text_color` | `foreground` |
| `@theme_unfocused_*` | derived from `-foreground` |
| `@theme_tooltip_bg_color` | `dark_background` (surface) |
| `@theme_tooltip_fg_color` | `foreground` |

Implementation: `src/render/gtk3.ts` generates the GTK3 theme under `~/.themes/<Theme>/gtk-3.0/gtk.css`
(plus `index.theme`) and sets `gsettings gtk-theme = <Theme>` (dry run supported).

**Tooltips:** Adwaita draws tooltips dark (`rgba(0,0,0,.8)`) with white text and sets
`tooltip * { color: white }`. The global `label` recolor has the same specificity value and comes
afterwards → it overwrote the tooltip text with the dark theme foreground (dark on dark).
Therefore `renderGtk3` sets explicit `tooltip`/`tooltip.background` rules at the end and the
color names `@theme_tooltip_bg/fg_color`. This way LibreOffice (GTK3-VCL) and Electron
(Chromium reads GTK colors) also follow the theme.

**Structure:** GTK3 expects a standalone, complete theme. A thin recolor overlay
would leave windows/structural elements translucent and missing. That is why the theme imports
Adwaita, which is always built into GTK3, as its base
(`@import url("resource:///org/gtk/libgtk/theme/Adwaita/gtk-contained.css")`) and lays the
Rose Pine recolor + compaction on top — analogous to the shell theme (Yaru base) and the GTK4 overlay.
Deep override optionally as `~/.config/gtk-3.0/gtk.css`.

### 3.3 GTK4 / libadwaita
- libadwaita largely ignores `gtk-theme`; the adapter uses the official overlay mechanism:
  **`~/.config/gtk-4.0/gtk.css`** is loaded automatically by libadwaita. There the public
  libadwaita color names are set (`window_bg_color`, `headerbar_bg_color`, `accent_bg_color`,
  `card_bg_color`, `view_bg_color`, …) — this colors libadwaita apps including the Ghostty window frame.
- Implementation: `src/render/gtk4.ts` renders the overlay; `install gtk4` writes/extends
  `~/.config/gtk-4.0/gtk.css`. **Foreign gtk.css files are never overwritten** (abort with a note);
  own blocks are updated idempotently (marker). Affected apps must be restarted.
- **Tooltips:** libadwaita hardcodes background/text (dark/white) and does not know any
  tooltip color names; the overlay therefore sets `tooltip`/`tooltip.background` (surface + foreground)
  explicitly — consistent with GTK3.
- **Known limitation:** not a full theme like with GTK3, but a recolor overlay on an Adwaita base.

**Window corners (rounding):**
- Omarchy (Hyprland) sets by default `decoration.rounding = 0` (sharp corners), plus shadow/blur off
  (`default/hypr/looknfeel.lua`). Rose Pine and almost all themes do not override this → sharp corners;
  the only exception in the theme universe: `solitude` with `rounding = 6`.
- GNOME/libadwaita, by contrast, brings rounded CSD corners (~12 px). Testing confirmed that the rounding
  is controllable via GTK CSS: `window.csd, window { border-radius: 0 }` in the gtk4 overlay makes windows sharp.
- Therefore `src/render/gtk4.ts` sets `border-radius: 0` — following the Omarchy `rounding = 0` default.
- **Note:** the Mutter compositor additionally applies a "rounded clip" to windows; the CSS value affects
  CSD/GTK4 windows and was visually confirmed.

### 3.4 Terminal: Ghostty (chosen target, 2026-09-07)
> Ptyxis/GNOME Terminal profile discarded: on this system **Ghostty** is the active
> terminal and Ptyxis is unproductively unused.

Ghostty themes via a **theme file** `<config>/ghostty/themes/<theme>.conf` + `theme = <theme>.conf` in the config
(theme ID = directory name, e.g. `rose-pine.conf`).
**Important:** Ghostty lists user themes WITH the extension (`rose-pine.conf (user)`); the `theme` reference
must match the file name exactly, otherwise Ghostty reports "theme not found".
Mapping exactly from Omarchy `default/themed/ghostty.conf.tpl` (Option B):

| Ghostty key | Source |
|---|---|
| `background` | `background` |
| `foreground` | `foreground` |
| `cursor-color` | `bright_foreground` |
| `selection-background` | `selection` |
| `selection-foreground` | `foreground` |
| `palette 0..15` | `background, red, green, yellow, blue, magenta, cyan, foreground, muted, bright_red, bright_green, bright_yellow, bright_blue, bright_magenta, bright_cyan, bright_foreground` |

Implementation: `src/render/ghostty.ts` renders the theme; CLI `themeswitch install ghostty`
writes `~/.config/ghostty/themes/<theme>.conf` (theme ID = directory name, e.g.
`rose-pine.conf`) and sets the `theme` line to exactly `theme = rose-pine.conf`
(config backup automatic). Before the first modification,
`src/state.ts` saves the original state to `~/.local/state/themeswitch/state.json`;
`themeswitch reset [--dry-run]` restores it (no guessed defaults).
Render address/index order follows the Omarchy template 1:1 so that the colors are identical to the
Omarchy look. **Interpreter: TypeScript via Bun.**

### 3.5 LibreOffice
LibreOffice draws toolbars & co. via its own application colors, not via GTK.
If the profile was set to a fixed scheme (`CurrentColorScheme=LibreOffice`), it ignored
the system theme. Implementation: `src/render/libreoffice.ts` sets `CurrentColorScheme=Automatic`
in `registrymodifications.xcu` (with backup) — **only when LibreOffice is closed**
(LO writes the config back on exit). Complete Dawn application colors as a dedicated
LO scheme are a possible follow-up step.
**Warning (verified 2026-09-07):** Automatic + minimal GTK theme results in a black Writer
(known "muddled Automatic" problem). Therefore not a standard path; `reset libreoffice` restores the
fixed scheme. Omarchy itself does not theme LibreOffice at all (no LO path in the tree).

### 3.6 VS Code
Like Omarchy (`bin/omarchy-theme-set-vscode`): the theme descriptor
(`themes/rose-pine/vscode.json` = name + extension `mvllow.rose-pine`) is applied through
extension installation and `workbench.colorTheme` in `settings.json`. Edit JSONC-safely via
regex (no reformat, comments remain). Implementation: `src/render/vscode.ts`.

### 3.7 Wallpaper
Omarchy default = first of the sorted `backgrounds/` (`1-funky-shapes.webp`).
themeswitch, deviating from this, prefers `2-dot-map.webp` (Rose Pine dot map) if
present, otherwise the first sorted one; all files are located in `themes/<id>/backgrounds/`.
Implementation: `src/render/wallpaper.ts` sets `picture-uri` + `picture-uri-dark` via gsettings
(`install wallpaper [NAME]`); the URIs (via `pathToFileURL`, also for paths with spaces)
are covered by snapshot/reset.

### 3.8 GNOME Shell / PaperWM top bar
On this system PaperWM renders the top bar itself (transparent, class
`topbar-transparent-background`). Official hook point: `~/.config/paperwm/user.css`
(disable/enable the extension to activate, no logout). Implementation: `src/render/shell.ts` manages
a marked Dawn block (top bar background + text in Dawn colors); foreign content remains
untouched. Snapshot/reset: `reset shell`.

#### Shell theme findings (all verified, as of 2026-09-08)

Implementation: `src/render/shellTheme.ts` — system Yaru base read on the fly
(`/usr/share/gnome-shell/theme/Yaru/gnome-shell.css`) plus appended
theme override, activated via user themes (`install shell-theme`).

- **`!important` is allowed and necessary in shell CSS.** Yaru uses it itself
  (e.g. white workspace dots, `#f2f2f2 !important`). The "no `!important`" rule
  applies only to GTK CSS.
- **Avoid `:not()`.** St theme CSS does not reliably support `:not()` — an
  inactive rule with `:not(:checked)` was discarded completely. Pattern per
  WhiteSur-gtk-theme (`src/sass/gnome-shell/widgets-48-0/_quick-settings.scss`):
  inactive state as a **base rule with `!important`**, `:checked` sits above it —
  likewise with `!important`.
- **Quick Toggles:** Yaru colors active tiles via the system-wide
  `-st-accent-color` (Ubuntu orange). Override sets active explicitly to
  `accent` (foam) with light text (`background`), inactive to
  `lighter_background` with `foreground`; split arrow dimmed (`dark_foreground`),
  separators per state (`muted` / `background`).
- **Workspace pill:** the Activities button internally uses only `.workspace-dot`
  (active = fully scaled dot, inactive = semi-transparent). Yaru enforces white at the
  end of the stylesheet via `!important` → override with accent `!important`
  beats it (rule comes afterwards).
- **Top bar hover transparent:** `#panel .panel-button:hover/:focus/:active/:checked`
  → `background-color: transparent`, so that no differently colored pill background
  appears behind clock, pill or icons.
- **Expanded panels sharp:** `.popup-menu-content`, `.quick-settings`,
  `.osd-window`, `.calendar`, `.message-list`, `.world-clocks-button`,
  `.background-menu` → `border-radius: 0` (consistent with Omarchy `rounding = 0`).
- **Reference situation:** `rose-pine/gtk` and `omarchy-gtk-theme` (see brain note
  "Rose Pine Dawn auf Ubuntu GNOME") provide **no** GNOME Shell quick-settings
  rules — only GTK. The reliable shell template is WhiteSur (SCSS, see above).
- **Fan Control deliberately untouched** (extension error state, not a theme problem).

### 3.9 Icons
Matching Dawn-compatible icon theme (to be chosen, open). Omarchy reference:
`themes/rose-pine/icons.theme` = `Yaru-blue`.

`gsettings set org.gnome.desktop.interface icon-theme ...`
`gsettings set org.gnome.desktop.background picture-uri ...`

## 4. Application chain (pipeline)

```
colors.toml ─▶ Parser (src/colors.ts, roles via src/palette.ts) ─▶ normalized semantics
                 │
                 ├─▶ Render GTK3     → ~/.themes/<name>/gtk-3.0/gtk.css
                 ├─▶ Render GTK4/lib → CSS fragment / GTK_THEME
                 ├─▶ Render Shell    → gnome-shell CSS fragment
                 ├─▶ Terminal        → ~/.config/ghostty/themes/<theme>.conf
                 └─▶ System          → gsettings (color-scheme, icon-theme, wallpaper)
APPLY via org.gnome (gsettings/dconf) + file copy
```

All steps idempotent; `--dry-run` only outputs what would be changed.

## 5. Open domain questions (deliberately open, non-blocking for MVP)
- ANSI mapping **orange**: real X ANSI does not know orange; proposal: leave orange at cell 3
  (yellow) unassigned or use `bright_yellow`. Decision later.
- Icon theme: choice of the concrete Dawn variant.
- Wallpaper: source of the Rose Pine Dawn asset.
- Exact shell recolor scope (user themes extension vs. GTK_THEME).
