import { existsSync, promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import type { CliHost, CliModule, Ctx } from "@isocan/cli/modulehost";
import {
  agentActorIds,
  collectCanvasActors,
  moduleAsset,
  newGroupId,
  newVersionId,
  type CanvasSnapshotResponse,
  type Item,
} from "@isocan/core";
import {
  FIGHTER_MIME,
  MEDALS,
  DOT,
  MISS,
  TROPHY,
  arenaOrigin,
  arenaPlan,
  bellPlan,
  briefMarkdown,
  cardJson,
  decidePlan,
  entriesOf,
  findBout,
  handinPatch,
  laneMarkdown,
  laneOfActor,
  laneOfItem,
  laneState,
  startPlan,
  timeLeft,
  type Bout,
  type EntryKind,
  type Minted,
} from "./bout.ts";
import { competitionCore } from "./core.ts";
import { findFighter, fighters, packPath, rosterClashes, type Fighter, type FighterPack, type PackFile } from "./packs.ts";
import { competitionTally, standings } from "./tally.ts";

/**
 * **The competition, from a terminal** — every button in the journey has a
 * verb here, so an agent can run a bout as fully as a person with the picker.
 * `isocan competition new` lays the arena, `start` casts the fighters,
 * `handin` / `bell` / `vote` / `decide` run it, `result` / `take` / `remix` /
 * `rematch` / `standings` are what it becomes.
 */

const OWN = competitionCore.name;

/** A pack's file as text — the module's own from its `assets/`, another
 *  module's from wherever that module was installed (proposed: `assets`). */
function packText(fighter: Fighter, file: PackFile): string {
  const rel = packPath(fighter.pack, file);
  const where =
    fighter.module === OWN
      ? fileURLToPath(new URL(`../${rel}`, import.meta.url))
      : moduleAsset(fighter.module, rel);
  if (!where || !existsSync(where)) throw new Error(`${fighter.pack.id}: ${rel} is not there`);
  return readFileSync(where, "utf8");
}

/** `20m`, `90s`, `1h` or a bare number of minutes — as minutes. */
function minutesOf(spec: string | undefined, fallback: number): number {
  if (!spec) return fallback;
  const m = /^(\d+(?:\.\d+)?)\s*(s|m|h)?$/.exec(spec.trim());
  if (!m) throw new Error(`"${spec}" is not a time — 20m, 90s or 1h`);
  const n = Number(m[1]);
  return m[2] === "s" ? n / 60 : m[2] === "h" ? n * 60 : n;
}

/** The roster, with clashes refused — the same list the picker shows. */
function roster(): Fighter[] {
  const all = fighters();
  const clashes = new Set(rosterClashes(all).map((c) => c.id));
  return all.filter((f) => !clashes.has(f.pack.id));
}

function boutOrSay(snapshot: CanvasSnapshotResponse, ref?: string): Bout {
  const bout = findBout(snapshot.canvas, ref);
  if (!bout) throw new Error(ref ? `no bout "${ref}" here — \`isocan competition status\`` : "no design competition on this canvas yet — `isocan competition new`");
  return bout;
}

function entryOrSay(snapshot: CanvasSnapshotResponse, bout: Bout, ref: string, host: CliHost): Item {
  const item = host.resolveItem(snapshot, ref);
  if (!entriesOf(bout).some((e) => e.id === item.id)) {
    throw new Error(`${item.title} is not an entry in this bout — entries are what a fighter handed in (\`isocan competition status\`)`);
  }
  return item;
}

async function mint(ctx: Ctx, canvasId: string, text: string, mimeType: string, filename: string): Promise<Minted> {
  const upload = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), mimeType, filename);
  return { blobHash: upload.blobHash, size: upload.size, mimeType, filename };
}

/** Everyone who counts as an agent here: the enrolled, and the fighters. */
function agentsOn(snapshot: CanvasSnapshotResponse): Set<string> {
  return agentActorIds([], snapshot.canvas);
}

/** Name an actor the way people type one: an id, a name, or a first name. */
function actorByRef(snapshot: CanvasSnapshotResponse, ref: string): { id: string; name: string } {
  const all = collectCanvasActors(snapshot.canvas);
  const q = ref.toLowerCase();
  const hit =
    all.find((a) => a.id === ref) ??
    all.find((a) => a.name.toLowerCase() === q) ??
    all.find((a) => a.name.toLowerCase().split(/\s+/)[0] === q);
  if (!hit) throw new Error(`nobody here answers to "${ref}"`);
  return hit;
}

