import { parseCanvasAddress } from "./address.ts";
import { googleDocId, googleDocUrl } from "./googledoc.ts";
import { normalizeSiteUrl, siteLabel } from "./browseritem.ts";

/**
 * **One door for everything you bring onto a canvas.** The rail had three
 * add buttons and the terminal four verbs for one act — files, a site, a
 * Google Doc, a canvas — and every one of them asked the person to name
 * the kind before showing the thing, when the thing already says what it
 * is. This reads what was given and says what it would become; the person
 * confirms, or picks the row they meant. Both surfaces classify here, so
 * the app's field and `isocan add` cannot disagree about a paste.
 *
 * The order is the order of confidence. A Google Doc address is the most
 * specific shape and cannot be anything else. A canvas address names a
 * canvas at a home. A canvas THIS home knows — by id, or by exactly one
 * title match — is a canvas only when the words could not be a site (no
 * scheme, no dot): "Lake House" is a canvas, "lakehouse.io" is a site. Any
 * other address is a site. Anything else is words to search canvases with.
 */
export type AddKind = "file" | "site" | "doc" | "canvas";

export type Addable =
  | { kind: "doc"; id: string; url: string }
  | { kind: "canvas"; canvasId: string; origin: string | null; title: string | null }
  | { kind: "site"; url: string }
  | { kind: "search"; query: string }
  | { kind: "empty" };

/** Does this read as an address rather than words — a scheme, a localhost,
 *  or a dotted host with no spaces. */
export function looksLikeSite(input: string): boolean {
  const s = input.trim();
  if (!s || /\s/.test(s)) return false;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^localhost(:\d+)?(\/|$)/i.test(s) || /^[^/]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(s) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(s);
}

export function classifyAddable(
  input: string,
  canvases: readonly { id: string; title: string }[],
  /** The canvas being added to — never offered as a card of itself. */
  selfId?: string,
): Addable {
  const s = input.trim();
  if (!s) return { kind: "empty" };
  const doc = googleDocId(s);
  if (doc) return { kind: "doc", id: doc, url: googleDocUrl(doc) };
  const address = parseCanvasAddress(s);
  if (address) {
    const known = canvases.find((c) => c.id === address.canvasId);
    return { kind: "canvas", canvasId: address.canvasId, origin: address.origin, title: known?.title ?? null };
  }
  const others = canvases.filter((c) => c.id !== selfId);
  const byId = others.find((c) => c.id === s);
  if (byId) return { kind: "canvas", canvasId: byId.id, origin: null, title: byId.title };
  if (!looksLikeSite(s)) {
    const needle = s.toLowerCase();
    const exact = others.filter((c) => c.title.toLowerCase() === needle);
    const prefix = others.filter((c) => c.title.toLowerCase().startsWith(needle));
    const one = exact.length === 1 ? exact[0] : prefix.length === 1 ? prefix[0] : null;
    if (one) return { kind: "canvas", canvasId: one.id, origin: null, title: one.title };
    return { kind: "search", query: s };
  }
  return { kind: "site", url: normalizeSiteUrl(s) };
}

/** The line under the field: what pressing Enter would do. */
export function addableWords(a: Addable): string | null {
  switch (a.kind) {
    case "doc":
      return "Add as a document — its words, with a ↗ to the doc";
    case "canvas":
      return a.title ? `Place the canvas “${a.title}”` : `Place the canvas ${a.canvasId}`;
    case "site":
      return `Add ${siteLabel(a.url)} as a live site`;
    case "search":
      return "Searching your canvases — or paste an address";
    case "empty":
      return null;
  }
}
