# Architektur: `colors.toml` → GNOME

Stand: 2026-09-07 · Status: Entwurf (MVP)

Dieses Dokument definiert, wie die Omarchy-Farbsemantik (`colors.toml`) auf die
GNOME-eigenen Schichten abgebildet wird. Es ist die Referenz für Parser, Render-Backends
und die Anwendung via `gsettings`/`dconf`.

## 1. Paletten-Schema von Omarchy (rose-pine)

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

> Hinweis: `orange` ist die Øle-Palette-Erweiterung von Omarchy; klassische ANSI kennt
> kein Orange. Verwendung: als Akzent-/Highlight-Farbe.

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

Umsetzung: eigenes **GNOME-Shell-Theme-CSS** (`gnome-shell-theme.css`) unter
`~/.local/share/themes/<name>/gnome-shell/`. GNOME-Shell-Theme selbst liegt in
`/usr/share/gnome-shell/theme/gnome-shell-theme.gresource`; der verlässliche Weg ist ein
**User-Theme** (Shell-Extension „User Themes") oder das `GTK_THEME`-Feld. *Status: MVP
liefert Basistoken; vollständiger Shell-Recolor später.*

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

Umsetzung: `src/render/gtk3.ts` erzeugt das GTK3-Theme unter `~/.themes/RosePineDawn/gtk-3.0/gtk.css`
(plus `index.theme`) und setzt `gsettings gtk-theme = RosePineDawn` (Dry-run unterstützt).
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

### 3.4 Terminal: Ghostty (gewähltes Ziel, 2026-09-07)
> Ptyxis/GNOME-Terminal-Profil verworfen: auf diesem System ist **Ghostty** das aktive
> Terminal und Ptyxis produktiv ungenutzt.

Ghostty themen via **Theme-Datei** `~/.config/ghostty/themes/rose-pine-dawn.conf` + `theme = rose-pine-dawn.conf` in der config.
**Wichtig:** Ghostty listet User-Themes MIT Endung (`rose-pine-dawn.conf (user)`); die `theme`-Referenz
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

Umsetzung: `src/render/ghostty.ts` rendert das Theme; CLI `rosepine-gnome install ghostty`
schreibt `~/.config/ghostty/themes/rose-pine-dawn.conf` und setzt die `theme`-Zeile auf exakt
`theme = rose-pine-dawn.conf` (Config-Backup automatisch). Vor dem ersten Eingriff sichert
`src/state.ts` den Originalzustand nach `~/.local/state/rosepine-gnome/state.json`;
`rosepine-gnome reset [--dry-run]` stellt ihn wieder her (keine geratenen Defaults).
Render-Adresse/Indexreihenfolge folgt 1:1 dem Omarchy-Template, damit die Farben identisch zur
Omarchy-Optik sind. **Interpreter: TypeScript via Bun.**

### 3.5 LibreOffice
LibreOffice zeichnet Symbolleisten & Co. über eigene Anwendungsfarben, nicht über GTK.
Stand das Profil auf einem festen Schema (`CurrentColorScheme=LibreOffice`), ignorierte es
das System-Theme. Umsetzung: `src/render/libreoffice.ts` setzt `CurrentColorScheme=Automatic`
in `registrymodifications.xcu` (mit Backup) — **nur bei beendetem LibreOffice**
(LO schreibt die Config beim Beenden zurück). Vollständige Dawn-Anwendungsfarben als eigenes
LO-Schema sind ein möglicher Folgeschritt.

### 3.6 Icons & Wallpaper
| Element | Quelle |
|---|---|
| Icon-Theme | passendes Dawn-kompatibles Icon-Theme (auszuwählen, offen) |
| Wallpaper | Rose-Pine-Dawn-Bild/Asset (zu beschaffen, offen) |

`gsettings set org.gnome.desktop.interface icon-theme ...`
`gsettings set org.gnome.desktop.background picture-uri ...`

## 4. Anwendungskette (Pipeline)

```
colors.toml ─▶ Parser (src/lib-colors.sh) ─▶ normalisierte VAR_* Semantik
                 │
                 ├─▶ Render GTK3     → ~/.themes/<name>/gtk-3.0/gtk.css
                 ├─▶ Render GTK4/lib → CSS-Fragment / GTK_THEME
                 ├─▶ Render Shell    → gnome-shell CSS-Fragment
                 ├─▶ Terminal        → dconf-Profil (uuid)
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