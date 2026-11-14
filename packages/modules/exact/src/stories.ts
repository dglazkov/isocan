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

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CanvasSnapshotResponse, Item, LogEntry, Operation } from "@isocan/core";
import type { CliHost, Ctx } from "@isocan/cli/modulehost";
import type { ExactIndex, Readings } from "./core.ts";
import { core } from "./core-ref.ts";
import {
  appendTest, appendedTest, parseRecordAsk, parseRecordAnswer, parseRecording, parseRunAnswer, parseRunAsk, parseStory, parseVerifyAnswer, parseVerifyAsk, parseWritten,
  proposeExpects, rebased, recordedTest, storyOf, storySize, storyText, withRun,
  type CompiledTest, type RecordAnswer, type RecordAsk, type Recording, type RunAnswer, type RunReport, type Storyboard, type VerifyAnswer, type Written,
} from "./story.ts";

/**
 * **Tests are storyboards, the acting half** (exact phase 5; design §9),
 * loaded with the verbs — never on `isocan --version`'s path.
 *
 * - every `*.test.contract` is posted as the file it is (a text item that
 *   reads as the file with the module gone), and each `test` block in it as
 *   a storyboard beside the map;
 * - **Run** (`isocan exact run`, or a storyboard's Run with *Live frames* off,
 *   answered here) runs Exact's own `test <host>` through the bridge and
 *   keeps the run as the storyboard's next version;
 * - **Verify** runs Exact's `verify` and posts each screenshot as a version of
 *   the screen it shows, where it can say which;
 * - **Record**: a recording asked for on a screen becomes a core proposal
 *   item under its test file, and only the person's Keep — core's choose,
 *   which folds the proposal into the file as its next version — makes this
 *   write the file, after checking the kept text is the file it was recorded
 *   against with one recorded test appended.
 *
 * Nothing here spawns: Exact runs in `scripts/exact-bridge.mjs`.
 */

type Upsert = "new" | "new version" | "unchanged" | "skipped";

/** What `cli-run.ts` hands over: its bridge and its upsert, so this file has one way to run Exact and one to post. */
export interface Kit {
  bridge: <T>(host: CliHost, verb: string, args: string[], what: string, quiet: boolean) => Promise<T>;
  upsert: (
    host: CliHost, ctx: Ctx, canvasId: string, snapshot: CanvasSnapshotResponse, existing: Item | null,
    file: { bytes: Buffer; mime: string; filename: string },
    add: { title: string; width: number; height: number; properties: Record<string, string>; at: { x: number; y: number } },
    group: string,
  ) => Promise<{ itemId: string; status: Upsert; blobHash: string }>;
  appOf: (app: string) => Promise<{ id: string; name: string }>;
}

const id = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const sha256 = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
const P = () => core.EXACT_PROPS;
const appProp = (appId: string) => JSON.stringify({ id: appId });

/** The text item holding one test file. */
export function testFileItemOf(snapshot: CanvasSnapshotResponse, appId: string, file: string): Item | null {
  return Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === appId && i.properties?.[P().testFile] === file && i.properties?.[P().test] === undefined && !i.properties?.proposal) ?? null;
}

/** The storyboard of one test. */
export function storyItemOf(snapshot: CanvasSnapshotResponse, appId: string, file: string, test: string): Item | null {
  return Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === appId && i.properties?.[P().testFile] === file && i.properties?.[P().test] === test) ?? null;
}

const currentVersion = (item: Item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);

async function readStory(ctx: Ctx, canvasId: string, item: Item): Promise<Storyboard | null> {
  const v = currentVersion(item);
  if (!v) return null;
  try { return parseStory(Buffer.from(await ctx.client.downloadBlob(canvasId, v.blobHash)).toString("utf8")); } catch { return null; }
}

/**
 * **The test files and their storyboards, posted** (a pass of `open` or
 * `live`): each file as a text item in the side column under the map's
 * cards, each test as a storyboard in a row under the map. A storyboard whose
 * steps did not move is not touched (its key says so); one whose steps moved
 * gets a version with no runs, since runs of other steps are not its.
 */
