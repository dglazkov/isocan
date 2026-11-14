/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Command } from "commander";
import type { CanvasSnapshotResponse, Item, LogEntry } from "@isocan/core";
import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import { core } from "./core-ref.ts";
import type { Kit } from "./stories.ts";
import {
  CARD, EXACT_LANE_MIME, LANE_SIZE, PHASED_NOTE, agentRefusal, cardAt, changedScreens, classificationLine, classify,
  originLine, parseLane, parsePrepareAsk, parsePrepareAnswer, parsePrepared, parseRelease, parseShipAsk, parseShipAnswer,
  preparedMarkdown, preparedRecord, releaseMarkdown,
  type DeployTable, type LaneFacts, type PrepareAnswer, type PrepareReport, type PreparedRecord, type ReleaseRecord, type ShipAnswer, type ShipAsk, type ShipKind,
} from "./release.ts";

/**
 * **Ship, the acting half** (exact phase 7; design §11), loaded with the
 * verbs — never on `isocan --version`'s path.
 *
 * - **Prepare** (`isocan exact prepare`, or the lane's Prepare): Exact's dry
 *   run, posted as a card in the channel's row — over the air, or *needs a
 *   binary* with Exact's reason — and the origin's digest either side of it.
 *   Anybody may prepare, an agent too.
 * - **Ship**, **Promote**, **Roll back** (`isocan exact ship|promote|rollback`,
 *   or the lane's buttons, answered by `isocan exact live`): Exact's `--yes`,
 *   signed with the keys on this machine. **Only a person ships**: the CLI
 *   refuses when its own actor is an enrolled agent, and `live` refuses a
 *   lane ask an agent wrote. A person confirms the channel, the change count
 *   and the classification — the CLI's `--yes` after it printed them, the
 *   lane's confirm step — and the ship is pinned to the commit they saw.
 * - The canvas holds the release record only: keys never leave the machine.
 *
 * Nothing here spawns: Exact runs in `scripts/exact-bridge.mjs`.
 */

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const P = () => core.EXACT_PROPS;
const currentVersion = (item: Item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);

interface ShipReport extends Omit<PrepareReport, "table"> { release?: string; table: DeployTable | null }

const isAgent = (snapshot: CanvasSnapshotResponse, actorId: string) => !!snapshot.canvas.agents?.[actorId];

export function laneItemOf(snapshot: CanvasSnapshotResponse, appId: string): Item | null {
  return Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === appId && currentVersion(i)?.mimeType === EXACT_LANE_MIME) ?? null;
}

/** Every prepare or release card of an app, oldest first. */
function cardsOf(snapshot: CanvasSnapshotResponse, appId: string) {
  const items = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId);
  const prepared = items.flatMap((i) => { const r = parsePrepared(i.properties?.[P().classification]); return r ? [{ item: i, record: r }] : []; }).sort((a, b) => a.record.at.localeCompare(b.record.at));
  const releases = items.flatMap((i) => { const r = parseRelease(i.properties?.[P().release]); return r ? [{ item: i, record: r }] : []; }).sort((a, b) => a.record.at.localeCompare(b.record.at));
  return { prepared, releases };
}

/**
 * The app's screens by version — each host's phone screen in the light scheme, the one a person reads first: what
 * a release card compares. Every host, not only the one the lane ships to: a capture session may not have re-run
 * the simulator, and the web's screens still say what the release changed.
 */
function screensNow(snapshot: CanvasSnapshotResponse, appId: string): Record<string, { title: string; version: string }> {
  const pick = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId && i.properties?.[P().route] && !i.properties?.[P().branch]
    && (i.properties?.[P().device] ?? "phone") === "phone" && (i.properties?.[P().scheme] ?? "light") === "light");
  return Object.fromEntries(pick.flatMap((i) => { const v = currentVersion(i); return v ? [[i.id, { title: i.title, version: v.id }]] : []; }));
}

