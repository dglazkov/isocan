import { newGroupId, newVersionId } from "@isocan/core";
import type { CanvasContents } from "@isocan/core";
import { applyCopy } from "./content/flesh-spec.ts";
import { validateCopyPayload } from "./copy-schema.ts";
import type { Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { renderWire } from "./render.ts";
import type { WireSpec } from "./spec.ts";

/**
 * **The one writer of a wireframe's words**: validate a copy file against
 * the screen, apply it as `source: "copy"` by `by`, re-render, and land one
 * version plus any kept-flow prototype rebuilt — one op group, one undo.
 * `wire copy --apply`, `isocan words <screen> --apply` (the copy deck,
 * through `wireCopyWriter`) and the stage's in-place text edit
 * (`web-copy.ts`) all come here. Browser-safe, which is why it is not in
 * `flesh-cli.ts`.
 *
 * `render` is how the new spec becomes the file: the renderer, unless the
 * screen's file is not its own render (crafted by hand around an embedded
 * spec), where the caller keeps those bytes and embeds the new spec.
 */
export async function writeWireCopy(
  port: WirePort,
  canvas: CanvasContents,
  all: Screen[],
  screen: Screen,
  raw: unknown,
  by: string,
  render: (next: WireSpec) => string = renderWire,
): Promise<{ changed: false } | { changed: true; next: WireSpec; group: string; versionId: string; prototypes: Awaited<ReturnType<typeof rebuildPrototypes>> }> {
  const spec = screen.spec;
  const validated = validateCopyPayload(spec, raw);
  const next = applyCopy(spec, validated, by);
  if (JSON.stringify(next) === JSON.stringify(spec)) return { changed: false };
  const item = canvas.items[screen.item]!;
  const filename = currentVersionOf(item)?.filename ?? "wireframe.html";
  const group = newGroupId();
  const versionId = newVersionId();
  const upload = await port.put(render(next), "text/html", filename);
  await port.send({ type: "item.addVersion", itemId: item.id, version: { id: versionId, blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
  const prototypes = await rebuildPrototypes(port, canvas, all, [{ item: item.id, spec: next }], group);
  return { changed: true, next, group, versionId, prototypes };
}
