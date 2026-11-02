import type { ModuleMark } from "@isocan/core";
import { wiresOn } from "./flow.ts";
import { keptFlowsOf, writePrototype } from "./kept-flows.ts";
import { overridesOf } from "./link-override.ts";
import type { WirePort } from "./port.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { webPort } from "./web-port.ts";

/**
 * **The prototype follows its marks** (24 Sep 2026, Dion: "would be nice to
 * follow on its own").
 *
 * Using a screen in the prototype or removing it (⇧K, the item menu, `wire
 * use|unuse|keep|unkeep`) changes which screens a flow's prototype plays, so
 * the prototype re-versions — in the SAME op group as the mark, so one undo
 * takes back the mark and the rebuild together. Only a flow that already has
 * a prototype follows: marking screens never makes one (`wire prototype`
 * does). A prototype somebody moved stays where they put it and only its
 * content changes (`wirePrototypeAt`, in `writePrototype`).
 *
 * It reads the canvas when it runs — after the mark has landed — so a quick
 * run of ⇧K presses rebuilds from what is marked by then, each in its own
 * press's group. Both surfaces call this one function: the CLI after `wire
 * use`, the web through the mark's `follow` hook (`command.ts`).
 */
export interface Followed {
  flow: string;
  itemId: string;
  what: "versioned" | "moved" | "unchanged" | "left";
  /** How many screens it plays now. */
  screens: number;
}

export async function followMarks(port: WirePort, changed: readonly string[], group: string): Promise<Followed[]> {
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  const moved = new Set(changed);
  const flowsOfChanged = new Set(all.filter((w) => moved.has(w.item)).map((w) => w.spec.flow));
  const kept = keptFlowsOf(canvas, all);
  const out: Followed[] = [];
  for (const proto of Object.values(canvas.items).filter((i) => i.properties?.[PROTOTYPE_PROP] !== undefined)) {
    const flow = proto.properties![PROTOTYPE_PROP]!;
    const current = kept.find((f) => f.flow === flow);
    // A flow follows when a screen of its own moved, or a screen of another flow it links to (a guest).
    const linksToChanged = Object.values(canvas.items).some((i) => all.some((w) => w.item === i.id && w.spec.flow === flow) && Object.values(overridesOf(i.properties)).some((to) => moved.has(to)));
    if (!flowsOfChanged.has(flow) && !linksToChanged) continue;
    // Nothing of its flow is marked any more: a prototype of nothing is not a thing, so it stays as it was.
    if (!current) {
      out.push({ flow, itemId: proto.id, what: "left", screens: 0 });
      continue;
    }
    const written = await writePrototype(port, canvas, current, group);
    out.push({ flow, itemId: written.itemId, what: written.what === "added" ? "versioned" : written.what, screens: current.screens.length });
  }
  return out;
}

/** The web's door: the keep mark's `follow`, over the viewer's hands (`webPort`). */
export async function followOnWeb({ canvasId, group, changed, host }: Parameters<NonNullable<ModuleMark["follow"]>>[0]): Promise<void> {
  await followMarks(webPort(canvasId, host), changed.map((i) => i.id), group);
}

/** How the CLI says a prototype followed. */
export function followedLine(f: Followed): string {
  if (f.what === "left") return `prototype ${f.itemId} left as it was — nothing of its flow is in it now; \`isocan wire use <screens...>\` puts some back`;
  if (f.what === "unchanged") return `prototype ${f.itemId} already plays these ${f.screens} screens`;
  return `prototype ${f.itemId} follows — it plays ${f.screens} screen${f.screens === 1 ? "" : "s"} now${f.what === "moved" ? ", back above its flow" : ""}`;
}
