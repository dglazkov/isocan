/**
 * **What a node on the canvas can do** (`docs/projects/node-focus/design.md`).
 *
 * Derived from the item and its version, never stored: every surface — the
 * top-left action strip on a selected card, the keyboard (`Enter`, `E`),
 * `FullScreen.tsx` (`/i/:itemId`), `Workbench.tsx` (`/w/:itemId`), and
 * `isocan open --edit` — asks this one function rather than checking MIME
 * strings of its own.
 */

import { isArea } from "./area.ts";
import { BROWSER_MIME } from "./browseritem.ts";
import { isGroupItem } from "./canvas-groups.ts";
import { isCanvasItem } from "./canvasitem.ts";
import { isDesignSystem } from "./designsystem.ts";
import { isDrawingItem } from "./drawing.ts";
import { isGoogleDocItem } from "./googledoc.ts";
import { editableText } from "./kinds.ts";
import type { Item, ItemVersion } from "./model.ts";
import { moduleCapabilitiesFor } from "./modules.ts";
import { isTextItem } from "./textnode.ts";

/** Capability flags determining which focus and inline modes a canvas node supports. */
export interface NodeCapabilities {
  /** Can open in View Focus (/p/:canvasId/i/:itemId) — presentation + rich metadata/inspection. */
  view: boolean;
  /** Can open in Edit Focus (/p/:canvasId/w/:itemId) — has a rich Edit Studio and/or editable file source. */
  edit: boolean;
  /**
   * Can be Entered inline on the canvas (`enteredItemId`) — ONLY true for nodes
   * with live interactive or scrollable card interiors (HTML screens/prototypes,
   * live docs, browser frames, videos, placed canvases, long-form Markdown).
   * False for static images, SVGs, design systems, drawings, text nodes, and groups.
   */
  enter: boolean;
  /**
   * Node is a file itself (HTML, Markdown, DESIGN.md, SVG, JSON/code) — unlocks
   * Workbench file tools (CodeMirror source pane, Save-to-disk backing, file
   * tree, lint) inside Edit Focus.
   */
  file: boolean;
}

const NO_CAPABILITIES: NodeCapabilities = {
  view: false,
  edit: false,
  enter: false,
  file: false,
};

/**
 * Compute `{ view, edit, enter, file }` for an item and version (defaulting to
 * the item's current version).
 *
 * Built-in rules run first, then any loaded module capability override
 * (`moduleCapabilitiesFor`) refines the result; unloading a module falls back
 * cleanly to the built-in capabilities of the underlying file.
 */
export function nodeCapabilitiesFor(item: Item, version?: ItemVersion): NodeCapabilities {
  // Structural containers and canvas-native captions/stickies/sketches have
  // their own canvas interactions rather than cover-route studios.
  if (isGroupItem(item) || isArea(item) || isTextItem(item)) {
    return NO_CAPABILITIES;
  }
  if (isDrawingItem(item)) {
    return { view: true, edit: false, enter: false, file: false };
  }

  const current =
    version ??
    item.versions.find((v) => v.id === item.currentVersionId) ??
    item.versions[0];
  if (!current) return NO_CAPABILITIES;

  const mime = current.mimeType ?? "";
  const visualMime = current.visual?.mimeType ?? mime;
  const isFile = editableText(mime);

  let base: NodeCapabilities;

  // Design systems (`DESIGN.md`) are specimen cards on the canvas (`enter: false`),
  // even though their underlying file is `text/markdown`.
  if (isDesignSystem(item)) {
    base = { view: true, edit: true, enter: false, file: true };
  } else if (isCanvasItem(item) || mime === BROWSER_MIME) {
    // Placed canvases and projected browser sites are live framed places you
    // can interact with in place or open full screen, not files edited here.
    base = { view: true, edit: false, enter: true, file: false };
  } else if (mime === "image/svg+xml") {
    // Uploaded SVG vectors have both an Image Studio and XML file source,
    // and are static cards on the canvas (`enter: false`).
    base = { view: true, edit: true, enter: false, file: true };
  } else if (mime.startsWith("image/")) {
    // Raster images (PNG, JPEG, WebP, GIF) open in Image View (with metadata
    // inspector) and Image Edit Studio, without raw CodeMirror or inline enter.
    base = { view: true, edit: true, enter: false, file: false };
  } else if (mime.startsWith("video/")) {
    // Videos have inline playback controls on the canvas (`enter: true`) and
    // metadata/trim/agent editing in Edit Focus, without a text source file.
    base = { view: true, edit: true, enter: true, file: false };
  } else if (mime === "text/html" || visualMime === "text/html") {
    // HTML screens, prototypes, wireframes, and visual HTML faces can be
    // interacted with in place (`enter: true`) and edited in Screen/Module Studio.
    base = { view: true, edit: true, enter: true, file: isFile };
  } else if (
    mime === "text/markdown" ||
    mime === "text/plain" ||
    isGoogleDocItem(item)
  ) {
    // Long-form documents and notes scroll and allow text selection when entered.
    base = { view: true, edit: true, enter: true, file: true };
  } else if (mime === "application/pdf") {
    base = { view: true, edit: false, enter: true, file: false };
  } else if (isFile) {
    // Any other text/* or application/json file (code, Mermaid .mmd, mindmap JSON).
    const scrollableText = mime.startsWith("text/");
    base = { view: true, edit: true, enter: scrollableText, file: true };
  } else {
    base = { view: true, edit: false, enter: false, file: false };
  }

  const override = moduleCapabilitiesFor(item, current);
  return override ? { ...base, ...override } : base;
}
