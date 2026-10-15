import {
  critiqueCannot,
  newGroupId,
  nightLead,
  type Actor,
  type CanvasSnapshotResponse,
  type Item,
  type ItemVersion,
  type NightSeen,
} from "@isocan/core";
import {
  RIPPLE_PROP,
  readBackBody,
  readBackOf,
  readBackRefusal,
  rippleAsk,
  rippleAt,
  rippleAsked,
  ripplePulse,
  rippleRead,
  rippleRun,
  rippleRuns,
  rippleSections,
  rippleVersions,
  systemAsk,
  systemAsked,
  type ReadBack,
  type RippleRead,
  type RippleRun,
} from "@isocan/core/ripple";
import { PROPOSAL_PROP, parentOf, proposalCites } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { sayInChat, type ExplainDeps } from "./explain.ts";
import { propose } from "./propose.ts";

/**
 * **`isocan ripple [item]`** (proactive-agent phase 6, design §8) — changes
 * ripple, from a terminal. A top-level verb rather than one of the `design`
 * family, because a ripple is about screens and their words as much as the
 * design system: a term ("Pickup" → "Collection") ripples with no DESIGN.md
 * in sight, and putting a change *in* the design system is only one of the
 * three altitudes. With no item it prints the pulse, one tick per screen.
 *
 * - `isocan ripple <item>`: the source's latest run read against every other
 *   screen — what changed, the three states, the lead's read-back (or why it
 *   waits), the altitudes, and the sketch set apart. Reads only.
 * - `--ask`: "I like this" — summon the lead for this run now, whether or
 *   not it has settled (the canvas asks by itself once a run settles).
 * - `--altitude system|screens|one-off`: the person's choice. `system` asks
 *   the lead to propose it in the design system; `screens` (the default)
 *   writes nothing — keep each preview; `one-off` marks the source
 *   `ripple=off` and clears its open previews, in one undo.
 * - The lead's answer: `--read-back --decision … [--good …] [--exception
 *   "<screen> | why"] [--sketch …] [--sketch-file f]`, and `--preview
 *   "<screen>=<file>"` for each screen that would change — proposals citing
 *   the source's version, so nothing changes until the person keeps one.
 *
 * Loaded on this verb only, with main's helpers handed in (`propose.ts`'s reason).
 */
export interface RippleOpts {
  ask?: boolean;
  altitude?: string;
  readBack?: boolean;
  decision?: string[];
  good?: string;
  exception?: string[];
  sketch?: string;
  sketchFile?: string;
  preview?: string[];
  why?: string;
  hunch?: boolean;
}

/** The canvas's lead, and why it cannot answer this person — or null when it can. */
async function leadFor(ctx: Ctx, canvas: { id: string; properties?: Record<string, string> }, snapshot: CanvasSnapshotResponse): Promise<{ lead: Actor | null; cannot: string | null }> {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen: NightSeen = { answering, sessions, ...(snapshot.joined ? { joined: snapshot.joined } : {}) };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}

/** Every version these runs need, read once. */
async function texts(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, runs: RippleRun[]): Promise<(v: ItemVersion) => string | undefined> {
  const out = new Map<string, string>();
  await Promise.all(rippleVersions(snapshot.canvas, runs).map(async (v) => {
    out.set(v.blobHash, Buffer.from(await ctx.client.downloadBlob(canvasId, v.blobHash)).toString("utf8"));
  }));
  return (v) => out.get(v.blobHash);
}

async function readOf(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, run: RippleRun): Promise<RippleRead> {
  const back = readBackOf(snapshot.canvas, rippleAt(run));
  const read = rippleRead(snapshot.canvas, run, await texts(ctx, canvasId, snapshot, [run]), back?.exceptions ?? []);
  if (!read) throw new Error("a version this ripple needs could not be read");
  return read;
}

function header(read: RippleRead): string {
  const r = read.run;
  return `Ripple from “${read.source.title}” (${read.at}) · ${r.by.name}'s run, ${r.edits} edit${r.edits === 1 ? "" : "s"} · ${r.settled ? "settled" : `settles ${new Date(r.settlesAt).toLocaleTimeString()}`}`;
}

