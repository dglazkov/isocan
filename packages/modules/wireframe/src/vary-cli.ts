import type { Command } from "commander";
import { newGroupId, type CanvasContents } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { FlowCanvas, addVariations, wiresOn } from "./compose-cli.ts";
import { KEEP_EMOJI, isKept, keepPatch, keepable, kept } from "./keep.ts";
import { wireTitle } from "./spec.ts";
import { DEFAULT_VARIATIONS, decisions, flipWords, honestFlips, VARIATION_FLOOR } from "./vary.ts";

/**
 * **`wire vary`, `wire keep|unkeep`, `wire kept`** — phase 2's verbs.
 *
 * `vary` adds a screen's variations on demand, from the distribution its
 * answerer already gave (nothing is asked again), placed under the screen in
 * an op group of their own. `keep` and `unkeep` are one `item.update` each —
 * the same property patch the web app's menu entry and ⇧K send — under one
 * group, so one undo takes a gesture back.
 */

export function registerVary(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson } = host;

  wire
    .command("vary <screen>")
    .description("Add a screen's variations under it — each flips the least certain remaining decision to its runner-up, from the distribution the answerer already gave")
    .option("--canvas <canvas>")
    .option("--count <n>", `how many variations the screen should have in all (default ${DEFAULT_VARIATIONS})`)
    .action(
      run(async (ref: string, _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { count?: string };
        const count = opts.count === undefined ? DEFAULT_VARIATIONS : Number(opts.count);
        if (!Number.isInteger(count) || count < 0) throw new Error(`--count must be a whole number — got: ${opts.count}`);
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const item = resolveItem(snapshot, ref);
        const wires = await wiresOn(ctx, p.id, snapshot);
        const screen = wires.find((w) => w.item === item.id);
        if (!screen) throw new Error(`"${item.title}" is not a wireframe screen — \`isocan wire "<request>"\` composes some`);
        if (screen.spec.variantOf) {
          const of = snapshot.canvas.items[screen.spec.variantOf];
          throw new Error(`"${item.title}" is a variation${of ? ` of "${of.title}"` : ""} — vary the screen itself: \`isocan wire vary ${screen.spec.variantOf}\``);
        }
        if (decisions(screen.spec).length === 0) {
          throw new Error(`"${item.title}" carries no answerer's distribution (drawn by hand, or not yet answered) — there is nothing to vary it from`);
        }
        const siblings = wires.filter((w) => w.spec.variantOf === screen.item);
        const canvas = new FlowCanvas(host, ctx, p.id, newGroupId());
        const made = await addVariations(canvas, screen, siblings, count);
        const left = honestFlips(screen.spec, [...siblings, ...made].map((v) => v.spec.flip!).filter(Boolean));
        if (ctx.json) {
          return printJson({
            screen: screen.item,
            added: made.map((v) => ({ itemId: v.item, title: wireTitle(v.spec), flip: v.spec.flip })),
            siblings: siblings.length + made.length,
            honestLeft: left.length,
          });
        }
        for (const v of made) console.log(`${v.item}  ${wireTitle(v.spec)}`);
        const total = siblings.length + made.length;
        if (made.length === 0 && total === 0) {
          console.log(`"${item.title}" — one way to draw this: no decision's runner-up reached ${VARIATION_FLOOR.toFixed(2)}`);
        } else if (made.length === 0) {
          console.log(`"${item.title}" already has ${total} variation${total === 1 ? "" : "s"}${left.length ? ` — --count ${total + 1} adds the next (${flipWords(left[0]!)})` : ", and no honest alternative is left"}`);
        } else {
          console.log(`${made.length} added under "${item.title}" (${total} in all)${left.length ? "" : " — no honest alternative is left"} · \`isocan undo\` takes them back`);
        }
      }),
    );

  const mark = (on: boolean) =>
    run(async (refs: string[], _local: unknown, cmd: Command) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const items = refs.map((ref) => resolveItem(snapshot, ref));
      const refused = items.filter((item) => !keepable(item));
      if (refused.length) {
        throw new Error(`not a wireframe screen: ${refused.map((i) => `"${i.title}"`).join(", ")} — the keep mark is for screens \`isocan wire\` drew`);
      }
      const group = newGroupId();
      const changed: string[] = [];
      for (const item of items) {
        if (isKept(item) === on || changed.includes(item.id)) continue;
        await sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: keepPatch(on) }, group);
        changed.push(item.id);
      }
      if (ctx.json) return printJson({ [on ? "kept" : "unkept"]: changed, unchanged: items.filter((i) => !changed.includes(i.id)).map((i) => i.id) });
      for (const item of items) {
        const moved = changed.includes(item.id);
        console.log(`${item.id}  ${on ? KEEP_EMOJI : "  "} "${item.title}" ${on ? (moved ? "kept" : "was already kept") : moved ? "unkept" : "was not kept"}`);
      }
    });

  wire
    .command("keep <items...>")
    .description(`Mark screens as keepers (${KEEP_EMOJI}) — a property on the item, as a slide is, so anyone can take it off`)
    .option("--canvas <canvas>")
    .action(mark(true));

  wire
    .command("unkeep <items...>")
    .description(`Take the keep mark (${KEEP_EMOJI}) off screens — anyone's mark, not only your own`)
    .option("--canvas <canvas>")
    .action(mark(false));

  wire
    .command("kept")
    .description(`List the kept screens (${KEEP_EMOJI}) in reading order — rows top to bottom, each left to right`)
    .option("--canvas <canvas>")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(p.id);
        const list = kept(snapshot.canvas as CanvasContents);
        if (ctx.json) return printJson(list.map((i, n) => ({ n: n + 1, itemId: i.id, title: i.title })));
        if (list.length === 0) {
          console.log(`nothing is kept — \`isocan wire keep <items...>\` marks screens ${KEEP_EMOJI}`);
          return;
        }
        list.forEach((i, n) => console.log(`${String(n + 1).padStart(2)}. ${KEEP_EMOJI} ${i.id}  ${i.title}`));
      }),
    );
}
