import type { CanvasContents, Item } from "./model.ts";
import type { PresenceSession } from "./protocol.ts";
import { roster, type RowState } from "./roster.ts";

/**
 * **Your bench: the agents you have, read from your own canvas**
 * (`docs/projects/bench/design.md`, phase 0).
 *
 * The one structural claim the design makes is that **the personal canvas IS
 * the registry** — an agent on your bench is an ordinary item on your private
 * canvas whose `properties.kind` is `agent`, the same way a canvas placed on a
 * canvas is an ordinary item with `kind=canvas` (`canvasitem.ts`). Nothing
 * here is a new op: `bench add` is an `item.add` and `bench rm` is an
 * `item.delete`, so undo, privacy, replication between your machines and the
 * door that judges who may read it all arrive already argued over.
 *
 * What the item carries is the STANDING half — a name, an actor, which harness
 * it is, and an opaque label for where it runs. What it deliberately does not
 * carry is the RUNNING half: the working directory and the ACP session handle
 * stay in `~/.isocan/rc-agents.json` (`packages/cli/src/rc.ts`), because only
 * the machine that holds a `cwd` can honour one, and the secret that claims an
 * agent's actor stays in `~/.isocan/agent-secret`. A second machine therefore
 * reads the same bench and can see that it cannot answer for Percy — which is
 * the whole point of measuring reachability rather than asserting it.
 *
 * **A bench row confers nothing.** It is a record. Standing is `agent.enroll`
 * on each canvas; reach is measured below. Removing a row takes away neither.
 */

/** `properties.kind` on an item that is an agent on somebody's bench. */
export const AGENT_KIND = "agent";
/**
 * **The property names, spelled once and promised to nobody.**
 *
 * These three and `BENCH_ITEM_FILENAME` below are module-local on purpose.
 * They exist so `benchAgentOf` and `benchItemOf` cannot disagree about what a
 * bench item wears — that is the whole job, and it is done entirely inside
 * this file. Exporting them added a fourth promise nothing outside had asked
 * for, and `test/unused-exports.test.ts` is right that a promise to nobody
 * costs the next reader a lookup before they find out it is not API.
 *
 * The day something outside genuinely needs to read `actorId` off an item, the
 * honest move is to export `benchAgentOf` (already exported) rather than the
 * string — a reader that knows the property name knows the schema, and the
 * point of this file is that only it does.
 */
/** `actorId=<id>` — the actor this agent speaks as. The row's identity: the
 * title is what a person calls it and can be renamed, the actor is what a
 * summons, an enrolment and a parked rc all name. */
const AGENT_ACTOR_PROP = "actorId";
/** `harness=<name>` — `claude-code`, `codex`, `sheep`, … so a reader knows
 * WHAT Percy is without being told where it runs. */
const AGENT_HARNESS_PROP = "harness";
/**
 * `runsAt=<label>` — an opaque label for WHERE this agent runs.
 *
 * Deliberately not `machineId`. Today every value is a machine; journey 4's
 * value is a cell that hibernates with its sockets and wakes on an alarm, and
 * renaming a property that has shipped is a migration. Opaque also means no
 * reader may infer a working directory from it.
 */
const AGENT_RUNS_AT_PROP = "runsAt";
/** The blob a bench item carries. An item.add needs a version, and the honest
 * one here is the row written out — readable on the canvas itself, so the
 * registry is not a row of blank cards. */
const BENCH_ITEM_FILENAME = "agent.md";
/** What a bench card is, placed: a caption's worth of space, not a screen. */
export const BENCH_ITEM_SIZE = { width: 320, height: 180 };
/** Laid out in rows of four rather than stacked: the bench is a list somebody
 * looks at, and a pile of cards at the origin is not one. */
const BENCH_PER_ROW = 4;
const BENCH_GAP = 40;

/**
 * **Reachability is a measurement, and it has three answers.**
 *
 * - `ready` — something is parked that can answer for this agent NOW.
 * - `elsewhere` — it stands somewhere, or this machine knows how to run it,
 *   but nothing is parked: a summons would land in silence.
 * - `unreachable` — nothing present can run it at all.
 *
 * A boolean ("is my rc parked?") is the natural shape and is wrong twice: it
 * cannot say *unreachable*, the dead-machine case `agent-custody` waits on,
 * and it assumes the question is about THIS machine, which journey 4 makes
 * false. Never reduce this to two.
 *
 * Module-local: the surfaces meet this union through `BenchRow.reach`, which
 * is exported and carries it structurally, and they check themselves against
 * `BENCH_REACH` below rather than against the type. Nothing outside ever
 * needed to WRITE the name, and a type nobody names is not API.
 */
type BenchReach = "ready" | "elsewhere" | "unreachable";

/**
 * Every reachability a bench row can read, in the order a person meets them.
 *
 * Exported — and it is the one of the pair that has to be, because it is a
 * VALUE a test can iterate: a build that collapsed the middle state would
 * still type check, so the guard has to hold the three answers in its hand
 * rather than trust the union it would be checking against.
 */