/** `isocan ripple [item] [--ask | --altitude … | --read-back … | --preview …]`. */
export async function ripple(ctx: Ctx, deps: ExplainDeps, ref: string | undefined, opts: RippleOpts): Promise<void> {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const now = Date.now();

  if (!ref) {
    const all = rippleRuns(snapshot.canvas, now);
    const runs = all.filter((r) => r.settled);
    const textOf = await texts(ctx, p.id, snapshot, runs);
    const reads = runs.flatMap((run) => {
      const r = rippleRead(snapshot.canvas, run, textOf, readBackOf(snapshot.canvas, rippleAt(run))?.exceptions ?? []);
      return r ? [r] : [];
    });
    const ticks = ripplePulse(snapshot.canvas, reads);
    if (ctx.json) return deps.printJson({ ticks, sources: reads.map((r) => ({ itemId: r.source.itemId, at: r.at })), settling: all.filter((r) => !r.settled) });
    const mark = { current: "●", behind: "◐", conflict: "✕" } as const;
    const count = (s: keyof typeof mark) => ticks.filter((t) => t.state === s).length;
    console.log(`Pulse: ${ticks.map((t) => mark[t.state]).join(" ")}  ${count("current")} current · ${count("behind")} behind · ${count("conflict")} in conflict`);
    for (const t of ticks) console.log(`  ${mark[t.state]} ${t.title}${t.why ? ` — ${t.why}` : ""}`);
    for (const r of all.filter((x) => !x.settled)) console.log(`${r.by.name}'s run on “${r.title}” is still settling — quiet until ${new Date(r.settlesAt).toLocaleTimeString()}, or \`isocan ripple ${r.itemId} --ask\``);
    if (!reads.length) console.log("No settled run to ripple from: a screen ripples after a run of edits settles, or `isocan ripple <item> --ask`.");
    return;
  }

  const item = deps.resolveItem(snapshot, ref);
  const run = rippleRun(snapshot.canvas, item.id, now, true);
  if (!run) throw new Error(`“${item.title}” has no run of edits to ripple — a screen ripples after somebody edits it, and its newest version is the one showing (an agent's edits are not a run)`);
  const read = await readOf(ctx, p.id, snapshot, run);
  const said = [opts.ask, opts.altitude !== undefined, opts.readBack || (opts.preview?.length ?? 0) > 0].filter(Boolean).length;
  if (said > 1) throw new Error("one act at a time: --ask, --altitude, or the lead's --read-back / --preview");

  if (opts.ask) {
    const found = await leadFor(ctx, p, snapshot);
    if (found.cannot || !found.lead) throw new Error(`nothing can read it back here: ${found.cannot ?? "no lead"}. The ripple stands without one — \`isocan ripple ${item.id}\``);
    if (rippleAsked(snapshot.canvas, read.at)) throw new Error(`${found.lead.name} was already asked about this run — \`isocan ripple ${item.id}\` shows the read-back when it comes`);
    const posted = await sayInChat(ctx, deps, p.id, snapshot, rippleAsk(found.lead, read), { items: [item.id] });
    if (ctx.json) return deps.printJson({ commentId: posted.commentId, lead: found.lead, at: read.at });
    console.log(`asked ${found.lead.name} to read back your run on “${item.title}” (${posted.commentId}); nothing on any other screen has changed`);
    return;
  }

  if (opts.altitude !== undefined) {
    const altitude = opts.altitude;
    if (altitude === "screens") {
      const previews = read.screens.filter((s) => s.previewId);
      if (ctx.json) return deps.printJson({ altitude, previews: previews.map((s) => s.previewId) });
      console.log(`screen by screen: keep each preview you want (${previews.length ? previews.map((s) => `\`isocan choose ${s.previewId}\` for “${s.title}”`).join(", ") : "none has arrived yet"}); nothing changes until you do`);
      return;
    }
    if (altitude === "system") {
      const found = await leadFor(ctx, p, snapshot);
      if (found.cannot || !found.lead) throw new Error(`nothing can put it in the design system for you here: ${found.cannot ?? "no lead"}`);
      if (systemAsked(snapshot.canvas, read.at)) throw new Error(`${found.lead.name} was already asked to put this run in the design system`);
      const posted = await sayInChat(ctx, deps, p.id, snapshot, systemAsk(found.lead, read), { items: [item.id] });
      if (ctx.json) return deps.printJson({ altitude, commentId: posted.commentId });
      console.log(`asked ${found.lead.name} to propose “${item.title}”'s change in the design system (${posted.commentId}); it arrives as a proposal, and nothing changes until you keep it`);
      return;
    }
    if (altitude === "one-off") {
      if (item.properties[RIPPLE_PROP] === "off") throw new Error(`“${item.title}” is already a one-off`);
      const group = newGroupId();
      await deps.sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: { properties: { [RIPPLE_PROP]: "off" } } }, group);
      const open = openPreviews(snapshot.canvas.items, item.id);
      for (const one of open) await deps.sendOp(ctx, p.id, { type: "item.delete", itemId: one.id }, group);
      if (ctx.json) return deps.printJson({ altitude, itemId: item.id, cleared: open.map((o) => o.id) });
      console.log(`“${item.title}” is a one-off: it stops rippling${open.length ? `, and its ${open.length} open preview${open.length === 1 ? "" : "s"} went to the trash` : ""} — one undo takes it back`);
      return;
    }
    throw new Error(`--altitude is system, screens or one-off — not "${altitude}"`);
  }

  if (opts.readBack || opts.preview?.length) {
    let back: ReadBack | null = null;
    let posted: { commentId: string } | null = null;
    if (opts.readBack) {
      back = {
        decisions: (opts.decision ?? []).map((d) => d.trim()).filter(Boolean),
        good: opts.good?.trim() || null,
        exceptions: (opts.exception ?? []).map((raw) => {
          const at = raw.indexOf("|");
          if (at < 0) throw new Error(`an exception is "<screen> | why, in one line" — not "${raw}"`);
          const screen = deps.resolveItem(snapshot, raw.slice(0, at).trim());
          return { itemId: screen.id, title: screen.title || "Untitled", why: raw.slice(at + 1).trim() };
        }),
        sketch: opts.sketch?.trim() || null,
      };
      if (opts.sketchFile && !back.sketch) throw new Error("--sketch-file draws the idea --sketch says");
      const refused = readBackRefusal(snapshot.canvas, read, back);
      if (refused) throw new Error(refused);
      posted = await sayInChat(ctx, deps, p.id, snapshot, readBackBody(read.at, back), { record: true, items: [item.id, ...back.exceptions.map((e) => e.itemId)] });
    }
    const why = opts.why?.trim() || back?.decisions[0] || readBackOf(snapshot.canvas, read.at)?.decisions[0];
    const made: { screen: string; itemId: string }[] = [];
    for (const raw of opts.preview ?? []) {
      const at = raw.lastIndexOf("=");
      if (at < 1) throw new Error(`a preview is "<screen>=<file>" — not "${raw}"`);
      const screen = deps.resolveItem(snapshot, raw.slice(0, at).trim());
      const row = read.screens.find((s) => s.itemId === screen.id);
      const argued = back?.exceptions.find((e) => e.itemId === screen.id);
      if (argued) throw new Error(`“${screen.title}” disagrees (${argued.why}) — argue it, do not preview it`);
      if (!row || row.state !== "would change") {
        throw new Error(`“${screen.title}” ${row ? (row.state === "in sync" ? "is already in sync" : `disagrees (${row.because}) — argue it, do not preview it`) : "does not use what changed"}: preview only a screen that would change`);
      }
      if (!why) throw new Error("a preview says why in design words: --why, or read it back first (--read-back --decision …)");
      const one = await propose(ctx, deps, screen.id, raw.slice(at + 1).trim(), { cites: [`version:${read.cite}`], why, ...(opts.hunch ? { hunch: true } : {}) }, true);
      if (one) made.push({ screen: screen.id, itemId: one.itemId });
    }
    let sketched: string | null = null;
    if (opts.sketchFile && back?.sketch) {
      const one = await propose(ctx, deps, item.id, opts.sketchFile, { cites: [`version:${read.cite}`], why: back.sketch, hunch: true, title: `${item.title || "Untitled"} — a sketch` }, true);
      if (one) sketched = one.itemId;
    }
    if (ctx.json) return deps.printJson({ commentId: posted?.commentId ?? null, previews: made, sketch: sketched });
    if (posted) console.log(`the read-back is in the Chat (${posted.commentId})`);
    for (const m of made) console.log(`previewed “${snapshot.canvas.items[m.screen]?.title}” beneath it (${m.itemId}), citing version:${read.cite}`);
    if (sketched) console.log(`the sketch hangs beneath “${item.title}” as a hunch (${sketched}), set apart from the previews`);
    return;
  }

  const back = readBackOf(snapshot.canvas, read.at);
  let waits: string | null = null;
  if (!back && !rippleAsked(snapshot.canvas, read.at)) waits = (await leadFor(ctx, p, snapshot)).cannot ?? `nobody has asked the lead yet — \`isocan ripple ${item.id} --ask\``;
  const sections = rippleSections(read, back, waits);
  if (ctx.json) return deps.printJson({ read, back, waits, sections });
  console.log(header(read));
  for (const s of sections) {
    if (!s.lines.length) continue;
    console.log(`\n${s.heading}`);
    for (const l of s.lines) console.log(`  ${l.text}${l.previewId ? ` (preview ${l.previewId})` : ""}`);
  }
}

/** The open previews of a source's ripples: proposals citing one of its versions. */
function openPreviews(items: Record<string, Item>, sourceId: string): Item[] {
  return Object.values(items).filter((one) => one.properties[PROPOSAL_PROP] && parentOf(one) !== sourceId && proposalCites(one).some((c) => c.kind === "version" && c.ref.startsWith(`${sourceId}@`)));
}
