# themeswitch

Wende jedes **Omarchy-Theme** als Erscheinungsbild eines Ubuntu-GNOME-Systems an —
aus dessen `colors.toml` (Option B: eigener GNOME-Adapter, **ohne** Omarchy/Hyprland).
Ghostty-, GTK3-, GTK4- und PaperWM-Artefakte werden on-the-fly erzeugt; `mode`
steuert `prefer-light`/`prefer-dark`, `icons.theme` das Icon-Theme.

> **Status:** funktionsfähig. **Interpreter:** TypeScript + [Bun](https://bun.sh) (`./bin/themeswitch`).
> Siehe [PROJECT.md](./PROJECT.md) für das Projektkonzept und [docs/architektur.md](./docs/architektur.md).

## Voraussetzungen
- [Bun](https://bun.sh) ≥ 1 (Interpreter)
- Ubuntu 26.04 / GNOME

## Nutzung
```bash
bun install                        # Dev-Abhängigkeiten (@types/bun, css-tree)
./bin/themeswitch themes                          # verfügbare Omarchy-Themes
./bin/themeswitch set rose-pine --dry-run         # Vorschau für ein Theme
./bin/themeswitch set catppuccin-latte            # Theme vollständig anwenden
./bin/themeswitch set tokyo-night                 # … auch dunkle Themes (mode=dark)
./bin/themeswitch reset --dry-run                 # Vorschau der Wiederherstellung
./bin/themeswitch reset                           # Originalzustand aus Snapshot wiederherstellen
```

## Quellen & Korrektur
- Omarchy: [`omacom/omarchy`](https://github.com/omacom/omarchy) @ `quattro` (nicht `basecamp/omarchy`).
- Themes unter [`themes/<id>/`](./themes): je `colors.toml` (Pflicht) + optionale `vscode.json`, `icons.theme`, `backgrounds/`.
- Brain-Notiz: `~/dokumente/brain/brain/Atlas/Dots/Things/Rose Pine Dawn auf Ubuntu GNOME.md`

## Lizenz
MIT (in Anlehnung an Omarchy).