#!/usr/bin/env bash
# render-ghostty.sh — rendert ein Ghostty-Theme aus der geparsten colors.toml.
# Einhängen: source; erwartet _C_* Variablen von colors_parse gesetzt.
# Logik (Option B): spiegelt omarchy default/themed/ghostty.conf.tpl.

GHOSTTY_THEME_NAME="rose-pine-dawn"

# render_ghostty: gibt ein gültiges Ghostty .conf-Theme auf stdout aus.
render_ghostty() {
  printf 'background = %s\n' "$_C_background"
  printf 'foreground = %s\n' "$_C_foreground"
  printf 'cursor-color = %s\n' "${_C_bright_foreground:-$_C_foreground}"
  printf 'selection-background = %s\n' "${_C_selection}"
  printf 'selection-foreground = %s\n' "${_C_foreground}"

  # Reihenfolge/Palette-Index exakt wie im Omarchy-tpl
  local i idx key name val
  for i in \
    0=background 1=red 2=green 3=yellow 4=blue 5=magenta 6=cyan 7=foreground \
    8=muted 9=bright_red 10=bright_green 11=bright_yellow 12=bright_blue \
    13=bright_magenta 14=bright_cyan 15=bright_foreground; do
    idx="${i%%=*}"
    key="${i#*=}"
    name="_C_${key}"
    val="${!name}"
    printf 'palette = %s=%s\n' "$idx" "$val"
  done
}

# install_ghostty: schreibt das Theme nach ~/.config/ghostty/themes und setzt
# die theme-Zeile in der config (mit Backup). DRY steuert echtes Schreiben.
install_ghostty() {
  local gh_conf="${XDG_CONFIG_HOME:-$HOME/.config}/ghostty"
  local gh_themes="$gh_conf/themes"
  local gh_theme_file="$gh_themes/$GHOSTTY_THEME_NAME.conf"
  local gh_cfg="$gh_conf/config"

  if [[ "$DRY" -eq 1 ]]; then
    printf '  dry-run: mkdir -p %s\n' "$gh_themes"
    printf '  dry-run: schreibe %s\n' "$gh_theme_file"
    printf '  dry-run: theme-Zeile → "theme = %s" in %s\n' "$GHOSTTY_THEME_NAME" "$gh_cfg"
    return 0
  fi

  mkdir -p "$gh_themes"
  render_ghostty > "$gh_theme_file"
  printf '   ✓ Theme geschrieben: %s\n' "$gh_theme_file"

  [[ -f "$gh_cfg" ]] || touch "$gh_cfg"
  # Backup nur, wenn eine theme-Zeile vorhanden ist und geändert wird
  if grep -qE '^\s*theme\s*=' "$gh_cfg"; then
    cp "$gh_cfg" "$gh_cfg.bak-$(date +%Y%m%d%H%M%S)"
  fi
  if grep -qE '^\s*theme\s*=' "$gh_cfg"; then
    sed -ri 's/^(\s*theme\s*=).*/\1 '"$GHOSTTY_THEME_NAME"'/' "$gh_cfg"
  else
    printf 'theme = %s\n' "$GHOSTTY_THEME_NAME" >> "$gh_cfg"
  fi
  printf '   ✓ config aktualisiert: %s\n' "$gh_cfg"
}