/** The lane: `app.json`'s `deploy` as a JSON item, right of the app's region; a new version when the deploy block moved. */
async function upsertLane(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, lane: LaneFacts): Promise<Item> {
  const snapshot = await ctx.client.snapshot(canvasId);
  const existing = laneItemOf(snapshot, lane.app.id);
  const mine = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === lane.app.id && !parseRelease(i.properties?.[P().release]) && !parsePrepared(i.properties?.[P().classification]));
  const right = mine.length ? Math.max(...mine.map((i) => i.x + i.width)) : 0;
  const top = mine.length ? Math.min(...mine.map((i) => i.y)) : 0;
  const facts: LaneFacts = { format: 1, app: lane.app, platform: lane.platform, channels: lane.channels, baked: lane.baked, activate: lane.activate, interval: lane.interval, signing: lane.signing };
  const size = LANE_SIZE(lane.channels.length);
  const { itemId } = await kit.upsert(host, ctx, canvasId, snapshot, existing,
    { bytes: Buffer.from(JSON.stringify(facts, null, 2) + "\n", "utf8"), mime: EXACT_LANE_MIME, filename: "release-lane.exact-lane.json" },
    { title: `${lane.app.name} — releases`, ...size, properties: { [P().app]: JSON.stringify({ id: lane.app.id }) }, at: { x: Math.round(right + 600), y: Math.round(top) } },
    id("exact-lane"));
  return (await ctx.client.snapshot(canvasId)).canvas.items[itemId]!;
}

async function postCard(host: CliHost, ctx: Ctx, canvasId: string, lane: Item, laneFacts: LaneFacts, channel: string, text: string, filename: string, title: string, properties: Record<string, string>): Promise<string> {
  const snapshot = await ctx.client.snapshot(canvasId);
  const row = Math.max(0, laneFacts.channels.findIndex((c) => c.name === channel));
  const { prepared, releases } = cardsOf(snapshot, laneFacts.app.id);
  const inRow = [...prepared, ...releases].filter((c) => c.record.channel === channel).length;
  const put = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), "text/markdown", filename);
  const itemId = id("itm");
  await host.sendOp(ctx, canvasId, {
    type: "item.add", itemId,
    version: { id: id("ver"), blobHash: put.blobHash, mimeType: "text/markdown", filename, size: put.size },
    width: CARD.width, height: CARD.height, placement: cardAt(lane, row, inRow), title,
    properties: { [P().app]: JSON.stringify({ id: laneFacts.app.id }), ...properties },
    ...(snapshot.project.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" as const } : {}),
  } as never, id("exact-card"));
  return itemId;
}

/** **Prepare**, from either door: the dry run, the lane, the card. */
export async function prepareOn(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, channel: string, by: string, platform?: string): Promise<{ report: PrepareReport; record: PreparedRecord | null; itemId: string | null }> {
  const report = await kit.bridge<PrepareReport>(host, "prepare", ["--app", app, "--channel", channel, ...(platform ? ["--platform", platform] : [])], "Exact's dry run", true);
  if (!report.ok || !report.table) return { report, record: null, itemId: null };
  const lane = await upsertLane(kit, host, ctx, canvasId, report.lane);
  const record = preparedRecord(report, by, new Date().toISOString());
  const itemId = await postCard(host, ctx, canvasId, lane, report.lane, channel, preparedMarkdown(record, report.lane.app.name), `prepared-${channel}-${record.release}.md`, `Prepared → ${channel}: ${classificationLine(record.classification)}`, { [P().classification]: JSON.stringify(record) });
  return { report, record, itemId };
}

/** What a ship is about to do, from the cards on the canvas: the prepared card it is pinned to, and the release it promotes or rolls back. */
export function shipPlan(snapshot: CanvasSnapshotResponse, appId: string, kind: ShipKind, channel: string, from: string | null): { prepared: { item: Item; record: PreparedRecord } | null; of: { item: Item; record: ReleaseRecord } | null; error: string | null } {
  const { prepared, releases } = cardsOf(snapshot, appId);
  const onChannel = releases.filter((r) => r.record.channel === channel && r.record.heads.length);
  const latestPrepared = prepared.filter((p) => p.record.channel === channel).at(-1) ?? null;
  if (kind === "rollback") {
    if (onChannel.length < 2) return { prepared: null, of: null, error: `${channel} has ${onChannel.length ? "one release" : "no release"} on this canvas; a roll back re-publishes the one before the latest` };
    return { prepared: null, of: onChannel.at(-2)!, error: null };
  }
  if (!latestPrepared) return { prepared: null, of: null, error: `nothing is prepared for ${channel}: prepare first, and confirm what it shows` };
  if (kind === "promote") {
    const source = releases.filter((r) => r.record.channel === from && r.record.heads.length).at(-1) ?? null;
    if (!source) return { prepared: latestPrepared, of: null, error: `${from} has no release on this canvas to promote` };
    if (source.record.commit !== latestPrepared.record.commit) return { prepared: latestPrepared, of: source, error: `the ${channel} prepare is of ${latestPrepared.record.commit.slice(0, 12)}, but ${source.record.release} on ${from} is ${source.record.commit.slice(0, 12)}: promote ships what ${from} has — check that commit out and prepare ${channel} again` };
    return { prepared: latestPrepared, of: source, error: null };
  }
  return { prepared: latestPrepared, of: null, error: null };
}

