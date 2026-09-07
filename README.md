# rosepinetheme

Rose Pine Dawn als Erscheinungsbild eines Ubuntu-26.04-GNOME-Systems nachbauen —
aus dem Omarchy-`colors.toml` (Option B: eigener GNOME-Adapter, **ohne** Omarchy/Hyprland).

> **Status:** Umsetzung läuft. **Interpreter:** TypeScript + [Bun](https://bun.sh) (`bun run` bzw. `./bin/rosepine-gnome`).
> Siehe [PROJECT.md](./PROJECT.md) für das Projektkonzept und [docs/architektur.md](./docs/architektur.md).

## Voraussetzungen
- [Bun](https://bun.sh) ≥ 1 (Interpreter)
- Ubuntu 26.04 / GNOME

## Nutzung
```bash
bun install                        # @types/bun (Dev)
./bin/rosepine-gnome --help
./bin/rosepine-gnome parse
./bin/rosepine-gnome render ghostty
./bin/rosepine-gnome install ghostty --dry-run   # Vorschau
./bin/rosepine-gnome install ghostty             # anwenden (mit Config-Backup + Snapshot)
./bin/rosepine-gnome apply --dry-run             # System-Light-Schema (Vorschau, ändert nichts)
./bin/rosepine-gnome install gtk4 --dry-run             # Vorschau libadwaita-Overlay
./bin/rosepine-gnome install gtk4                       # libadwaita-Overlay (Fensterrahmen) anwenden
./bin/rosepine-gnome install libreoffice [--dry-run]  # LO folgt dem System-Theme (nur bei beendetem LO)
./bin/rosepine-gnome install vscode [--dry-run]   # Rose-Pine-Dawn-Theme in VS Code (Extension + colorTheme)
./bin/rosepine-gnome reset --dry-run             # Vorschau der Wiederherstellung
./bin/rosepine-gnome reset                       # Originalzustand aus Snapshot wiederherstellen
```

## Quellen & Korrektur
- Omarchy: [`omacom/omarchy`](https://github.com/omacom/omarchy) @ `quattro` (nicht `basecamp/omarchy`).
- Quellpalette: [`themes/rose-pine/colors.toml`](./themes/rose-pine/colors.toml)
- Brain-Notiz: `~/dokumente/brain/brain/Atlas/Dots/Things/Rose Pine Dawn auf Ubuntu GNOME.md`

## Lizenz
MIT (in Anlehnung an Omarchy).