/**
 * **Lay an arena** — shared by `new`, `remix` and `rematch`: mint every blob,
 * plan the ops, send them as one group. One undo removes the whole arena.
 */
async function layArena(
  host: CliHost,
  ctx: Ctx,
  canvasId: string,
  snapshot: CanvasSnapshotResponse,
  input: {
    brief: string;
    chosen: Fighter[];
    entryKind: EntryKind;
    minutes: number;
    decider: string;
    target: Item | null;
    at?: { x: number; y: number };
    parent?: string;
  },
) {
  const lanes: Record<string, { area: Minted; card: Minted; design: Minted; shelf: Minted }> = {};
  for (const f of input.chosen) {
    lanes[f.pack.id] = {
      area: await mint(ctx, canvasId, laneMarkdown(f.pack), "text/markdown", "area.md"),
      card: await mint(ctx, canvasId, cardJson(f.pack, packText(f, "avatar.svg")), FIGHTER_MIME, `${f.pack.id}.fighter`),
      design: await mint(ctx, canvasId, packText(f, "DESIGN.md"), "text/markdown", "DESIGN.md"),
      shelf: await mint(ctx, canvasId, packText(f, "references.md"), "text/markdown", "references.md"),
    };
  }
  const brief = await mint(
    ctx,
    canvasId,
    briefMarkdown({ brief: input.brief, packs: input.chosen.map((f) => f.pack), entryKind: input.entryKind, minutes: input.minutes, mode: "exhibition" }),
    "text/markdown",
    "area.md",
  );
  const plan = arenaPlan({
    at: input.at ?? arenaOrigin(snapshot.canvas),
    brief: input.brief,
    fighters: input.chosen.map((f) => ({ source: f.module, pack: f.pack })),
    entryKind: input.entryKind,
    mode: "exhibition",
    minutes: input.minutes,
    decider: input.decider,
    target: input.target,
    parent: input.parent ?? null,
    blobs: { brief, lanes },
  });
  const group = newGroupId();
  for (const op of plan.ops) await host.sendOp(ctx, canvasId, op, group);
  return plan;
}