const releaseId = (kind: ShipKind, of: string | null) => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return kind === "ship" ? `r-${stamp}` : `${kind}-${stamp}${of ? `-of-${of}`.slice(0, 80) : ""}`;
};

/**
 * **A ship, done**: Exact's `--yes` through the bridge — pinned to the
 * prepared commit, or (a roll back) the earlier release's commit in a
 * worktree — and the release card in the channel's row. The caller has
 * already refused agents.
 */
export async function shipOn(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, ask: { kind: ShipKind; channel: string; by: string; from: string | null }): Promise<{ ok: boolean; itemId: string | null; record: ReleaseRecord | null; error: string | null; report: ShipReport | null }> {
  const started = Date.now();
  let snapshot = await ctx.client.snapshot(canvasId);
  const lane0 = await kit.bridge<LaneFacts>(host, "lane", ["--app", app], "the release lane", true);
  const plan = shipPlan(snapshot, lane0.app.id, ask.kind, ask.channel, ask.from);
  if (plan.error) return { ok: false, itemId: null, record: null, error: plan.error, report: null };
  const of = plan.of?.record.release ?? null;
  const release = releaseId(ask.kind, of);
  const args = ["--app", app, "--channel", ask.channel, "--release", release,
    ...(ask.kind === "rollback" ? ["--commit", plan.of!.record.commit] : ["--expect", plan.prepared!.record.commit])];
  let report: ShipReport;
  try {
    report = await kit.bridge<ShipReport>(host, "ship", args, "Exact's publisher", true);
  } catch (err) {
    return { ok: false, itemId: null, record: null, error: (err as Error).message, report: null };
  }
  const t = report.table;
  if (!t || !t.published) return { ok: false, itemId: null, record: null, error: report.error ?? "Exact published nothing and said why on stderr", report };
  const want = ask.kind === "rollback" ? plan.of!.record.commit : plan.prepared!.record.commit;
  const heads = t.published.filter((p) => p.kind === "stream" && p.action === "published" && p.head).map((p) => ({ platform: p.platform ?? "?", stream: (p.compatibilityId ?? "").slice(0, 8), seq: p.head!.seq, sha256: p.head!.sha256, previous: p.previous ?? null }));
  snapshot = await ctx.client.snapshot(canvasId);
  const lane = laneItemOf(snapshot, lane0.app.id) ?? await upsertLane(kit, host, ctx, canvasId, report.lane);
  const now = screensNow(snapshot, lane0.app.id);
  const previous = cardsOf(snapshot, lane0.app.id).releases.filter((r) => r.record.channel === ask.channel).at(-1)?.record.screens ?? null;
  const phasedAsked = report.lane.channels.find((c) => c.name === ask.channel)?.phased ?? false;
  const record: ReleaseRecord = {
    kind: ask.kind, channel: ask.channel, release: t.release, snapshot: t.snapshot.id, commit: t.snapshot.commit, origin: t.origin.location,
    by: ask.by, at: new Date().toISOString(), heads,
    refused: (t.refused ?? []).map((r) => ({ platform: r.platform ?? "?", reason: r.reason })),
    failed: (t.failed ?? []).map((f) => `${f.platform ?? f.kind ?? "?"}: ${f.error}`),
    classification: classify(t), of,
    phased: { asked: phasedAsked, note: phasedAsked ? PHASED_NOTE : null },
    screens: Object.fromEntries(Object.entries(now).map(([k, v]) => [k, v.version])),
    changed: changedScreens(now, previous), ms: Date.now() - started,
  };
  const commitOk = t.snapshot.commit === want;
  if (!commitOk) record.failed.push(`Exact snapshotted ${t.snapshot.commit.slice(0, 12)}, not the confirmed ${want.slice(0, 12)}`);
  const word = ask.kind === "ship" ? "Shipped" : ask.kind === "promote" ? "Promoted" : "Rolled back";
  const itemId = await postCard(host, ctx, canvasId, lane, report.lane, ask.channel, releaseMarkdown(record, report.lane.app.name), `release-${ask.channel}-${t.release}.md`,
    `${word} → ${ask.channel}: ${heads.map((h) => `seq ${h.seq}`).join(", ") || "nothing written"}${ask.kind === "rollback" ? ` (content of ${of})` : ""}`, { [P().release]: JSON.stringify(record) });
  const ok = report.ok && commitOk && !record.failed.length;
  return { ok, itemId, record, error: ok ? null : record.failed.join("; ") || report.error || null, report };
}

