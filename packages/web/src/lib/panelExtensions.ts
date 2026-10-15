import { useEffect, useState } from "react";
import {
  EXTENSION_COLORS,
  extensionColor,
  panelExtensionItems,
  readPanelExtension,
  type CanvasContents,
  type Item,
  type PanelExtension,
} from "@isocan/core";
import { readBlobText } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * The canvas's own panels (`docs/projects/extensions/design.md`, phases 3–4):
 * items on the canvas with `properties.role = "panel"`, read through core's
 * `readPanelExtension` so the dock and `isocan panel list` never disagree.
 *
 * A panel wears its own name and a colour from `EXTENSION_COLORS` — never
 * `IDENTITY_COLORS`, which mean a person is standing there.
 */
export { EXTENSION_COLORS, extensionColor };

export interface CanvasPanel {
  itemId: string;
  /** The manifest's validated title, or the item's title when unreadable. */
  title: string;
  /** The extension's own colour, derived from `itemId` and disjoint from `IDENTITY_COLORS`. */
  color: string;
  panel?: PanelExtension;
  /** Why this panel cannot be shown right now. */
  problem?: string;
}

const manifestCache = new Map<string, string>();
const missingBlobs = new Set<string>();

/**
 * Resolve one panel item against the current canvas state using core's single
 * reader (`readPanelExtension`).
 */
export function resolveCanvasPanel(
  item: Item,
  canvas: CanvasContents,
  rawManifest: string | null | undefined,
  blobMissing = false,
): CanvasPanel {
  const color = extensionColor(item.id);
  if (rawManifest === null || rawManifest === undefined) {
    return {
      itemId: item.id,
      title: item.title,
      color,
      problem: "its manifest bytes are missing",
    };
  }
  const { panel, problem } = readPanelExtension(rawManifest, canvas);
  if (!panel) {
    return {
      itemId: item.id,
      title: item.title,
      color,
      problem: problem ?? "this panel manifest could not be read",
    };
  }
  if (blobMissing) {
    return {
      itemId: item.id,
      title: panel.title,
      color,
      problem: `the bytes for ${panel.src} are missing`,
    };
  }
  return { itemId: item.id, title: panel.title, color, panel };
}

/** The sentence shown when a panel's manifest or page blob is unavailable. */
export function panelUnavailableSentence(entry: CanvasPanel): string {
  if (!entry.problem) return `${entry.title} — ${entry.panel?.src ?? ""}`;
  return `${entry.title} is unavailable — ${entry.problem}`;
}

export function useCanvasPanels(canvasId: string): CanvasPanel[] {
  const canvas = useCanvasStore((s) => s.canvas);
  const [, bump] = useState(0);

  const items = canvas ? panelExtensionItems(canvas) : [];
  const signature = items
    .map((i) => {
      const ver = i.versions.find((v) => v.id === i.currentVersionId);
      return `${i.id}:${ver?.blobHash ?? ""}`;
    })
    .join(",");

  useEffect(() => {
    if (!canvas) return;
    let cancelled = false;
    for (const item of panelExtensionItems(canvas)) {
      const version = item.versions.find((v) => v.id === item.currentVersionId);
      if (!version) continue;
      const hash = version.blobHash;
      if (!manifestCache.has(hash) && !missingBlobs.has(hash)) {
        void readBlobText(canvasId, hash)
          .then((raw: string) => {
            manifestCache.set(hash, raw);
            if (!cancelled) bump((n) => n + 1);
          })
          .catch(() => {
            missingBlobs.add(hash);
            if (!cancelled) bump((n) => n + 1);
          });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [canvasId, canvas, signature]);

  const resolved: CanvasPanel[] = [];
  if (!canvas) return resolved;

  for (const item of items) {
    const version = item.versions.find((v) => v.id === item.currentVersionId);
    if (!version) {
      resolved.push(resolveCanvasPanel(item, canvas, null));
      continue;
    }
    if (missingBlobs.has(version.blobHash)) {
      resolved.push(resolveCanvasPanel(item, canvas, null));
      continue;
    }
    const raw = manifestCache.get(version.blobHash);
    if (raw === undefined) continue;
    const entry = resolveCanvasPanel(item, canvas, raw, false);
    if (entry.panel) {
      const pageHash = entry.panel.bytes.blobHash;
      if (missingBlobs.has(pageHash)) {
        resolved.push(resolveCanvasPanel(item, canvas, raw, true));
        continue;
      }
      if (!manifestCache.has(pageHash)) {
        void readBlobText(canvasId, pageHash)
          .then((pageRaw: string) => {
            manifestCache.set(pageHash, pageRaw);
          })
          .catch(() => {
            missingBlobs.add(pageHash);
            bump((n) => n + 1);
          });
      }
    }
    resolved.push(entry);
  }

  return resolved;
}
