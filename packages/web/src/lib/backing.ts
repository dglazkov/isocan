import type { Backing } from "@isocan/core";

/**
 * What the file mark says when you rest on it.
 *
 * One sentence per state, and each one says what it MEANS rather than naming
 * the state: "drifted" is a word this product invented, and a person reading
 * a tooltip should not have to have read the design doc.
 */
export function fileMarkTip(backing: Backing): string {
  switch (backing.state) {
    case "written":
      return `${backing.path} — this item is that file, and the file matches`;
    case "behind":
      return `${backing.path} — the file holds an older version of this item; saving catches it up`;
    case "drifted":
      return `${backing.path} — the file changed outside the canvas; saving would overwrite it`;
    case "absent":
      return `${backing.path} — not written on this machine yet`;
    case "unbound":
      return `${backing.path} — no directory is bound to this canvas here`;
  }
}
