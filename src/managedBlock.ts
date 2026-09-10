// managedBlock.ts — Auffinden und Verwalten markierter CSS-Blöcke.
//
// GTK4-Overlay und PaperWM-user.css werden über Kommentar-Marker verwaltet.
// Beide Installationen (und der Reset) müssen denselben Marker zuverlässig
// finden und „Marker ohne Kommentar-Opener" als beschädigt erkennen, statt die
// Datei per slice(0, -1) still zu beschädigen.

export type BlockLocation =
  | { kind: "absent" }
  | { kind: "corrupt" }
  | { kind: "found"; start: number; end: number };

/**
 * Sucht einen von themeswitch verwalteten Block.
 *
 * @param marker    Markertext ohne `/* ` (z. B. "themeswitch: …").
 * @param endMarker Optionaler Endmarker ohne `/* ` und ` *\/`.
 *
 * Rückgabe:
 *  - `absent`  Marker kommt nicht vor
 *  - `corrupt` Marker kommt vor, aber Kommentar-Opener bzw. Endmarker fehlt
 *  - `found`   `start` = Index des Openers, `end` = Index direkt hinter dem Block
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
