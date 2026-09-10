// managedBlock.ts — locating and managing marked CSS blocks.
//
// The GTK4 overlay and PaperWM user.css are managed via comment markers.
// Both installations (and the reset) must reliably find the same marker and
// recognize "marker without comment opener" as corrupted, instead of silently
// corrupting the file via slice(0, -1).

export type BlockLocation =
  | { kind: "absent" }
  | { kind: "corrupt" }
  | { kind: "found"; start: number; end: number };

/**
 * Searches for a block managed by themeswitch.
 *
 * @param marker    Marker text without `/* ` (e.g. "themeswitch: …").
 * @param endMarker Optional end marker without `/* ` and ` *\/`.
 *
 * Returns:
 *  - `absent`  marker does not occur
 *  - `corrupt` marker occurs, but the comment opener or end marker is missing
 *  - `found`   `start` = index of the opener, `end` = index directly after the block
 */
export function locateBlock(text: string, marker: string, endMarker?: string): BlockLocation {
  if (!text.includes(marker)) return { kind: "absent" };
  const start = text.indexOf(`/* ${marker}`);
  if (start === -1) return { kind: "corrupt" };
  if (endMarker === undefined) return { kind: "found", start, end: text.length };
  const endToken = `/* ${endMarker} */`;
  const end = text.indexOf(endToken, start);
  if (end === -1) return { kind: "corrupt" };
  return { kind: "found", start, end: end + endToken.length };
}