// ---------------------------------------------------------------- the CLI's verbs

export interface PrepareOptions { canvas?: string; channel?: string; platform?: string }
export interface ShipOptions { canvas?: string; channel?: string; yes?: boolean; from?: string; to?: string }

function printClassification(r: PreparedRecord): void {
  const c = r.classification;
  console.log(`channel ${r.channel} · release ${r.release} · snapshot ${r.snapshot.slice(0, 12)} (commit ${r.commit.slice(0, 12)})${r.dirty ? " · DIRTY (ignored files only)" : ""} · origin ${r.origin}`);
  console.log(`  ${classificationLine(c)}`);
  for (const o of c.ota) console.log(`  over the air  ${o.platform}${o.stream ? ` ${o.stream}` : ""}${o.seq != null ? ` → seq ${o.seq}` : ""}: ${o.changes.join(", ")}`);
  for (const b of c.binary) console.log(`  needs a binary  ${b.platform}${b.stream ? ` ${b.stream}` : ""}: ${b.reason}`);
  for (const x of c.current) console.log(`  current  ${x.platform} ${x.stream}${x.seq != null ? ` at seq ${x.seq}` : ""}`);
  for (const u of c.unavailable) console.log(`  unavailable  ${u.platform}: ${u.reason}`);
  console.log(`  ${originLine(r)}`);
}

/** `isocan exact prepare <app>`: Exact's dry run as a card. Anybody may — an agent too. */
export async function prepareVerb(kit: Kit, host: CliHost, given: string, opts: PrepareOptions, cmd: Command, app: string): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const channel = opts.channel ?? (await kit.bridge<LaneFacts>(host, "lane", ["--app", app], "the release lane", true)).baked;
  if (!channel) throw new Error(`which channel? --channel <name> (app.json's deploy.channels)`);
  if (!ctx.json) console.error(`preparing ${given} for ${channel}: Exact's dry run snapshots, bakes and classifies — nothing is uploaded (a minute or more)…`);
  const { report, record, itemId } = await prepareOn(kit, host, ctx, canvas.id, app, channel, ctx.actor.name, opts.platform);
  if (ctx.json) return host.printJson({ ok: report.ok, itemId, record, error: report.error ?? null });
  if (!record) throw new Error(`not prepared: ${report.error}`);
  printClassification(record);
  console.log(`${itemId}  the card, in ${channel}'s row of the lane`);
}

/** The agent refusal, before anything runs: the CLI's own actor, by isocan's roles. */
async function refuseAgents(ctx: Ctx, canvasId: string): Promise<void> {
  const snapshot = await ctx.client.snapshot(canvasId);
  if (isAgent(snapshot, ctx.actor.id)) throw new Error(agentRefusal(ctx.actor.name));
}

/**
 * `isocan exact ship|promote|rollback <app>`: a person's, confirmed. Without
 * `--yes` it prepares (ship, promote) or names the release it would
 * re-publish (roll back) and stops; with `--yes` it prints what it is
 * confirming, then Exact signs and publishes.
 */
