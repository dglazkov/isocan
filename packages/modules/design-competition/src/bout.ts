import {
  AREA_HEAD,
  AREA_INSET,
  AREA_TINT_PROP,
  areaOf,
  designSystemProperties,
  inArea,
  newCommentId,
  newItemId,
  newThreadId,
  newVersionId,
  type CanvasContents,
  type Item,
  type Operation,
  type VoteRound,
} from "@isocan/core";
import type { FighterPack } from "./packs.ts";

/**
 * **A bout, as the canvas holds it** (`docs/projects/design-competition/design.md`).
 *
 * No competition mode and no hidden store: a bout is its **Brief** — an area
 * whose properties say what the bout is and where it stands — and one **lane**
 * per fighter, each an area holding the fighter's card, its `DESIGN.md` (a
 * design system scoped to the lane) and its reference shelf. Every write is
 * an op that already exists, so the whole arena is one group and one undo, and
 * with the module gone every piece of it is still a file.
 *
 * Where the bout STANDS is on the Brief too (`competition.phase`, `.until`):
 * module state is an item, visible and versioned, and the log says who rang
 * each bell.
 */

/** Every property key this module writes, namespaced and forever. */
export const P = {
  role: "competition.role",
  bout: "competition.bout",
  fighters: "competition.fighters",
  fighter: "competition.fighter",
  source: "competition.module",
  actor: "competition.actor",
  entryKind: "competition.entrykind",
  entry: "competition.entry",
  mode: "competition.mode",
  minutes: "competition.minutes",
  decider: "competition.decider",
  target: "competition.target",
  phase: "competition.phase",
  until: "competition.until",
  winner: "competition.winner",
  parent: "competition.parent",
} as const;

export const PROPERTY_KEYS: readonly string[] = Object.values(P);

export type Phase = "laid" | "building" | "voting" | "decided";
/**
 * **Exhibition only, in this build.** A blind bout is fighters on DESKS — a
 * canvas each, admitted to nobody else — handing in lettered at the bell. A
 * wall shuffled after three lanes were built in plain sight would be the
 * faked blindness the journey forbids, so until desks are wired (#262) the
 * mode is one value and asking for the other is refused with a sentence.
 */
export type Mode = "exhibition";
export type EntryKind = "screen" | "flow";

/** The card kind: a small JSON file a module renders as a portrait and
 *  anything else reads as JSON. */
export const FIGHTER_MIME = "application/vnd.isocan.fighter+json";

export const LANE = { width: 1600, height: 1500 } as const;
export const LANE_GAP = 120;
export const BRIEF_HEIGHT = 560;
export const CARD = { width: 360, height: 240 } as const;
export const SYSTEM = { width: 360, height: 560 } as const;
export const SHELF = { width: 360, height: 420 } as const;
const STACK_GAP = 24;

/** The marks that are votes (`design.md`, "The vote"). */
export const MEDALS = ["🥇", "🥈", "🥉"] as const;
export const DOT = "🔴";
export const MISS = "⛔";
export const TROPHY = "🏆";
export const BALLOT_MARKS: readonly string[] = [...MEDALS, DOT, MISS, TROPHY];

export interface Bout {
  brief: Item;
  phase: Phase;
  mode: Mode;
  entryKind: EntryKind;
  minutes: number;
  until: string | null;
  decider: string | null;
  target: string | null;
  winner: string | null;
  lanes: Lane[];
}

export interface Lane {
  area: Item;
  packId: string;
  /** The module that contributed the pack — where its files live. */
  source: string;
  /** The fighter's actor, once the bout has started. */
  actorId: string | null;
  /** The entry it handed in, if any. */
  entry: Item | null;
}

const prop = (item: Item, key: string): string | undefined => item.properties[key];

/** Every bout on the canvas, oldest first. */
export function bouts(canvas: CanvasContents): Bout[] {
  return Object.values(canvas.items)
    .filter((item) => prop(item, P.role) === "brief")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((brief) => boutOf(canvas, brief));
}

/** A bout by its brief item, id or title prefix; with no ref, the newest. */
export function findBout(canvas: CanvasContents, ref?: string): Bout | null {
  const all = bouts(canvas);
  if (!ref) return all[all.length - 1] ?? null;
  const q = ref.toLowerCase();
  return all.find((b) => b.brief.id === ref) ?? all.find((b) => b.brief.title.toLowerCase().startsWith(q)) ?? null;
}

