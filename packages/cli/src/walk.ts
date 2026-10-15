import { anchorAtFraction, critiqueCannot, newCommentId, newThreadId, nightLead, type Actor, type CanvasSnapshotResponse, type NightSeen } from "@isocan/core";
import {
  DEFAULT_WALKERS,
  WALKERS_MAX,
  WALK_NOTICE,
  WALK_OUTCOMES,
  WALK_PARAMETERS,
  stumbleBody,
  walkAskBody,
  walkAsks,
  walkFindings,
  walkFlow,
  walkLanes,
  walkRecordBody,
  walkRecordOf,
  walkRecordRefusal,
  walkScreen,
  walkShared,
  walkStumbles,
  walkerOf,
  type WalkAsk,
  type WalkLane,
  type WalkRecord,
  type WalkScreen,
  type WalkStumble,
  type Walker,
} from "@isocan/core/walk";
import type { Ctx } from "./ctx.ts";
import { sayInChat, type ExplainDeps } from "./explain.ts";
import { propose } from "./propose.ts";

/**
 * **`isocan walk`** (proactive-agent phase 9, design §11) — walk it as
 * someone else, from a terminal. A top-level verb, as `ripple`, `explain`
 * and `stuck` are: it is an exchange between the person and the canvas's
 * lead about a flow, not an act on the design system, and design §13 names it.
 *
 * - `isocan walk <flow|screen> [--as <walker>…]`: the lanes, measured — which
 *   screens the flow reaches, and per walker what the screens' code says they
 *   meet. Writes nothing.
 * - `… --task "<task>"`: the person's ask — the same lanes, and the lead asked
 *   in the Chat to walk each one through the task; with nothing to answer,
 *   the lanes still print and the walk waits.
 * - `isocan walk [walk]`: a walk asked before (the newest with none named) —
 *   the lanes, the lead's pins and outcomes, the shared finding, or why it waits.
 * - The lead's answer, once per walk: `--stumble` (a pin worn as the walker)
 *   ×n, `--outcome` for every walker, and where two or more stumbled on one
 *   screen, `--shared` with one `--fix` (a proposal citing `walk:<id>`).
 *
 * Every printing says these are simulations. Loaded on this verb only, with
 * main's helpers handed in (`propose.ts`'s reason).
 */
export interface WalkOpts {
  task?: string;
  as?: string[];
  stumble?: string[];
  outcome?: string[];
  shared?: string;
  fix?: string;
  why?: string;
  hunch?: boolean;
}

/** The canvas's lead, and why it cannot answer this person — null when it can. */
async function leadFor(ctx: Ctx, canvas: { id: string; properties?: Record<string, string> }, snapshot: CanvasSnapshotResponse): Promise<{ lead: Actor | null; cannot: string | null }> {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen: NightSeen = { answering, sessions, ...(snapshot.joined ? { joined: snapshot.joined } : {}) };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}

const split = (raw: string, n: number, shape: string): string[] => {
  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length < n || parts.slice(0, n).some((p) => !p)) throw new Error(`write ${shape} — not "${raw}"`);
  return [...parts.slice(0, n - 1), parts.slice(n - 1).join(" | ")];
};

