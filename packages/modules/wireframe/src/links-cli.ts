import type { Command } from "commander";
import { FIDELITY_PROP, newGroupId, type Item } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { cliPort } from "./cli-port.ts";
import { wiresOn } from "./flow.ts";
import { isKept } from "./keep.ts";
import { keptFlowsOf, pickKeptFlow, writePrototype, type KeptFlow } from "./kept-flows.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { LINK_BACK, LINK_NONE, hotspots, inferLinks, type WireLink } from "./links.ts";
import { setLinkOverride } from "./link-override.ts";
import type { WirePort } from "./port.ts";

/**
 * **`wire links`, `wire link`, `wire prototype`** — phase 3's verbs.
 *
 * `links` prints what `inferLinks` says about the kept screens right now —
 * computed on every call, never stored. `link` records the one thing that is
 * stored, a person's decision about one hotspot: `wireLinks` on the source
 * screen, through `item.update`. `prototype` assembles the kept screens of a
 * flow as one HTML item beside them — the first time `item.add`, after that
 * `item.addVersion` on the same item (found by `wirePrototype = <flow>`), so a
 * rebuild is a version and not a replacement. Each command is one op group.
 */

/** The kept screens, grouped by flow, each group in reading order. */
async function keptFlows(port: WirePort): Promise<KeptFlow[]> {
  const canvas = await port.canvas();
  return keptFlowsOf(canvas, await wiresOn(port, canvas));
}

function linkLine(l: WireLink, title: (id: string) => string): string {
  const where = l.to === LINK_BACK ? "back" : l.to ? `→ "${title(l.to)}"` : l.needs ? `- - needs ${l.needs}` : "off";
  return `  ${l.key.padEnd(18)} ${l.label.padEnd(16)} ${where.padEnd(28)} ${l.rule}${l.to && l.to !== LINK_BACK ? `, ${l.transition}` : ""}`;
}

