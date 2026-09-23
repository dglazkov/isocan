import type { Command } from "commander";
import { FIDELITY_PROP, newGroupId, newItemId, newVersionId, type CanvasContents, type CanvasSnapshotResponse, type Item } from "@isocan/core";
import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import { wiresOn } from "./compose-cli.ts";
import { isKept, kept } from "./keep.ts";
import { LINKS_PROP, LINK_BACK, LINK_NONE, hotspots, inferLinks, readOverrides, type WireLink, type WireScreen } from "./links.ts";
import { PROTOTYPE_PROP, assemblePrototype, prototypeSize } from "./prototype.ts";

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

interface KeptFlow {
  flow: string;
  request: string;
  screens: WireScreen[];
  items: Item[];
}

/** The kept screens, grouped by flow, each group in reading order. */
async function keptFlows(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse): Promise<KeptFlow[]> {
  const wires = new Map((await wiresOn(ctx, canvasId, snapshot)).map((w) => [w.item, w]));
  const flows = new Map<string, KeptFlow>();
  for (const item of kept(snapshot.canvas as CanvasContents)) {
    const wire = wires.get(item.id);
    if (!wire) continue;
    const flow = wire.spec.flow;
    const entry = flows.get(flow) ?? { flow, request: wire.spec.request, screens: [], items: [] };
    entry.screens.push({ id: item.id, title: item.title, spec: wire.spec, overrides: readOverrides(item.properties?.[LINKS_PROP]) });
    entry.items.push(item);
    flows.set(flow, entry);
  }
  return [...flows.values()];
}

function pickKeptFlow(flows: KeptFlow[], wanted: string | undefined): KeptFlow {
  if (flows.length === 0) throw new Error("nothing is kept — `isocan wire keep <screens...>` marks the screens a prototype plays");
  if (wanted !== undefined) {
    const found = flows.find((f) => f.flow === wanted);
    if (!found) throw new Error(`no kept screens in flow "${wanted}" — kept flows: ${flows.map((f) => `${f.flow || "(hand-drawn)"} "${f.request}"`).join(", ")}`);
    return found;
  }
  if (flows.length > 1) {
    throw new Error(`kept screens come from ${flows.length} flows — say which with --flow:\n  ${flows.map((f) => `--flow ${f.flow || '""'}  "${f.request}" (${f.screens.length} kept)`).join("\n  ")}`);
  }
  return flows[0]!;
}

function linkLine(l: WireLink, title: (id: string) => string): string {
  const where = l.to === LINK_BACK ? "back" : l.to ? `→ "${title(l.to)}"` : l.needs ? `- - needs ${l.needs}` : "off";
  return `  ${l.key.padEnd(18)} ${l.label.padEnd(16)} ${where.padEnd(28)} ${l.rule}${l.to && l.to !== LINK_BACK ? `, ${l.transition}` : ""}`;
}