/** `isocan walk [ref] [--task … --as … | --stumble … --outcome … --shared … --fix …]`. */
export async function walk(ctx: Ctx, deps: ExplainDeps, ref: string | undefined, opts: WalkOpts): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const canvas = snapshot.canvas;
  const read = async (hash: string) => (await ctx.client.downloadBlob(p.id, hash)).toString("utf8");
  const asks = walkAsks(canvas);
  const answering = (opts.stumble?.length ?? 0) > 0 || (opts.outcome?.length ?? 0) > 0 || opts.shared !== undefined || opts.fix !== undefined;
  if (answering && (opts.task !== undefined || (opts.as?.length ?? 0) > 0)) throw new Error("one act at a time: the person's --task (and --as), or the lead's --stumble / --outcome / --shared");

  /** The screens of an asked walk, at the versions it was asked over. */
  const screensOf = async (ask: Pick<WalkAsk, "screens">): Promise<WalkScreen[]> => (await Promise.all(ask.screens.map(async (s) => {
    const item = canvas.items[s.itemId];
    const v = item?.versions.find((x) => x.id === s.versionId);
    return item && v ? [walkScreen(item, v.id, await read(v.blobHash))] : [];
  }))).flat();

  const askNamed = ref ? asks.find((a) => a.id === ref) : undefined;
  if (answering) {
    const ask = askNamed ?? (ref ? undefined : [...asks].reverse().find((a) => !walkRecordOf(canvas, a.id)));
    if (!ask) throw new Error(ref ? `no walk ${ref} here — \`isocan walk\` shows the newest` : "no walk is waiting for an answer here");
    await answer(ctx, deps, p.id, snapshot, ask, await screensOf(ask), opts);
    return;
  }

  if (!ref || askNamed) {
    const ask = askNamed ?? asks.at(-1);
    if (!ask) {
      if (ctx.json) return deps.printJson({ walk: null, notice: WALK_NOTICE });
      console.log("No walk has been asked here yet: `isocan walk <flow|screen> --task \"…\" --as one-handed --as low-vision`.");
      return;
    }
    const screens = await screensOf(ask);
    const stumbles = walkStumbles(canvas, ask.id);
    const record = walkRecordOf(canvas, ask.id);
    const waits = record ? null : await leadFor(ctx, p, snapshot).then(({ lead, cannot }) => (cannot || !lead ? `The walk waits: ${cannot ?? "no lead"}.` : `Asked ${lead.name} — its pins and outcomes have not come yet.`));
    return show(ctx, deps, { ask, task: ask.task, via: null, unreached: [], screens, walkers: ask.walkers, stumbles, record, waits, asked: null });
  }

  // A flow, read — and asked about, with a task.
  const item = deps.resolveItem(snapshot, ref);
  const current = item.versions.find((v) => v.id === item.currentVersionId);
  const html = current?.mimeType === "text/html" ? await read(current.blobHash) : null;
  const flow = walkFlow(canvas, item.id, html);
  if ("refused" in flow) throw new Error(flow.refused);
  const walkers: Walker[] = [];
  for (const spec of (opts.as?.length ? opts.as : [...DEFAULT_WALKERS]).flatMap((s) => (s.includes(":") ? [s] : s.split(",")))) {
    const w = walkerOf(spec);
    if ("refused" in w) throw new Error(w.refused);
    if (!walkers.some((x) => x.id === w.id)) walkers.push(w);
  }
  if (walkers.length > WALKERS_MAX) throw new Error(`at most ${WALKERS_MAX} walkers on one walk — more is a survey, not a walk`);
  const screens = (await Promise.all(flow.screens.map(async (id) => {
    const it = canvas.items[id]!;
    const v = it.versions.find((x) => x.id === it.currentVersionId)!;
    return walkScreen(it, v.id, id === item.id && html !== null ? html : await read(v.blobHash));
  })));
  let asked: string | null = null;
  let waits: string | null = null;
  if (opts.task !== undefined) {
    const task = opts.task.replace(/\s+/g, " ").trim();
    if (!task) throw new Error("--task says what they are trying to do: \"order a loaf for Saturday\"");
    const { lead, cannot } = await leadFor(ctx, p, snapshot);
    if (cannot || !lead) waits = `The walk waits: ${cannot ?? "no lead"}. Nothing was asked; the lanes above are measured, and nobody has walked them.`;
    else {
      const findings = walkers.flatMap((w) => walkFindings(w, screens));
      const posted = await sayInChat(ctx, deps, p.id, snapshot, walkAskBody(lead, task, screens, walkers, findings), { items: screens.map((s) => s.itemId) });
      asked = posted.commentId;
      waits = `Asked ${lead.name} to walk it (${posted.commentId}) — stumbles land as pins on the screens, an outcome for each walker, and one fix where several stumble.`;
    }
  }
  return show(ctx, deps, { ask: null, task: opts.task ?? null, via: flow.via, unreached: flow.unreached, screens, walkers, stumbles: [], record: null, waits, asked });
}

