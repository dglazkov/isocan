import guideText from "../agent-guide.md";
import { existsSync, readFileSync } from "node:fs";
import type { Command } from "commander";
import { moduleAsset, moduleSlug, newItemId, newVersionId, type CanvasSnapshotResponse } from "@isocan/core";
import { packagePath } from "@isocan/core/packageroot";
import type { CliHost, CliModule, Ctx } from "@isocan/cli/modulehost";
import {
  CRITIC_PROP,
  canvasClashes,
  criticItems,
  criticMarkdown,
  criticProblems,
  draftFromRoster,
  findInRoster,
  lensPath,
  readCritic,
  readLens,
  refuseJoin,
  roster,
  skeletonDraft,
  critiqueCore,
  type CanvasCritic,
  type CriticDraft,
  type Lens,
  type RosterEntry,
} from "./core.ts";

/**
 * **Critics, from a terminal** — `isocan critic ls|add|new`. The web's
 * Critics panel is critique phase 4; until then these are the doors, and
 * editing a critic is `isocan edit` on its card like any markdown item.
 */

/** A critic card's size on the canvas: a column of questions, not a page. */
const CARD = { width: 360, height: 440 };

/**
 * **A roster entry's lens**, from the module that contributed it.
 *
 * `moduleAsset` answers for a module installed at runtime. A module built in
 * (how design-competition ships) registers no base, so its files are where
 * every built-in module's are in this copy: `packages/modules/<slug>/`. When
 * the file is not there at all, the three questions on the record are the
 * lens, and the two headings are left for a person to write.
 */
function lensOf(entry: RosterEntry): Lens {
  const rel = lensPath(entry.critic);
  const where = moduleAsset(entry.module, rel) ?? packagePath("packages/modules", moduleSlug(entry.module), rel);
  if (existsSync(where)) {
    const lens = readLens(readFileSync(where, "utf8"));
    if (lens.questions.length > 0) return lens;
  }
  return { questions: [...entry.critic.critique], looksFor: "", ranks: "" };
}

/** Every critic on this canvas, read from its card's current bytes. A card
 *  edited into something that is no longer a critic is left out. */
async function criticsOn(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse): Promise<CanvasCritic[]> {
  const out: CanvasCritic[] = [];
  for (const item of criticItems(snapshot.canvas.items)) {
    const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
    if (!current) continue;
    const critic = readCritic((await ctx.client.downloadBlob(canvasId, current.blobHash)).toString("utf8"), current.filename);
    if (critic) out.push({ itemId: item.id, critic });
  }
  return out;
}

/** Write one critic card: one blob, one `item.add`, the property beside it. */
async function place(host: CliHost, ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, draft: CriticDraft, opts: { at?: string }): Promise<string> {
  const text = criticMarkdown(draft);
  const filename = `${draft.name}.md`;
  const upload = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), "text/markdown", filename);
  const itemId = newItemId();
  await host.sendOp(ctx, canvasId, {
    type: "item.add",
    itemId,
    version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/markdown", filename, size: upload.size },
    width: CARD.width,
    height: CARD.height,
    placement: host.placementFor(snapshot, opts, CARD),
    title: draft.agentName,
    properties: { [CRITIC_PROP]: draft.name },
  } as never);
  return itemId;
}