export async function syncStories(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, readings: Readings, index: ExactIndex, at: { sideX: number; mapX: number; y: number }): Promise<Array<{ file: string; test: string | null; itemId: string; status: Upsert }>> {
  const out: Array<{ file: string; test: string | null; itemId: string; status: Upsert }> = [];
  const sources = readings.testSources ?? {};
  const group = id("exact-stories");
  let y = at.y;
  for (const compiled of readings.tests ?? []) {
    const text = sources[compiled.file];
    if (text === undefined) continue;
    let snapshot = await ctx.client.snapshot(canvasId);
    const fileItem = testFileItemOf(snapshot, index.app.id, compiled.file);
    const posted = await kit.upsert(host, ctx, canvasId, snapshot, fileItem,
      { bytes: Buffer.from(text, "utf8"), mime: "text/plain", filename: compiled.file },
      { title: `${index.app.name} · ${compiled.file}`, width: 320, height: 420, properties: { [P().app]: appProp(index.app.id), [P().testFile]: compiled.file }, at: { x: at.sideX, y } },
      group);
    out.push({ file: compiled.file, test: null, itemId: posted.itemId, status: posted.status });
    let rowY = fileItem ? fileItem.y : y;
    for (const test of compiled.tests as CompiledTest[]) {
      snapshot = await ctx.client.snapshot(canvasId);
      const next = storyOf(index.app, compiled.file, text, test);
      const key = sha256(JSON.stringify([next.test.name, next.test.line, next.test.steps]));
      const existing = storyItemOf(snapshot, index.app.id, compiled.file, test.name);
      const size = storySize(next.test.steps.length);
      if (existing?.properties?.[P().key] === key) { out.push({ file: compiled.file, test: test.name, itemId: existing.id, status: "skipped" }); rowY = existing.y + existing.height + 60; continue; }
      const story = rebased(existing ? await readStory(ctx, canvasId, existing) : null, next);
      const r = await kit.upsert(host, ctx, canvasId, snapshot, existing,
        { bytes: Buffer.from(storyText(story), "utf8"), mime: core.EXACT_STORY_MIME, filename: `${test.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "test"}.exact-storyboard.json` },
        { title: `${index.app.name} · test "${test.name}"`, width: size.width, height: size.height, properties: { [P().app]: appProp(index.app.id), [P().testFile]: compiled.file, [P().test]: test.name, [P().key]: key }, at: { x: at.mapX, y: rowY } },
        group);
      out.push({ file: compiled.file, test: test.name, itemId: r.itemId, status: r.status });
      rowY = (existing ? existing.y + existing.height : rowY + size.height) + 60;
    }
    y = Math.max(y + 420 + 60, rowY);
  }
  return out;
}

// ---------------------------------------------------------------- Run

/** One host's run, through the bridge, kept as the storyboard's next version. */
export async function runOnHost(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, item: Item, on: string, sim: string | null): Promise<{ report: RunReport; status: Upsert }> {
  const file = item.properties?.[P().testFile] ?? "";
  const test = item.properties?.[P().test] ?? "";
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-run-"));
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({ host: on, file, test }));
    const report = await kit.bridge<RunReport>(host, "run", ["--app", app, "--dir", dir, "--job", job, ...(sim ? ["--sim", sim] : [])], `the test on ${on}`, true);
    const snapshot = await ctx.client.snapshot(canvasId);
    const now = snapshot.canvas.items[item.id] ?? item;
    const story = await readStory(ctx, canvasId, now);
    if (!story) throw new Error(`${now.title} does not read as a storyboard`);
    const read = new Map<string, string>();
    for (const f of [...report.steps.map((s) => s.frame), report.failed?.frame ?? null, report.end]) {
      if (f?.file && !read.has(f.sha256)) read.set(f.sha256, (await fs.readFile(f.file)).toString("base64"));
    }
    const next = withRun(story, report, (f) => read.get(f.sha256) ?? null, new Date().toISOString());
    const posted = await kit.upsert(host, ctx, canvasId, snapshot, now,
      { bytes: Buffer.from(storyText(next), "utf8"), mime: core.EXACT_STORY_MIME, filename: currentVersion(now)?.filename ?? "test.exact-storyboard.json" },
      { title: now.title, width: now.width, height: now.height, properties: {}, at: { x: now.x, y: now.y } },
      id("exact-run"));
    return { report, status: posted.status };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export interface RunOptions { canvas?: string; hosts?: string; sim?: string; file?: string }

