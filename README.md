# omarchy-theme-adapter

Apply any **Omarchy theme** as the appearance of an Ubuntu GNOME system —
from its `colors.toml` (Option B: custom GNOME adapter, **without** Omarchy/Hyprland).
Ghostty, GTK3, GTK4 and PaperWM artifacts are generated on the fly; `mode`
controls `prefer-light`/`prefer-dark`, `icons.theme` controls the icon theme.

> **Status:** functional. **Interpreter:** TypeScript + [Bun](https://bun.sh) — CLI command `themeswitch` (`./bin/themeswitch`).
> See [PROJECT.md](./PROJECT.md) for the project concept and [docs/architecture.md](./docs/architecture.md).

## Prerequisites
- [Bun](https://bun.sh) ≥ 1 (interpreter)
- Ubuntu 26.04 / GNOME

## Usage
```bash
bun install                        # Dev dependencies (@types/bun, css-tree)
./bin/themeswitch themes                          # available Omarchy themes
./bin/themeswitch set rose-pine --dry-run         # preview for a theme
./bin/themeswitch set catppuccin-latte            # apply theme fully
./bin/themeswitch set tokyo-night                 # … including dark themes (mode=dark)
./bin/themeswitch reset --dry-run                 # preview the restore
./bin/themeswitch reset                           # restore original state from snapshot
```

## Sources & corrections
- Omarchy: [`omacom/omarchy`](https://github.com/omacom/omarchy) @ `quattro` (not `basecamp/omarchy`).
- Themes under [`themes/<id>/`](./themes): each with `colors.toml` (required) + optional `vscode.json`, `icons.theme`, `backgrounds/`.

## License
MIT (inspired by Omarchy).