export async function shipVerb(kit: Kit, host: CliHost, kind: ShipKind, given: string, opts: ShipOptions, cmd: Command, app: string): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  await refuseAgents(ctx, canvas.id);
  const from = kind === "promote" ? (opts.from ?? "internal") : null;
  const channel = kind === "promote" ? (opts.to ?? "production") : opts.channel;
  if (!channel) throw new Error(`which channel? --channel <name> (app.json's deploy.channels)`);
  const appId = (await kit.appOf(app)).id;
  const verbWord = kind === "ship" ? `ship ${given} --channel ${channel}` : kind === "promote" ? `promote ${given} --from ${from} --to ${channel}` : `rollback ${given} --channel ${channel}`;
  if (!opts.yes) {
    if (kind === "rollback") {
      const plan = shipPlan(await ctx.client.snapshot(canvas.id), appId, kind, channel, null);
      if (plan.error) throw new Error(plan.error);
      const r = plan.of!.record;
      console.log(`roll back ${channel}: re-publish the content of ${r.release} (commit ${r.commit.slice(0, 12)}, ${r.at.slice(0, 16)}) at a new sequence number — Exact has no publisher rollback, so this is a new release, labelled so`);
      console.log(`isocan exact ${verbWord} --yes   does it, with the keys on this machine`);
      return;
    }
    if (!ctx.json) console.error(`preparing ${given} for ${channel} first, so you can see what you would ship…`);
    const { report, record, itemId } = await prepareOn(kit, host, ctx, canvas.id, app, channel, ctx.actor.name);
    if (!record) throw new Error(`not prepared: ${report.error}`);
    printClassification(record);
    console.log(`${itemId}  the card`);
    if (kind === "promote") {
      const plan = shipPlan(await ctx.client.snapshot(canvas.id), appId, kind, channel, from);
      if (plan.error) throw new Error(plan.error);
      console.log(`promotes ${plan.of!.record.release} (${from}) to ${channel}${record.classification.binary.length ? "; the rows that need a binary are refused by Exact and named on the card" : ""}`);
    }
    if (!record.classification.ota.length) { console.log("nothing goes over the air: nothing to ship"); return; }
    console.log(`isocan exact ${verbWord} --yes   ships these ${record.classification.changes} change${record.classification.changes === 1 ? "" : "s"} to ${channel}, signed with the keys on this machine`);
    return;
  }
  const plan = shipPlan(await ctx.client.snapshot(canvas.id), appId, kind, channel, from);
  if (plan.error) throw new Error(plan.error);
  if (plan.prepared && !ctx.json) {
    console.log(`confirmed by ${ctx.actor.name}:`);
    printClassification(plan.prepared.record);
  }
  if (plan.of && !ctx.json) console.log(`${kind === "rollback" ? "re-publishing the content of" : "promoting"} ${plan.of.record.release} (commit ${plan.of.record.commit.slice(0, 12)})`);
  if (!ctx.json) console.error(`${kind === "rollback" ? "rolling back" : kind === "promote" ? "promoting" : "shipping"} to ${channel}: Exact snapshots, bakes, signs and publishes…`);
  const done = await shipOn(kit, host, ctx, canvas.id, app, { kind, channel, by: ctx.actor.name, from });
  if (ctx.json) return host.printJson({ ok: done.ok, itemId: done.itemId, record: done.record, error: done.error });
  if (!done.record) throw new Error(`not shipped: ${done.error}`);
  for (const h of done.record.heads) console.log(`  ${h.platform} stream ${h.stream}: head seq ${h.seq} (${h.sha256.slice(0, 12)}), previous ${h.previous?.slice(0, 12) ?? "none"}`);
  for (const r of done.record.refused) console.log(`  ${r.platform}: refused, needs a binary — ${r.reason}`);
  if (done.record.phased.asked) console.log(`  phased: ${done.record.phased.note}`);
  console.log(`${done.itemId}  ${done.record.release} on ${channel}${done.record.changed.length ? `, ${done.record.changed.length} screens changed` : ""}`);
  if (!done.ok) throw new Error(done.error ?? "not every row published");
}

// ---------------------------------------------------------------- the lane's asks (`isocan exact live`)

/**
 * The properties an op wrote on one item: an `item.update`'s patch, or — on a canvas with groups, where the CLI's
 * `isocan set` sends one — a `group.change` content write. An agent's ask arrives the second way, and must be read
 * (and refused) like any other.
 */
function propertiesWritten(op: unknown, itemId: string): Record<string, unknown> | null {
  const o = op as { type: string; itemId?: string; patch?: { properties?: Record<string, unknown> }; action?: { change?: { writes?: Array<{ itemId?: string; content?: { properties?: Record<string, unknown> } }> } } };
  if (o.type === "item.update") return o.itemId === itemId ? o.patch?.properties ?? null : null;
  if (o.type !== "group.change") return null;
  const writes = (o.action?.change?.writes ?? []).filter((w) => w.itemId === itemId && w.content?.properties);
  return writes.length ? Object.assign({}, ...writes.map((w) => w.content!.properties)) : null;
}