export const BENCH_REACH: readonly BenchReach[] = ["ready", "elsewhere", "unreachable"];

/**
 * The roster states that mean something is parked and would answer.
 *
 * `parked` is `wait`'s own lifecycle signature on a live session; `answerable`
 * is the daemon's connection-bound fact that an `isocan rc` holds a claim for
 * this actor. Both are measurements the canvas cannot lie about, which is why
 * `ready` is read from them and from no record anywhere.
 */
const ANSWERING: ReadonlySet<RowState> = new Set<RowState>(["parked", "answerable"]);

/** One agent, as its item on the personal canvas records it. */
export interface BenchAgent {
  /** The item on the personal canvas — what `bench rm` removes. */
  itemId: string;
  /** What the agent is called: the item's title. */
  name: string;
  actorId: string;
  /** Which agent this is, or null when the row was written without one. */
  harness: string | null;
  /** Where it runs, opaquely. Null when nobody said. */
  runsAt: string | null;
}

/** Is this item a bench row at all? The `kind` test, spelled once — and kept
 * inside this file, because the question a caller outside actually has is
 * "what agent is this item", which `benchAgentOf` answers and which already
 * returns null for anything that is not one. */
function isAgentItem(item: Item): boolean {
  return item.properties.kind === AGENT_KIND;
}

/** The agent an item records, or null when it is not a bench row. An item
 * with no `actorId` is not one either: a row that names no actor can be
 * measured against nothing, and a row nothing can measure is a claim. */
export function benchAgentOf(item: Item): BenchAgent | null {
  if (!isAgentItem(item)) return null;
  const actorId = item.properties[AGENT_ACTOR_PROP];
  if (!actorId) return null;
  return {
    itemId: item.id,
    name: item.title || actorId,
    actorId,
    harness: item.properties[AGENT_HARNESS_PROP] ?? null,
    runsAt: item.properties[AGENT_RUNS_AT_PROP] ?? null,
  };
}

/** Everybody on this bench, by name. The canvas is the registry, so this is
 * the whole of the read — there is no second table to consult. */
