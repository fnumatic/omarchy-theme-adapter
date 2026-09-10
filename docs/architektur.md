# Architektur: `colors.toml` → GNOME

Stand: 2026-09-07 · Status: Entwurf (MVP)

Dieses Dokument definiert, wie die Omarchy-Farbsemantik (`colors.toml`) auf die
GNOME-eigenen Schichten abgebildet wird. Es ist die Referenz für Parser, Render-Backends
und die Anwendung via `gsettings`/`dconf`.

## 1. Paletten-Schema: Omarchy-Keys + Rose-Pine-Rollen

Jedes Theme unter `themes/<id>/` besteht aus:

- `colors.toml` (Pflicht, Omarchy-Keys — gewinnt immer)
- `extended.toml` (optional, volle 15 Rose-Pine-Rollen — füllt nur Lücken)

| Kategorie | Keys |
|---|---|
| Modus | `mode` (`light`/`dark`) |
| Basishintergrund | `background` |
| Hintergrundabstufungen | `dark_background`, `darker_background`, `lighter_background` |
| Basisvordergrund | `foreground` |
| Vordergrundabstufungen | `dark_foreground`, `light_foreground`, `bright_foreground` |
| Akzent | `accent` |
| Auswahl | `selection`, `muted` |
| ANSI | `red yellow orange green cyan blue magenta brown` + `bright_*` |
| Rollen (extended) | `surface overlay subtle love gold rose pine foam iris highlight_low highlight_med highlight_high` |

> Hinweis: `orange` ist die Øle-Palette-Erweiterung von Omarchy; klassische ANSI kennt
> kein Orange. Verwendung: als Akzent-/Highlight-Farbe.

### Deklarative Auflösung (`src/palette.ts`)

Renderer arbeiten **nie** mit Roh-Keys, sondern nur mit der `Palette` (15 Rollen +
`mode`/`accent`/`ansi16`). Genau **eine** Tabelle regelt die Auflösung
(`ROLE_SOURCES`: Rolle → Kandidaten-Keys, erster Treffer gewinnt):

- Vorrang: `colors.toml` → `extended.toml` → Kette (`mergeThemeColors`, colors.toml gewinnt)
- Ketten bevorzugen bewusst die Keys, die Renderer bisher nutzten — bestehende
  Themes behalten ihr Aussehen; offizielle Rollenwerte greifen bei fehlenden Keys.
- Bekannte bewusste Abweichung (rose-pine): `foreground` #575279 statt offiziellem
  `text` #464261; Omarchy-`muted` #cecacd = `highlight_high` (nicht Rollen-`muted`).
- Rollen-Spec: https://github.com/rose-pine/palette (Verwendung je Rolle).

## 2. Ziel-Normalform (interne Semantik)

Um Backends robust zu versorgen, wird `colors.toml` in eine neutrale Semantik übersetzt:

```
NORMAL_BG            = background
SURFACE              = dark_background      (Standard-Fläche unter bg)
SURFACE_RAISED       = lighter_background   (Karten/Elevation)
SURFACE_SINK         = darker_background    (gedrückt/Eingaben)
NORMAL_FG            = foreground
FG_MUTED / SECONDARY = light_foreground
FG_DISABLED          = dark_foreground
FG_BRIGHT            = bright_foreground
ACCENT               = accent
SELECTION_BG         = selection
OUTLINE/MUTED        = muted
ANSI_[0..15]         = red..magenta + bright_*
```

## 3. Mapping `colors.toml` → GNOME-Schichten

### 3.1 GNOME Shell (Hintergrund/Topbar/Fenster)
| GNOME-Element | Quelle |
|---|---|
| Shell-Hintergrund (Login/Overview-Bg) | `background` |
| Topbar-/Panelfläche | `dark_background` (bei light eher `lighter`/kompositiert) |
| Topbar-Schrift | `foreground` |
| Akzent (Fokus/Hervorhebung) | `accent` |
| Auszeichnung/Selection | `selection` |

