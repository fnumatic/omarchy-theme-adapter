#!/usr/bin/env bash
# lib-colors.sh — Omarchy colors.toml lesen und in normalisierte Semantik überführen.
# Einhängen per: source "$(dirname "${BASH_SOURCE[0]}")/lib-colors.sh"
# Kein Implementierungsvegina-Code; nur Definitionen + parse-Funktion.

# --- Schlüssel&Quelldatei-Lookup ---
# colors.toml liegt relativ zu dieser Lib: ../../themes/rose-pine/colors.toml
_COLORS_DEFAULT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/themes/rose-pine/colors.toml"

# Leere Collection
_colors_reset() {
  local k
  for k in \
    mode accent selection muted \
    background dark_background darker_background lighter_background \
    foreground dark_foreground light_foreground bright_foreground \
    red yellow orange green cyan blue magenta brown \
    bright_red bright_yellow bright_green bright_cyan bright_blue bright_magenta; do
    eval "_C_${k//-/_}="   # z.B. _C_dark_background
  done
}

# colors.toml einlesen; setzt _C_* Variablen.
# Rückgabe: 0 bei Erfolg.
colors_parse() {
  local file="${1:-$_COLORS_DEFAULT}"
  _colors_reset
  [[ -f "$file" ]] || { echo "lib-colors: Datei nicht gefunden: $file" >&2; return 1; }
  local line key val
  while IFS= read -r line; do
    # Kommentare & leer
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    # Nur simple key = "value" Zeilen
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_]+)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      val="${val//\"/}"; val="$(printf '%s' "$val" | sed 's/[[:space:]]*$//')"
      # Nur bekannte Schlüssel übernehmen
      case "$key" in
        mode|accent|selection|muted|background|dark_background|darker_background|lighter_background|foreground|dark_foreground|light_foreground|bright_foreground|red|yellow|orange|green|cyan|blue|magenta|brown|bright_red|bright_yellow|bright_green|bright_cyan|bright_blue|bright_magenta)
          eval "_C_${key//-/_}='$val'"
          ;;
      esac
    fi
  done < "$file"
  return 0
}

# Normalisierte Semantik ausgeben (stderr-frei, zeilenweise KEY=VALUE).
colors_semantic() {
  local bg="${_C_background}" sfc="${_C_dark_background}" up="${_C_lighter_background}" dn="${_C_darker_background}"
  local fg="${_C_foreground}" fg2="${_C_light_foreground}" fgd="${_C_dark_foreground}" fgb="${_C_bright_foreground}"
  printf 'MODE=%s\n'      "${_C_mode:-light}"
  printf 'NORMAL_BG=%s\n' "$bg"
  printf 'SURFACE=%s\n'   "$sfc"
  printf 'SURFACE_RAISED=%s\n' "$up"
  printf 'SURFACE_SINK=%s\n'   "$dn"
  printf 'NORMAL_FG=%s\n' "$fg"
  printf 'FG_SECONDARY=%s\n'   "$fg2"
  printf 'FG_DISABLED=%s\n'    "$fgd"
  printf 'FG_BRIGHT=%s\n'      "$fgb"
  printf 'ACCENT=%s\n' "${_C_accent}"
  printf 'SELECTION_BG=%s\n' "${_C_selection}"
  printf 'MUTED=%s\n' "${_C_muted}"
  # ANSI 0..15. Zelle 3 ist gelb/orange (kein Standard-Orange), 12 ist gelb-bold.
  printf 'ANSI_00=%s\n' "${_C_red}"
  printf 'ANSI_01=%s\n' "${_C_yellow}"
  printf 'ANSI_02=%s\n' "${_C_green}"
  printf 'ANSI_03=%s\n' "${_C_brown:-${_C_yellow}}"         # yellow-ish
  printf 'ANSI_04=%s\n' "${_C_blue}"
  printf 'ANSI_05=%s\n' "${_C_magenta}"
  printf 'ANSI_06=%s\n' "${_C_cyan}"
  printf 'ANSI_07=%s\n' "${_C_light_foreground:-$_C_foreground}" # light gray text
  printf 'ANSI_08=%s\n' "${_C_muted:-$_C_dark_foreground}"       # bright black = muted
  printf 'ANSI_09=%s\n' "${_C_bright_red:-${_C_red}}"
  printf 'ANSI_10=%s\n' "${_C_bright_yellow:-${_C_yellow}}"
  printf 'ANSI_11=%s\n' "${_C_bright_green:-${_C_green}}"
  printf 'ANSI_12=%s\n' "${_C_bright_blue:-${_C_blue}}"     # Org.-Feld; orange fehlt → blue
  printf 'ANSI_13=%s\n' "${_C_bright_magenta:-${_C_magenta}}"
  printf 'ANSI_14=%s\n' "${_C_bright_cyan:-${_C_cyan}}"
  printf 'ANSI_15=%s\n' "${_C_bright_foreground:-$_C_foreground}"
}