export function registerLinks(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson } = host;

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
        const flows = await keptFlows(ctx, p.id, snapshot);
        const only = ref ? resolveItem(snapshot, ref) : null;
        const flow = only ? flows.find((f) => f.screens.some((s) => s.id === only.id)) : pickKeptFlow(flows, opts.flow);
        if (!flow) throw new Error(`"${only!.title}" is not a kept screen — links run between kept screens (\`isocan wire keep ${only!.id}\`)`);
        const links = inferLinks(flow.screens, { withNone: true });
        const shown = only ? links.filter((l) => l.from === only.id) : links;
        if (ctx.json) return printJson({ flow: flow.flow, request: flow.request, screens: flow.screens.map((s) => ({ itemId: s.id, title: s.title })), links: shown });
        const title = (id: string) => flow.screens.find((s) => s.id === id)?.title ?? id;
        for (const s of flow.screens) {
          if (only && s.id !== only.id) continue;
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
        const wires = await wiresOn(ctx, p.id, snapshot);
        const source = wires.find((w) => w.item === item.id);
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
          if (!wires.some((w) => w.item === to!.id)) throw new Error(`"${to.title}" is not a wireframe screen — a link goes to a screen`);
          value = to.id;
        }
        const overrides = readOverrides(item.properties?.[LINKS_PROP]);
        if (value === null) delete overrides[key];
        else overrides[key] = value;
        const patch = Object.keys(overrides).length ? { properties: { [LINKS_PROP]: JSON.stringify(overrides) } } : { removeProperties: [LINKS_PROP] };
        await sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch }, newGroupId());
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
        const snapshot = await ctx.client.snapshot(p.id);
        const flow = pickKeptFlow(await keptFlows(ctx, p.id, snapshot), opts.flow);
        const links = inferLinks(flow.screens);
        const title = `Prototype · ${flow.request.length > 60 ? `${flow.request.slice(0, 59)}…` : flow.request || "hand-drawn screens"}`;
        const html = assemblePrototype(flow.screens, links, { title });
        const { width, height } = prototypeSize(flow.screens);
        const filename = "prototype.html";
        const upload = await ctx.client.uploadBlob(p.id, Buffer.from(html, "utf8"), "text/html", filename);
        const version = { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
        const existing = Object.values(snapshot.canvas.items ?? {}).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
        const group = newGroupId();
        let itemId: string;
        let what: "added" | "versioned" | "unchanged";
        if (existing) {
          itemId = existing.id;
          const current = existing.versions.find((v) => v.id === existing.currentVersionId) ?? existing.versions[existing.versions.length - 1];
          if (current?.blobHash === upload.blobHash) what = "unchanged";
          else {
            await sendOp(ctx, p.id, { type: "item.addVersion", itemId, version }, group);
            if (existing.width !== width || existing.height !== height) await sendOp(ctx, p.id, { type: "item.resize", itemId, width, height }, group);
            if (existing.title !== title) await sendOp(ctx, p.id, { type: "item.update", itemId, patch: { title } }, group);
            what = "versioned";
          }
        } else {
          itemId = newItemId();
          // Right of everything in the kept screens' band — their unkept siblings too — so it covers nothing.
          const top = Math.min(...flow.items.map((i) => i.y));
          const bottom = top + height;
          const band = Object.values(snapshot.canvas.items ?? {}).filter((i) => i.y < bottom && i.y + i.height > top);
          const right = Math.max(...flow.items.map((i) => i.x + i.width), ...band.map((i) => i.x + i.width));
          await sendOp(ctx, p.id, {
            type: "item.add",
            itemId,
            version,
            width,
            height,
            placement: { x: Math.round(right + 120), y: Math.round(top), chosen: true } as never,
            title,
            // A wireframe's fidelity, so the design-system gate does not count it as an undesigned screen.
            properties: { [FIDELITY_PROP]: "wireframe", [PROTOTYPE_PROP]: flow.flow },
          }, group);
          what = "added";
        }
        const after = await ctx.client.snapshot(p.id);
        const versions = after.canvas.items[itemId]?.versions.length ?? 0;
        const dashed = links.filter((l) => l.to === null && l.needs);
        if (ctx.json) return printJson({ itemId, title, flow: flow.flow, screens: flow.screens.length, links: links.length, dashed: dashed.length, versions, [what]: true });
        console.log(`${itemId}  "${title}" — ${what === "added" ? "added beside the kept screens" : what === "versioned" ? `version ${versions}` : `unchanged (still version ${versions}) — nothing kept has changed`}`);
        console.log(`  ${flow.screens.length} screens: ${flow.screens.map((s) => s.title).join(" · ")}`);
        console.log(`  ${links.length} links, ${dashed.length} dashed${dashed.length ? ` (needs ${[...new Set(dashed.map((l) => l.needs))].join(", ")})` : ""} · \`isocan open ${itemId}\` plays it${what === "unchanged" ? "" : " · `isocan undo` takes it back"}`);
      }),
    );
}
