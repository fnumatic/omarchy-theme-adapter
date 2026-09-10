# Projekt: Rose Pine Dawn als GNOME-Theme auf Ubuntu 26.04

**Status:** umgesetzt (v1, funktionsfähig)
**Datum:** 2026-09-07
**Zielversion:** Ubuntu 26.04.1 LTS („Resolute Raccoon"), GNOME (ubuntu-Session)
**Verwandte Notiz:** `~/dokumente/brain/.../Rose Pine Dawn auf Ubuntu GNOME.md`

---

## 1. Problem

### Was wird gelöst?
Das Omarchy-Theme „Rose Pine" (helle *Dawn*-Variante) soll als Erscheinungsbild
eines **Ubuntu-26.04-GNOME**-Systems nachgebaut werden — **ohne Omarchy** (Hyprland-
Desktop) zu installieren, und **ohne** ein fertiges GTK-Theme von Drittanbietern zu
verwenden.

**Warum reine Option B?** (Entscheidung des Nutzers, 2026-09-07)
Statt die offizielle `rose-pine/gtk`-Implementierung (Option A) zu installieren, soll
das **Omarchy-Theme-System** (Palette → Templates) als Quelle dienen und über einen
**eigenen GNOME-Adapter** in die GNOME-eigenen Schichten übersetzt werden. Der Weg bleibt
damit nahe am Omarchy-Konzept und reproduziert die Optik aus der Originalsemantik des
`colors.toml` statt aus einem fremden Recolor.

### Warum jetzt?
- Es gibt keine fertige 1:1-Lösung „Omarchy-Thema auf GNOME".
- Die genaue Quellpalette ist jetzt verifiziert (`omacom/omarchy`, Branch `quattro`).
- Das Zielsystem (dieser Rechner) ist vorhanden und direkt testbar.

### Wer ist betroffen?
- **Primär:** der Besitzer dieses Systems, das einen konsistenten Rose-Pine-Dawn-Look möchte.
- **Sekundär:** jede Person, die das Repo später auf einem Ubuntu-26.04-GNOME-System wiederverwenden will.

---

## 2. Verifizierte Quellen (Korrekturen zur Brain-Notiz)

| Thema | Brain-Notiz | Verifiziert (2026-09-07) |
|---|---|---|
| Omarchy-Repo | `basecamp/omarchy` | **`omacom/omarchy`** (Branch `quattro`, von DHH) — `basecamp/` ist ein Placeholder/Zugriffspfad, nicht das Primär-Repo |
| Quellpalette | „noch nicht beschafft" | vorhanden als **`themes/rose-pine/colors.toml`** im Omarchy-Repo |
| Variante | Dawn (hell) | bestätigt: Stock-Theme ist `mode = "light"` mit `background = "#faf4ed"` (Rose-Pine-Dawn) |
| Template-Mechanik | „`colors.toml` → Templates" | bestätigt via `default/agents/skills/omarchy/theming.md`; Rendering über `$OMARCHY_PATH/default/themed/*.tpl` |

**Referenzkopie des `colors.toml`** liegt unter `themes/rose-pine/colors.toml` in diesem Repo.

---

## 3. Quell-Palette (Rose Pine Dawn)

Aus `themes/rose-pine/colors.toml` (`omacom/omarchy@quattro`):

| Rolle | Hex |
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
| `bright_red…bright_magenta` | identisch zu `red…magenta` |

---

## 4. Lösungsüberblick

Ein Werkzeug `themeswitch set` (bzw. `omarchy-gnome-theme set rose-pine`) liest ein
Omarchy-`colors.toml` und übersetzt es in die GNOME-eigenen Schichten:

1. **GNOME Shell** → generiertes `gnome-shell-theme.css`
2. **GTK3** → generiertes `gtk.css` (gtk-theme unter `~/.themes`)
3. **GTK4 / libadwaita** → generiertes CSS bzw. via `libadwaita`-Recolor
4. **Ghostty (Terminal)** → Theme-Datei `~/.config/ghostty/themes/rose-pine.conf` + `theme`-Key
   (Mapping nach Omarchy `ghostty.conf.tpl`) — **entschieden 2026-09-07**; Ptyxis verworfen
5. **GNOME Icon-Theme** → ausgewähltes passendes Icon-Theme
6. **Light Mode** → `gsettings color-scheme = prefer-light`
7. **Wallpaper** → Rose-Pine-Dawn-Hintergrund setzen
8. **Cursor** → optional

Architektur (Konzept): `colors.toml` (Quelle) → Parser → normierte Farbsemantik →
Render-Backends (Shell/GTK3/GTK4/Terminal) → Anwendung via `gsettings`/`dconf`/Dateikopie.

---

## 5. End State (Definition of Done)

Wenn das Projekt abgeschlossen ist:

- [x] `themeswitch set rose-pine` wendet Rose Pine Dawn konsistent auf das GNOME-System an.
- [x] GNOME Shell verwendet die Dawn-Palette.
- [x] GTK3- und GTK4/libadwaita-Apps verwenden die Dawn-Palette.
- [x] Ghostty nutzt die Dawn-Farben (Theme-Datei `rose-pine.conf`).
- [x] Light-Dark-Präferenz steht auf Light.
- [x] Ein Rose-Pine-Dawn-Wallpaper ist als Standard gesetzt.
- [x] Es existiert ein Verzeichnis-Standard + installierbares Script (Doku + Setup).
- [x] Das Tool ist über ein einzelnes Kommando aufrufbar und idempotent.
- [x] README/PROJECT-Doku beschreibt Installation, Nutzung und Limits.

---

## 6. Erfolgsmetriken

**Quantitativ**

| Metrik | Ziel |
|---|---|
| Anzahl zu konfigurierender GNOME-Schichten | 7 (Shell, GTK3, GTK4, Terminal, Icons, Light-Mode, Wallpaper) vollständig |
| Aufrufbarkeit | ein Kommando, idempotent, ohne Netz zur Laufzeit (Palette eingebettet) |
| Wiederholbarkeit | auf frischem Ubuntu-26.04-GNOME im Dry-run ohne Reboot verifizierbar |

**Qualitativ**
- Kein sichtbarer Farbmismatch zwischen Shell und libadwaita-Apps.
- Hell/Licht-Präferenz wird korrekt respektiert.
- Keine manuellen Eingriffe nach dem `set`-Kommando nötig.

---

## 7. Akzeptanzkriterien

### Feature: GNOME-Adapter `themeswitch`
- [x] Liesst ein Omarchy-`colors.toml` korrekt (inkl. `mode`, Fore-/Backgrounds, ANSI-Sets).
- [x] Generiert gültiges GNOME-Shell-CSS aus der Palette.
- [x] Generiert gültiges GTK3-CSS aus der Palette.
- [x] Wendet die Farbsemantik auf GTK4/libadwaita an.
- [x] Fehlende/strittige Keys werden defensiv behandelt (Default oder Warnung).

### Feature: Ghostty & System
- [x] Setzt Terminal-Farben via Ghostty-Theme-Datei + `theme`-Key.
- [x] Setzt `color-scheme = prefer-light`/`prefer-dark`.
- [x] Setzt/verlinkt ein Wallpaper.
- [x] Icon-Theme-Einstellung ist gesetzt.

### Feature: CLI/Robustheit
- [x] `themeswitch set rose-pine` idempotent (mehrfach laufen → gleiches Ergebnis).
- [x] `--dry-run` zeigt, was geändert würde, ohne zu ändern.
- [x] Fehler bei fehlenden Programmen (z. B. `gsettings`) werden klar gemeldet.
- [x] Doku (README) vollständig.

---

## 8. Geplante Verzeichnisstruktur

```
rosepinetheme/
├── PROJECT.md                  # dieses Dokument
├── README.md                   # Kurzanleitung
├── LICENSE                     # MIT (Orientierung an Omarchy)
├── themes/
│   └── rose-pine/
│       ├── colors.toml         # verifizierte Quellpalette (Referenz)
│       └── sources.txt         # Herkunft/Lizenz/Kommitsh der Palette
├── src/
│   ├── cli.ts                # CLI-Einstieg (Bun): parse/render/install/apply/reset
│   ├── colors.ts             # colors.toml-Parser + Normalisierung (TS)
│   ├── gsettings.ts          # testbarer gsettings-Wrapper (real + fake)
│   ├── state.ts              # Snapshot des Originalzustands (nur einmal)
│   ├── reset.ts              # Wiederherstellung aus Snapshot
│   └── render/
│       ├── ghostty.ts        # Ghostty-Theme rendern/installieren (TS)
│       ├── gtk3.ts           # GTK3 gtk.css + index.theme rendern/installieren (TS)
│       └── gtk4.ts           # libadwaita-Overlay (gtk-4.0/gtk.css) rendern/installieren (TS)
│       └── libreoffice.ts    # LO folgt dem System-Theme (Automatic, mit Backup) (TS)
│       └── vscode.ts         # VS-Code-Theme (Extension + colorTheme, JSONC-sicher) (TS)
│       └── wallpaper.ts      # Wallpaper setzen (Omarchy-Default 1-funky-shapes) (TS)
│       └── shell.ts          # PaperWM-Topbar in Dawn (user.css-Block) (TS)
├── bin/
│   └── themeswitch        # Wrapper → bun src/cli.ts
└── docs/
    └── architektur.md          # Farb-Semanik & Mapping-Tabellen
```

---

## 9. Technische Überlegungen / Limits

- **GTK4/libadwaita** ignoriert `gtk-theme` weitgehend; der Adapter muss die
  libadwaita-Schicht (CSS/Recolor) über den `GTK_THEME`/CSS-Mechanismus abdecken. Bekannte
  Omarchy-Problemlage: basecamp/omarchy#7557 (in Notiz zitiert).
- **Normierung:** `dark/darker/lighter_background`, `dark/light/bright_foreground`
  sind Omarchy-Spezifika; das Mapping auf GNOME-Shell/GTK-Token muss definiert und
  dokumentiert werden (`docs/architektur.md`).
- **Nicht Omarchy blenden:** Omarchy-Templates wie `neovim.lua`, `vscode.json`,
  `chromium.theme` sind für GNOME egal und über das Tool nicht anzusteuern (Out-of-Scope).

**Blaupausen (aus Notiz):**
- `theme-hook-plugin-manager` (thpm, OldJobobo) — GTK-Plugin übersetzt `colors.toml` in
  Adwaita/GTK-CSS; als Referenz für den Adapter.
- `themix/Oomox` — gleiches Kernmuster (Palette → GTK2/3/Shell/Icons) ohne Omarchy-Bindung.

---

## 10. Risiken & Abmilderungen

| Risiko | Wahrsch. | Impact | Abmilderung |
|---|---|---|---|
| libadwaita/GTK4 widersetzt sich theming | Hoch | Hoch | Modus „GTK4-CSS/native Recolor" explizit; ggf. `GTK_THEME`-Fallback; Referenz rose-pine/gtk nutzen |
| `colors.toml`-Schema ändert sich upstream | Mittel | Mittel | Palette eingebettet + `sources.txt` mit Kommitsh; expliziter Update-Weg |
| Aufwand für eigene CSS-Generatoren unterschätzt | Mittel | Hoch | MVP zuerst nur Shell+Terms+LightMode, GTK3/4 inkrementell; Wiederverwendung thpm-Ansatz |
| Fehlende Session-Rechte bei `gsettings` | Niedrig | Mittel | Fehler klar melden; Dry-run vorab |
| Farbabweichung Server vs. GNOME-Kontexte | Mittel | Mittel | Matter of doc/architektur.md Mapping-Tabelle + Screenshot-Verifikation |

---

## 11. Betrachtete Alternativen

### Alternative 1 — Option A (rose-pine/gtk installieren)
- **Pro:** erprobt, minimaler Aufwand, offiziell.
- **Contra:** nicht aus Omarchy-Palettesemantik gebaut; fremdes Recolor statt eigener Adapter.
- **Entscheidung:** vom Nutzer 2026-09-07 abgelehnt — reine Option B gewünscht.

### Alternative 2 — Hybride Basis (A installieren + schlanker B-Adapter)
- **Pro:** robustes GTK-Fundament, weniger Eigenbau.
- **Contra:** vermischt zwei Herkunfts-Pipelines; Ziel war einheitliche Omarchy-Quelle.
- **Entscheidung:** zurückgestellt; kann bei GTK4-Problemen in Option B als Fallback wieder
  in Betracht gezogen werden.

---

## 12. Non-Goals (v1)

- **Kein** Installieren von Omarchy bzw. Hyprland-Desktop.
- **Kein** Umstellung von Neovim/VS Code/Chromium/btop-Templates (Hyprland-Kontext).
- **Kein** Bauplan für hybride Option A als Standardweg (nur Fallback-Diskussion).
- **Kein** vollautomatisches Erkennen aller Omarchy-Templates über `colors.toml` hinaus.
- **Kein** Multi-User-/Polkit-/Systemweites Deployment (zunächst nur der aktuelle Nutzer).

---

## 13. Offene Punkte

| Frage | Status |
|---|---|
| Farb-Mapping `colors.toml` → GNOME-Shell-Token | zu erarbeiten in `docs/architektur.md` |
| Terminal-Hebel | **erledigt** — Ghostty-Theme installiert (`rose-pine.conf`), Ptyxis verworfen (unproduktiv) |
| GTK4/libadwaita-Ansatz (generierte CSS vs. `GTK_THEME`-Fallback) | zu evaluieren in Umsetzung |
| Icon-Theme-Variante (welches passende Dawn-Icon-Theme) | zu wählen |
| Wallpaper-Quelle (Rose-Pine-Dawn-Assets) | zu beschaffen |
| Script-Sprache | **erledigt** — TypeScript, Interpreter Bun (`src/*.ts`, `bun run`) |
| Testverfahren (Dry-run + Screenshot-Soll-Vergleich) | zu konkretisieren |

---

## 14. Referenzen

- `omacom/omarchy` @ `quattro`: `themes/rose-pine/colors.toml`, `default/agents/skills/omarchy/theming.md`
- Brain-Notiz: `~/dokumente/brain/brain/Atlas/Dots/Things/Rose Pine Dawn auf Ubuntu GNOME.md`
- Blaupausen: thpm (OldJobobo), themix/Oomox