import { FIDELITY_PROP, newItemId, newVersionId, type CanvasContents, type Item } from "@isocan/core";
import { kept } from "./keep.ts";
import { inferLinks, type WireLink, type WireScreen } from "./links.ts";
import { overridesOf } from "./link-override.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { PROTOTYPE_PROP, assemblePrototype, prototypeSize } from "./prototype.ts";

/**
 * **The kept screens, by flow, and the prototype they play** — phase 3's
 * canvas half, over a `WirePort` so `isocan wire prototype` and the web's
 * `/wire prototype` write the same item the same way: `item.add` the first
 * time, `item.addVersion` on the same item (found by `wirePrototype = <flow>`)
 * after that, nothing when the file is byte-for-byte what it already plays.
 */

export interface KeptFlow {
  flow: string;
  request: string;
  screens: WireScreen[];
  items: Item[];
  /**
   * Kept screens of OTHER flows that one of this flow's overrides links to
   * (`wire link <home> tab-3 <a screen kept in the other flow>`), appended
   * after this flow's own so the link resolves and the prototype plays it
   * (Porchlight #5). Their own hotspots are inferred here too, so the
   * prototype does not dead-end on them; the listing and the arrows skip them.
   */
  guests: string[];
}

/** The kept screens, grouped by flow, each group in reading order — from wires already read. */
export function keptFlowsOf(canvas: CanvasContents, screens: ReadonlyArray<{ item: string; spec: WireScreen["spec"] }>): KeptFlow[] {
  const wires = new Map(screens.map((w) => [w.item, w]));
  const flows = new Map<string, KeptFlow>();
  for (const item of kept(canvas)) {
    const wire = wires.get(item.id);
    if (!wire) continue;
    const flow = wire.spec.flow;
    const entry = flows.get(flow) ?? { flow, request: wire.spec.request, screens: [], items: [], guests: [] };
    entry.screens.push({ id: item.id, title: item.title, spec: wire.spec, overrides: overridesOf(item.properties) });
    entry.items.push(item);
    flows.set(flow, entry);
  }
  const all = [...flows.values()];
  const home = new Map(all.flatMap((f) => f.screens.map((s, i) => [s.id, { screen: s, item: f.items[i]! }] as const)));
  for (const f of all) {
    const own = new Set(f.screens.map((s) => s.id));
    for (const target of f.screens.flatMap((s) => Object.values(s.overrides ?? {}))) {
      const guest = home.get(target);
      if (!guest || own.has(target)) continue;
      own.add(target);
      f.screens.push(guest.screen);
      f.items.push(guest.item);
      f.guests.push(target);
    }
  }
  return all;
}

/** The one kept flow a command means: the named one, or the only one — else a refusal that lists them. */
export function pickKeptFlow(flows: KeptFlow[], wanted: string | undefined, flag = "--flow"): KeptFlow {
  if (flows.length === 0) throw new Error("nothing is kept — `isocan wire keep <screens...>` marks the screens a prototype plays");
  if (wanted !== undefined) {
    const found = flows.find((f) => f.flow === wanted);
    if (!found) throw new Error(`no kept screens in flow "${wanted}" — kept flows: ${flows.map((f) => `${f.flow || "(hand-drawn)"} "${f.request}"`).join(", ")}`);
    return found;
  }
  if (flows.length > 1) {
    throw new Error(`kept screens come from ${flows.length} flows — say which with ${flag}:\n  ${flows.map((f) => `${flag} ${f.flow || '""'}  "${f.request}" (${f.screens.length} kept)`).join("\n  ")}`);
  }
  return flows[0]!;
}

export function prototypeTitle(flow: KeptFlow): string {
  return `Prototype · ${flow.request.length > 60 ? `${flow.request.slice(0, 59)}…` : flow.request || "hand-drawn screens"}`;
}

/** The group every one of these items sits in, as an `item.add`'s fields — or nothing when they do not share one. */
export function sharedGroup(items: readonly Item[]): { containerId: string; groupPlacement: "exact" } | undefined {
  const first = items[0]?.containerId;
  return first && items.every((i) => i.containerId === first) ? { containerId: first, groupPlacement: "exact" } : undefined;
}

/**
 * Assemble a kept flow's prototype and write it, under the caller's group —
 * a prototype's own, or a restyle's.
 */
export async function writePrototype(
  port: WirePort, canvas: CanvasContents, flow: KeptFlow, group: string,
): Promise<{ itemId: string; title: string; links: WireLink[]; what: "added" | "versioned" | "unchanged" }> {
  const links = inferLinks(flow.screens);
  const title = prototypeTitle(flow);
  const html = assemblePrototype(flow.screens, links, { title });
  const { width, height } = prototypeSize(flow.screens);
  const filename = "prototype.html";
  const upload = await port.put(html, "text/html", filename);
  const version = { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
  const existing = Object.values(canvas.items ?? {}).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
  if (existing) {
    if (currentVersionOf(existing)?.blobHash === upload.blobHash) return { itemId: existing.id, title, links, what: "unchanged" };
    await port.send({ type: "item.addVersion", itemId: existing.id, version }, group);
    if (existing.width !== width || existing.height !== height) await port.send({ type: "item.resize", itemId: existing.id, width, height }, group);
    if (existing.title !== title) await port.send({ type: "item.update", itemId: existing.id, patch: { title } }, group);
    return { itemId: existing.id, title, links, what: "versioned" };
  }
  const itemId = newItemId();
  // Right of everything in the kept screens' band — their unkept siblings too — so it covers nothing.
  // The flow's own screens: a guest from another flow sits elsewhere.
  const own = flow.items.filter((i) => !flow.guests.includes(i.id));
  const top = Math.min(...own.map((i) => i.y));
  const bottom = top + height;
  const band = Object.values(canvas.items ?? {}).filter((i) => i.y < bottom && i.y + i.height > top);
  const right = Math.max(...own.map((i) => i.x + i.width), ...band.map((i) => i.x + i.width));
  await port.send({
    type: "item.add",
    itemId,
    version,
    width,
    height,
    placement: { x: Math.round(right + 120), y: Math.round(top), chosen: true } as never,
    title,
    // A wireframe's fidelity, so the design-system gate does not count it as an undesigned screen.
    properties: { [FIDELITY_PROP]: "wireframe", [PROTOTYPE_PROP]: flow.flow },
    // In the group its screens live in, when they share one (Porchlight #6).
    ...(sharedGroup(own) ?? {}),
  }, group);
  return { itemId, title, links, what: "added" };
}

/**
 * **Rebuild the prototypes a change touched** — every kept flow that already
 * has a prototype and one of whose screens is in `changed`, in the caller's
 * group, so one undo takes the change and its prototype back together. What
 * `wire style` and `wire flesh` both do after writing their versions.
 */
export async function rebuildPrototypes(
  port: WirePort,
  canvas: CanvasContents,
  all: ReadonlyArray<{ item: string; spec: WireScreen["spec"] }>,
  changed: ReadonlyArray<{ item: string; spec: WireScreen["spec"] }>,
  group: string,
): Promise<Array<{ itemId: string; what: string }>> {
  const out: Array<{ itemId: string; what: string }> = [];
  const touched = new Set(changed.map((s) => s.spec.flow));
  const now = all.map((s) => changed.find((c) => c.item === s.item) ?? s);
  for (const flow of keptFlowsOf(canvas, now)) {
    if (!touched.has(flow.flow)) continue;
    if (!Object.values(canvas.items).some((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow)) continue;
    const written = await writePrototype(port, canvas, flow, group);
    out.push({ itemId: written.itemId, what: written.what });
  }
  return out;
}