/** One line of what a run found, for a person or an agent reading the terminal. */
export function runLine(r: RunReport): string {
  if (r.verdict === "ok") return `${r.host.padEnd(6)} ok — ${r.steps.length} steps green`;
  if (r.verdict === "skipped") return `${r.host.padEnd(6)} skipped — ${r.said[0] ?? ""}`;
  const at = r.failed?.line ? `${r.file}:${r.failed.line}` : r.file;
  return `${r.host.padEnd(6)} ${r.verdict === "fail" ? "FAIL" : "error"} at ${at} — ${r.failed?.reason.split("\n")[0]?.slice(0, 220) ?? r.error ?? "?"}`;
}

/** A run asked for on the canvas (`exact.run`, by a browser whose door is shut), answered: each host in turn. */
export async function answerRun(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, hosts: readonly string[], sim: string | null, item: Item, say: (line: string) => void): Promise<RunAnswer | null> {
  const ask = parseRunAsk(item.properties?.[P().run]);
  if (!ask) return null;
  const started = Date.now();
  const answer: RunAnswer = { seq: ask.seq, ok: true, hosts: {}, ms: 0 };
  for (const on of ask.hosts) {
    if (!hosts.includes(on)) { answer.hosts[on] = { verdict: "error", line: null, reason: `this \`isocan exact live\` runs on ${hosts.join(", ")} — start it with --hosts …,${on}` }; continue; }
    if (on === "ios" && !sim) { answer.hosts[on] = { verdict: "error", line: null, reason: "this `isocan exact live` has no simulator of its own: --sim <udid>" }; continue; }
    say(`run on ${on}: ${item.title}${ask.by ? `, for ${ask.by}` : ""}`);
    try {
      const { report } = await runOnHost(kit, host, ctx, canvasId, app, item, on, sim);
      answer.hosts[on] = { verdict: report.verdict, line: report.failed?.line ?? null, reason: report.failed?.reason ?? null };
      say(`run on ${on}: ${runLine(report)}`);
    } catch (err) {
      answer.hosts[on] = { verdict: "error", line: null, reason: (err as Error).message };
      say(`run on ${on}: ${(err as Error).message}`);
    }
  }
  answer.ms = Date.now() - started;
  answer.ok = Object.values(answer.hosts).every((h) => h.verdict !== "error");
  return answer;
}

// ---------------------------------------------------------------- Verify

interface VerifyReport {
  ok: boolean; host: string; exit: number | null; problems: number | null;
  tests: { passed: number; failed: number; failing: Array<{ name: string; file: string; failures: string[] }> } | null;
  shots: Array<{ file: string; sha256: string; screen: string; size: [number, number] | null; scheme: "light" | "dark"; png: { width: number; height: number } | null }>;
  ms: number; error?: string;
}

const WEB_DEVICE: Record<string, string> = { "390x844": "phone", "820x1180": "tablet", "1280x800": "desktop" };

/**
 * **Verify on a host, its screenshots posted where they belong** (design §9):
 * a shot of the app's first screen is the start route's screen on that host,
 * at the device its size is and the scheme it was taken in — posted as that
 * screen's next version when its pixels differ. A shot verify names by a
 * test's name, or at a size no device of the row has, is said, not guessed.
 */
