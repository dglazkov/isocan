import { newGroupId, newVersionId, type CanvasContents, type Item } from "@isocan/core";
import type { Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { renderWire } from "./render.ts";
import { wireSize, wireTitle, type WireSpec } from "./spec.ts";

/**
 * **Re-render: the renderer's change, reaching screens already drawn**
 * (phase 8, part B).
 *
 * A restyle or a flesh writes a screen only where its SPEC changed, so a
 * change to the renderer itself — phase 8's "just the screen", a new derived
 * colour — never reached a wire already on a canvas (phase 7's Open). This
 * draws every wire again from the spec it carries and writes a version only
 * where the bytes differ (a blob is named by its hash, so "differ" is a hash
 * compare), resizing the item when the screen's size moved — all in one op
 * group, so one undo takes it back. A kept flow's prototype is rebuilt in the
 * same group, and left alone when its bytes did not move either.
 *
 * `isocan wire render --all [--flow <id>]` and `/wire rerender` both run it.
 */

/**
 * Write a spec as a screen's next version, and the item's size if it moved.
 * Nothing is sent when the drawn bytes are the ones it already shows. Returns
 * whether it wrote.
 */
export async function writeWire(port: WirePort, item: Item, spec: WireSpec, group: string): Promise<boolean> {
  const current = currentVersionOf(item);
  const filename = current?.filename ?? "wireframe.html";
  const upload = await port.put(renderWire(spec), "text/html", filename);
  const { width, height } = wireSize(spec);
  const resize = item.width !== width || item.height !== height;
  if (current?.blobHash === upload.blobHash && !resize) return false;
  if (current?.blobHash !== upload.blobHash) {
    await port.send({ type: "item.addVersion", itemId: item.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
  }
  if (resize) await port.send({ type: "item.resize", itemId: item.id, width, height }, group);
  return true;
}

export interface Rerendered {
  group: string;
  screens: readonly Screen[];
  changed: Screen[];
  /** Of `changed`, the ones whose item was resized — the name strip's 32 px, gone. */
  resized: number;
  prototypes: Array<{ itemId: string; what: string }>;
}

/** Draw `screens` again from their specs; version what moved; rebuild the prototypes of kept flows. One op group. */
export async function rerender(port: WirePort, canvas: CanvasContents, all: readonly Screen[], screens: readonly Screen[], opts: { group?: string } = {}): Promise<Rerendered> {
  const group = opts.group ?? newGroupId();
  const changed: Screen[] = [];
  let resized = 0;
  for (const s of screens) {
    const item = canvas.items[s.item];
    if (!item) continue;
    const { width, height } = wireSize(s.spec);
    if (await writeWire(port, item, s.spec, group)) {
      changed.push(s);
      if (item.width !== width || item.height !== height) resized += 1;
    }
  }
  // Every kept flow these screens belong to, changed or not: the prototype's own sheet may have moved too.
  const prototypes = await rebuildPrototypes(port, canvas, all, screens, group);
  return { group, screens, changed, resized, prototypes };
}

/** The closing line, for a person. */
export function rerenderSummary(r: Rerendered): string {
  const protos = r.prototypes.filter((p) => p.what !== "unchanged").length;
  const n = r.screens.length;
  const head = `${r.changed.length} of ${n} wire${n === 1 ? "" : "s"} re-rendered · ${n - r.changed.length} unchanged`;
  const resized = r.resized ? ` · ${r.resized} resized to the screen alone` : "";
  const proto = r.prototypes.length ? ` · ${protos} of ${r.prototypes.length} prototype${r.prototypes.length === 1 ? "" : "s"} rebuilt` : "";
  const tail = r.changed.length || protos ? " — one op group: one undo takes it back" : " — nothing written";
  return `${head}${resized}${proto}${tail}`;
}

/** One line per changed screen, for the terminal. */
export function rerenderLines(r: Rerendered): string[] {
  return r.changed.map((s) => `${s.item}  ${wireTitle(s.spec)} — re-rendered`);
}