function register(host: CliHost): void {
  const { program, run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson } = host;
  const family = program
    .command("competition")
    .description("Design competitions — designer packs as fighters, one brief, rival designs, a vote")
    .addHelpText(
      "after",
      `
A bout is an arena of areas: a Brief, and a lane per fighter holding its card,
its DESIGN.md (scoped to the lane) and its references. Fighters are agents on
your own rc, each named for its principle — an homage, never the person.

  isocan competition fighters
  isocan competition new "a checkout for a plant shop" --fighters kare,rams,linear
  isocan competition start
  isocan competition status
  isocan competition bell --vote 5m
  isocan competition vote <entry> --rank 1
  isocan competition result`,
    );

  family
    .command("fighters")
    .description("The roster the picker shows — every pack this build can field, and where it came from")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const json = (cmd.optsWithGlobals() as { json?: boolean }).json;
        const all = fighters();
        const clashes = rosterClashes(all);
        if (json) {
          return printJson(
            all.map(({ module, pack }) => ({
              id: pack.id, title: pack.title, agentName: pack.agentName, credit: pack.credit, tagline: pack.tagline,
              from: module === OWN ? "built in" : module,
              ...(clashes.some((c) => c.id === pack.id) ? { refused: clashes.find((c) => c.id === pack.id)!.problem } : {}),
            })),
          );
        }
        for (const { module, pack } of all) {
          const clash = clashes.find((c) => c.id === pack.id);
          console.log(
            `${pack.id.padEnd(10)} ${pack.title.padEnd(32)} ${pack.credit}${module === OWN ? "" : `  · from ${module}`}${clash ? `  · REFUSED: ${clash.problem}` : ""}`,
          );
        }
        console.error("each is an homage, named for its principle — not affiliated with or endorsed by its person");
      }),
    );

  family
    .command("new <brief...>")
    .description("Lay an arena: a Brief and one lane per fighter, each with its card, scoped DESIGN.md and references")
    .requiredOption("--fighters <ids>", "two to four fighters, comma-separated — ids, principles or names (kare,rams,linear)")
    .option("--entry <kind>", "screen (one) or flow (three screens)", "screen")
    .option("--time <spec>", "how long they build: 20m, 90s, 1h", "20m")
    .option("--mode <mode>", "exhibition — built live in the lanes", "exhibition")
    .option("--attach <item>", "the screen this is about — copied in as a reference, and what `take` versions")
    .option("--decider <who>", "the person whose 🏆 decides (default: you)")
    .option("--at <x,y>", "where the arena's top-left goes (default: right of everything)")
    .option("--canvas <canvas>")
    .action(
      run(async (words: string[], opts: { fighters: string; entry: string; time: string; mode: string; attach?: string; decider?: string; at?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const brief = words.join(" ").trim();
        if (!brief) throw new Error("a bout needs a brief — what are we designing, and for whom");
        if (opts.mode !== "exhibition") {
          throw new Error("only exhibition bouts are built — a blind bout needs desks, and faking blindness on live lanes is the one thing it must not do (#262)");
        }
        if (opts.entry !== "screen" && opts.entry !== "flow") throw new Error("--entry is screen or flow");
        const list = roster();
        const chosen: Fighter[] = [];
        for (const ref of opts.fighters.split(",").map((s) => s.trim()).filter(Boolean)) {
          const hit = findFighter(list, ref);
          if (!hit) throw new Error(`no fighter "${ref}" — \`isocan competition fighters\` lists them`);
          if (!chosen.some((c) => c.pack.id === hit.pack.id)) chosen.push(hit);
        }
        if (chosen.length < 2 || chosen.length > 4) throw new Error("a bout is two to four fighters");
        const taken = new Set(collectCanvasActors(snapshot.canvas).map((a) => a.name.split(/\s+/)[0]!.toLowerCase()));
        for (const f of chosen) {
          const first = f.pack.agentName.split(/\s+/)[0]!.toLowerCase();
          const holder = collectCanvasActors(snapshot.canvas).find((a) => a.name.split(/\s+/)[0]!.toLowerCase() === first);
          if (taken.has(first) && holder && holder.name !== f.pack.agentName) {
            throw new Error(`"${f.pack.agentName}" would answer to @${first}, and ${holder.name} already does here`);
          }
        }
        const at = opts.at ? (() => {
          const [x, y] = opts.at!.split(",").map(Number);
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("--at is x,y");
          return { x: x!, y: y! };
        })() : undefined;
        const plan = await layArena(host, ctx, canvas.id, snapshot, {
          brief,
          chosen,
          entryKind: opts.entry as EntryKind,
          minutes: minutesOf(opts.time, 20),
          decider: opts.decider ? actorByRef(snapshot, opts.decider).id : ctx.actor.id,
          target: opts.attach ? resolveItem(snapshot, opts.attach) : null,
          ...(at ? { at } : {}),
        });
        if (ctx.json) return printJson({ bout: plan.boutId, lanes: plan.lanes });
        console.log(`arena laid — bout ${plan.boutId}: ${chosen.map((f) => f.pack.agentName).join(" · ")}`);
        console.error("next: isocan competition start   (casts one agent per fighter on your rc)");
      }),
    );

  family
    .command("start [bout]")
    .description("Cast the fighters — enrol one agent per lane from its pack, and hand each its brief in its lane")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        let snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, ref);
        if (bout.phase !== "laid") throw new Error(`this bout is already ${bout.phase}`);
        const list = fighters();
        const packs: Record<string, FighterPack> = {};
        const actors: Record<string, { id: string; name: string }> = {};
        for (const lane of bout.lanes) {
          const fighter = list.find((f) => f.pack.id === lane.packId);
          if (!fighter) throw new Error(`the pack "${lane.packId}" is not on this machine — \`isocan module ls\``);
          packs[lane.packId] = fighter.pack;
          const enrolled = await host.enrol(ctx, canvas.id, {
            name: fighter.pack.agentName,
            template: "design-competition.fighter",
            args: { pack: fighter.pack.id, module: fighter.module, bout: bout.brief.id, lane: lane.area.title, canvas: canvas.id },
          });
          actors[lane.packId] = { id: enrolled.actorId, name: fighter.pack.agentName };
          if (!ctx.json) console.error(`${fighter.pack.agentName} enrolled — working in ${enrolled.dir}`);
        }
        snapshot = await ctx.client.snapshot(canvas.id);
        const fresh = boutOrSay(snapshot, bout.brief.id);
        const group = newGroupId();
        for (const op of startPlan({ bout: fresh, packs, actors, now: new Date() })) await sendOp(ctx, canvas.id, op, group);
        if (ctx.json) return printJson({ bout: bout.brief.id, fighters: actors });
        console.log(
          `the fighters walk in — ${Object.values(actors).map((a) => a.name).join(", ")}, ${bout.minutes} minutes. ` +
            "A running `isocan rc` wakes each on its brief; nothing runs until it does.",
        );
      }),
    );

  family
    .command("status [bout]")
    .description("Each lane: fighter, state, entry — and the clock")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, ref);
        const left = timeLeft(bout, new Date());
        const rows = bout.lanes.map((lane) => ({
          lane: lane.area.title,
          fighter: lane.packId,
          state: laneState(snapshot.canvas, bout, lane),
          entry: lane.entry ? `${lane.entry.title} (${lane.entry.id})` : null,
        }));
        if (ctx.json) return printJson({ bout: bout.brief.id, title: bout.brief.title, phase: bout.phase, until: bout.until, left, lanes: rows });
        console.log(`${bout.brief.title} — ${bout.phase}${left ? `, ${left} left` : ""}`);
        for (const r of rows) console.log(`  ${r.lane.padEnd(24)} ${r.state.padEnd(10)} ${r.entry ?? ""}`);
      }),
    );

  family
    .command("handin <item>")
    .description("A fighter hands in its entry — the item in its lane that it wants judged")
    .option("--bout <bout>")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, opts: { bout?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, opts.bout);
        if (bout.phase !== "building") throw new Error(`the bout is ${bout.phase} — hand-in is while it is building`);
        const item = resolveItem(snapshot, ref);
        const lane = laneOfItem(snapshot.canvas, bout, item) ?? laneOfActor(bout, ctx.actor.id);
        if (!lane) throw new Error(`${item.title} is in no lane of this bout — build in yours`);
        if (lane.actorId && lane.actorId !== ctx.actor.id) {
          throw new Error(`${item.title} is in ${lane.area.title}'s lane — a fighter hands in its own work`);
        }
        const group = newGroupId();
        if (lane.entry && lane.entry.id !== item.id) {
          await sendOp(ctx, canvas.id, { type: "item.update", itemId: lane.entry.id, patch: { removeProperties: ["competition.entry", "competition.fighter"] } }, group);
        }
        await sendOp(ctx, canvas.id, { type: "item.update", itemId: item.id, patch: { properties: handinPatch(bout, lane) } }, group);
        if (ctx.json) return printJson({ entry: item.id, lane: lane.area.title });
        console.log(`${item.title} handed in for ${lane.area.title}`);
      }),
    );

  family
    .command("bell [bout]")
    .description("Ring the bell: building stops, the vote opens behind the curtain")
    .option("--vote <spec>", "how long the vote runs", "5m")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string | undefined, opts: { vote: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, ref);
        if (bout.phase !== "building") throw new Error(`the bout is ${bout.phase} — the bell ends building`);
        const minutes = minutesOf(opts.vote, 5);
        const group = newGroupId();
        for (const op of bellPlan(bout, new Date(), minutes)) await sendOp(ctx, canvas.id, op, group);
        const entries = entriesOf(bout);
        if (ctx.json) return printJson({ bout: bout.brief.id, voting: `${minutes}m`, entries: entries.map((e) => e.id) });
        console.log(`the bell — ${entries.length} entr${entries.length === 1 ? "y" : "ies"} in; the vote runs ${minutes} minutes, names and counts hidden until then`);
        for (const lane of bout.lanes) if (!lane.entry) console.log(`  ${lane.area.title}: no entry`);
      }),
    );

  family
    .command("vote <entry>")
    .description("Rank an entry 🥇 🥈 🥉 by which best answers the brief — placing a medal moves it")
    .requiredOption("--rank <n>", "1, 2 or 3")
    .option("--off", "take that medal back")
    .option("--bout <bout>")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, opts: { rank: string; off?: boolean; bout?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, opts.bout);
        const rank = Number(opts.rank);
        const medal = MEDALS[rank - 1];
        if (!medal) throw new Error("--rank is 1, 2 or 3");
        const entry = entryOrSay(snapshot, bout, ref, host);
        const mine = laneOfActor(bout, ctx.actor.id);
        if (mine && entry.properties["competition.fighter"] === mine.packId) throw new Error("a fighter never ranks its own entry");
        const group = newGroupId();
        if (opts.off) {
          await sendOp(ctx, canvas.id, { type: "item.react", itemId: entry.id, emoji: medal, on: false }, group);
          return ctx.json ? printJson({ entry: entry.id, medal, on: false }) : console.log(`${medal} taken off ${entry.title}`);
        }
        // One of each per voter: the medal MOVES — off wherever it was, on
        // here, one group so one undo.
        for (const other of entriesOf(bout)) {
          if (other.id !== entry.id && (other.reactions?.[medal] ?? []).includes(ctx.actor.id)) {
            await sendOp(ctx, canvas.id, { type: "item.react", itemId: other.id, emoji: medal, on: false }, group);
          }
        }
        await sendOp(ctx, canvas.id, { type: "item.react", itemId: entry.id, emoji: medal, on: true }, group);
        if (ctx.json) return printJson({ entry: entry.id, medal, on: true });
        console.log(`${medal} on ${entry.title}`);
      }),
    );

  family
    .command("dot <entry>")
    .description("Put a 🔴 on the part of an entry you would steal — feeds the remix")
    .requiredOption("--at <x,y>", "where on the entry, as fractions of its box: 0.4,0.7")
    .option("--bout <bout>")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, opts: { at: string; bout?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, opts.bout);
        const entry = entryOrSay(snapshot, bout, ref, host);
        const [x, y] = opts.at.split(",").map(Number);
        if (!(x! >= 0 && x! <= 1 && y! >= 0 && y! <= 1)) throw new Error("--at is two fractions of the entry's box, 0..1: 0.4,0.7");
        await sendOp(ctx, canvas.id, { type: "item.react", itemId: entry.id, emoji: DOT, on: true, at: { x: x!, y: y! } });
        if (ctx.json) return printJson({ entry: entry.id, at: { x, y } });
        console.log(`${DOT} on ${entry.title} at ${x},${y}`);
      }),
    );

  family
    .command("miss <entry>")
    .description("⛔ — this entry misses the brief (the arenas' \"both bad\")")
    .option("--off", "take it back")
    .option("--bout <bout>")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, opts: { off?: boolean; bout?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const entry = entryOrSay(snapshot, boutOrSay(snapshot, opts.bout), ref, host);
        await sendOp(ctx, canvas.id, { type: "item.react", itemId: entry.id, emoji: MISS, on: !opts.off });
        if (ctx.json) return printJson({ entry: entry.id, miss: !opts.off });
        console.log(`${MISS} ${opts.off ? "off" : "on"} ${entry.title}`);
      }),
    );

  family
    .command("decide <entry>")
    .description("The Decider's 🏆 — the result, which only the Decider places")
    .option("--bout <bout>")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string, opts: { bout?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, opts.bout);
        if (bout.decider && bout.decider !== ctx.actor.id) {
          const who = collectCanvasActors(snapshot.canvas).find((a) => a.id === bout.decider)?.name ?? bout.decider;
          throw new Error(`the Decider is ${who} — people rank, one person decides`);
        }
        if (agentsOn(snapshot).has(ctx.actor.id)) throw new Error("an agent never decides — a person does");
        const entry = entryOrSay(snapshot, bout, ref, host);
        const group = newGroupId();
        await sendOp(ctx, canvas.id, { type: "item.react", itemId: entry.id, emoji: TROPHY, on: true }, group);
        for (const op of decidePlan(bout, entry)) await sendOp(ctx, canvas.id, op, group);
        const lane = bout.lanes.find((l) => l.packId === entry.properties["competition.fighter"]);
        if (ctx.json) return printJson({ winner: entry.id, fighter: lane?.area.title ?? null });
        console.log(`${TROPHY} ${lane?.area.title ?? entry.title} wins — ${ctx.actor.name}'s call`);
        console.error("then: isocan competition take · remix · rematch · withdraw");
      }),
    );

  family
    .command("result [bout]")
    .description("The tally — people and agents apart, dots, misses, and the Decider's pick")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, ref);
        const tally = competitionTally(bout, agentsOn(snapshot));
        const laneName = (packId: string) => bout.lanes.find((l) => l.packId === packId)?.area.title ?? packId;
        if (ctx.json) {
          return printJson({
            bout: bout.brief.id,
            phase: bout.phase,
            decided: tally.decided?.id ?? null,
            voters: tally.voters,
            entries: tally.entries.map((e) => ({ itemId: e.entry.id, fighter: laneName(e.packId), people: e.people, agents: e.agents, dots: e.dots, misses: e.misses, trophies: e.trophies })),
            dropped: tally.dropped,
          });
        }
        if (bout.phase === "voting" && timeLeft(bout, new Date())) console.error("the vote is still running — these counts are hidden in the app until the bell");
        console.log(`${bout.brief.title}`);
        console.log(`  people (${tally.voters.people}): ${tally.entries.map((e) => `${laneName(e.packId)} ${e.people}`).join(" · ")}`);
        console.log(`  agents (${tally.voters.agents}): ${[...tally.entries].sort((a, b) => b.agents - a.agents).map((e) => `${laneName(e.packId)} ${e.agents}`).join(" · ")}`);
        for (const e of tally.entries) {
          const extras = [e.dots ? `${e.dots} ${DOT}` : "", e.misses.people + e.misses.agents ? `${e.misses.people + e.misses.agents} ${MISS}` : "", e.trophies ? `${e.trophies} ${TROPHY} (not the Decider's)` : ""].filter(Boolean);
          if (extras.length) console.log(`  ${laneName(e.packId)}: ${extras.join(", ")}`);
        }
        for (const d of tally.dropped) console.log(`  dropped: ${d.mark} on ${d.itemId} — ${d.why}`);
        console.log(tally.decided ? `  ${TROPHY} ${laneName(tally.decided.properties["competition.fighter"] ?? "")} — decided` : "  not decided yet — the Decider's 🏆 is the result");
      }),
    );

  family
    .command("take [bout]")
    .description("The winner becomes the target's next version — a copy, never `choose`, so the arena stays the record")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, ref);
        const winner = competitionTally(bout, agentsOn(snapshot)).decided;
        if (!winner) throw new Error("nothing is decided yet — the Decider's 🏆 first");
        if (!bout.target) throw new Error("this bout was about no screen (--attach) — there is nothing to take it onto");
        const target = snapshot.canvas.items[bout.target];
        if (!target) throw new Error("the screen this bout was about is gone");
        const v = winner.versions.find((x) => x.id === winner.currentVersionId) ?? winner.versions[0]!;
        await sendOp(ctx, canvas.id, {
          type: "item.addVersion",
          itemId: target.id,
          version: { id: newVersionId(), blobHash: v.blobHash, size: v.size, mimeType: v.mimeType, filename: v.filename },
        });
        if (ctx.json) return printJson({ target: target.id, from: winner.id });
        console.log(`${target.title} v${target.versions.length + 1} — the winning entry, taken`);
      }),
    );

  const nextBout = (name: "remix" | "rematch", describe: string) =>
    family
      .command(`${name} [bout]`)
      .description(describe)
      .option("--brief <text>", name === "rematch" ? "the new brief" : "override the generated brief")
      .option("--fighter <id>", "remix: the fighter who remixes (default: the winner's)")
      .option("--time <spec>", "how long they build")
      .option("--canvas <canvas>")
      .action(
        run(async (ref: string | undefined, opts: { brief?: string; fighter?: string; time?: string }, cmd: Command) => {
          const ctx = await ctxOf(cmd);
          const canvas = await resolveCanvas(ctx);
          const snapshot = await ctx.client.snapshot(canvas.id);
          const bout = boutOrSay(snapshot, ref);
          const list = roster();
          let chosen: Fighter[];
          let brief: string;
          if (name === "rematch") {
            if (!opts.brief) throw new Error("a rematch needs a new brief: --brief \"…\"");
            brief = opts.brief;
            chosen = bout.lanes.flatMap((l) => list.filter((f) => f.pack.id === l.packId));
          } else {
            const tally = competitionTally(bout, agentsOn(snapshot));
            const winner = tally.decided;
            const by = opts.fighter ? findFighter(list, opts.fighter) : list.find((f) => f.pack.id === winner?.properties["competition.fighter"]);
            if (!by) throw new Error(winner ? "no such fighter" : "nothing is decided yet — or name the remixer with --fighter");
            chosen = [by];
            // The converge half: the winner as the input, every steal and
            // every miss from the other lanes as the brief.
            const steals = tally.entries.filter((e) => e.entry.id !== winner?.id && e.dots > 0).map((e) => `${e.dots} ${DOT} on #${e.entry.title}`);
            brief = opts.brief ?? [
              `Remix ${winner ? `#${winner.title}` : "the entries"} from "${bout.brief.title.replace(/^Design competition — /, "")}".`,
              steals.length ? `Steal what the room marked: ${steals.join("; ")}.` : "Keep what won; fix what the critiques named.",
              "Read every critique thread on the entries first.",
            ].join(" ");
          }
          const plan = await layArena(host, ctx, canvas.id, snapshot, {
            brief,
            chosen,
            entryKind: bout.entryKind,
            minutes: minutesOf(opts.time, bout.minutes),
            decider: bout.decider ?? ctx.actor.id,
            target: bout.target ? snapshot.canvas.items[bout.target] ?? null : null,
            parent: bout.brief.id,
          });
          if (ctx.json) return printJson({ bout: plan.boutId, parent: bout.brief.id });
          console.log(`${name} laid — bout ${plan.boutId}; \`isocan competition start ${plan.boutId}\` casts it`);
        }),
      );
  nextBout("remix", "A one-fighter bout: the winner as input, the room's dots and critiques as the brief");
  nextBout("rematch", "The same fighters, a new brief, a new arena beside the last");

  family
    .command("withdraw [bout]")
    .description("The fighters leave — their standing is withdrawn, the history and their directories stay")
    .option("--canvas <canvas>")
    .action(
      run(async (ref: string | undefined, _opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const bout = boutOrSay(snapshot, ref);
        const gone: string[] = [];
        for (const lane of bout.lanes) {
          if (!lane.actorId || !snapshot.canvas.agents?.[lane.actorId]) continue;
          await host.withdraw(ctx, canvas.id, lane.actorId);
          gone.push(lane.area.title);
        }
        if (ctx.json) return printJson({ withdrawn: gone });
        console.log(gone.length ? `withdrawn: ${gone.join(", ")} — the log keeps everything` : "no fighter of this bout is standing");
      }),
    );

  family
    .command("standings")
    .description("Every bout on this canvas, per fighter — bouts, wins, mean Borda, and a rating once it means something")
    .option("--canvas <canvas>")
    .action(
      run(async (_opts: unknown, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvas = await resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const rows = standings(snapshot.canvas, agentsOn(snapshot));
        if (ctx.json) return printJson(rows);
        if (rows.length === 0) return console.log("no bout here has two entries yet");
        for (const r of rows) {
          console.log(`${r.packId.padEnd(10)} ${String(r.bouts).padStart(3)} bouts ${String(r.wins).padStart(3)} wins  Borda ${r.meanBorda}  ${r.rating === null ? "rating after 3 bouts" : `rating ${r.rating}`}`);
        }
      }),
    );

  const fighter = family.command("fighter").description("Bring your own fighter — a pack as a data-only module");
  fighter
    .command("new <title>")
    .description("Write a pack as a data-only module directory — then `isocan module add <dir> --yes --proposed`")
    .requiredOption("--design <file>", "the pack's DESIGN.md")
    .requiredOption("--credit <text>", "who it is after — \"after Jun's house style\"")
    .requiredOption("--name <text>", "the person or studio it is an homage to (or yourself, with --self)")
    .option("--agent <name>", "the agent's name on the canvas (default: the title, as words)")
    .option("--tagline <text>", "one line for the card", "")
    .option("--avatar <svg>", "an illustrated emblem — never a photograph")
    .option("--ref <title|url|what to learn>", "a reference (repeatable)", (v: string, prev: string[]) => [...prev, v], [])
    .option("--self", "a pack of yourself: it may carry your own name")
    .option("--out <dir>", "where to write it", ".")
    .action(
      run(async (title: string, opts: { design: string; credit: string; name: string; agent?: string; tagline: string; avatar?: string; ref: string[]; self?: boolean; out: string }) => {
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 31) || "fighter";
        const pack: FighterPack = {
          id,
          title,
          agentName: opts.agent ?? title.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(),
          credit: opts.credit,
          name: opts.name,
          tagline: opts.tagline || title,
          bio: `A pack written for a design competition: ${title}.`,
          colour: "#555555",
          homage: opts.self ? `${opts.name}'s own pack.` : `An homage to the published work of ${opts.name}. Not affiliated with or endorsed by ${opts.name}.`,
          beliefs: ["See DESIGN.md — Philosophy", "See DESIGN.md — Do's and Don'ts", "See DESIGN.md — Never"],
          moves: ["See DESIGN.md", "See DESIGN.md", "See DESIGN.md"],
          critique: ["Does it answer the brief?", "What would you remove?", "What is the one thing it does best?"],
          references: opts.ref.map((r) => {
            const [refTitle, url, learn] = r.split("|").map((s) => s.trim());
            return { title: refTitle ?? r, year: "", learn: learn ?? "", url: url ?? "" };
          }),
          quote: null,
          ...(opts.self ? { self: true } : {}),
        };
        const problems = (await import("./packs.ts")).packProblems(pack);
        if (problems.length) {
          const hint = problems.some((p) => /reference/.test(p)) ? " — add one with --ref \"Title|https://…|what to learn\"" : "";
          throw new Error(`this pack would be refused: ${problems.join("; ")}${hint}`);
        }
        const dir = path.resolve(opts.out, `fighter-${id}`);
        const assets = path.join(dir, "assets/packs", id);
        await fs.mkdir(assets, { recursive: true });
        await fs.copyFile(opts.design, path.join(assets, "DESIGN.md"));
        const avatar = opts.avatar ? await fs.readFile(opts.avatar, "utf8") : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#eeeeee"/><circle cx="60" cy="45" r="22" fill="#555555"/></svg>`;
        if (/<script|href=|<image|<foreignObject/i.test(avatar)) throw new Error("an avatar is an emblem: no script, no images, no links");
        await fs.writeFile(path.join(assets, "avatar.svg"), avatar);
        await fs.writeFile(path.join(assets, "critique.md"), `# ${title} — critique\n\n${pack.critique.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n`);
        await fs.writeFile(path.join(assets, "references.md"), `# ${title} — references\n\n${pack.references.map((r) => `## ${r.title}\n\nWhat to learn: ${r.learn}\n\n${r.url}\n`).join("\n") || "None yet.\n"}`);
        const files = await Promise.all(
          (["DESIGN.md", "avatar.svg", "critique.md", "references.md"] as const).map(async (f) => ({
            path: `assets/packs/${id}/${f}`,
            size: (await fs.stat(path.join(assets, f))).size,
          })),
        );
        const manifest = {
          name: `fighter-${id}`,
          version: "0.1.0",
          description: `A design competition fighter: ${title} (${opts.credit})`,
          engines: "^0.2.1",
          proposed: ["assets", "points"],
          contributes: { "design-competition.fighters": [pack] },
          assets: files,
        };
        await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
        console.log(`wrote ${dir} — a data-only module; it runs nothing`);
        console.error(`add it: isocan module add ${path.relative(process.cwd(), dir) || "."} --yes --proposed`);
      }),
    );
}