function boutOf(canvas: CanvasContents, brief: Item): Bout {
  const items = Object.values(canvas.items);
  const mine = (item: Item) => prop(item, P.bout) === brief.id;
  const entries = items.filter((item) => prop(item, P.entry) === brief.id);
  const lanes: Lane[] = items
    .filter((item) => mine(item) && prop(item, P.role) === "lane")
    .sort((a, b) => a.x - b.x)
    .map((area) => {
      const packId = prop(area, P.fighter) ?? "";
      return {
        area,
        packId,
        source: prop(area, P.source) ?? "",
        actorId: prop(area, P.actor) ?? null,
        entry: entries.find((e) => prop(e, P.fighter) === packId) ?? null,
      };
    });
  const phase = prop(brief, P.phase);
  return {
    brief,
    phase: phase === "building" || phase === "voting" || phase === "decided" ? phase : "laid",
    mode: "exhibition",
    entryKind: prop(brief, P.entryKind) === "flow" ? "flow" : "screen",
    minutes: Number(prop(brief, P.minutes) ?? 20) || 20,
    until: prop(brief, P.until) ?? null,
    // Unset, the person who laid the bout decides — the picker has nobody
    // else to name, and it is the right default: they asked.
    decider: prop(brief, P.decider) ?? brief.createdBy.id,
    target: prop(brief, P.target) ?? null,
    winner: prop(brief, P.winner) ?? null,
    lanes,
  };
}

/** The entries of a bout, in lane order. */
export function entriesOf(bout: Bout): Item[] {
  return bout.lanes.flatMap((lane) => (lane.entry ? [lane.entry] : []));
}

/** The lane an actor fights in, if any. */
export function laneOfActor(bout: Bout, actorId: string): Lane | null {
  return bout.lanes.find((lane) => lane.actorId === actorId) ?? null;
}

/** The lane an item sits in, by geometry. */
export function laneOfItem(canvas: CanvasContents, bout: Bout, item: Item): Lane | null {
  const area = areaOf(canvas, item);
  return (area && bout.lanes.find((lane) => lane.area.id === area.id)) ?? null;
}

// ---------- the vote rounds the curtain honours ----------

/**
 * **The curtain's rounds** (proposed: `rounds`): while a bout is voting, the
 * lanes its entries sit in are behind the lens until the bell; once decided,
 * the same rounds say which marks are votes, so the heat map stays drawn.
 */
export function boutRounds(canvas: CanvasContents): VoteRound[] {
  return bouts(canvas).flatMap((bout) => {
    if ((bout.phase !== "voting" && bout.phase !== "decided") || !bout.until) return [];
    const areas = bout.lanes.map((lane) => lane.area);
    const until = bout.phase === "decided" ? new Date(0).toISOString() : bout.until;
    return areas.map((area) => ({ areaId: area.id, marks: BALLOT_MARKS, until }));
  });
}

// ---------- the words the arena is made of ----------

/** The Brief area's card: the brief, the rules, and where to look. */
export function briefMarkdown(input: { brief: string; packs: readonly FighterPack[]; entryKind: EntryKind; minutes: number; mode: Mode }): string {
  const who = input.packs.map((p) => `**${p.agentName}** (${p.credit})`).join(" · ");
  return [
    `**${input.brief}**`,
    "",
    `${who}. ${input.entryKind === "flow" ? "A flow of three screens" : "One screen"} each, ${input.minutes} minutes, built live, in the lanes below.`,
    "",
    "Rank the entries 🥇 🥈 🥉 by *which best answers the brief*, 🔴 on the part you would steal, ⛔ on one that misses the brief. The Decider's 🏆 decides. Fighters rank each other; their votes are shown beside yours, never mixed in.",
  ].join("\n");
}

/** A lane's card: who fights here, as an homage, and the rules of the lane. */
export function laneMarkdown(pack: FighterPack): string {
  return [`**${pack.title}** — ${pack.credit}`, "", `*${pack.tagline}* ${pack.homage}`].join("\n");
}

/**
 * **The fighter card's bytes**: everything the portrait draws, the avatar
 * inline — so a card still draws with nothing but its own file, reads as JSON
 * without the module, and names the pack it came from.
 */