/** Prepare and ship asks on an app's lane, with the op that wrote each and its actor. */
export function pendingLaneAsks(entries: readonly LogEntry[], snapshot: CanvasSnapshotResponse, appId: string): { prepares: Array<{ item: Item; seq: number }>; ships: Array<{ item: Item; seq: number; actor: { id: string; name: string } }> } {
  const lane = laneItemOf(snapshot, appId);
  const prepares: Array<{ item: Item; seq: number }> = [];
  const ships: Array<{ item: Item; seq: number; actor: { id: string; name: string } }> = [];
  if (!lane) return { prepares, ships };
  for (const e of entries) {
    const touched = propertiesWritten(e.envelope.op, lane.id);
    if (!touched) continue;
    if (P().prepare in touched) {
      const ask = parsePrepareAsk(lane.properties?.[P().prepare]);
      const answered = parsePrepareAnswer(lane.properties?.[P().prepared]);
      if (ask && (!answered || answered.seq < ask.seq) && !prepares.length) prepares.push({ item: lane, seq: e.seq });
    }
    if (P().ship in touched) {
      const ask = parseShipAsk(lane.properties?.[P().ship]);
      const answered = parseShipAnswer(lane.properties?.[P().shipped]);
      // The actor of the op that wrote the ask now standing — an agent's write is refused whatever it says.
      if (ask && (!answered || answered.seq < ask.seq)) { ships.length = 0; ships.push({ item: lane, seq: e.seq, actor: e.envelope.actor }); }
    }
  }
  return { prepares, ships };
}

export async function answerPrepare(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, lane: Item, say: (line: string) => void): Promise<PrepareAnswer | null> {
  const ask = parsePrepareAsk(lane.properties?.[P().prepare]);
  if (!ask) return null;
  say(`prepare ${ask.channel}${ask.by ? `, for ${ask.by}` : ""}`);
  try {
    const { report, record, itemId } = await prepareOn(kit, host, ctx, canvasId, app, ask.channel, ask.by || ctx.actor.name);
    say(`prepare ${ask.channel}: ${record ? classificationLine(record.classification) : report.error}`);
    return { seq: ask.seq, ok: !!record, itemId, ...(record ? {} : { error: report.error ?? "not prepared" }) };
  } catch (err) {
    return { seq: ask.seq, ok: false, itemId: null, error: (err as Error).message };
  }
}

/**
 * A ship asked for on the lane. The ask's writer is read off the op log:
 * an enrolled agent's is refused with the sentence, and nothing runs. A
 * person's must match what is prepared — the change count they confirmed and
 * the prepared card — or it is refused, and they confirm again.
 */
export async function answerShip(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, lane: Item, actor: { id: string; name: string }, say: (line: string) => void): Promise<ShipAnswer | null> {
  const ask = parseShipAsk(lane.properties?.[P().ship]) as ShipAsk | null;
  if (!ask) return null;
  const snapshot = await ctx.client.snapshot(canvasId);
  if (isAgent(snapshot, actor.id)) {
    const sentence = agentRefusal(actor.name);
    say(`refused a ${ask.kind} to ${ask.channel} written by ${actor.name}: ${sentence}`);
    return { seq: ask.seq, ok: false, itemId: null, error: sentence, refused: true };
  }
  const appId = core.appIdOf(lane)!;
  const plan = shipPlan(snapshot, appId, ask.kind, ask.channel, ask.kind === "promote" ? ask.from : null);
  if (plan.error) return { seq: ask.seq, ok: false, itemId: null, error: plan.error };
  if (ask.kind !== "rollback" && (plan.prepared!.item.id !== ask.prepared || plan.prepared!.record.classification.changes !== ask.changes)) {
    return { seq: ask.seq, ok: false, itemId: null, error: "what is prepared is not what was confirmed (a newer prepare, or another change count): confirm again" };
  }
  say(`${ask.kind} to ${ask.channel}, confirmed by ${actor.name}`);
  const done = await shipOn(kit, host, ctx, canvasId, app, { kind: ask.kind, channel: ask.channel, by: actor.name, from: ask.kind === "promote" ? ask.from : null });
  say(`${ask.kind} to ${ask.channel}: ${done.record ? `${done.record.release}, ${done.record.heads.map((h) => `seq ${h.seq}`).join(", ") || "nothing written"}` : done.error}`);
  return { seq: ask.seq, ok: done.ok, itemId: done.itemId, ...(done.error ? { error: done.error } : {}) };
}

export { parseLane };