export function registerLinks(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;

  wire
    .command("links [screen]")
    .description("Print where every hotspot on the kept screens goes — inferred from intents, archetypes and reading order, and any override set with `wire link`")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "which flow's kept screens (default: the only one)")
    .action(
      run(async (ref: string | undefined, _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { flow?: string };
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const flows = await keptFlows(cliPort(host, ctx, p.id));
        const only = ref ? resolveItem(snapshot, ref) : null;
        const flow = only ? flows.find((f) => f.screens.some((s) => s.id === only.id) && !f.guests.includes(only.id)) : pickKeptFlow(flows, opts.flow);
        if (!flow) throw new Error(`"${only!.title}" is not a kept screen — links run between kept screens (\`isocan wire keep ${only!.id}\`)`);
        const links = inferLinks(flow.screens, { withNone: true });
        // A guest (a screen kept in another flow that this one links to) is listed with its own flow.
        const shown = links.filter((l) => (only ? l.from === only.id : !flow.guests.includes(l.from)));
        if (ctx.json) return printJson({ flow: flow.flow, request: flow.request, screens: flow.screens.map((s) => ({ itemId: s.id, title: s.title })), links: shown });
        const title = (id: string) => flow.screens.find((s) => s.id === id)?.title ?? id;
        for (const s of flow.screens) {
          if ((only && s.id !== only.id) || flow.guests.includes(s.id)) continue;
          console.log(`${s.id}  "${s.title}" (${s.spec.archetype})`);
          const mine = shown.filter((l) => l.from === s.id);
          if (mine.length === 0) console.log("  (no hotspot that navigates)");
          for (const l of mine) console.log(linkLine(l, title));
        }
        const missing = shown.filter((l) => l.to === null && l.needs);
        const needs = [...new Set(missing.map((l) => l.needs!))];
        console.log(`\n${shown.length} links · ${missing.length} dashed${needs.length ? ` — still to make: ${needs.join(", ")}` : ""}`);
      }),
    );

  wire
    .command("link <screen> <element> [target]")
    .description("Override where one hotspot goes: to a screen, or --none to switch it off; --clear gives it back to the rules. A property on the source screen")
    .option("--canvas <canvas>")
    .option("--none", "the hotspot goes nowhere")
    .option("--back", "the hotspot goes back, whatever the rules say")
    .option("--clear", "forget the override — the rules decide again")
    .action(
      run(async (ref: string, element: string, target: string | undefined, _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { none?: boolean; back?: boolean; clear?: boolean };
        const given = [target !== undefined, Boolean(opts.none), Boolean(opts.back), Boolean(opts.clear)].filter(Boolean).length;
        if (given !== 1) throw new Error("say where it goes: a <target> screen, or one of --none, --back, --clear");
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        // Only the source screen's file is read: every other wire on the canvas is none of this verb's business,
        // and forty-eight downloads to write one property is how a one-line write became a long wait (Porchlight #3).
        const port = cliPort(host, ctx, p.id);
        const [source] = await wiresOn(port, { ...snapshot.canvas, items: { [item.id]: item } });
        if (!source) throw new Error(`"${item.title}" is not a wireframe screen — links start on screens \`isocan wire\` drew`);
        const keys = hotspots(source.spec).map((h) => h.key);
        const matches = keys.includes(element) ? [element] : keys.filter((k) => k.endsWith(`#${element}`));
        if (matches.length !== 1) {
          throw new Error(`${matches.length === 0 ? `"${item.title}" has no hotspot "${element}"` : `"${element}" is on more than one slot`} — its hotspots: ${keys.join(", ")} (\`isocan wire links ${item.id}\`)`);
        }
        const key = matches[0]!;
        let value: string | null;
        let to: Item | null = null;
        if (opts.clear) value = null;
        else if (opts.none) value = LINK_NONE;
        else if (opts.back) value = LINK_BACK;
        else {
          to = resolveItem(snapshot, target!);
          if (to.properties?.[FIDELITY_PROP] !== "wireframe" || to.properties?.[PROTOTYPE_PROP] !== undefined) throw new Error(`"${to.title}" is not a wireframe screen — a link goes to a screen`);
          value = to.id;
        }
        // One hotspot, one property: a second `wire link` on the same screen at the same time keeps its own (link-override.ts).
        const { overrides } = await setLinkOverride(port, item, key, value, newGroupId());
        const keptNow = to ? isKept(to) : true;
        if (ctx.json) return printJson({ itemId: item.id, key, to: value, overrides });
        const said = value === null ? "back to the rules" : value === LINK_NONE ? "switched off" : value === LINK_BACK ? "goes back" : `goes to "${to!.title}"`;
        console.log(`${item.id}  "${item.title}" ${key} ${said}${keptNow ? "" : ` — "${to!.title}" is not kept, so the prototype draws it dashed until it is`} · \`isocan undo\` takes it back`);
      }),
    );

  wire
    .command("prototype")
    .description("Assemble the kept screens as one clickable HTML item beside them — rebuilt, it gains a version rather than being replaced")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "which flow's kept screens (default: the only one)")
    .action(
      run(async (_local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { flow?: string };
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const canvas = await port.canvas();
        const flow = pickKeptFlow(keptFlowsOf(canvas, await wiresOn(port, canvas)), opts.flow);
        const { itemId, title, links, what } = await writePrototype(port, canvas, flow, newGroupId());
        const after = await ctx.client.snapshot(p.id);
        const versions = after.canvas.items[itemId]?.versions.length ?? 0;
        const dashed = links.filter((l) => l.to === null && l.needs);
        if (ctx.json) return printJson({ itemId, title, flow: flow.flow, screens: flow.screens.length, links: links.length, dashed: dashed.length, versions, [what]: true });
        console.log(`${itemId}  "${title}" — ${what === "added" ? "added above the kept screens" : what === "versioned" ? `version ${versions}` : what === "moved" ? `moved back above its flow (still version ${versions})` : `unchanged (still version ${versions}) — nothing kept has changed`}`);
        console.log(`  ${flow.screens.length} screens: ${flow.screens.map((s) => s.title).join(" · ")}`);
        console.log(`  ${links.length} links, ${dashed.length} dashed${dashed.length ? ` (needs ${[...new Set(dashed.map((l) => l.needs))].join(", ")})` : ""} · \`isocan open ${itemId}\` plays it${what === "unchanged" ? "" : " · `isocan undo` takes it back"}`);
      }),
    );
}
