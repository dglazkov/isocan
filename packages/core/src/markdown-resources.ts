import { CANVAS_PATH_PREFIX } from "./address.ts";
import { cleanFilePath, fileOf, visualFileOf } from "./backing.ts";
import { visualFaceOf } from "./model.ts";
import type { CanvasContents, Item } from "./model.ts";

/** Import provenance only: unlike `file`, this never asks a machine to write a file. */
export const SOURCE_PATH_PROP = "sourcePath";
type MarkdownResource = { kind: "external" | "fragment"; url: string } |
  { kind: "item"; itemId: string; blobHash: string; mimeType: string; fragment: string } |
  { kind: "missing" | "ambiguous" | "unsafe"; path: string };

/** Resolve against saved canvas resources, never the app URL or the daemon's disk.
 * A duplicate path is ambiguous; a basename in another directory is not a match. */
export function markdownResource(canvas: CanvasContents, source: Item, versionId: string, raw: string): MarkdownResource {
  if (raw.startsWith("#")) return { kind: "fragment", url: raw };
  if (raw.startsWith(`${CANVAS_PATH_PREFIX}/`) || /^(?:https?:|mailto:)/i.test(raw) || raw.startsWith("//")) return { kind: "external", url: raw };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || /[\\\x00-\x1f]/.test(raw)) return { kind: "unsafe", path: raw };
  const version = source.versions.find(v => v.id === versionId);
  if (!version) return { kind: "missing", path: raw };
  const base = cleanFilePath((version.visual ? visualFileOf(source) : null) ?? fileOf(source) ?? source.properties[SOURCE_PATH_PROP] ?? visualFaceOf(version).filename);
  let decoded: string;
  try { decoded = decodeURIComponent(raw.split(/[?#]/)[0]!); } catch { return { kind: "unsafe", path: raw }; }
  if (/[\\\x00-\x1f]/.test(decoded)) return { kind: "unsafe", path: raw };
  const parts = decoded.startsWith("/") ? [] : (base?.split("/").slice(0, -1) ?? []);
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!parts.length) return { kind: "unsafe", path: raw }; parts.pop(); }
    else parts.push(part);
  }
  const target = parts.join("/");
  const matches = Object.values(canvas.items).flatMap(item => {
    const v = item.versions.find(one => one.id === (item.id === source.id ? versionId : item.currentVersionId));
    if (!v) return [];
    const face = visualFaceOf(v);
    const pathname = cleanFilePath((v.visual ? visualFileOf(item) : null) ?? fileOf(item) ?? item.properties[SOURCE_PATH_PROP] ?? face.filename);
    return pathname === target ? [{ itemId: item.id, blobHash: face.blobHash, mimeType: face.mimeType }] : [];
  });
  if (matches.length !== 1) return { kind: matches.length ? "ambiguous" : "missing", path: target };
  return { kind: "item", ...matches[0]!, fragment: raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : "" };
}