export async function verifyOnHost(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, on: string, sim: string | null): Promise<VerifyAnswer["hosts"][string]> {
  const r = await kit.bridge<VerifyReport>(host, "verify", ["--app", app, "--host", on, ...(sim ? ["--sim", sim] : [])], `verify on ${on}`, true);
  if (!r.ok) return { exit: r.exit, problems: null, tests: null, posted: [], unmatched: [], error: r.error ?? "verify did not report" };
  const info = await kit.appOf(app);
  const manifest = JSON.parse(await fs.readFile(path.join(app, "app.json"), "utf8")) as { start_url?: string };
  const start = manifest.start_url ?? "/";
  const snapshot = await ctx.client.snapshot(canvasId);
  const indexItem = core.indexItemOf(snapshot.canvas, info.id);
  let routes: Array<{ name: string; pattern: string }> = [];
  if (indexItem) {
    try { routes = core.parseIndex(Buffer.from(await ctx.client.downloadBlob(canvasId, currentVersion(indexItem)!.blobHash)).toString("utf8")).routes; } catch { /* no index: nothing matches */ }
  }
  const startRoute = routes.find((x) => x.pattern === start)?.name ?? null;
  const posted: VerifyAnswer["hosts"][string]["posted"] = [];
  const unmatched: VerifyAnswer["hosts"][string]["unmatched"] = [];
  const group = id("exact-verify");
  for (const shot of r.shots) {
    const name = path.basename(shot.file);
    if (shot.screen === "relaunch") { unmatched.push({ shot: name, why: "verify's relaunch reopens on the store a passing test left, and says nothing of the route it shows" }); continue; }
    if (shot.screen !== "first screen") { unmatched.push({ shot: name, why: `verify names this screen by the test that ended on it ("${shot.screen}"), not by a route, so the canvas cannot say which screen it shows` }); continue; }
    if (!startRoute) { unmatched.push({ shot: name, why: `no route of the index has the start_url's pattern ${start}` }); continue; }
    const size = shot.size ? `${shot.size[0]}x${shot.size[1]}` : "";
    const device = on === "web" ? WEB_DEVICE[size] : "phone";
    if (!device) { unmatched.push({ shot: name, why: `verify draws the first screen at ${size.replace("x", "×")}, which is no device of the canvas's row (phone 390×844, tablet 820×1180, desktop 1280×800)` }); continue; }
    const screen = core.screenItemOf(snapshot.canvas, info.id, startRoute, device as never, shot.scheme, on);
    if (!screen) { unmatched.push({ shot: name, why: `no ${on} ${device} ${shot.scheme} screen of ${startRoute} on this canvas — \`isocan exact open\` captures it first` }); continue; }
    const p = await kit.upsert(host, ctx, canvasId, snapshot, screen,
      { bytes: await fs.readFile(shot.file), mime: "image/png", filename: `${startRoute}-verify-${on}-${device}-${shot.scheme}.png` },
      { title: screen.title, width: screen.width, height: screen.height, properties: {}, at: { x: screen.x, y: screen.y } },
      group);
    posted.push({ itemId: screen.id, status: p.status, shot: name });
  }
  return { exit: r.exit, problems: r.problems, tests: r.tests ? { passed: r.tests.passed, failed: r.tests.failed, failing: r.tests.failing.map((t) => `${t.file}: ${t.name} — ${t.failures[0] ?? ""}`.slice(0, 300)) } : null, posted, unmatched };
}

// ---------------------------------------------------------------- Record

/** The record asks waiting on this app's screens, with the op that asked (a proposal cites it). */
export function pendingRecords(entries: readonly LogEntry[], snapshot: CanvasSnapshotResponse, appId: string): Array<{ item: Item; ask: RecordAsk; seq: number }> {
  const out = new Map<string, { item: Item; ask: RecordAsk; seq: number }>();
  for (const e of entries) {
    const op = e.envelope.op as { type: string; itemId?: string; patch?: { properties?: Record<string, unknown> } };
    if (op.type !== "item.update" || !op.itemId || !op.patch?.properties || !(P().record in op.patch.properties)) continue;
    const item = snapshot.canvas.items[op.itemId];
    if (!item || core.appIdOf(item) !== appId) continue;
    const ask = parseRecordAsk(item.properties?.[P().record]);
    const answered = parseRecordAnswer(item.properties?.[P().recorded]);
    if (ask && (!answered || answered.seq < ask.seq)) out.set(item.id, { item, ask, seq: e.seq });
  }
  return [...out.values()];
}

/** The run and verify asks waiting, read off the log the same way. */
export function pendingAsks(entries: readonly LogEntry[], snapshot: CanvasSnapshotResponse, appId: string): { runs: Item[]; verifies: Item[] } {
  const touched = (key: string) => {
    const ids = new Set<string>();
    for (const e of entries) {
      const op = e.envelope.op as { type: string; itemId?: string; patch?: { properties?: Record<string, unknown> } };
      if (op.type === "item.update" && op.itemId && op.patch?.properties && key in op.patch.properties) ids.add(op.itemId);
    }
    return [...ids].map((i) => snapshot.canvas.items[i]).filter((i): i is Item => !!i && core.appIdOf(i) === appId);
  };
  const runs = touched(P().run).filter((i) => { const a = parseRunAsk(i.properties?.[P().run]); const b = parseRunAnswer(i.properties?.[P().ran]); return a && (!b || b.seq < a.seq); });
  const verifies = touched(P().verify).filter((i) => { const a = parseVerifyAsk(i.properties?.[P().verify]); const b = parseVerifyAnswer(i.properties?.[P().verified]); return a && (!b || b.seq < a.seq); });
  return { runs, verifies };
}

