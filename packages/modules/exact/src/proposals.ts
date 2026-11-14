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

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { Actor, CanvasSnapshotResponse, Item, LogEntry, NewVersion, Operation, Placement } from "@isocan/core";
import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import { core } from "./core-ref.ts";
import { DEVICES, type Device } from "./map.ts";
import type { Kit } from "./stories.ts";
import {
  opsFromFlags, parseAcceptAnswer, parseProposalRecord, parseProposeAnswer, parseProposeAsk, proposalTitle, scopeFor,
  type AcceptAnswer, type PreviewCell, type ProposalRecord, type ProposeAnswer, type ProposeAsk, type TamberOp,
} from "./proposal.ts";

/**
 * **Agents propose, the acting half** (exact phase 6; design §10), loaded
 * with the verbs — never on `isocan --version`'s path.
 *
 * - `isocan exact propose <screen>` — anybody's ask, written on the screen
 *   (`exact.propose`); an agent's terminal never reaches the app or its wire.
 * - `isocan exact live` answers it: the asker's scope from isocan's roles (an
 *   enrolled agent `propose`, anybody else who may write the canvas `write`),
 *   the proposal held on the dev loop's Tamber wire by a client of that scope,
 *   pictured before and after on every device, scheme and host this session
 *   captures — a scrub for a live-class edit, staged copies for a rebuild-class
 *   one — and posted as a core proposal item under the screen.
 * - A **Keep** (core's choose, a person's) folds the proposal's picture into
 *   the screen and takes the proposal away; `settleKept` reads that off the op
 *   log and only then sends Tamber's `accept`. A proposal taken away without a
 *   Keep is dropped on the wire.
 *
 * Nothing here spawns: the wire and Exact are reached in `scripts/exact-bridge.mjs`.
 */

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const P = () => core.EXACT_PROPS;
const currentVersion = (item: Item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
const LOOP = /^http:\/\/127\.0\.0\.1:\d+$/;

interface ProposeReport {
  ok: boolean;
  proposal?: string; client?: string; scope?: "propose" | "write"; class?: "live" | "rebuild";
  changed?: Array<{ file: string; token: string }>; files?: Record<string, string>;
  scopeCheck?: { status: number; scope: string | null; needs: string | null } | null;
  how?: "scrub" | "staged";
  previews?: Array<{ host: string; device: string; scheme: "light" | "dark"; before: string; after: string; beforeSha256: string; afterSha256: string; restored: boolean | null }>;
  ms?: number; error?: string;
}

interface AcceptReport { ok: boolean; heldAgain?: string | null; written?: string[]; error?: string }

// ---------------------------------------------------------------- the ask (anybody's terminal)

export interface ProposeOptions { token?: string[]; row?: string[]; op?: string[]; why?: string; cites?: string[]; in?: string; wait?: string; canvas?: string }

/**
 * **`isocan exact propose <screen>`** — an ask, written on the screen. The
 * terminal that runs it never touches the app: `isocan exact live`, the
 * person's own bridge, holds the proposal on the wire at the asker's scope and
 * pictures it. Waits for the answer (`--wait`, seconds; 0 returns at once).
 */
export async function proposeVerb(host: CliHost, ref: string, opts: ProposeOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const screen = host.resolveItem(snapshot, ref);
  if (!screen.properties?.[P().route] || !core.appIdOf(screen)) throw new Error(`${screen.title} is not an Exact screen — propose on a screen \`isocan exact open\` posted (it carries exact.route)`);
  const ops: TamberOp[] = opsFromFlags(opts.token ?? [], opts.row ?? [], opts.op ?? []);
  const why = (opts.why ?? "").trim();
  if (!why) throw new Error("a proposal says why, in design words: --why \"…\" (two sentences at most)");
  if ((why.match(/[.!?](\s|$)/g) ?? []).length > 2) throw new Error("the why is two sentences at most; say the rest in a comment");
  const cites = (opts.cites ?? []).map((c) => {
    const at = c.indexOf(":");
    if (at <= 0) throw new Error(`--cites takes kind:ref (comment:<id>, op:<seq>, …), not ${JSON.stringify(c)}`);
    return { kind: c.slice(0, at), ref: c.slice(at + 1) };
  });
  const area = opts.in ? host.resolveItem(snapshot, opts.in).id : null;
  const seq = Date.now();
  const ask: ProposeAsk = { seq, by: ctx.actor.name, ops, why, cites, in: area };
  await host.sendOp(ctx, canvas.id, { type: "item.update", itemId: screen.id, patch: { properties: { [P().propose]: JSON.stringify(ask) } } }, id("exact-propose"));
  const wait = opts.wait === undefined ? 540 : Number(opts.wait);
  if (!(wait >= 0)) throw new Error(`--wait takes seconds, not ${opts.wait}`);
  if (wait === 0) {
    if (ctx.json) return host.printJson({ asked: { screen: screen.id, seq } });
    console.log(`asked on ${screen.title} — \`isocan exact live\` holds it and posts the proposal under the screen; read exact.proposed there`);
    return;
  }
  if (!ctx.json) console.error(`asked on ${screen.title}; waiting for \`isocan exact live\` to hold it and picture it on every device (a minute or two)…`);
  const deadline = Date.now() + wait * 1000;
  for (;;) {
    const now = await ctx.client.snapshot(canvas.id);
    const answer = parseProposeAnswer(now.canvas.items[screen.id]?.properties?.[P().proposed]);
    if (answer && answer.seq === seq) {
      if (ctx.json) return host.printJson(answer);
      if (!answer.ok) throw new Error(`not proposed: ${answer.error}`);
      console.log(`${answer.itemId}  proposed (${answer.class}, ${answer.previews} pictures, held as ${answer.proposal} by ${answer.client} at ${answer.scope} scope) — a person's Keep writes it; nothing is written until then`);
      return;
    }
    if (Date.now() > deadline) throw new Error(`no answer in ${wait} s — is \`isocan exact live <app>\` running for this canvas, without --no-frames? The ask stays on the screen; it answers when it starts`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ---------------------------------------------------------------- the answer (`isocan exact live`)

/** The proposal asks waiting on this app's screens, with the op that asked and who sent it. */
export function pendingProposes(entries: readonly LogEntry[], snapshot: CanvasSnapshotResponse, appId: string): Array<{ item: Item; ask: ProposeAsk; seq: number; actor: Actor }> {
  const out = new Map<string, { item: Item; ask: ProposeAsk; seq: number; actor: Actor }>();
  for (const e of entries) {
    const op = e.envelope.op as { type: string; itemId?: string; patch?: { properties?: Record<string, unknown> } };
    if (op.type !== "item.update" || !op.itemId || !op.patch?.properties || !(P().propose in op.patch.properties)) continue;
    const item = snapshot.canvas.items[op.itemId];
    if (!item || core.appIdOf(item) !== appId || !item.properties?.[P().route]) continue;
    const ask = parseProposeAsk(item.properties?.[P().propose]);
    const answered = parseProposeAnswer(item.properties?.[P().proposed]);
    if (ask && (!answered || answered.seq < ask.seq)) out.set(item.id, { item, ask, seq: e.seq, actor: e.envelope.actor });
  }
  return [...out.values()];
}

/**
 * **A proposal, held and pictured, as a core proposal item.** The bridge
 * holds it on the wire at the asker's scope and pictures it; each picture is
 * a version of the proposal item (so garbage collection keeps every one while
 * the proposal stands), and its current version — last — is the screen it
 * hangs under, as the proposal would draw it: what a Keep folds in.
 */
export async function answerPropose(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, opts: { hosts: readonly string[]; sim: string | null }, pending: { item: Item; ask: ProposeAsk; seq: number; actor: Actor }): Promise<ProposeAnswer> {
  const { item: screen, ask, seq: askSeq, actor } = pending;
  const started = Date.now();
  let snapshot = await ctx.client.snapshot(canvasId);
  const isAgent = !!snapshot.canvas.agents?.[actor.id];
  const scope = scopeFor(isAgent);
  const refused = (error: string, extra: Partial<ProposeAnswer> = {}): ProposeAnswer => ({ seq: ask.seq, ok: false, itemId: null, proposal: null, class: null, scope, client: null, how: null, previews: 0, scopeCheck: null, ms: Date.now() - started, error, ...extra });
  const loop = process.env.ISOCAN_EXACT_LOOP;
  if (!loop || !LOOP.test(loop)) return refused("a proposal is held by the dev loop's Tamber wire, and this `isocan exact live` runs none (--no-frames): start it without --no-frames");
  const route = screen.properties[P().route]!;
  const shots = screen.properties[P().reached] ?? screen.properties[P().shots] ?? `at "${screen.properties[P().url] ?? "/"}"`;
  const ios = opts.hosts.includes("ios") && !!opts.sim;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-propose-"));
  let r: ProposeReport;
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({
      ops: ask.ops, scope, name: actor.name, shots,
      devices: (Object.keys(DEVICES) as Device[]).map((d) => ({ device: d, size: `${DEVICES[d].width}x${DEVICES[d].height}` })),
      schemes: ["light", "dark"], ios,
    }));
    try {
      r = await kit.bridge<ProposeReport>(host, "propose", ["--app", app, "--dir", path.join(dir, "out"), "--job", job, "--dev-url", loop, ...(ios ? ["--sim", opts.sim!] : [])], "the proposal's preview", true);
    } catch (err) {
      return refused((err as Error).message);
    }
    const base = { proposal: r.proposal ?? null, class: r.class ?? null, client: r.client ?? null, how: r.how ?? null, scopeCheck: r.scopeCheck ?? null };
    if (!r.ok || !r.proposal || !r.previews?.length) {
      if (r.proposal) await dropOnWire(kit, host, app, loop, r.proposal);
      return refused(r.error ?? "the proposal was not pictured", base);
    }
    // Every picture, put once; each a version of the proposal item.
    const blobs = new Map<string, { blobHash: string; size: number }>();
    const put = async (file: string, sha: string) => {
      const known = blobs.get(sha);
      if (known) return known;
      const b = await ctx.client.uploadBlob(canvasId, await fs.readFile(file), "image/png", path.basename(file));
      const v = { blobHash: b.blobHash, size: b.size };
      blobs.set(sha, v);
      return v;
    };
    const versions: NewVersion[] = [];
    const cells: PreviewCell[] = [];
    const version = async (file: string, sha: string, name: string) => {
      const b = await put(file, sha);
      const v: NewVersion = { id: id("ver"), blobHash: b.blobHash, mimeType: "image/png", filename: name, size: b.size };
      versions.push(v);
      return v.id;
    };
    for (const p of r.previews) {
      const stem = `${route}-${p.host}-${p.device}-${p.scheme}`;
      const before = await version(p.before, p.beforeSha256, `${stem}-before.png`);
      const after = await version(p.after, p.afterSha256, `${stem}-proposed.png`);
      cells.push({ host: p.host, device: p.device, scheme: p.scheme, before, after, restored: p.restored });
    }
    const host_ = screen.properties[P().host] ?? "web", device = screen.properties[P().device] ?? "phone", scheme = screen.properties[P().scheme] ?? "light";
    const own = r.previews.find((p) => p.host === host_ && p.device === device && p.scheme === scheme);
    if (!own) {
      await dropOnWire(kit, host, app, loop, r.proposal);
      return refused(`this session pictures ${[...new Set(r.previews.map((p) => p.host))].join(", ")}; ${screen.title} is a ${host_} screen — propose on a screen this \`isocan exact live\` captures`, base);
    }
    // Last, so it is current: the screen as the proposal draws it — what a Keep folds into the screen.
    await version(own.after, own.afterSha256, `${route}-${host_}-${device}-${scheme}.png`);
    const record: ProposalRecord = {
      seq: ask.seq, route, asker: { id: actor.id, name: actor.name, kind: isAgent ? "agent" : "person" }, scope, client: r.client!, proposal: r.proposal,
      class: r.class!, how: r.how!, ops: ask.ops, files: r.files ?? {}, changed: r.changed ?? [], previews: cells, at: new Date().toISOString(),
    };
    snapshot = await ctx.client.snapshot(canvasId);
    const size = { width: 1080, height: 300 + 280 * new Set(cells.map((c) => `${c.host}/${c.device}`)).size };
    const area = ask.in ? snapshot.canvas.items[ask.in] : null;
    // Under the screen it changes; in a design-competition lane when the ask names one (the lane's fighter hands it in).
    const placement: Placement = area
      ? (host.placementFor(snapshot, { in: area.id }, size) as Placement)
      : { x: Math.round(screen.x), y: Math.round(screen.y + screen.height + 80) };
    const itemId = id("itm");
    const [first, ...rest] = versions;
    const group = id("exact-proposal");
    const add: Operation = {
      type: "item.add",
      itemId,
      version: first!,
      width: size.width,
      height: size.height,
      placement,
      title: proposalTitle(actor.name, ask.ops),
      // Core's proposal, by its own keys (`packages/core/src/proposal.ts`): hung beneath the screen it changes, citing the ask.
      properties: {
        proposal: "sure",
        parent: screen.id,
        proposalCites: JSON.stringify([{ kind: "op", ref: String(askSeq) }, ...ask.cites]),
        proposalWhy: ask.why,
        [P().app]: JSON.stringify({ id: core.appIdOf(screen) }),
        [P().proposal]: JSON.stringify(record),
      },
      ...(snapshot.project.groupMode === "groups" && !area ? { containerId: null, groupPlacement: "exact" as const } : {}),
    } as Operation;
    try {
      await host.sendOp(ctx, canvasId, add, group);
      for (const v of rest) await host.sendOp(ctx, canvasId, { type: "item.addVersion", itemId, version: v }, group);
    } catch (err) {
      await dropOnWire(kit, host, app, loop, r.proposal);
      return refused((err as Error).message, base);
    }
    return { seq: ask.seq, ok: true, itemId, ...base, scope, previews: cells.length, ms: Date.now() - started };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function dropOnWire(kit: Kit, host: CliHost, app: string, loop: string, proposal: string): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-drop-"));
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({ proposal }));
    await kit.bridge(host, "drop", ["--app", app, "--job", job, "--dev-url", loop], "the drop", true);
  } catch { /* gone already is the same answer */ } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * **A Keep, sent to the wire** — the only way a proposal reaches the app's
 * files. Read off the log: a proposal item taken away whose current version
 * is now a version of the screen it hung under (core's choose folds it in and
 * trashes it, in one group). The Keep must be a person's: an agent's choose
 * is refused and the screen's picture put back. A proposal taken away without
 * a Keep is dropped on the wire.
 */
export async function settleKept(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, appId: string, entries: readonly LogEntry[], snapshot: CanvasSnapshotResponse, say: (line: string) => void): Promise<void> {
  const loop = process.env.ISOCAN_EXACT_LOOP;
  const trashed = new Map(snapshot.canvas.trash.map((t) => [t.item.id, t.item]));
  for (const e of entries) {
    const op = e.envelope.op as Operation;
    // A delete is `item.delete`, or — on a canvas with groups, where the proposal may sit in a lane — a `group.change`
    // whose intent is delete and which names the items it takes away.
    const ids = op.type === "item.delete" ? [op.itemId] : op.type === "group.change" ? [...new Set(JSON.stringify(op).match(/itm_[A-Za-z0-9_-]+/g) ?? [])] : [];
    for (const goneId of ids) await settleOne(goneId, e);
  }
  async function settleOne(goneId: string, e: LogEntry): Promise<void> {
    const gone = trashed.get(goneId);
    const record = gone ? parseProposalRecord(gone.properties?.[P().proposal]) : null;
    if (!gone || !record || core.appIdOf(gone) !== appId) return;
    const screen = snapshot.canvas.items[gone.properties?.parent ?? ""];
    const picture = currentVersion(gone);
    const kept = !!screen && !!picture && screen.versions.some((v) => v.id === picture.id);
    if (!loop || !LOOP.test(loop)) { say(`${kept ? "kept" : "dropped"} ${gone.title}, but this \`isocan exact live\` runs no dev loop (--no-frames): nothing reached the wire`); return; }
    if (!kept) {
      await dropOnWire(kit, host, app, loop, record.proposal);
      say(`dropped: ${gone.title} (${record.proposal})`);
      return;
    }
    if (parseAcceptAnswer(screen.properties?.[P().accepted])?.item === gone.id) return;
    const by = e.envelope.actor;
    const answer = async (a: Omit<AcceptAnswer, "item" | "version" | "at" | "by">) => {
      const full: AcceptAnswer = { item: gone.id, version: picture!.id, by: by.name, at: new Date().toISOString(), ...a };
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: screen.id, patch: { properties: { [P().accepted]: JSON.stringify(full) } } }, id("exact-accept"));
    };
    // The picture folded in shows what is not on disk: a Keep that did not reach the files puts the screen back.
    const putBack = async () => {
      const before = screen.versions.filter((v) => v.id !== picture!.id).at(-1);
      if (before && screen.currentVersionId === picture!.id) await host.sendOp(ctx, canvasId, { type: "item.setCurrentVersion", itemId: screen.id, versionId: before.id } as Operation, id("exact-accept"));
    };
    if (snapshot.canvas.agents?.[by.id]) {
      await putBack();
      await answer({ ok: false, proposal: record.proposal, heldAgain: null, written: [], error: `${by.name} is an agent: a proposal reaches the files only by a person's Keep` });
      say(`refused: ${by.name}, an agent, chose ${gone.title}`);
      return;
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-accept-"));
    let r: AcceptReport;
    try {
      const job = path.join(dir, "job.json");
      await fs.writeFile(job, JSON.stringify({ proposal: record.proposal, ops: record.ops, files: record.files, name: by.name }));
      r = await kit.bridge<AcceptReport>(host, "accept", ["--app", app, "--job", job, "--dev-url", loop], "the accept", true);
    } catch (err) {
      r = { ok: false, error: (err as Error).message };
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
    if (!r.ok) await putBack();
    await answer({ ok: r.ok, proposal: record.proposal, heldAgain: r.heldAgain ?? null, written: r.written ?? [], ...(r.error ? { error: r.error } : {}) });
    say(r.ok ? `kept by ${by.name}: ${gone.title} — accepted on the wire, wrote ${(r.written ?? []).join(", ") || "nothing"}` : `kept by ${by.name}, not written: ${r.error}`);
  }
}
