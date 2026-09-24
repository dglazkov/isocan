import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { newGroupId, newVersionId } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { cliAnswerer, cliPort } from "./cli-port.ts";
import { PACKS } from "./content/packs.ts";
import { applyCopy, copyOf, type CopyFile } from "./content/flesh-spec.ts";
import { flesh, fleshLines, fleshSummary } from "./flesh.ts";
import { wiresOn, type Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import { currentVersionOf } from "./port.ts";
import { renderWire } from "./render.ts";
import { wireTitle } from "./spec.ts";

/**
 * **`isocan wire flesh` and `isocan wire copy`** (design §10, journey scene 7).
 *
 * `flesh` is `flesh.ts` over the CLI's port, with the answerer the terminal
 * picks (Jev with a key here, else the home's judge, else the stub — whose
 * flat distribution always falls under the floor, so the generic pack fills
 * and the line says so). `copy` prints a screen's words by slot and path, and
 * with `--apply <file>` writes an agent's exact words back as one version.
 *
 * `--pack` and `--flesh` are `wire`'s own options (it composes with them), so
 * the subcommands read them with `optsWithGlobals()`, as `render` reads `--at`.
 */

async function screensFor(host: CliHost, snapshot: { canvas: unknown }, all: Screen[], refs: string[], flow: string | undefined): Promise<Screen[]> {
  if (refs.length > 0) {
    return refs.map((ref) => {
      const item = host.resolveItem(snapshot as never, ref) as { id: string; title: string };
      const found = all.find((s) => s.item === item.id);
      if (!found) throw new Error(`"${item.title}" is not a wireframe screen — \`isocan wire "<request>"\` composes some`);
      return found;
    });
  }
  const screens = flow === undefined ? all : all.filter((s) => s.spec.flow === flow);
  if (screens.length === 0) throw new Error(flow === undefined ? "no wireframe on this canvas — `isocan wire \"<request>\"` composes some" : `no wireframe in flow "${flow}" on this canvas`);
  return screens;
}

export function registerFlesh(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, printJson } = host;

  wire
    .command("flesh [screens...]")
    .description("Fill wires with sample content instead of grey bars — Jev picks one content pack per flow from its request (p recorded; --pack <id> overrides); one op group, a version per changed wire. --bars goes back to bars")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens and their variations")
    .option("--bars", "back to bars: take the content off")
    .option("--packs", "write nothing: list the content packs")
    .action(
      run(async (refs: string[], _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { flow?: string; bars?: boolean; packs?: boolean; pack?: string; answerer?: string; seed?: string };
        if (opts.packs) {
          if ((cmd.optsWithGlobals() as { json?: boolean }).json) return printJson({ packs: PACKS.map((p) => ({ id: p.id, name: p.name, about: p.about, motifs: p.motifs })) });
          for (const p of PACKS) console.log(`${p.id.padEnd(14)} ${p.name} — ${p.about}`);
          return;
        }
        if (opts.bars && opts.pack !== undefined) throw new Error("--bars takes content off and --pack puts it on — say one");
        const ctx = await ctxOf(cmd);
        const say = (line: string) => {
          if (!ctx.json) console.log(line);
        };
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const snapshot = await ctx.client.snapshot(p.id);
        const all = await wiresOn(port, snapshot.canvas);
        const screens = await screensFor(host, snapshot, all, refs, opts.flow);
        // An agent answers rounds, not a pack: `--answerer agent` asks with whatever this machine has.
        const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? undefined : opts.answerer, Number(opts.seed ?? 1), say);
        const r = await flesh(port, snapshot.canvas, all, screens, answerer, { ...(opts.pack !== undefined ? { pack: opts.pack } : {}), bars: Boolean(opts.bars) });
        if (ctx.json) {
          return printJson({
            group: r.group,
            content: opts.bars ? "bars" : "pack",
            packs: [...r.choices].map(([flow, c]) => ({ flow, pack: c.pack, leaned: c.leaned, p: c.p, how: c.how, by: c.by })),
            fleshed: r.changed.map((t) => ({ itemId: t.screen.item, title: wireTitle(t.spec), pack: t.spec.content?.pack ?? null, heading: t.spec.content?.title ?? null })),
            unchanged: r.targets.filter((t) => !r.changed.includes(t)).map((t) => ({ itemId: t.screen.item, ...(t.skipped ? { skipped: t.skipped } : {}) })),
            prototypes: r.prototypes,
            calls: r.calls,
            inputTokens: r.inputTokens,
          });
        }
        for (const line of fleshLines(r)) say(line);
        for (const t of r.changed) say(`${t.screen.item}  ${wireTitle(t.spec)}${t.spec.content?.title ? ` — "${t.spec.content.title}"` : ""}`);
        say(fleshSummary(r, Boolean(opts.bars)).replace("one undo takes", "`isocan undo` takes"));
      }),
    );

  wire
    .command("copy <screen>")
    .description("Print a fleshed screen's words by slot and path, as a file to edit; --apply <file> writes exact words back (source \"copy\") as one version")
    .option("--canvas <canvas>")
    .option("--apply <file>", "a JSON file: { \"title\"?: string, \"slots\": { \"<slot>\": { \"<path>\": \"words\" } | [\"words\", …] } }")
    .option("--by <name>", "who wrote the words — recorded on the screen", "agent")
    .action(
      run(async (ref: string, _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { apply?: string; by: string };
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const snapshot = await ctx.client.snapshot(p.id);
        const all = await wiresOn(port, snapshot.canvas);
        const [screen] = await screensFor(host, snapshot, all, [ref], undefined);
        const spec = screen!.spec;
        if (!opts.apply) {
          const words = copyOf(spec);
          if (!spec.content) throw new Error(`"${wireTitle(spec)}" draws bars — \`isocan wire flesh ${screen!.item}\` fills it first; then \`wire copy\` prints its words to replace`);
          // A file to edit, whatever --json says — as `wire questions` prints one.
          console.log(JSON.stringify({
            screen: screen!.item,
            title: words.title,
            ...(spec.content.bar !== undefined ? { bar: spec.content.bar } : {}),
            content: words.content,
            slots: Object.fromEntries(words.slots.map((s) => [s.slot, { block: s.block, words: s.words }])),
          }, null, 2));
          return;
        }
        let raw: CopyFile & { slots?: Record<string, unknown> };
        try {
          raw = JSON.parse(await readFile(opts.apply, "utf8"));
        } catch (error) {
          throw new Error(`${opts.apply} is not a JSON file this can read: ${(error as Error).message}`);
        }
        // `wire copy` prints { block, words } per slot; the file may give that back as it is.
        const slots = Object.fromEntries(Object.entries(raw.slots ?? {}).map(([k, v]) => [k, (v as { words?: unknown })?.words ?? v])) as CopyFile["slots"];
        const next = applyCopy(spec, { ...(raw.title !== undefined ? { title: raw.title } : {}), ...(raw.bar !== undefined ? { bar: raw.bar } : {}), ...(slots ? { slots } : {}) }, opts.by);
        if (JSON.stringify(next) === JSON.stringify(spec)) {
          if (ctx.json) return printJson({ itemId: screen!.item, changed: false });
          console.log(`${screen!.item}  ${wireTitle(spec)} — the same words; nothing written`);
          return;
        }
        const item = snapshot.canvas.items[screen!.item]!;
        const filename = currentVersionOf(item)?.filename ?? "wireframe.html";
        const group = newGroupId();
        const upload = await port.put(renderWire(next), "text/html", filename);
        await port.send({ type: "item.addVersion", itemId: item.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
        const prototypes = await rebuildPrototypes(port, snapshot.canvas, all, [{ item: item.id, spec: next }], group);
        if (ctx.json) return printJson({ itemId: item.id, changed: true, group, content: next.content, prototypes });
        console.log(`${item.id}  ${wireTitle(next)} — exact copy by ${opts.by}, one version${prototypes.length ? `, prototype rebuilt` : ""} — \`isocan undo\` takes it back`);
      }),
    );
}