/** The lead's answer: the fix first (the cap refuses before anything lands), then a pin per stumble, then the record. */
async function answer(ctx: Ctx, deps: ExplainDeps, canvasId: string, snapshot: CanvasSnapshotResponse, ask: WalkAsk, screens: WalkScreen[], opts: WalkOpts): Promise<void> {
  const canvas = snapshot.canvas;
  if (walkRecordOf(canvas, ask.id)) throw new Error(`this walk was already answered — \`isocan walk ${ask.id}\` shows it`);
  const screenOf = (raw: string): WalkScreen => {
    const want = raw.replace(/^#/, "").trim().toLowerCase();
    const hit = screens.find((s) => s.itemId.toLowerCase() === want || s.title.toLowerCase() === want);
    if (!hit) throw new Error(`"${raw}" is not a screen this walk met — ${screens.map((s) => `“${s.title}”`).join(", ")}`);
    return hit;
  };
  const walkerId = (raw: string) => {
    const w = walkerOf(raw);
    return "refused" in w ? raw.trim() : w.id;
  };
  const stumbles: WalkStumble[] = (opts.stumble ?? []).map((raw) => {
    const [w, s, f, what] = split(raw, 4, "\"<walker> | <screen> | <measured id, or judged> | <what happened>\"");
    const finding = f!.toLowerCase() === "judged" ? "judged" : f!.replace(/^measured\s*/i, "");
    return { walk: ask.id, walker: walkerId(w!), itemId: screenOf(s!).itemId, finding, what: what! };
  });
  const outcomes = (opts.outcome ?? []).map((raw) => {
    const [w, o, line] = split(raw, 3, `"<walker> | ${WALK_OUTCOMES.join("|")} | <one line>"`);
    return { walker: walkerId(w!), outcome: o!.toLowerCase(), line: line! };
  });
  const shared = opts.shared !== undefined ? (() => {
    const [s, sentence] = split(opts.shared!, 2, "\"<screen> | <the problem, in design words>\"");
    return { itemId: screenOf(s!).itemId, sentence: sentence! };
  })() : null;
  const findings = ask.walkers.flatMap((w) => walkFindings(w, screens));
  const refused = walkRecordRefusal(ask, findings, stumbles, outcomes, shared, opts.fix !== undefined);
  if (refused) throw new Error(refused);
  if (opts.fix !== undefined && !opts.why?.trim()) throw new Error("the fix says why, in design words: --why \"…\" (two sentences at most)");

  const fix = shared && opts.fix ? await propose(ctx, deps, shared.itemId, opts.fix, { cites: [`walk:${ask.id}`], why: opts.why!, ...(opts.hunch ? { hunch: true } : {}) }, true) : undefined;
  const pins: string[] = [];
  const spare = new Map<string, number>();
  for (const s of stumbles) {
    const screen = screens.find((x) => x.itemId === s.itemId)!;
    const item = canvas.items[s.itemId]!;
    const f = findings.find((x) => x.walker === s.walker && x.itemId === s.itemId && x.id === s.finding);
    const vp = screen.read.viewport;
    // Where it happened when the code places it; else down the screen's right edge, one pin under another.
    const n = spare.get(s.itemId) ?? 0;
    const at = f?.at
      ? { x: Math.min(1, Math.max(0, (f.at.x + f.at.width / 2) / vp.width)), y: Math.min(1, Math.max(0, (f.at.y + f.at.height / 2) / vp.height)) }
      : (spare.set(s.itemId, n + 1), { x: 0.94, y: Math.min(0.95, 0.08 + n * 0.08) });
    const walker = ask.walkers.find((w) => w.id === s.walker)!;
    const threadId = newThreadId();
    await deps.sendOp(ctx, canvasId, { type: "thread.create", threadId, ...anchorAtFraction(item, at), anchorItemId: item.id, comment: { id: newCommentId(), body: stumbleBody(walker, ask.id, s.finding, s.what), persona: walker.id } } as never);
    pins.push(threadId);
  }
  const typed = outcomes.map((o) => ({ ...o, outcome: o.outcome as WalkRecord["outcomes"][number]["outcome"] }));
  const posted = await sayInChat(ctx, deps, canvasId, snapshot, walkRecordBody(ask, typed, shared, fix?.itemId ?? null), { record: true, items: screens.map((s) => s.itemId) });
  if (ctx.json) return deps.printJson({ walk: ask.id, pins, record: posted.commentId, fix: fix?.itemId ?? null, shared: walkShared(stumbles) });
  console.log(`pinned ${stumbles.length} ${stumbles.length === 1 ? "stumble" : "stumbles"} on the screens, each worn as its walker; the outcomes are in the Chat (${posted.commentId})${fix ? `; one fix, ${fix.itemId}, hangs beneath “${screens.find((s) => s.itemId === shared!.itemId)!.title}” citing walk:${ask.id}` : ""}. Nothing else was touched.`);
  console.log(WALK_NOTICE);
}

interface Shown {
  ask: WalkAsk | null;
  task: string | null;
  via: "prototype" | "group" | "screen" | null;
  unreached: string[];
  screens: WalkScreen[];
  walkers: readonly Walker[];
  stumbles: WalkStumble[];
  record: WalkRecord | null;
  waits: string | null;
  asked: string | null;
}

/** The lanes, as a person reads them in a terminal — and as an agent reads them with `--json`. */
function show(ctx: Ctx, deps: ExplainDeps, s: Shown): void {
  const lanes = walkLanes(s.walkers, s.screens, s.stumbles, s.record);
  const shared = walkShared(s.stumbles);
  const titled = new Map(s.screens.map((x) => [x.itemId, x.title]));
  if (ctx.json) {
    return deps.printJson({
      walk: s.ask?.id ?? s.asked,
      task: s.task,
      via: s.via,
      notice: WALK_NOTICE,
      screens: s.screens.map((x) => ({ itemId: x.itemId, versionId: x.versionId, title: x.title })),
      unreached: s.unreached,
      walkers: s.walkers,
      lanes: lanes.map((l) => ({ walker: l.walker.id, outcome: l.outcome, screens: l.screens })),
      shared: s.record?.shared ? { ...s.record.shared, walkers: shared.find((x) => x.itemId === s.record!.shared!.itemId)?.walkers ?? [] } : shared,
      fix: s.record?.fix ?? null,
      waits: s.waits,
      parameters: WALK_PARAMETERS,
    });
  }
  const via = s.via === "prototype" ? "a prototype's path" : s.via === "group" ? "a group's screens in reading order" : s.via === "screen" ? "one screen" : null;
  console.log(`${s.task ? `Walk “${s.task}”` : "Walk"} · ${s.screens.length} ${s.screens.length === 1 ? "screen" : "screens"}${via ? `, ${via}` : ""}: ${s.screens.map((x) => x.title).join(" → ")}${s.ask ? ` (${s.ask.id}, asked by ${s.ask.by.name})` : ""}`);
  console.log(WALK_NOTICE);
  if (s.unreached.length) console.log(`No link reaches ${s.unreached.length === 1 ? "one screen" : `${s.unreached.length} screens`} from where it opens; the walk does not meet ${s.unreached.length === 1 ? "it" : "them"}.`);
  for (const lane of lanes) printLane(lane);
  if (s.record?.shared) console.log(`\nShared: “${titled.get(s.record.shared.itemId) ?? s.record.shared.itemId}” — ${s.record.shared.sentence}${s.record.fix ? ` · one fix: ${s.record.fix}, a proposal beneath it` : ""}`);
  else if (shared.length) console.log(`\nShared: ${shared.map((x) => `“${titled.get(x.itemId)}” (${x.walkers.join(", ")})`).join("; ")}`);
  if (!s.task && !s.ask) console.log("\nMeasured only — nobody was asked. `--task \"…\"` asks the canvas's lead to walk it.");
  if (s.waits) console.log(`\n${s.waits}`);
}

function printLane(lane: WalkLane): void {
  const w = lane.walker;
  console.log(`\n${w.name} — ${w.situation}${w.described ? "" : `; ${w.constraint}`}${lane.outcome ? `  [${lane.outcome.outcome}: ${lane.outcome.line}]` : ""}`);
  lane.screens.forEach((sc, i) => {
    const clean = !sc.findings.length && !sc.stumbles.length;
    console.log(`  ${i + 1}. ${sc.title}${clean && w.checks.length ? " — nothing measured in the way" : ""}`);
    for (const f of sc.findings) console.log(`     ${f.id} ${f.text}`);
    for (const st of sc.stumbles) console.log(`     ✗ stumbled (${st.finding === "judged" ? "judged, not measured" : `measured ${st.finding}`}): ${st.what}`);
    for (const n of sc.notes) console.log(`     · ${n}`);
  });
}