/**
 * **A recording, proposed**: the state before and after the recorded presses
 * (the bridge's `record`, a cold driver), the `expect` lines read off what
 * moved, and the test appended to the file as it is on disk now — posted as a
 * core proposal item under the file's item (`proposal`, `parent`,
 * `proposalCites` naming the op that asked, `proposalWhy`), with
 * `exact.recording` saying what it was written against. Nothing is written
 * to disk: the person's Keep is the only way there (`writeKept`).
 */
export async function answerRecord(kit: Kit, host: CliHost, ctx: Ctx, canvasId: string, app: string, hosts: readonly string[], sim: string | null, _screen: Item, ask: RecordAsk, askSeq: number): Promise<RecordAnswer> {
  const started = Date.now();
  const refused = (error: string): RecordAnswer => ({ seq: ask.seq, ok: false, itemId: null, test: null, expects: [], ms: Date.now() - started, error });
  if (!hosts.includes(ask.host)) return refused(`this \`isocan exact live\` drives ${hosts.join(", ")} — start it with --hosts …,${ask.host}`);
  if (ask.host === "ios" && !sim) return refused("this `isocan exact live` has no simulator of its own: --sim <udid>");
  const info = await kit.appOf(app);
  const snapshot = await ctx.client.snapshot(canvasId);
  const fileItem = testFileItemOf(snapshot, info.id, ask.file);
  if (!fileItem) return refused(`${ask.file} is not on this canvas as a test file — \`isocan exact open\` posts the app's test files`);
  let disk: string;
  try { disk = await fs.readFile(path.join(app, ask.file), "utf8"); } catch { return refused(`${ask.file} is not in the app`); }
  if (new RegExp(`^test "${ask.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*$`, "m").test(disk)) return refused(`${ask.file} already has a test named "${ask.name}" — name the recording something else`);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-exact-record-"));
  let r: { ok: boolean; before?: { slots: Record<string, unknown> | null; derives: Record<string, unknown> | null }; after?: { slots: Record<string, unknown> | null; derives: Record<string, unknown> | null }; error?: string };
  try {
    const job = path.join(dir, "job.json");
    await fs.writeFile(job, JSON.stringify({ host: ask.host, size: ask.size, scheme: ask.scheme, shots: ask.shots, before: ask.before, ops: ask.ops }));
    r = await kit.bridge(host, "record", ["--app", app, "--job", job, ...(sim ? ["--sim", sim] : [])], "the recording", true);
  } catch (err) {
    return refused((err as Error).message);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
  if (!r.ok || !r.before || !r.after) return refused(r.error ?? "the recording's drive did not finish");
  const expects = proposeExpects(r.before, r.after);
  let test: string;
  try { test = recordedTest(ask.name, ask.shots, ask.before, ask.ops, expects); } catch (err) { return refused((err as Error).message); }
  const text = appendTest(disk, test);
  const put = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), "text/plain", ask.file);
  const recording: Recording = { file: ask.file, base: sha256(disk), test: ask.name, host: ask.host, seq: ask.seq };
  const presses = ask.ops.length;
  const why = `Recorded in Drive mode on ${ask.host === "web" ? "the web" : ask.host === "ios" ? "iOS" : "macOS"}: ${presses} press${presses === 1 ? "" : "es"}, and ${expects.length} expect line${expects.length === 1 ? "" : "s"} read off the state that changed. Keep it to write the test into ${ask.file}.`;
  const itemId = id("itm");
  const op: Operation = {
    type: "item.add",
    itemId,
    version: { id: id("ver"), blobHash: put.blobHash, mimeType: "text/plain", filename: ask.file, size: put.size },
    width: fileItem.width,
    height: fileItem.height,
    // Beside the file, on the side away from the map: the next file's item sits under it.
    placement: { x: Math.round(fileItem.x - fileItem.width - 80), y: Math.round(fileItem.y), chosen: true },
    title: `Recorded: test "${ask.name}" for ${ask.file}`,
    // Core's proposal, by its own keys (`packages/core/src/proposal.ts`, `lineage.ts`): the reducer refuses one without a cite or a why.
    properties: {
      proposal: "sure",
      parent: fileItem.id,
      proposalCites: JSON.stringify([{ kind: "op", ref: String(askSeq) }]),
      proposalWhy: why,
      [P().app]: appProp(info.id),
      [P().recording]: JSON.stringify(recording),
    },
    ...(snapshot.project.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" as const } : {}),
  };
  try {
    await host.sendOp(ctx, canvasId, op, id("exact-record"));
  } catch (err) {
    return refused((err as Error).message);
  }
  return { seq: ask.seq, ok: true, itemId, test, expects, ms: Date.now() - started };
}

