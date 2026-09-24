import type { Command } from "commander";
import { itemUrl } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { cliPort } from "./cli-port.ts";
import { wiresOn } from "./flow.ts";
import { keptFlowsOf } from "./kept-flows.ts";
import { hotspots } from "./links.ts";
import { PROTOTYPE_PROP, playAnchor } from "./prototype.ts";

/**
 * **`wire play <screen> [element]`** — *Play from here*, from a terminal
 * (phase 8, research *Flow arrows*: "What it would take, on both surfaces").
 *
 * On the canvas a selected arrow opens the flow's prototype full screen at the
 * arrow's source screen. This prints that same address: the prototype item's
 * full-screen route with `?at=screen=<id>&hot=<key>`, which the viewer hands
 * to the prototype's frame as its fragment and the prototype's router opens
 * at. Nothing is written — what somebody is looking at is not a mutation — so
 * the verb's whole job is the address, the way `isocan open <item>` hands
 * one over.
 */

export function registerPlay(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  wire
    .command("play <screen> [element]")
    .description("Print the address that opens the flow's prototype full screen AT this screen of it — with [element], its hotspot pointed out. What an arrow's Play from here opens")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, element: string | undefined, _local: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const screen = resolveItem(snapshot, ref);
        const flows = keptFlowsOf(snapshot.canvas, await wiresOn(cliPort(host, ctx, p.id), snapshot.canvas));
        const flow = flows.find((f) => f.screens.some((s) => s.id === screen.id));
        if (!flow) throw new Error(`"${screen.title}" is not in the prototype — a prototype plays the screens used in it (\`isocan wire use ${screen.id}\`)`);
        const proto = Object.values(snapshot.canvas.items).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
        if (!proto) throw new Error(`this flow has no prototype yet — \`isocan wire prototype${flows.length > 1 ? ` --flow ${flow.flow}` : ""}\` makes one`);
        let key: string | undefined;
        if (element !== undefined) {
          const keys = hotspots(flow.screens.find((s) => s.id === screen.id)!.spec).map((h) => h.key);
          const matches = keys.includes(element) ? [element] : keys.filter((k) => k.endsWith(`#${element}`));
          if (matches.length !== 1) throw new Error(`${matches.length === 0 ? `"${screen.title}" has no hotspot "${element}"` : `"${element}" is on more than one slot`} — its hotspots: ${keys.join(", ")}`);
          key = matches[0]!;
        }
        const origin = (await ctx.homeOf(p.id)) ?? ctx.client.base;
        const url = `${itemUrl(origin, p.id, proto.id)}?at=${encodeURIComponent(playAnchor(screen.id, key))}`;
        if (ctx.json) return printJson({ prototype: proto.id, screen: screen.id, ...(key ? { hotspot: key } : {}), url });
        console.log(url);
        console.log(`  "${proto.title}" at "${screen.title}"${key ? `, ${key} pointed out` : ""} — open it in a browser signed in to this canvas (\`isocan open\` signs one in)`);
      }),
    );
}
