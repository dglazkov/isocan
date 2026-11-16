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
import { designSystemProperties, serializeDesign, type Actor, type CanvasSnapshotResponse, type DesignTokens, type Item, type LogEntry } from "@isocan/core";
import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import { core } from "./core-ref.ts";
import { DEVICES, type Device } from "./map.ts";
import { dropOnWire, postProposalItem, type ProposeReport } from "./proposals.ts";
import type { Kit } from "./stories.ts";
import {
  dtcgFor, leafCss, mapTokens, mappingMarkdown, parseApplyAnswer, parseApplyAsk, parseMaps, parseSystem, stylesNote, systemRows,
  type ApplyAnswer, type ApplyAsk, type Mapping, type SystemRecord,
} from "./system.ts";

/**
 * **Design systems that travel between apps, the acting half** (exact phase
 * 9; design §13), loaded with the verbs.
 *
 * - `isocan exact system extract <app>` — Exact's `forma ir`, `forma export
 *   dtcg` and named styles, read by the bridge, as a design-system item that
 *   belongs to no app.
 * - `isocan exact system apply <system> <app>` — anybody's ask, written on
 *   the system item (`exact.apply`), as the canvas's Apply button writes it.
 *   `isocan exact live <app>` answers it: the mapping card first, then the
 *   mapped tokens handed to the app's served design as Exact's held import,
 *   then the proposal pictured on every device and posted as phase 6's
 *   proposal item. Keep is phase 6's `settleKept`.
 *
 * Nothing here spawns: Exact and the wire are reached in `scripts/exact-bridge.mjs`.
 */

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const P = () => core.EXACT_PROPS;
const LOOP = /^http:\/\/127\.0\.0\.1:\d+$/;

/** The system item's DESIGN.md: isocan's own format, so `isocan style` and the DTCG export read it with nothing of ours. */
export function systemMarkdown(system: SystemRecord): string {
  const colors: Record<string, string> = {};
  const spacing: Record<string, string | number> = {};
  for (const t of system.tokens) {
    const hex = (t.light?.$value as { hex?: unknown } | undefined)?.hex;
    if (t.kind === "color" && typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex)) colors[t.name] = hex.toLowerCase();
    else if (t.kind === "length" && /^\d+(\.\d+)?px$/.test(leafCss(t.light))) spacing[t.name] = leafCss(t.light);
  }
  const tokens: DesignTokens = {
    name: `${system.from.name} design system`,
    description: `Extracted from the Exact app ${system.from.id} (${system.from.dir}) by \`forma ir\` and \`forma export dtcg\`, design digest ${system.digest}. It belongs to no app: Apply sends it to one as Exact's held import.`,
    ...(Object.keys(colors).length ? { colors } : {}),
    ...(Object.keys(spacing).length ? { spacing } : {}),
  };
  const styles = system.styles.map((s) => `- **${s.name}** (${s.file}:${s.line}): ${s.rows.map((r) => `${r.row}=${r.value}`).join(", ")}`);
  const note = stylesNote(system.styles);
  const body = [
    "## Overview",
    "",
    `The tokens of ${system.from.name}'s design, per scheme, and its named styles. Drag a chip to change a value here; Apply maps it onto another app's tokens and holds it there as a proposal.`,
    "",
    "## Colors",
    "",
    "| Token | Kind | Light | Dark | State |",
    "| --- | --- | --- | --- | --- |",
    ...systemRows(system),
    ...(styles.length ? ["", "## Styles", "", ...styles, ...(note ? ["", note] : [])] : []),
  ].join("\n");
  return serializeDesign(tokens, body);
}

/** The system items on a canvas, by the app they came from. */
export function systemItems(snapshot: CanvasSnapshotResponse): Item[] {
  return Object.values(snapshot.canvas.items).filter((i) => parseSystem(i.properties?.[P().system]) !== null);
}

// ---------------------------------------------------------------- extract