/**
 * **A kept recording, written** — the only way a recorded test reaches the
 * disk. Read off the log: a version added to one of this app's test files, or
 * a recorded proposal taken away, after which the file's current version is a
 * recorded proposal's own bytes (core's choose — the person's Keep — folds the
 * proposal in and trashes it). The file is written only when it is still the
 * text the recording was made against and the kept text is that text with
 * one recorded test appended; the answer, either way, is `exact.written` on
 * the file's item, for that version.
 */
export async function writeKept(host: CliHost, ctx: Ctx, canvasId: string, app: string, appId: string, entries: readonly LogEntry[], snapshot: CanvasSnapshotResponse, say: (line: string) => void): Promise<void> {
  // The files a Keep may have touched: a version added to one, or a recorded proposal taken away (core's choose sends
  // both, in one group — and a long poll can hand them over in two batches).
  const trashed = snapshot.canvas.trash.map((t) => t.item);
  const files = new Set<string>();
  for (const e of entries) {
    const op = e.envelope.op as Operation;
    if (op.type === "item.addVersion") files.add(op.itemId);
    if (op.type === "item.delete") { const p = trashed.find((i) => i.id === op.itemId); if (p && parseRecording(p.properties?.[P().recording]) && p.properties?.parent) files.add(p.properties.parent); }
  }
  for (const fileId of files) {
    const file = snapshot.canvas.items[fileId];
    if (!file || core.appIdOf(file) !== appId || !file.properties?.[P().testFile] || file.properties?.[P().test] !== undefined) continue;
    const version = currentVersion(file);
    if (!version || parseWritten(file.properties?.[P().written])?.version === version.id) continue;
    // The file's current version is a recorded proposal's own bytes: that proposal was kept (folded in by choose).
    const kept = [...trashed, ...Object.values(snapshot.canvas.items)].find((i) => i.properties?.parent === file.id && parseRecording(i.properties?.[P().recording]) && currentVersion(i)?.blobHash === version.blobHash);
    if (!kept) continue;
    const recording = parseRecording(kept.properties?.[P().recording])!;
    const target = path.join(app, recording.file);
    const answer = async (w: Omit<Written, "version" | "at">) => {
      const written: Written = { version: version.id, at: new Date().toISOString(), ...w };
      await host.sendOp(ctx, canvasId, { type: "item.update", itemId: file.id, patch: { properties: { [P().written]: JSON.stringify(written) } } }, id("exact-write"));
      say(w.ok ? `kept: test "${w.test}" written into ${recording.file}` : `kept, not written: ${w.error}`);
    };
    if (recording.file !== file.properties[P().testFile]) { await answer({ ok: false, sha256: null, test: null, error: `the recording was for ${recording.file}, not ${file.properties[P().testFile]}` }); continue; }
    let disk: string;
    try { disk = await fs.readFile(target, "utf8"); } catch { await answer({ ok: false, sha256: null, test: null, error: `${recording.file} is not in the app any more` }); continue; }
    if (sha256(disk) !== recording.base) { await answer({ ok: false, sha256: null, test: null, error: `${recording.file} changed on disk since the recording; record again` }); continue; }
    const text = Buffer.from(await ctx.client.downloadBlob(canvasId, version.blobHash)).toString("utf8");
    const checked = appendedTest(disk, text);
    if ("refused" in checked) { await answer({ ok: false, sha256: null, test: null, error: checked.refused }); continue; }
    const temp = `${target}.isocan-${process.pid}`;
    await fs.writeFile(temp, text);
    await fs.rename(temp, target);
    await answer({ ok: true, sha256: sha256(text), test: recording.test });
  }
}