export function benchAgents(canvas: CanvasContents): BenchAgent[] {
  return Object.values(canvas.items)
    .map(benchAgentOf)
    .filter((agent): agent is BenchAgent => agent !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The properties and blob a bench item wears — one function, so `isocan bench
 * add` and anything the app grows later cannot spell the row two ways. The
 * same job `canvasItemOf` does for a canvas placed on a canvas.
 */
export function benchItemOf(
  name: string,
  agent: { actorId: string; harness?: string | null; runsAt?: string | null },
): { properties: Record<string, string>; blob: string; mimeType: string; filename: string } {
  const properties: Record<string, string> = { kind: AGENT_KIND, [AGENT_ACTOR_PROP]: agent.actorId };
  if (agent.harness) properties[AGENT_HARNESS_PROP] = agent.harness;
  if (agent.runsAt) properties[AGENT_RUNS_AT_PROP] = agent.runsAt;
  const lines = [
    `# ${name}`,
    "",
    `- actor: ${agent.actorId}`,
    `- harness: ${agent.harness ?? "unsaid"}`,
    `- runs at: ${agent.runsAt ?? "unsaid"}`,
    "",
    "A bench row is a record. It grants no standing and no reach.",
  ];
  return {
    properties,
    blob: `${lines.join("\n")}\n`,
    mimeType: "text/markdown",
    filename: BENCH_ITEM_FILENAME,
  };
}

/**
 * **What recording this agent asks of a bench** — a card to add and where to
 * put it, the gaps to fill in the row that is already there, or nothing.
 *
 * One function because phase 3 made the bench fill itself: `isocan bench add`
 * used to be the only caller that had to decide *is this actor already a row,
 * and where does a new card go*, and every enrolment path now asks the same
 * two questions. Three copies of that decision would be three benches that
 * lay their cards out differently and disagree about what counts as already
 * there. It reads through `benchAgents`, so a row is "already there" by the
 * same test `isocan bench` prints from.
 *
 * **Identity is the actor, never the name.** Two rows a person called the
 * same thing are two agents; one agent renamed is still one row. That is why
 * a re-enrolment under a new title fills rather than duplicates.
 *
 * **Gaps are filled; nothing is overwritten.** An enrolment knows the harness
 * and the machine it happened on, so a row that was written without them
 * stops being a blank card — but a `runsAt` a person typed by hand, or one
 * written by a different machine, is not corrected by whichever machine
 * enrolled last. The bench is a person's own record: filling a silence keeps
 * the registry from going stale, and rewriting an answer would make the same
 * row flip between two machines' opinions, one op per enrolment, forever.
 */
export function benchWriteFor(
  canvas: CanvasContents,
  agent: { actorId: string; harness?: string | null; runsAt?: string | null },
):
  | { kind: "add"; x: number; y: number }
  | { kind: "fill"; itemId: string; properties: Record<string, string> }
  | { kind: "already"; itemId: string } {
  const rows = benchAgents(canvas);
  const already = rows.find((row) => row.actorId === agent.actorId);
  if (!already) {
    const at = rows.length;
    return {
      kind: "add",
      x: (at % BENCH_PER_ROW) * (BENCH_ITEM_SIZE.width + BENCH_GAP),
      y: Math.floor(at / BENCH_PER_ROW) * (BENCH_ITEM_SIZE.height + BENCH_GAP),
    };
  }
  const properties: Record<string, string> = {};
  if (agent.harness && !already.harness) properties[AGENT_HARNESS_PROP] = agent.harness;
  if (agent.runsAt && !already.runsAt) properties[AGENT_RUNS_AT_PROP] = agent.runsAt;
  return Object.keys(properties).length > 0
    ? { kind: "fill", itemId: already.itemId, properties }
    : { kind: "already", itemId: already.itemId };
}

/**
 * One canvas a reader can see, with the two live facts the roster needs.
 *
 * `answerable` is `roster()`'s fourth argument — the daemon's
 * connection-bound rc holds. A caller that cannot see the holds passes
 * nothing and every standing row reads `enrolled`, which is the safe
 * under-claim: not knowing whether anybody is listening is not knowing.
 */
export interface BenchCanvas {
  canvasId: string;
  canvasTitle: string;
  canvas: CanvasContents;
  sessions: readonly PresenceSession[];
  answerable?: ReadonlySet<string>;
}

/** A canvas this agent stands on — its enrolment, named so a row can say
 * "standing on 4 canvases" and a reader can go and look. Module-local for
 * `BenchReach`'s reason: readers reach it through `BenchRow.standing`, and
 * nothing outside has ever written the name. */
interface BenchStanding {
  canvasId: string;
  canvasTitle: string;
}

/** A bench row as both surfaces draw it: the record, plus what was measured. */
export interface BenchRow extends BenchAgent {
  reach: BenchReach;
  standing: BenchStanding[];
}

/**
 * **The bench, measured** — the one derivation both `isocan bench` and the
 * app's *Your bench* read, and a fourth caller of `roster()` rather than a
 * fourth implementation of it.
 *
 * `roster()` already answers "is anything parked for this actor?" for `isocan
 * who`, the agent tray and the workbench; three surfaces agree there because
 * there is one answer, not three written to agree. The bench asks the same
 * question of every canvas the reader can see and folds it into one word.
 *
 * `runsHere` is the machine-local half: the actor ids this reader holds a
 * RUNNING row for (`~/.isocan/rc-agents.json`). A browser has no such file
 * and passes nothing — it can still tell `elsewhere` from `unreachable`,
 * because an enrolment is canvas state and travels.
 *
 * Order of the three, and why: `ready` is measured and outranks everything,
 * including a machine that has no row for an agent another machine is
 * answering for — a relayed hold is still an agent that will answer, and
 * saying `unreachable` over the top of it would be the lie the whole state
 * exists to prevent.
 */
export function benchRows(
  agents: readonly BenchAgent[],
  canvases: readonly BenchCanvas[],
  runsHere: ReadonlySet<string>,
  nowMs: number,
): BenchRow[] {
  // One roster per canvas, not one per (canvas, agent): the fold walks every
  // thread on the canvas to find open asks, and a bench of eight agents would
  // otherwise walk them eight times.
  const answering = new Set<string>();
  for (const one of canvases) {
    for (const row of roster(one.sessions, one.canvas, nowMs, one.answerable)) {
      if (ANSWERING.has(row.state)) answering.add(row.actorId);
    }
  }
  return agents.map((agent) => {
    const standing = canvases
      .filter((one) => one.canvas.agents?.[agent.actorId])
      .map((one) => ({ canvasId: one.canvasId, canvasTitle: one.canvasTitle }));
    const reach: BenchReach = answering.has(agent.actorId)
      ? "ready"
      : runsHere.has(agent.actorId) || standing.length > 0
        ? "elsewhere"
        : "unreachable";
    return { ...agent, reach, standing };
  });
}

/**
 * The sentence a row reads as, in both surfaces' words.
 *
 * Said plainly rather than left for a reader to infer from a missing ring:
 * journey 1's complaint is that today a summons into silence is
 * indistinguishable from an agent that is thinking. `runsAt` rides the ready
 * line because "ready (sheep-2)" is the answer to the question a person
 * actually has next, and it says nothing about a machine being *yours*.
 */
export function benchWords(row: BenchRow): string {
  if (row.reach === "ready") return row.runsAt ? `ready (${row.runsAt})` : "ready";
  if (row.reach === "elsewhere") return "its machine is not here";
  return "nothing here can run it";
}

/** "standing on 4 canvases", or the honest nothing. */
export function benchStandingWords(row: BenchRow): string {
  const count = row.standing.length;
  if (count === 0) return "standing nowhere";
  return `standing on ${count} canvas${count === 1 ? "" : "es"}`;
}
