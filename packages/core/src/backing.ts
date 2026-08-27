import type { Item } from "./model.ts";

/**
 * **Items backed by files** (`docs/projects/workbench/files-on-disk.md`).
 *
 * `＋` carries a file from the disk onto the canvas; this is the other
 * direction, and the choice of whether to take it. A screen an agent runs up
 * to answer "let me see a view" wants to stay on the canvas; a screen that is
 * a new part of the system wants to be a file. Both a person and an agent
 * decide that per item.
 *
 * **Two facts, and keeping them apart is the whole design.** Where a file
 * belongs is a CANVAS fact — it replicates, it reaches a teammate who clones
 * the repo, and it lives here as an item property. Whether it is written is a
 * fact about ONE MACHINE — bindings are per-machine by construction, so the
 * same canvas on a laptop with no checkout has no disk to be written to. The
 * first is stored; the second is derived, every time, and never stored.
 */

/** The path this item is the file at, relative to the bound root. */
export const FILE_PROP = "file";

/**
 * Where this item belongs on disk, or null when it belongs nowhere — which
 * is the default and stays perfectly useful.
 *
 * Relative to the root, never absolute: an absolute path is one machine's
 * answer to a question the canvas is asking, and it would be wrong the
 * moment a teammate cloned the repo somewhere else.
 */
export function fileOf(item: Item): string | null {
  const raw = item.properties[FILE_PROP];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/**
 * What one machine's disk says about a tracked item.
 *
 * - `written` — the file is there and matches the item's current version.
 * - `drifted` — it is there and does NOT match: somebody edited it outside
 *   the canvas, so a write would eat their work and must say so first.
 * - `absent` — tracked, and never written on this machine.
 * - `unbound` — no directory here at all, which is every hosted canvas and
 *   every machine without the checkout. Not an error; a different question.
 */
export type BackingState = "written" | "drifted" | "absent" | "unbound";

export interface Backing {
  path: string;
  state: BackingState;
}

/**
 * Combine the canvas's intent with a machine's answer.
 *
 * `onDisk` is what that machine found at the path — the content hash of the
 * file, or `null` when it is not there — and `bound` says whether the machine
 * has a directory for this canvas at all. Splitting those two is what keeps
 * "no checkout here" from reading as "somebody deleted your file".
 */
export function backingOf(
  item: Item,
  bound: boolean,
  onDisk: (path: string) => string | null,
): Backing | null {
  const path = fileOf(item);
  if (path === null) return null;
  if (!bound) return { path, state: "unbound" };
  const found = onDisk(path);
  if (found === null) return { path, state: "absent" };
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  return { path, state: found === current?.blobHash ? "written" : "drifted" };
}

/**
 * A path a canvas may name, or null.
 *
 * The canvas half of the jail — the daemon enforces the real one against a
 * real filesystem (`server/tree.ts`), and this refuses the shapes that are
 * wrong on their face so neither surface offers them. Absolute paths and
 * `..` are refused for the same reason: they are answers about a machine,
 * asked of a canvas. Dot segments are refused because `listable` will refuse
 * them at the far end and an affordance that leads to a refusal is worse
 * than one that never offered.
 */
export function cleanFilePath(raw: string): string | null {
  const value = raw.trim().replace(/\\/g, "/");
  if (value === "" || value.startsWith("/")) return null;
  const segments = value.split("/").filter((one) => one !== "" && one !== ".");
  if (segments.length === 0) return null;
  if (segments.some((one) => one === ".." || one.startsWith("."))) return null;
  return segments.join("/");
}