export async function extractVerb(kit: Kit, host: CliHost, app: string, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const read = await kit.bridge<Omit<SystemRecord, "at"> & { notes?: string[] }>(host, "system-extract", ["--app", app], "the design system's extract", ctx.json);
  const system: SystemRecord = { from: read.from, digest: read.digest, tokens: read.tokens, styles: read.styles, at: new Date().toISOString() };
  const snapshot = await ctx.client.snapshot(canvas.id);
  // One system item per source app: extracted again, it is the same item's next version (a person's edits start over).
  const existing = systemItems(snapshot).find((i) => parseSystem(i.properties?.[P().system])?.from.id === system.from.id) ?? null;
  const items = Object.values(snapshot.canvas.items);
  const at = existing ? { x: existing.x, y: existing.y } : items.length ? { x: Math.round(Math.max(...items.map((i) => i.x + i.width)) + 400), y: Math.round(Math.min(...items.map((i) => i.y))) } : { x: 0, y: 0 };
  const md = systemMarkdown(system);
  // No `exact.app`: the system belongs to no app (design §13).
  const properties = { ...designSystemProperties(), [P().system]: JSON.stringify(system) };
  const r = await kit.upsert(host, ctx, canvas.id, snapshot, existing, { bytes: Buffer.from(md), mime: "text/markdown", filename: `${system.from.dir}-system.md` },
    { title: `${system.from.name} — design system`, width: 560, height: 520, properties, at }, id("exact-system"));
  if (ctx.json) return host.printJson({ itemId: r.itemId, status: r.status, from: system.from, digest: system.digest, tokens: system.tokens.length, styles: system.styles.map((s) => s.name), notes: read.notes ?? [] });
  console.log(`${r.itemId}  design system from ${system.from.name} (${r.status}): ${system.tokens.length} tokens, digest ${system.digest}${system.styles.length ? `; styles ${system.styles.map((s) => s.name).join(", ")} (shown, not carried by Exact's held import)` : ""}`);
  for (const n of read.notes ?? []) console.log(`  note: ${n}`);
}

// ---------------------------------------------------------------- apply (anybody's terminal)

export interface ApplyOptions { map?: string[]; wait?: string; canvas?: string }

/** The target's tokens, from its index on the canvas (`isocan exact open` posted it). */
function targetOf(snapshot: CanvasSnapshotResponse, appId: string): { id: string; name: string; tokens: Array<{ name: string; kind: string }> } | null {
  const index = core.indexItemOf(snapshot.canvas, appId);
  const raw = index?.properties?.[P().summary];
  const design = index ? (() => { try { return JSON.parse(raw ?? "null") as { name?: string } | null; } catch { return null; } })() : null;
  const tokens = targetTokens(snapshot, appId);
  if (!index || !tokens) return null;
  return { id: appId, name: design?.name ?? index.title, tokens };
}

/** The target's tokens as its design-system item lists them (`build.ts`'s DESIGN.md table carries each name and kind). */
export function targetTokens(snapshot: CanvasSnapshotResponse, appId: string): Array<{ name: string; kind: string }> | null {
  const item = core.designItemOf(snapshot.canvas, appId);
  if (!item) return null;
  return designTokensCache.get(item.currentVersionId ?? "") ?? null;
}
const designTokensCache = new Map<string, Array<{ name: string; kind: string }>>();

/** Read a target's design-system item once per version (its table names every token and kind). */
export async function loadTargetTokens(ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, appId: string): Promise<void> {
  const item = core.designItemOf(snapshot.canvas, appId);
  const version = item?.versions.find((v) => v.id === item.currentVersionId) ?? item?.versions.at(-1);
  if (!item || !version || designTokensCache.has(item.currentVersionId ?? "")) return;
  const text = Buffer.from(await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8");
  const list: Array<{ name: string; kind: string }> = [];
  for (const line of text.split("\n")) {
    const m = /^\| `([^`]+)` \| ([a-z-]+) \|/.exec(line);
    if (m) list.push({ name: m[1]!, kind: m[2]! });
  }
  designTokensCache.set(item.currentVersionId ?? "", list);
}

/**
 * **`isocan exact system apply <system> <app>`** — an ask on the system
 * item. Prints the mapping it will be answered with, then waits for
 * `isocan exact live <app>` to post the card, hold the import and picture it.
 */
export async function applyVerb(kit: Kit, host: CliHost, ref: string, app: string, opts: ApplyOptions, cmd: Command): Promise<void> {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const snapshot = await ctx.client.snapshot(canvas.id);
  const item = host.resolveItem(snapshot, ref);
  const system = parseSystem(item.properties?.[P().system]);
  if (!system) throw new Error(`${item.title} is not a design system \`isocan exact system extract\` made (it carries exact.system)`);
  const info = await kit.appOf(app);
  if (info.id === system.from.id) throw new Error(`${item.title} came from ${info.name}: apply it to another app`);
  await loadTargetTokens(ctx, canvas.id, snapshot, info.id);
  const target = targetOf(snapshot, info.id);
  if (!target) throw new Error(`${info.name} is not on this canvas with its design — \`isocan exact open ${app}\` first`);
  const map = parseMaps(opts.map ?? []);
  const mapping = mapTokens(system.tokens, target.tokens, map);
  if (!ctx.json) {
    console.error(`${system.from.name} → ${info.name}:`);
    for (const r of mapping.rows) console.error(`  ${r.from.padEnd(18)} ${r.to ? `→ ${r.to} (${r.how})` : `no match: ${r.why}`}`);
    if (mapping.untouched.length) console.error(`  kept in ${info.name}: ${mapping.untouched.join(", ")}`);
    const note = stylesNote(system.styles);
    if (note) console.error(`  ${note}`);
  }
  if (!mapping.rows.some((r) => r.to)) throw new Error("no token of the system has a match in the app: name some with --map source=target");
  const seq = Date.now();
  const ask: ApplyAsk = { seq, by: ctx.actor.name, app: info.id, map };
  await host.sendOp(ctx, canvas.id, { type: "item.update", itemId: item.id, patch: { properties: { [P().apply]: JSON.stringify(ask) } } }, id("exact-apply"));
  const wait = opts.wait === undefined ? 600 : Number(opts.wait);
  if (!(wait >= 0)) throw new Error(`--wait takes seconds, not ${opts.wait}`);
  if (wait === 0) {
    if (ctx.json) return host.printJson({ asked: { system: item.id, app: info.id, seq }, mapping });
    console.log(`asked on ${item.title} — \`isocan exact live ${app}\` posts the mapping card, holds Exact's import and pictures it; read exact.applied there`);
    return;
  }
  if (!ctx.json) console.error(`waiting for \`isocan exact live\` on ${info.name} to hold the import and picture it on every device…`);
  const deadline = Date.now() + wait * 1000;
  for (;;) {
    const now = await ctx.client.snapshot(canvas.id);
    const answer = parseApplyAnswer(now.canvas.items[item.id]?.properties?.[P().applied]);
    if (answer && answer.seq === seq) {
      if (ctx.json) return host.printJson({ ...answer, mapping });
      if (!answer.ok) throw new Error(`not applied: ${answer.error}${answer.card ? ` (the mapping card is ${answer.card})` : ""}`);
      console.log(`${answer.card}  the mapping card: ${answer.mapped} tokens mapped, ${answer.unmatched.length} without a match`);
      console.log(`${answer.itemId}  proposed as Exact's held import ${answer.proposal} (${answer.class}, ${answer.previews} pictures) — a person's Keep writes it; nothing is written until then`);
      return;
    }
    if (Date.now() > deadline) throw new Error(`no answer in ${wait} s — is \`isocan exact live ${app}\` running for this canvas, without --no-frames? The ask stays on the system item`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ---------------------------------------------------------------- the answer (`isocan exact live`)

/** Apply asks for this app on any system item, with the op that asked and who sent it. */
export function pendingApplies(entries: readonly LogEntry[], snapshot: CanvasSnapshotResponse, appId: string): Array<{ item: Item; ask: ApplyAsk; seq: number; actor: Actor }> {
  const out = new Map<string, { item: Item; ask: ApplyAsk; seq: number; actor: Actor }>();
  for (const e of entries) {
    const op = e.envelope.op as { type: string; itemId?: string; patch?: { properties?: Record<string, unknown> } };
    if (op.type !== "item.update" || !op.itemId || !op.patch?.properties || !(P().apply in op.patch.properties)) continue;
    const item = snapshot.canvas.items[op.itemId];
    if (!item || !parseSystem(item.properties?.[P().system])) continue;
    const ask = parseApplyAsk(item.properties?.[P().apply]);
    const answered = parseApplyAnswer(item.properties?.[P().applied]);
    if (ask && ask.app === appId && (!answered || answered.seq < ask.seq)) out.set(item.id, { item, ask, seq: e.seq, actor: e.envelope.actor });
  }
  return [...out.values()];
}

/** The screen an applied system is pictured on: the web phone/light screen whose capture draws the most lines that read a mapped token. */
function screenFor(snapshot: CanvasSnapshotResponse, appId: string, uses: Array<{ file: string; line: number }>): Item | null {
  const screens = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId && i.properties?.[P().route] && !i.properties?.[P().branch]
    && (i.properties?.[P().host] ?? "web") === "web" && (i.properties?.[P().device] ?? "phone") === "phone" && (i.properties?.[P().scheme] ?? "light") === "light");
  const lines = new Set(uses.map((u) => `${u.file}:${u.line}`));
  const score = (i: Item) => (core.parsePoints(i.properties?.[P().points])?.nodes ?? []).filter((n) => lines.has(`${n.file}:${n.line}`) || n.chain.some((c) => lines.has(`${c.file}:${c.line}`))).length;
  return screens.sort((a, b) => score(b) - score(a) || a.y - b.y || a.x - b.x)[0] ?? null;
}

/**
 * **An Apply, answered**: the mapping card posted first — so the person sees
 * which token becomes which, and every unmatched one, before anything is
 * held — then the mapped tokens handed to the app's served design as Exact's
 * held import, pictured, and posted as a proposal item under the screen that
 * draws them most. The card stays whether or not the import holds.
 */
export async function answerApply(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, opts: { hosts: readonly string[]; sim: string | null }, pending: { item: Item; ask: ApplyAsk; seq: number; actor: Actor }): Promise<ApplyAnswer> {
  const { item, ask, seq: askSeq, actor } = pending;
  const started = Date.now();
  const system = parseSystem(item.properties?.[P().system])!;
  const answer = (a: Partial<ApplyAnswer>): ApplyAnswer => ({ seq: ask.seq, ok: false, app: ask.app, card: null, itemId: null, proposal: null, class: null, mapped: 0, unmatched: [], reported: [], styles: system.styles.map((s) => s.name), previews: 0, ms: Date.now() - started, ...a });
  let snapshot = await ctx.client.snapshot(canvasId);
  await loadTargetTokens(ctx, canvasId, snapshot, ask.app);
  const target = targetOf(snapshot, ask.app);
  if (!target) return answer({ error: "the app's design is not on this canvas: `isocan exact open` it first" });
  const mapping: Mapping = mapTokens(system.tokens, target.tokens, ask.map);
  const unmatched = mapping.rows.filter((r) => !r.to).map((r) => r.from);
  const mapped = mapping.rows.filter((r) => r.to).length;
  // The card first (design §13): a Markdown table, readable with the module taken away.
  const md = mappingMarkdown(system, target, mapping);
  const existingCard = Object.values(snapshot.canvas.items).find((i) => {
    try { const m = JSON.parse(i.properties?.[P().mapping] ?? "null") as { system?: string; app?: string } | null; return m?.system === item.id && m.app === ask.app; } catch { return false; }
  }) ?? null;
  const card = await kit.upsert(host, ctx, canvasId, snapshot, existingCard, { bytes: Buffer.from(md), mime: "text/markdown", filename: `${system.from.dir}-to-${target.id}.md` },
    { title: `${system.from.name} → ${target.name}: token mapping`, width: 760, height: 120 + 34 * mapping.rows.length, properties: { [P().app]: JSON.stringify({ id: ask.app }), [P().mapping]: JSON.stringify({ system: item.id, app: ask.app, seq: ask.seq, rows: mapping.rows, untouched: mapping.untouched }) }, at: { x: item.x, y: item.y + item.height + 80 } },
    id("exact-mapping"));
  const base = { card: card.itemId, mapped, unmatched };
  if (mapped === 0) return answer({ ...base, error: "no token of the system has a match in the app; name some (src=dst) and apply again" });
  const loop = process.env.ISOCAN_EXACT_LOOP;
  if (!loop || !LOOP.test(loop)) return answer({ ...base, error: "Exact's held import goes to the dev loop's design server, and this `isocan exact live` runs none (--no-frames)" });
  snapshot = await ctx.client.snapshot(canvasId);
  const design = core.designItemOf(snapshot.canvas, ask.app);
  // The lines that read a mapped token, from the target's own design reading (its index's `uses`).
  const usesOf = await (async () => {
    const v = design?.versions.find((x) => x.id === design.currentVersionId) ?? design?.versions.at(-1);
    if (!v) return [];
    const text = Buffer.from(await ctx.client.downloadBlob(canvasId, v.blobHash)).toString("utf8");
    const out: Array<{ file: string; line: number }> = [];
    const to = new Set(mapping.rows.map((r) => r.to).filter(Boolean));
    for (const line of text.split("\n")) {
      const m = /^\| `([^`]+)` \|.*\| ([^|]*) \|$/.exec(line);
      if (!m || !to.has(m[1]!)) continue;
      for (const u of m[2]!.matchAll(/([\w./-]+\.contract):(\d+)/g)) out.push({ file: u[1]!, line: Number(u[2]) });
    }
    return out;
  })();
  const screen = screenFor(snapshot, ask.app, usesOf);
  if (!screen) return answer({ ...base, error: "no web phone screen of the app on this canvas to picture the proposal on" });
  const shots = screen.properties[P().reached] ?? screen.properties[P().shots] ?? `at "${screen.properties[P().url] ?? "/"}"`;
  const ios = opts.hosts.includes("ios") && !!opts.sim;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-apply-"));
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({
      dtcg: dtcgFor(system, mapping), shots, ios, schemes: ["light", "dark"],
      devices: (Object.keys(DEVICES) as Device[]).map((d) => ({ device: d, size: `${DEVICES[d].width}x${DEVICES[d].height}` })),
    }));
    let r: ProposeReport & { review?: { unmapped?: Array<{ name: string; why: string }> } | null; ops?: unknown[]; said?: string };
    try {
      r = await kit.bridge(host, "system-apply", ["--app", app, "--dir", path.join(dir, "out"), "--job", job, "--dev-url", loop, ...(ios ? ["--sim", opts.sim!] : [])], "the applied system's preview", true);
    } catch (err) {
      return answer({ ...base, error: (err as Error).message });
    }
    const reported = (r.review?.unmapped ?? []).map((u) => ({ name: u.name, why: u.why }));
    if (!r.ok || !r.proposal || !r.previews?.length) {
      if (r.proposal) await dropOnWire(kit, host, app, loop, r.proposal);
      return answer({ ...base, proposal: r.proposal ?? null, class: r.class ?? null, reported, error: r.error ?? "the import was not pictured" });
    }
    const isAgent = !!snapshot.canvas.agents?.[actor.id];
    const ops = (r.ops ?? []) as Parameters<typeof postProposalItem>[5]["ops"];
    const posted = await postProposalItem(host, ctx, canvasId, screen, r as ProposeReport & { proposal: string; previews: NonNullable<ProposeReport["previews"]> }, {
      seq: ask.seq, askSeq, asker: { id: actor.id, name: actor.name, kind: isAgent ? "agent" : "person" }, scope: isAgent ? "propose" : "write", ops,
      why: `${system.from.name}'s design system applied to ${target.name} as Exact's held import: ${mapped} tokens mapped (the card ${card.itemId} says which).`.slice(0, 600),
      cites: [{ kind: "item", ref: item.id }, { kind: "item", ref: card.itemId }], in: null,
      title: `Applied by ${actor.name}: ${system.from.name}'s design system on ${target.name}`.slice(0, 160),
    });
    if ("error" in posted) {
      await dropOnWire(kit, host, app, loop, r.proposal);
      return answer({ ...base, proposal: r.proposal, class: r.class ?? null, reported, error: posted.error });
    }
    return answer({ ...base, ok: true, itemId: posted.itemId, proposal: r.proposal, class: r.class ?? null, reported, previews: posted.cells });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