export function cardJson(pack: FighterPack, avatarSvg: string): string {
  return JSON.stringify(
    {
      kind: "isocan.fighter",
      pack: pack.id,
      title: pack.title,
      agentName: pack.agentName,
      credit: pack.credit,
      tagline: pack.tagline,
      colour: pack.colour,
      homage: pack.homage,
      beliefs: pack.beliefs,
      avatar: avatarSvg,
    },
    null,
    2,
  );
}

/** What a card's file holds, read tolerantly — a hand-edited card is a card. */
export interface CardFile {
  pack: string;
  title: string;
  agentName: string;
  credit: string;
  tagline: string;
  colour: string;
  homage: string;
  beliefs: string[];
  avatar: string;
}

export function readCard(text: string): CardFile | null {
  try {
    const raw = JSON.parse(text) as Partial<CardFile> & { kind?: string };
    if (raw.kind !== "isocan.fighter" || typeof raw.title !== "string") return null;
    return {
      pack: String(raw.pack ?? ""),
      title: raw.title,
      agentName: String(raw.agentName ?? ""),
      credit: String(raw.credit ?? ""),
      tagline: String(raw.tagline ?? ""),
      colour: /^#[0-9a-fA-F]{6}$/.test(String(raw.colour)) ? String(raw.colour) : "#888888",
      homage: String(raw.homage ?? ""),
      beliefs: Array.isArray(raw.beliefs) ? raw.beliefs.map(String).slice(0, 3) : [],
      avatar: typeof raw.avatar === "string" && raw.avatar.trimStart().startsWith("<svg") && !/<script|href=|<image|<foreignObject/i.test(raw.avatar) ? raw.avatar : "",
    };
  } catch {
    return null;
  }
}

// ---------- laying the arena ----------

/** A blob already minted: what an `item.add` names. */
export interface Minted {
  blobHash: string;
  size: number;
  mimeType: string;
  filename: string;
}

export interface ArenaInput {
  at: { x: number; y: number };
  brief: string;
  fighters: readonly { source: string; pack: FighterPack }[];
  entryKind: EntryKind;
  mode: Mode;
  minutes: number;
  decider: string | null;
  target: Item | null;
  parent?: string | null;
  blobs: {
    brief: Minted;
    lanes: Record<string, { area: Minted; card: Minted; design: Minted; shelf: Minted }>;
  };
}

export interface ArenaPlan {
  boutId: string;
  ops: Operation[];
  lanes: { packId: string; areaId: string }[];
}

const version = (blob: Minted) => ({ id: newVersionId(), ...blob });

/**
 * **The arena as ops** — one Brief area across the top, a lane per fighter
 * beneath it, each lane furnished with its card, its scoped `DESIGN.md` and
 * its shelf. Pure: a surface mints the blobs, calls this, and sends the ops
 * in one group, so the terminal and the picker lay the same arena.
 */
