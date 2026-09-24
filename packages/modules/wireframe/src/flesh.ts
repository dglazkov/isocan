import { newGroupId, newVersionId, type CanvasContents } from "@isocan/core";
import { JEV_INPUT_PRICE, type Answerer } from "./answerer.ts";
import { choosePack, flagPack, packLine, type PackChoice } from "./content/choose.ts";
import { barsSpec, fleshSpec, isBlueprint, seedKey } from "./content/flesh-spec.ts";
import { packOf } from "./content/fill.ts";
import { GENERIC_PACK } from "./content/packs.ts";
import type { Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { renderWire } from "./render.ts";
import { wireTitle, type WireSpec } from "./spec.ts";

/**
 * **Every wire, fleshed** (design §10, journey scene 7) — the canvas half
 * both surfaces run: `isocan wire flesh` and the web's `/wire flesh`, over a
 * `WirePort`. The shape is `wire style`'s: for each flow, one pack — `--pack`,
 * or the one already on its screens, or Jev's choice for the flow's request
 * (one call) — then a new version of every screen whose content changed, in
 * one op group, so one undo takes it back; a kept flow's prototype is
 * rebuilt in the same group. Run it again and nothing is asked and nothing
 * is written. `bars` takes every screen back to bars.
 *
 * Blueprints are skipped (blue means still being drawn), and so is a screen
 * whose words an agent or a person wrote (`copy`) — unless `--pack` or
 * `--bars` says to replace them.
 */

export interface FleshOptions {
  /** `--pack <id>`: this pack for every flow, never asked. */
  pack?: string;
  /** `--bars`: back to bars. */
  bars?: boolean;
  /** The op group to write in (a composing flow's own); default a new one. */
  group?: string;
}

export interface FleshTarget {
  screen: Screen;
  spec: WireSpec;
  /** Why it was left as it was, when it was. */
  skipped?: "blueprint" | "copy";
}

export interface Fleshed {
  group: string;
  targets: FleshTarget[];
  changed: FleshTarget[];
  /** One choice per flow fleshed. */
  choices: Map<string, PackChoice>;
  prototypes: Array<{ itemId: string; what: string }>;
  calls: number;
  inputTokens: number;
}

/** The pack a flow's screens already carry, if any — lent so a rerun asks nothing. */
function packOnCanvas(all: readonly Screen[], flow: string): PackChoice | null {
  for (const s of all) {
    const c = s.spec.content;
    if (s.spec.flow !== flow || !c || !c.pack) continue;
    return { pack: c.pack, p: c.source === "pack" ? c.p ?? 1 : 1, leaned: c.pack, by: c.source === "pack" ? c.by ?? "" : c.by, how: "reused" };
  }
  return null;
}

/** The choice for one flow: `--pack`, the pack already there, or one call to the answerer. */
export async function packFor(answerer: Answerer, all: readonly Screen[], flow: string, request: string, flag?: string): Promise<PackChoice> {
  if (flag !== undefined) return flagPack(flag);
  const lent = packOnCanvas(all, flow);
  if (lent) return lent;
  if (!request.trim()) return { pack: GENERIC_PACK, p: 1, leaned: GENERIC_PACK, by: "nobody — no request to choose from", how: "flag" };
  return choosePack(answerer, request);
}

export async function flesh(
  port: WirePort,
  canvas: CanvasContents,
  all: readonly Screen[],
  screens: readonly Screen[],
  answerer: Answerer,
  opts: FleshOptions = {},
): Promise<Fleshed> {
  const group = opts.group ?? newGroupId();
  const choices = new Map<string, PackChoice>();
  let calls = 0;
  let inputTokens = 0;
  if (!opts.bars) {
    const flows = new Map<string, string>();
    for (const s of screens) if (!isBlueprint(s.spec) && !flows.has(s.spec.flow)) flows.set(s.spec.flow, s.spec.request);
    // One call per flow, all at once — a canvas of three flows waits for the slowest, not the sum.
    await Promise.all([...flows].map(async ([flow, request]) => {
      const choice = await packFor(answerer, all, flow, request, opts.pack);
      if (choice.how === "asked") {
        calls += 1;
        inputTokens += choice.inputTokens ?? 0;
      }
      choices.set(flow, choice);
    }));
  }
  const targets: FleshTarget[] = screens.map((screen) => {
    const spec = screen.spec;
    if (!opts.bars && isBlueprint(spec)) return { screen, spec, skipped: "blueprint" };
    if (spec.content?.source === "copy" && !opts.bars && opts.pack === undefined) return { screen, spec, skipped: "copy" };
    if (opts.bars) return { screen, spec: barsSpec(spec) };
    const c = choices.get(spec.flow)!;
    // A reused pack keeps the p and the name it was chosen with, so a rerun writes the same spec.
    const meta = c.how === "reused" ? { ...(spec.content?.source === "pack" ? { p: spec.content.p, by: spec.content.by } : { p: c.p, by: c.by }) } : { p: c.p, by: c.by };
    return { screen, spec: fleshSpec(spec, seedKey(spec, screen.item), packOf(c.pack), meta) };
  });
  const changed: FleshTarget[] = [];
  for (const t of targets) {
    if (t.skipped || JSON.stringify(t.spec) === JSON.stringify(t.screen.spec)) continue;
    const item = canvas.items[t.screen.item]!;
    const filename = currentVersionOf(item)?.filename ?? "wireframe.html";
    const upload = await port.put(renderWire(t.spec), "text/html", filename);
    await port.send({ type: "item.addVersion", itemId: item.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
    changed.push(t);
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, changed.map((t) => ({ item: t.screen.item, spec: t.spec })), group);
  return { group, targets, changed, choices, prototypes, calls, inputTokens };
}

/** The lines a person reads: which pack per flow, then what was written. */
export function fleshLines(r: Fleshed): string[] {
  const out: string[] = [];
  for (const [flow, choice] of r.choices) {
    const n = r.targets.filter((t) => t.screen.spec.flow === flow && !t.skipped).length;
    out.push(packLine(choice, `${n} screen${n === 1 ? "" : "s"} in flow ${flow || "(hand-drawn)"}`));
  }
  const copy = r.targets.filter((t) => t.skipped === "copy");
  const blue = r.targets.filter((t) => t.skipped === "blueprint");
  if (copy.length) out.push(`${copy.length} screen${copy.length === 1 ? "" : "s"} keep${copy.length === 1 ? "s" : ""} the exact words written for ${copy.length === 1 ? "it" : "them"} (${copy.map((t) => wireTitle(t.screen.spec)).join(", ")}) — --pack <id> or --bars replaces them`);
  if (blue.length) out.push(`${blue.length} blueprint${blue.length === 1 ? "" : "s"} left blue — nothing is chosen to fill yet`);
  for (const p of r.prototypes) out.push(`prototype ${p.itemId} — ${p.what === "versioned" ? "rebuilt as a new version" : p.what}`);
  return out;
}

/** The closing line. */
export function fleshSummary(r: Fleshed, bars: boolean): string {
  const tail = r.changed.length ? " — one op group: one undo takes it back" : " — nothing written";
  const asked = r.calls === 0 ? "nothing asked" : `${r.calls} ${r.calls === 1 ? "call" : "calls"} · ${r.inputTokens.toLocaleString("en-US")} input tokens · $${(r.inputTokens * JEV_INPUT_PRICE).toFixed(6)}`;
  return `${r.changed.length} of ${r.targets.length} wires ${bars ? "back to bars" : "fleshed"} · ${r.targets.length - r.changed.length} unchanged · ${asked}${tail}`;
}