/**
 * **The fighter template** (proposed: `templates`) — what the rc runs, on its
 * own machine, before it enrols a fighter: the agent's working directory.
 *
 * An `AGENTS.md` (and a `CLAUDE.md` saying the same, for the harness that
 * reads that name) that says who it is an homage to and the rules of the bout,
 * beside the pack's own files. The brief itself is NOT here: it is a message
 * on the canvas, where the room can read what each fighter was asked.
 */
async function prepareFighter(args: Readonly<Record<string, string>>, into: string): Promise<void> {
  const fighter = fighters().find((f) => f.pack.id === args.pack);
  if (!fighter) throw new Error(`no fighter "${args.pack}" on this machine`);
  const { pack } = fighter;
  const lane = args.lane ?? pack.agentName;
  const agents = [
    `# You are ${pack.agentName}`,
    "",
    `A fighter in an isocan design competition — **${pack.title}**, ${pack.credit}.`,
    "",
    `${pack.homage} You are an homage to published principles, **not the person**: never sign as them, never claim their words, never say what they would think. Your critiques are "a ${pack.title} critic asks…".`,
    "",
    "## Your philosophy",
    "",
    ...pack.beliefs.map((b) => `- ${b}`),
    "",
    "## Your moves",
    "",
    ...pack.moves.map((m) => `- ${m}`),
    "",
    "`DESIGN.md` beside this file is your design system — the same one is on the canvas, scoped to your lane. Build against it: `isocan design --css --in \"" + lane + "\"` prints its tokens. `critique.md` is how you judge a rival; `references.md` is what you study.",
    "",
    "## The rules of the bout",
    "",
    `- Your brief is a message addressed to you in your lane, "${lane}". Read the Brief card above the lanes.`,
    `- Build ONLY in your lane: \`isocan add <file> --in "${lane}"\`. Do not read the other lanes.`,
    "- One entry. Hand it in before the bell: `isocan competition handin <item>`.",
    "- After the bell: one critique thread on each rival entry, in your voice, naming which of your questions decided it; then rank the entries you did not make: `isocan competition vote <entry> --rank 1`. Never rank your own. Never place a 🏆 — a person decides.",
    "- Park between turns on your own lane: `isocan wait --in \"" + lane + "\" --json --timeout 900`.",
    "",
    `Bout ${args.bout ?? "?"} on canvas ${args.canvas ?? "?"}.`,
    "",
  ].join("\n");
  await fs.writeFile(path.join(into, "AGENTS.md"), agents);
  await fs.writeFile(path.join(into, "CLAUDE.md"), agents);
  for (const file of ["DESIGN.md", "critique.md", "references.md"] as const) {
    await fs.writeFile(path.join(into, file), packText(fighter, file));
  }
}

export const competitionCli: CliModule = {
  core: competitionCore,
  register,
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
  templates: [
    {
      id: "design-competition.fighter",
      describe: "a fighter's working directory: AGENTS.md (who it is an homage to, the bout's rules) beside its pack's DESIGN.md, critique and references",
      prepare: prepareFighter,
    },
  ],
};

export default competitionCli;