export function arenaPlan(input: ArenaInput): ArenaPlan {
  const n = input.fighters.length;
  const width = n * LANE.width + (n - 1) * LANE_GAP;
  const boutId = newItemId();
  const ops: Operation[] = [];
  const { x, y } = input.at;
  ops.push({
    type: "item.add",
    itemId: boutId,
    version: version(input.blobs.brief),
    width,
    height: BRIEF_HEIGHT,
    placement: { x, y, chosen: true },
    title: `Design competition — ${shortBrief(input.brief)}`,
    properties: {
      kind: "area",
      [AREA_TINT_PROP]: "grey",
      [P.role]: "brief",
      [P.fighters]: input.fighters.map((f) => f.pack.id).join(","),
      [P.entryKind]: input.entryKind,
      [P.mode]: input.mode,
      [P.minutes]: String(input.minutes),
      [P.phase]: "laid",
      ...(input.decider ? { [P.decider]: input.decider } : {}),
      ...(input.target ? { [P.target]: input.target.id } : {}),
      ...(input.parent ? { [P.parent]: input.parent } : {}),
    },
  } as Operation);
  if (input.target) {
    const current = input.target.versions.find((v) => v.id === input.target!.currentVersionId) ?? input.target.versions[0];
    if (current) {
      // The screen the bout is about, copied in as a reference: the same
      // bytes (no upload), a new item, so the real one is never moved.
      ops.push({
        type: "item.add",
        itemId: newItemId(),
        version: { id: newVersionId(), blobHash: current.blobHash, size: current.size, mimeType: current.mimeType, filename: current.filename },
        width: Math.min(input.target.width, 720),
        height: Math.min(input.target.height, BRIEF_HEIGHT - AREA_HEAD - AREA_INSET),
        placement: { x: x + width - Math.min(input.target.width, 720) - AREA_INSET, y: y + AREA_HEAD, chosen: true },
        title: `Reference — ${input.target.title}`,
        properties: { [P.bout]: boutId },
      } as Operation);
    }
  }
  const lanes: ArenaPlan["lanes"] = [];
  const top = y + BRIEF_HEIGHT + LANE_GAP;
  input.fighters.forEach(({ source, pack }, i) => {
    const blobs = input.blobs.lanes[pack.id];
    if (!blobs) throw new Error(`no blobs minted for ${pack.id}`);
    const areaId = newItemId();
    const lx = x + i * (LANE.width + LANE_GAP);
    lanes.push({ packId: pack.id, areaId });
    ops.push({
      type: "item.add",
      itemId: areaId,
      version: version(blobs.area),
      width: LANE.width,
      height: LANE.height,
      placement: { x: lx, y: top, chosen: true },
      title: pack.agentName,
      properties: { kind: "area", [P.role]: "lane", [P.bout]: boutId, [P.fighter]: pack.id, [P.source]: source },
    } as Operation);
    const ix = lx + AREA_INSET;
    let iy = top + AREA_HEAD;
    const place = (size: { width: number; height: number }) => {
      const at = { x: ix, y: iy, chosen: true };
      iy += size.height + STACK_GAP;
      return at;
    };
    ops.push({
      type: "item.add",
      itemId: newItemId(),
      version: version(blobs.card),
      ...CARD,
      placement: place(CARD),
      title: pack.agentName,
      properties: { [P.bout]: boutId, [P.fighter]: pack.id },
    } as Operation);
    ops.push({
      type: "item.add",
      itemId: newItemId(),
      version: version(blobs.design),
      ...SYSTEM,
      placement: place(SYSTEM),
      title: `DESIGN.md — ${pack.title}`,
      properties: { ...designSystemProperties(), [P.bout]: boutId, [P.fighter]: pack.id },
    } as Operation);
    ops.push({
      type: "item.add",
      itemId: newItemId(),
      version: version(blobs.shelf),
      ...SHELF,
      placement: place(SHELF),
      title: `References — ${pack.title}`,
      properties: { [P.bout]: boutId, [P.fighter]: pack.id },
    } as Operation);
  });
  return { boutId, ops, lanes };
}

/** The brief, as a title: its first clause, at most eight words. */
export function shortBrief(brief: string): string {
  const words = brief.trim().split(/\s+/);
  return words.length > 8 ? `${words.slice(0, 8).join(" ")}…` : words.join(" ");
}

/** Where a new arena goes: to the right of everything on the canvas, level
 *  with its top — never on top of work. */
export function arenaOrigin(canvas: CanvasContents): { x: number; y: number } {
  const items = Object.values(canvas.items);
  if (items.length === 0) return { x: 0, y: 0 };
  const right = Math.max(...items.map((i) => i.x + i.width));
  const top = Math.min(...items.map((i) => i.y));
  return { x: Math.round(right + 400), y: Math.round(top) };
}

// ---------- starting, and the brief each fighter is handed ----------

/**
 * **What a fighter is told, on the canvas** — the first turn is a message in
 * its lane, addressed to it, so the room can read exactly what each fighter
 * was asked. Who it IS lives in its working directory (the template); what to
 * DO lives here.
 */
export function fighterBrief(bout: Bout, lane: Lane, pack: FighterPack, agentName: string): string {
  const rivals = bout.lanes.filter((l) => l.packId !== lane.packId).map((l) => l.area.title);
  return [
    `@${agentName} — you are fighting in **${bout.brief.title.replace(/^Design competition — /, "")}**.`,
    "",
    `**The brief** is the Brief card above the lanes. **Your lane** is "${lane.area.title}". Build ${bout.entryKind === "flow" ? "a flow of three screens" : "one screen"} there, in the spirit of *${pack.title}* (${pack.credit}) — your \`DESIGN.md\` is the design system scoped to your lane: \`isocan design --css --in "${lane.area.title}"\` prints its tokens.`,
    "",
    `**The rules of the bout:** build only in your lane (\`isocan add … --in "${lane.area.title}"\`); do not read the other lanes (${rivals.join(", ")}); one entry; hand it in with \`isocan competition handin <item>\` before the bell (${bout.minutes} minutes). You are an homage, not the person — never sign as them.`,
    "",
    "When the bell rings you will be asked to critique each rival entry in your voice and rank the ones you did not make. Until then: build.",
  ].join("\n");
}

