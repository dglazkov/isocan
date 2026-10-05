import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { FIDELITY_PROP, newItemId, newVersionId, titleSlug } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import {
  BLOCKS, INTENTS, PLATFORMS, PRIMITIVES, RECIPES, blueprint, renderWire, validateWire, wireSize, wireTitle, wireframe,
  type Component, type Platform, type WireSpec,
} from "./core.ts";
import { answer, questions, registerCompose } from "./compose-cli.ts";
import { markScreens, registerVary } from "./vary-cli.ts";
import { registerLinks } from "./links-cli.ts";
import { registerStyle } from "./style-cli.ts";
import { registerFlesh } from "./flesh-cli.ts";
import { registerPlay } from "./play-cli.ts";
import { registerEditAndWhy } from "./edit-cli.ts";
import { registerVoice } from "./voice-cli.ts";
import { cliPort } from "./cli-port.ts";
import { wiresOn } from "./flow.ts";
import { rerender, rerenderLines, rerenderSummary } from "./rerender.ts";

/** A screen's filename stem: core's one title rule (cleanup DU-2), or "screen". */
function slugOf(title: string): string {
  return titleSlug(title) || "screen";
}

/** A component as JSON: its draw function and element predicates left out. */
function asData({ id, category, props, elements }: Component) {
  return { id, category, props, elements: Object.fromEntries(Object.entries(elements ?? {}).map(([k, e]) => [k, { accepts: e.accepts, default: e.default }])) };
}

function registerRuntime(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, sendOp, printJson, placementFor } = host;
  registerCompose(host, wire);
  registerVary(host, wire);
  registerLinks(host, wire);
  registerStyle(host, wire);
  registerFlesh(host, wire);
  registerPlay(host, wire);
  registerEditAndWhy(host, wire);
  registerVoice(host, wire);

  wire
    .command("use <screens...>")
    .description("Use screens in the prototype (📐) — the same act as `wire keep`, in the words the item menu says")
    .option("--canvas <canvas>")
    .action(markScreens(host, true));

  wire
    .command("unuse <screens...>")
    .description("Remove screens from the prototype (📐) — the same act as `wire unkeep`")
    .option("--canvas <canvas>")
    .action(markScreens(host, false));

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
    .command("render [spec]")
    .description("Draw a wireframe spec (a JSON file) and add it to the canvas as an HTML screen with the spec inside it — or, with --all, draw every wire on the canvas again from the spec it carries (one op group; a version only where the bytes change)")
    .option("--canvas <canvas>")
    .option("--all", "re-render every wire already on the canvas from its own spec — how a renderer change reaches screens drawn before it")
    .option("--flow <flow>", "with --all: only this flow's screens and their variations")
    .option("--title <title>", "the item's title (default: the spec's title)")
    .option("--at <x,y>", "place at world coordinates")
    .option("--anchor <item>", "place to the left of this item")
    .option("--in <group>", "insert into this group")
    .option("--cell <row,col>", "with --in: one cell of the sheet's grid")
    .action(
      run(async (file: string | undefined, _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { title?: string; at?: string; anchor?: string; in?: string; cell?: string; all?: boolean; flow?: string };
        if (opts.all || opts.flow !== undefined) {
          if (file !== undefined) throw new Error("--all draws the wires already on the canvas — give it no spec file");
          return rerenderAll(host, cmd, opts.flow);
        }
        if (file === undefined) throw new Error("which spec? `isocan wire render <spec.json>` adds a screen; `isocan wire render --all` re-renders the ones already here");
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
        const title = opts.title ?? wireTitle(spec);
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

/** `wire render --all [--flow]`: every wire drawn again from its spec, one op group. */
async function rerenderAll(host: CliHost, cmd: Command, flow: string | undefined): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const p = await host.resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  const screens = flow === undefined ? all : all.filter((s) => s.spec.flow === flow);
  if (screens.length === 0) throw new Error(flow === undefined ? "no wireframe on this canvas — `isocan wire \"<request>\"` composes some" : `no wireframe in flow "${flow}" on this canvas`);
  const r = await rerender(port, canvas, all, screens);
  if (ctx.json) {
    return host.printJson({
      group: r.group,
      wires: r.screens.length,
      rerendered: r.changed.map((s) => ({ itemId: s.item, title: wireTitle(s.spec) })),
      unchanged: r.screens.length - r.changed.length,
      resized: r.resized,
      prototypes: r.prototypes,
    });
  }
  for (const line of rerenderLines(r)) console.log(line);
  for (const pr of r.prototypes) if (pr.what !== "unchanged") console.log(`prototype ${pr.itemId} — ${pr.what === "moved" ? "moved back above its flow" : "rebuilt as a new version"}`);
  console.log(rerenderSummary(r).replace("one undo takes", "`isocan undo` takes"));
}

type ActionFn = (...args: unknown[]) => Promise<void>;

/**
 * Lazy entry for `isocan wire` actions so the CLI startup bundle (`isocan --version`)
 * does not load the wireframe catalog, content packs, or renderer until a `wire`
 * command actually runs.
 */
export async function executeWire(host: CliHost, subcommand: string, args: unknown[]): Promise<void> {
  const actions = new Map<string, ActionFn>();
  const rawHost: CliHost = { ...host, run: (fn) => fn };
  const makeCmd = (name: string) => {
    const cmd = {
      description: () => cmd,
      argument: () => cmd,
      option: () => cmd,
      action: (fn: ActionFn) => {
        actions.set(name, fn);
        return cmd;
      },
      command: (spec: string) => makeCmd(spec.split(/\s+/)[0]!),
    };
    return cmd;
  };
  registerRuntime(rawHost, makeCmd("") as unknown as Command);
  const fn = actions.get(subcommand);
  if (!fn) throw new Error(`unknown wire subcommand: ${subcommand}`);
  await fn(...args);
}
