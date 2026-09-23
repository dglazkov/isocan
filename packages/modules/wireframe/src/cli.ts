import guideText from "../agent-guide.md";
import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { FIDELITY_PROP, newItemId, newVersionId } from "@isocan/core";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import {
  BLOCKS, INTENTS, PLATFORMS, PRIMITIVES, RECIPES, blueprint, renderWire, validateWire, wireSize, wireframe,
  type Component, type Platform, type WireSpec,
} from "./core.ts";
import { wireframeModule } from "./record.ts";
import { answer, questions, registerCompose } from "./compose-cli.ts";

/**
 * **Wireframes from the terminal** — the agent's hands on the same catalog
 * and the same renderer the web app would use.
 *
 * `wire "<request>"` is phase 1's: a flow composed in three rounds by an
 * answerer (Jev, the stub, or an agent through `wire questions|answer`),
 * skeleton first and filled in place — `compose-cli.ts`.
 *
 * `wire render` is the phase-0 act: a spec in, a screen out, as ONE
 * `item.add` of an ordinary HTML file with the spec inside it. Nothing new
 * reaches the wire, so undo, versions, comments and presence already work on
 * a screen; take this module away and every screen still renders — only
 * these verbs are gone. `wire spec` and `wire catalog` exist so an agent can
 * write a valid spec without reading this module's source.
 */

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screen";
}

/** A component as JSON: its draw function and element predicates left out. */
function asData({ id, category, props, elements }: Component) {
  return { id, category, props, elements: Object.fromEntries(Object.entries(elements ?? {}).map(([k, e]) => [k, { accepts: e.accepts, default: e.default }])) };
}

function register(host: CliHost): void {
  const { run, ctxOf, resolveCanvas, sendOp, printJson, placementFor } = host;
  const wire = host.program
    .command("wire")
    .description("Wireframes: `wire \"<request>\"` composes a flow of screens from a catalog of blocks — a blue blueprint where a slot is undecided, grey where it is chosen");
  registerCompose(host, wire);

  wire
    .command("questions")
    .description("Print the pending round of a wireframe flow as a question file, in Jev's request shape — for an agent to answer in Jev's place")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "which flow (default: the newest one waiting on answers)")
    .action(run((opts: { flow?: string }, cmd: Command) => questions(host, opts, cmd)));

  wire
    .command("answer <file>")
    .description("Apply a question file whose calls each carry a `response` in Jev's response shape — the screens fill in place, in the flow's op group")
    .option("--canvas <canvas>")
    .action(run((file: string, _opts: unknown, cmd: Command) => answer(host, file, cmd)));

  wire
    .command("render <spec>")
    .description("Draw a wireframe spec (a JSON file) and add it to the canvas as an HTML screen with the spec inside it")
    .option("--canvas <canvas>")
    .option("--title <title>", "the item's title (default: the spec's title)")
    .option("--at <x,y>", "place at world coordinates")
    .option("--anchor <item>", "place to the left of this item")
    .option("--in <group>", "insert into this group")
    .option("--cell <row,col>", "with --in: one cell of the sheet's grid")
    .action(
      run(async (file: string, _local: unknown, cmd: Command) => {
        // `--at` is `wire`'s own flag too (it starts a composed row), so read
        // it wherever commander put it.
        const opts = cmd.optsWithGlobals() as { title?: string; at?: string; anchor?: string; in?: string; cell?: string };
        let spec: WireSpec;
        try {
          spec = JSON.parse(await readFile(file, "utf8")) as WireSpec;
        } catch (error) {
          throw new Error(`${file} is not a JSON file this can read: ${(error as Error).message}`);
        }
        const problems = validateWire(spec);
        if (problems.length > 0) {
          throw new Error(`${file} is not a drawable wireframe spec:\n  ${problems.join("\n  ")}\n  \`isocan wire spec <archetype>\` prints one that is.`);
        }
        const html = renderWire(spec);
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const title = opts.title ?? spec.title;
        const filename = `${slugOf(title)}.html`;
        const upload = await ctx.client.uploadBlob(p.id, Buffer.from(html, "utf8"), "text/html", filename);
        const { width, height } = wireSize(spec);
        const itemId = newItemId();
        const result = await sendOp(ctx, p.id, {
          type: "item.add",
          itemId,
          version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size },
          width,
          height,
          placement: placementFor(snapshot, opts, { width, height }) as never,
          title,
          properties: { [FIDELITY_PROP]: "wireframe" },
        });
        const at = host.insertionReceiptPlacement(result.envelope.op, itemId);
        const slots = spec.slots.length;
        const open = spec.slots.filter((s) => s.block === null).length;
        if (ctx.json) return printJson({ itemId, title, archetype: spec.archetype, platform: spec.platform, slots, undecided: open, ...at });
        console.log(`${itemId}  ${title} — ${spec.archetype}, ${spec.platform}, ${open === 0 ? "wireframe" : open === slots ? "blueprint" : `${slots - open} of ${slots} slots chosen`}`);
      }),
    );

  wire
    .command("spec <archetype>")
    .description("Print a spec for an archetype — a blueprint (every slot undecided), or with --resolved each slot's first block at its defaults")
    .option("--platform <platform>", `one of ${PLATFORMS.join(", ")} (default: the archetype's first)`)
    .option("--resolved", "choose each slot's first option, with default props and intents")
    .option("--title <title>")
    .option("--request <words>", "the words that asked for it")
    .action(
      run(async (archetype: string, opts: { platform?: string; resolved?: boolean; title?: string; request?: string }) => {
        if (opts.platform !== undefined && !PLATFORMS.includes(opts.platform as Platform)) {
          throw new Error(`--platform must be one of ${PLATFORMS.join(", ")} — got: ${opts.platform}`);
        }
        const o = {
          ...(opts.platform ? { platform: opts.platform as Platform } : {}),
          ...(opts.title ? { title: opts.title } : {}),
          ...(opts.request ? { request: opts.request } : {}),
        };
        console.log(JSON.stringify(opts.resolved ? wireframe(archetype, o) : blueprint(archetype, o), null, 2));
      }),
    );

  wire
    .command("catalog")
    .description("List the archetypes (with each slot's options), and count the blocks, primitives and intents")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        if ((cmd.optsWithGlobals() as { json?: boolean }).json) {
          return printJson({
            archetypes: RECIPES,
            blocks: BLOCKS.map(asData),
            primitives: PRIMITIVES.map(asData),
            intents: INTENTS,
          });
        }
        for (const r of RECIPES) {
          console.log(`${r.id} (${r.platforms.join(", ")})`);
          for (const s of r.sections) console.log(`  ${s.slot.padEnd(9)} ${s.options.join(" | ")}${s.optional ? "  (optional)" : ""}`);
        }
        console.log(`\n${RECIPES.length} archetypes, ${BLOCKS.length} blocks, ${PRIMITIVES.length} primitives, ${INTENTS.length} intents — \`isocan wire catalog --json\` has every prop and intent.`);
      }),
    );
}

export const wireframeCli: CliModule = {
  core: wireframeModule,
  register,
  guide: guideText,
};

export default wireframeCli;