export interface StartInput {
  bout: Bout;
  packs: Record<string, FighterPack>;
  /** The actor each lane's fighter was enrolled as. */
  actors: Record<string, { id: string; name: string }>;
  now: Date;
}

/**
 * **The start as ops**: each lane records its fighter's actor, each fighter is
 * handed its brief in its lane (a thread that mentions it — which is what
 * wakes an agent the rc holds), and the Brief says the bout is building, until
 * when. One group; the enrolments happen before, on the machine that answers
 * for them.
 */
export function startPlan(input: StartInput): Operation[] {
  const ops: Operation[] = [];
  const until = new Date(input.now.getTime() + input.bout.minutes * 60_000).toISOString();
  for (const lane of input.bout.lanes) {
    const actor = input.actors[lane.packId];
    const pack = input.packs[lane.packId];
    if (!actor || !pack) continue;
    ops.push({ type: "item.update", itemId: lane.area.id, patch: { properties: { [P.actor]: actor.id } } });
    ops.push({
      type: "thread.create",
      threadId: newThreadId(),
      x: lane.area.x + CARD.width + AREA_INSET * 3,
      y: lane.area.y + AREA_HEAD + 20,
      anchorItemId: null,
      comment: { id: newCommentId(), body: fighterBrief(input.bout, lane, pack, actor.name), mentions: [actor.id], items: [input.bout.brief.id] },
    });
  }
  ops.push({ type: "item.update", itemId: input.bout.brief.id, patch: { properties: { [P.phase]: "building", [P.until]: until } } });
  return ops;
}

/** The patch that hands an item in as a lane's entry. */
export function handinPatch(bout: Bout, lane: Lane): Record<string, string> {
  return { [P.entry]: bout.brief.id, [P.fighter]: lane.packId };
}

/**
 * **The bell**: the Brief moves to voting for so many minutes, and the
 * fighters are asked — once, on the Brief, after building stops, so none of
 * them is parked on its lane when a rival's critique lands there — to
 * critique each rival entry in their voice and rank the ones they did not
 * make. One group, so the terminal and the tray ring the same bell.
 */
export function bellPlan(bout: Bout, now: Date, minutes: number): Operation[] {
  const until = new Date(now.getTime() + minutes * 60_000).toISOString();
  const ops: Operation[] = [{ type: "item.update", itemId: bout.brief.id, patch: { properties: { [P.phase]: "voting", [P.until]: until } } }];
  const fighters = bout.lanes.flatMap((l) => (l.actorId ? [l.actorId] : []));
  if (fighters.length > 0) {
    ops.push({
      type: "thread.create",
      threadId: newThreadId(),
      x: 40,
      y: 40,
      anchorItemId: bout.brief.id,
      comment: {
        id: newCommentId(),
        body:
          `${bout.lanes.map((l) => `@${l.area.title}`).join(" ")} — the bell. Critique each rival entry in ONE thread on it, in your pack's voice (your critique.md), naming which question decided your view; ` +
          "then rank the entries you did not make with `isocan competition vote <entry> --rank 1|2`. Never rank your own; never place a 🏆.",
        mentions: fighters,
        items: entriesOf(bout).map((e) => e.id),
      },
    });
  }
  return ops;
}

/** The Brief recording the Decider's pick. */
export function decidePlan(bout: Bout, winner: Item): Operation[] {
  return [{ type: "item.update", itemId: bout.brief.id, patch: { properties: { [P.phase]: "decided", [P.winner]: winner.id } } }];
}

/** How long is left, in whole minutes and seconds, or null past it. */
export function timeLeft(bout: Bout, now: Date): string | null {
  if (!bout.until) return null;
  const ms = Date.parse(bout.until) - now.getTime();
  if (ms <= 0) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What each lane is doing, in a word — for `competition status` and the card. */
export function laneState(canvas: CanvasContents, bout: Bout, lane: Lane): "waiting" | "building" | "handed in" | "no entry" {
  if (lane.entry) return "handed in";
  if (bout.phase === "laid") return "waiting";
  if (bout.phase === "building") {
    const worked = Object.values(canvas.items).some(
      (item) => inArea(lane.area, item) && lane.actorId !== null && item.createdBy.id === lane.actorId,
    );
    return worked ? "building" : "waiting";
  }
  return "no entry";
}