Umsetzung: eigenes **GNOME-Shell-Theme-CSS** unter `~/.themes/<name>Shell/gnome-shell/`
(Basis Yaru + rekolorierter Override, aktiviert über die Extension „User Themes");
siehe `src/render/shellTheme.ts` und die Findings in Abschnitt 3.8.

### 3.2 GTK3
| GTK3-Token | Quelle |
|---|---|
| `@theme_base_color` | `dark_background` |
| `@theme_bg_color` | `background` |
| `@theme_fg_color` | `foreground` |
| `@theme_selected_bg_color` | `selection` |
| `@theme_selected_fg_color` | `foreground` (hell auf dunkler Selection) |
| `@theme_text_color` | `foreground` |
| `@theme_unfocused_*` | Ableitung aus `-foreground` |

Umsetzung: `src/render/gtk3.ts` erzeugt das GTK3-Theme unter `~/.themes/<Theme>/gtk-3.0/gtk.css`
(plus `index.theme`) und setzt `gsettings gtk-theme = <Theme>` (Dry-run unterstützt).

**Struktur:** GTK3 erwartet ein eigenständiges, vollständiges Theme. Ein dünnes Recolor-Overlay
würde fenster/Strukturelemente durchscheinend und fehlend lassen. Deshalb importiert das Theme als
Basis das in GTK3 immer eingebaute Adwaita
(`@import url("resource:///org/gtk/libgtk/theme/Adwaita/gtk-contained.css")`) und legt darüber den
Rose-Pine-Recolor + Kompaktierung — analog zum Shell-Theme (Yaru-Basis) und zum GTK4-Overlay.
Deep-Override optional als `~/.config/gtk-3.0/gtk.css`.

### 3.3 GTK4 / libadwaita
- libadwaita ignoriert `gtk-theme` weitgehend; der Adapter nutzt den offiziellen Overlay-Mechanismus:
  **`~/.config/gtk-4.0/gtk.css`** wird von libadwaita automatisch geladen. Dort werden die öffentlichen
  libadwaita-Farbnamen gesetzt (`window_bg_color`, `headerbar_bg_color`, `accent_bg_color`,
  `card_bg_color`, `view_bg_color`, …) — das färbt libadwaita-Apps inkl. Ghostty-Fensterrahmen.
- Umsetzung: `src/render/gtk4.ts` rendert das Overlay; `install gtk4` schreibt/erweitert
  `~/.config/gtk-4.0/gtk.css`. **Fremde gtk.css werden nie überschrieben** (Abbruch mit Hinweis);
  eigene Blöcke werden idempotent aktualisiert (Marker). Betroffene Apps müssen neu gestartet werden.
- **Bekannte Grenze:** kein Voll-Theme wie bei GTK3, sondern ein Recolor-Overlay auf Adwaita-Basis.

**Fensterecken (Rundung):**
- Omarchy (Hyprland) setzt standardmäßig `decoration.rounding = 0` (scharfe Ecken) sowie Shadow/Blur aus
  (`default/hypr/looknfeel.lua`). Rose Pine und fast alle Themes überschreiben das nicht → scharfe Ecken;
  einzige Ausnahme im Theme-Universum: `solitude` mit `rounding = 6`.
- GNOME/libadwaita bringt dagegen gerundete CSD-Ecken mit (~12 px). Per Test bestätigt, dass die Rundung
  über GTK-CSS steuerbar ist: `window.csd, window { border-radius: 0 }` im gtk4-Overlay macht Fenster scharf.
- Daher setzt `src/render/gtk4.ts` `border-radius: 0` — dem Omarchy-`rounding = 0`-Standard folgend.
- **Hinweis:** Der Mutter-Compositor legt zusätzlich einen „rounded clip" auf Fenster; der CSS-Wert wirkt auf
  CSD/GTK4-Fenster und wurde visuell bestätigt.

### 3.4 Terminal: Ghostty (gewähltes Ziel, 2026-09-07)
> Ptyxis/GNOME-Terminal-Profil verworfen: auf diesem System ist **Ghostty** das aktive
> Terminal und Ptyxis produktiv ungenutzt.

Ghostty themen via **Theme-Datei** `<config>/ghostty/themes/<theme>.conf` + `theme = <theme>.conf` in der config
(Theme-ID = Verzeichnisname, z. B. `rose-pine.conf`).
**Wichtig:** Ghostty listet User-Themes MIT Endung (`rose-pine.conf (user)`); die `theme`-Referenz
muss exakt dem Dateinamen entsprechen, sonst meldet Ghostty „theme not found".
Mapping exakt aus Omarchy `default/themed/ghostty.conf.tpl` (Option B):

| Ghostty-Key | Quelle |
|---|---|
| `background` | `background` |
| `foreground` | `foreground` |
| `cursor-color` | `bright_foreground` |
| `selection-background` | `selection` |
| `selection-foreground` | `foreground` |
| `palette 0..15` | `background, red, green, yellow, blue, magenta, cyan, foreground, muted, bright_red, bright_green, bright_yellow, bright_blue, bright_magenta, bright_cyan, bright_foreground` |

Umsetzung: `src/render/ghostty.ts` rendert das Theme; CLI `themeswitch install ghostty`
schreibt `~/.config/ghostty/themes/<theme>.conf` (Theme-ID = Verzeichnisname, z. B.
`rose-pine.conf`) und setzt die `theme`-Zeile auf exakt `theme = rose-pine.conf`
(Config-Backup automatisch). Vor dem ersten Eingriff sichert
`src/state.ts` den Originalzustand nach `~/.local/state/themeswitch/state.json`;
`themeswitch reset [--dry-run]` stellt ihn wieder her (keine geratenen Defaults).
Render-Adresse/Indexreihenfolge folgt 1:1 dem Omarchy-Template, damit die Farben identisch zur
Omarchy-Optik sind. **Interpreter: TypeScript via Bun.**

### 3.5 LibreOffice
LibreOffice zeichnet Symbolleisten & Co. über eigene Anwendungsfarben, nicht über GTK.
Stand das Profil auf einem festen Schema (`CurrentColorScheme=LibreOffice`), ignorierte es
das System-Theme. Umsetzung: `src/render/libreoffice.ts` setzt `CurrentColorScheme=Automatic`
in `registrymodifications.xcu` (mit Backup) — **nur bei beendetem LibreOffice**
(LO schreibt die Config beim Beenden zurück). Vollständige Dawn-Anwendungsfarben als eigenes
LO-Schema sind ein möglicher Folgeschritt.
**Warnung (verifiziert 2026-09-07):** Automatic + minimales GTK-Theme ergibt schwarzen Writer
(bekanntes „muddled Automatic"-Problem). Daher kein Standardweg; `reset libreoffice` stellt das
feste Schema wieder her. Omarchy selbst themt LibreOffice gar nicht (kein LO-Pfad im Tree).

### 3.6 VS Code
Wie Omarchy (`bin/omarchy-theme-set-vscode`): Der Theme-Deskriptor
(`themes/rose-pine/vscode.json` = Name + Extension `mvllow.rose-pine`) wird umgesetzt durch
Extension-Installation und `workbench.colorTheme` in `settings.json`. Edit JSONC-sicher per
Regex (kein Reformat, Kommentare bleiben). Umsetzung: `src/render/vscode.ts`.

### 3.7 Wallpaper
Omarchy-Default = erstes der sortierten `backgrounds/` = `1-funky-shapes.webp`
(alle vier Dateien liegen in `themes/rose-pine/backgrounds/`).
Umsetzung: `src/render/wallpaper.ts` setzt `picture-uri` + `picture-uri-dark` per gsettings
(`install wallpaper [NAME]`); URIs sind snapshot-/reset-abgedeckt.

### 3.8 GNOME Shell / PaperWM-Topbar
Auf diesem System rendert PaperWM die Top-Bar selbst (transparent, Klasse
`topbar-transparent-background`). Offizieller Eingriffspunkt: `~/.config/paperwm/user.css`
(Extension aus/ein zum Aktivieren, kein Logout). Umsetzung: `src/render/shell.ts` verwaltet
einen markierten Dawn-Block (Topbar-Hintergrund + Schrift in Dawn-Farben); Fremdinhalt bleibt
unangetastet. Snapshot/Reset: `reset shell`.

#### Shell-Theme-Findings (alle verifiziert, Stand 2026-09-08)

Umsetzung: `src/render/shellTheme.ts` — System-Yaru-Basis on-the-fly gelesen
(`/usr/share/gnome-shell/theme/Yaru/gnome-shell.css`) plus angehängter
Theme-Override, aktiviert über User-Themes (`install shell-theme`).

- **`!important` ist im Shell-CSS zulässig und nötig.** Yaru nutzt es selbst
  (z. B. weiße Workspace-Dots, `#f2f2f2 !important`). Die „kein `!important`"-Regel
  gilt nur für GTK-CSS.
- **`:not()` meiden.** St-Theme-CSS unterstützt `:not()` nicht zuverlässig — eine
  Inaktiv-Regel mit `:not(:checked)` wurde komplett verworfen. Muster nach
  WhiteSur-gtk-theme (`src/sass/gnome-shell/widgets-48-0/_quick-settings.scss`):
  Inaktiv-Zustand als **Basisregel mit `!important`**, `:checked` liegt darüber —
  ebenfalls mit `!important`.
- **Quick Toggles:** Yaru färbt aktive Kacheln über den systemweiten
  `-st-accent-color` (Ubuntu-Orange). Override setzt aktiv explizit auf
  `accent` (Foam) mit hellem Text (`background`), inaktiv auf
  `lighter_background` mit `foreground`; Split-Pfeil gedämpft (`dark_foreground`),
  Trenner je Zustand (`muted` / `background`).
- **Workspace-Pill:** Der Activities-Button nutzt intern nur `.workspace-dot`
  (aktiv = vollskaliertes Dot, inaktiv = halbtransparent). Yaru erzwingt am
  Stylesheet-Ende weiß per `!important` → Override mit Accent-`!important`
  schlägt es (Regel liegt danach).
- **Topbar-Hover transparent:** `#panel .panel-button:hover/:focus/:active/:checked`
  → `background-color: transparent`, damit kein andersfarbiger Pill-Hintergrund
  hinter Uhr, Pill oder Icons erscheint.
- **Aufgeklappte Panels scharf:** `.popup-menu-content`, `.quick-settings`,
  `.osd-window`, `.calendar`, `.message-list`, `.world-clocks-button`,
  `.background-menu` → `border-radius: 0` (konsistent zu Omarchy-`rounding = 0`).
- **Referenzlage:** `rose-pine/gtk` und `omarchy-gtk-theme` (siehe Brain-Notiz
  „Rose Pine Dawn auf Ubuntu GNOME") liefern **keine** GNOME-Shell-Quick-Settings-
  Regeln — nur GTK. Belastbare Shell-Vorlage ist WhiteSur (SCSS, siehe oben).
- **Fan Control bewusst unangetastet** (Extension-Fehlerzustand, kein Theme-Problem).

### 3.9 Icons
Passendes Dawn-kompatibles Icon-Theme (auszuwählen, offen). Omarchy-Referenz:
`themes/rose-pine/icons.theme` = `Yaru-blue`.

`gsettings set org.gnome.desktop.interface icon-theme ...`
`gsettings set org.gnome.desktop.background picture-uri ...`

## 4. Anwendungskette (Pipeline)

```
colors.toml ─▶ Parser (src/colors.ts, Rollen via src/palette.ts) ─▶ normalisierte Semantik
                 │
                 ├─▶ Render GTK3     → ~/.themes/<name>/gtk-3.0/gtk.css
                 ├─▶ Render GTK4/lib → CSS-Fragment / GTK_THEME
                 ├─▶ Render Shell    → gnome-shell CSS-Fragment
                 ├─▶ Terminal        → ~/.config/ghostty/themes/<theme>.conf
                 └─▶ System          → gsettings (color-scheme, icon-theme, wallpaper)
APPLY via org.gnome (gsettings/dconf) + Dateikopie
```

Alle Schritte idempotent; `--dry-run` gibt nur aus, was geändert würde.

## 5. Offene Fachfragen (bewusst offen, nicht blockierend für MVP)
- ANSI-Mapping **orange**: echte X-Ansi kennt kein Orange; Proposal: orange auf Zelle 3
  (yellow) unbelegt lassen oder `bright_yellow`. Entscheidung später.
- Icon-Theme: Wahl der konkreten Dawn-Variante.
- Wallpaper: Quelle des Rose-Pine-Dawn-Assets.
- Exakter Shell-Recolor-Umfang (User-Themes-Extension vs. GTK_THEME).