function register(host: CliHost): void {
  const { program, run, ctxOf, resolveCanvas, printJson } = host;
  const family = program
    .command("critic")
    .description("Critics on the canvas — personas that point and explain, and never edit")
    .addHelpText(
      "after",
      `
A critic is a markdown card in the persona format (critic: true). Add one from
the roster, or write your own; edit it with \`isocan edit <card> file.md\`.`,
    );

  family
    .command("ls")
    .alias("list")
    .description("The roster, and the critics on this canvas")
    .option("--canvas <canvas>")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const on = await criticsOn(ctx, canvas.id, snapshot);
        const clashes = new Map(canvasClashes(on).map((c) => [c.id, c.problem]));
        const rows = on.map(({ itemId, critic }) => ({
          itemId,
          name: critic.name,
          agentName: critic.agentName,
          credit: critic.credit,
          ...(critic.color ? { color: critic.color } : {}),
          questions: critic.questions,
          budget: critic.budget ?? null,
          problems: [...criticProblems(critic), ...(clashes.has(critic.name) ? [clashes.get(critic.name)!] : [])],
        }));
        const offered = roster().map(({ module, critic }) => ({ id: critic.id, agentName: critic.agentName, title: critic.title, credit: critic.credit, module }));
        if (ctx.json) return printJson({ roster: offered, critics: rows });
        console.log(offered.length ? "Roster (isocan critic add <id>):" : "Roster: none — no module contributes critics here; `isocan critic new \"<name>\"` writes one");
        for (const r of offered) console.log(`  ${r.id.padEnd(8)} ${r.agentName.padEnd(24)} ${r.credit}`);
        console.log(rows.length ? `On ${canvas.title}:` : `On ${canvas.title}: no critics yet`);
        for (const r of rows) {
          const budget = r.budget ? ` · ${r.budget.turnsPerRun ?? "?"} turns, $${r.budget.usdPerRun?.toFixed(2) ?? "?"}` : " · no budget";
          console.log(`  ${r.itemId}  ${r.agentName} — ${r.credit}${budget}`);
          r.questions.forEach((q, i) => console.log(`      ${i + 1}. ${q || "(unwritten)"}`));
          for (const p of r.problems) console.log(`      ! ${p}`);
        }
      }),
    );

  family
    .command("add <critic>")
    .description("Add a critic from the roster — its questions, what it looks for first, how it ranks")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "where to put the card")
    .action(
      run(async (ref: string, opts: { at?: string }, cmd: Command) => {
        const list = roster();
        const entry = findInRoster(list, ref);
        if (!entry) {
          throw new Error(list.length
            ? `no critic "${ref}" in the roster — try one of ${list.map((e) => e.critic.id).join(", ")}, or \`isocan critic new "<name>"\``
            : `no roster here — no module contributes critics; \`isocan critic new "<name>"\` writes one`);
        }
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const draft = draftFromRoster(entry.critic, lensOf(entry));
        const refused = refuseJoin(await criticsOn(ctx, canvas.id, snapshot), draft);
        if (refused) throw new Error(refused);
        const itemId = await place(host, ctx, canvas.id, snapshot, draft, opts);
        if (ctx.json) return printJson({ itemId, name: draft.name, agentName: draft.agentName, credit: draft.credit, questions: draft.lens.questions });
        console.log(`${draft.agentName} is on ${canvas.title} (${itemId}) — ${draft.credit}`);
      }),
    );

  family
    .command("new <name>")
    .description("Write a critic of your own: three empty questions and the two headings, to fill in")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "where to put the card")
    .option("--after <person>", "who it is an homage to — its name may not carry theirs")
    .option("--self", "you made it of yourself, so it may carry your own name")
    .action(
      run(async (name: string, opts: { at?: string; after?: string; self?: boolean }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const draft = skeletonDraft(name, { ...(opts.after ? { after: opts.after } : {}), ...(opts.self ? { self: true } : {}) });
        const refused = refuseJoin(await criticsOn(ctx, canvas.id, snapshot), draft);
        if (refused) throw new Error(refused);
        const itemId = await place(host, ctx, canvas.id, snapshot, draft, opts);
        if (ctx.json) return printJson({ itemId, name: draft.name, agentName: draft.agentName, credit: draft.credit });
        console.log(`${draft.agentName} is on ${canvas.title} (${itemId}) — three questions to write: \`isocan edit ${itemId} ${draft.name}.md\``);
      }),
    );
}

/** The CLI half. */
export const critiqueCli: CliModule = {
  core: critiqueCore,
  register,
  guide: guideText,
};

export default critiqueCli;
