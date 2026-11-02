import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { SUMMARY_MODEL, SUMMARY_OVER_BUDGET, SUMMARY_QUIET } from "@isocan/core/semantic-zoom";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **Semantic Zoom from the terminal** (`docs/projects/semantic-zoom/`, phase
 * 4; design §8): `isocan summary <item|group|area> [--refresh]` and `isocan ls
 * --summaries`, against a real daemon on a scratch home whose text model is a
 * stub that counts its calls. Never a real model, never a real home.
 *
 * Held, in the order a canvas lives through them: a long note with no summary
 * is `missing`; `ls --summaries` reads and never makes (a short note, which a
 * make would cache as `short` without a model call, is still `missing` after
 * it); a note changed moments ago answers `--refresh` with the home's 202 and
 * exits 0, saying when to ask again; once quiet, `--refresh` makes one —
 * `current` — through the stub; a short note is `short`, an excluded one
 * `excluded` and its refresh refused by the home; a group's summary is keyed
 * by its members exactly as the web keys it; an edit makes the summary
 * `stale`, with its age; over the canvas's hourly budget `--refresh` prints
 * the home's 429 plainly and exits 0; `--stats` reads the cost record; and a
 * view-only identity reads but its `--refresh` and `--stats` are refused,
 * with no model call.
 *
 * The CLI computes the content key itself, from the snapshot it read; a key
 * that differed from the web's (and the home's) would read every summary as
 * missing or stale, so `current` after a make is the key's proof.
 *
 * Fixtures are synthetic: Acme, Nico, Ravi, a made-up key.
 */

const KEY = "sk-ant-fake_SUMMARY_CLI_DO_NOT_PRINT_";
const nico = { id: "usr_nico", name: "Nico" };
const ravi = { id: "usr_ravi", name: "Ravi" };
const LONG = `Acme launch notes\n\n${"The Acme launch slips two weeks while Ravi rewrites the pricing page and the team settles the open question on data residency for the warehouse customers. ".repeat(3)}`;
const LONG_AGAIN = `Acme launch notes\n\n${"The Acme launch is back on its original date now that Ravi has finished the pricing page and the warehouse customers agreed on data residency in the EU. ".repeat(3)}`;
const SHORT = "Acme reminder: call the warehouse on Monday.";
const SECRET = `Acme payroll notes\n\n${"Private salary bands for the warehouse team, which must never be sent to any model or summarised for anybody looking at the canvas from afar. ".repeat(3)}`;
const SUMMARY = "Acme's launch slips two weeks; Ravi owns pricing; data residency is still open.";
const GROUP_SUMMARY = "A board of Acme launch work: pricing, residency and the warehouse call.";

let home: string;
let viewerHome: string;
let daemon: Daemon;
let port: string;
let canvasId: string;
/** Added to the home's clock: 0 while a note is "just changed", past the quiet period otherwise. */
const clock = { offset: 0 };
const calls: Array<Record<string, unknown>> = [];
const ids: Record<string, string> = {};

const claudeSays = (value: unknown) =>
  new Response(
    JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: SUMMARY_MODEL, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(value) }] }),
    { status: 200 },
  );

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-summary-cli-"));
  viewerHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-summary-viewer-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...nico, createdAt: new Date().toISOString() }));
  await fs.writeFile(path.join(viewerHome, "identity.json"), JSON.stringify({ ...ravi, createdAt: new Date().toISOString() }));
  const fake = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push(body);
    return claudeSays({ summary: JSON.stringify(body).includes("holding") ? GROUP_SUMMARY : SUMMARY });
  }) as unknown as typeof fetch;
  daemon = await startDaemon({
    port: 0, home, auth: null, contentPort: "off", birthHome: null,
    text: { key: () => KEY, fetch: fake },
    // Two calls an hour: the long note's and the group's; the third is over the budget.
    summaries: { now: () => Date.now() + clock.offset, perHour: 2 },
  });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);

  const made = await isocan("canvas", "create", "Acme Notes");
  expect(made.code, made.stderr).toBe(0);
  ids.long = (await json("text", LONG)).itemId;
  ids.short = (await json("text", SHORT)).itemId;
  ids.secret = (await json("text", SECRET)).itemId;
  const excluded = await isocan("context", "exclude", ids.secret!);
  expect(excluded.code, excluded.stderr).toBe(0);
  ids.board = (await json("area", "new", "Launch board")).itemId;
  ids.card = (await json("text", "Pricing page: Ravi", "--in", "Launch board")).itemId;
  canvasId = (await json("canvas", "show")).id;
}, 120_000);

afterAll(async () => {
  await daemon?.close();
  await Promise.allSettled([home, viewerHome].map((dir) => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port }) });
}

function asViewer(...args: string[]): Promise<Run> {
  return runCli(["--canvas", canvasId, ...args], { cwd: viewerHome, env: cliEnv({ ISOCAN_HOME: viewerHome, ISOCAN_PORT: port }) });
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

describe("isocan summary", () => {
  it("says a long note with no summary is missing, and how to ask for one", async () => {
    const run = await isocan("summary", ids.long!);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^missing — text /m);
    expect(run.stdout).toContain(`isocan summary ${ids.long} --refresh`);
    expect((await json("summary", ids.long!)).state).toBe("missing");
    expect(calls).toHaveLength(0);
  }, 60_000);

  it("ls --summaries reads and never makes", async () => {
    const run = await isocan("ls", "--summaries");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout.split("\n")[0]).toContain("SUMMARY");
    const rows = await json("ls", "--summaries");
    expect(rows.every((row: any) => row.summary === null)).toBe(true);
    // A make of the short note would have cached it as `short` with no model
    // call at all — so `missing` here is the witness that nothing was POSTed,
    // not merely that the stub stayed quiet.
    expect((await json("summary", ids.short!)).state).toBe("missing");
    expect(calls).toHaveLength(0);
  }, 60_000);

  it("--refresh on a note changed moments ago prints the home's wait and exits 0", async () => {
    clock.offset = 0;
    const run = await isocan("summary", ids.long!, "--refresh");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.stdout).toMatch(/Ask again in \d+ s/);
    const answer = await json("summary", ids.long!, "--refresh");
    expect(answer.state).toBe("missing");
    expect(answer.refresh).toMatchObject({ code: SUMMARY_QUIET });
    expect(answer.refresh.retryAfterMs).toBeGreaterThan(0);
    expect(calls).toHaveLength(0);
  }, 60_000);

  it("--refresh once quiet makes one through the stub, and it reads back current", async () => {
    clock.offset = 31_000;
    const made = await isocan("summary", ids.long!, "--refresh");
    expect(made.code, made.stderr).toBe(0);
    expect(made.stdout).toContain(`≈ ${SUMMARY}`);
    expect(made.stdout).toMatch(/^current — a summary of text /m);
    expect(made.stdout).toContain(`isocan get ${ids.long}`);
    expect(calls).toHaveLength(1);
    const read = await json("summary", ids.long!);
    expect(read).toMatchObject({ itemId: ids.long, kind: "text", state: "current", summary: SUMMARY, model: SUMMARY_MODEL });
    // Asking again spends nothing: the home answers the cached entry.
    const again = await json("summary", ids.long!, "--refresh");
    expect(again.refresh).toEqual({ made: false });
    expect(calls).toHaveLength(1);
  }, 60_000);

  it("a short note is short, and costs no model call", async () => {
    const made = await json("summary", ids.short!, "--refresh");
    expect(made).toMatchObject({ state: "short", summary: null });
    const run = await isocan("summary", ids.short!);
    expect(run.stdout).toMatch(/^short — /m);
    expect(calls).toHaveLength(1);
  }, 60_000);

  it("an excluded note is excluded, and the home refuses its refresh", async () => {
    const read = await isocan("summary", ids.secret!);
    expect(read.code, read.stderr).toBe(0);
    expect(read.stdout).toMatch(/^excluded — /m);
    const refused = await isocan("summary", ids.secret!, "--refresh");
    expect(refused.code).toBe(1);
    expect(refused.stderr).toMatch(/excluded from context/);
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls)).not.toContain("salary");
  }, 60_000);

  it("a group's summary is keyed by its members as the web keys it", async () => {
    expect((await json("summary", ids.board!)).state).toBe("missing");
    const made = await json("summary", ids.board!, "--refresh");
    expect(made).toMatchObject({ kind: "group", state: "current", summary: GROUP_SUMMARY });
    // A group's words are its members': the read it points at is `ls --in`, not `get`.
    expect((await isocan("summary", ids.board!)).stdout).toContain(`isocan ls --in ${ids.board}`);
    expect(calls).toHaveLength(2);
    expect((await json("summary", ids.board!)).state).toBe("current");
  }, 60_000);

  it("ls --summaries shows the column for what has one", async () => {
    const run = await isocan("ls", "--summaries");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain("≈ Acme's launch slips two weeks");
    const rows = await json("ls", "--summaries");
    const byId = new Map(rows.map((row: any) => [row.id, row.summary]));
    expect(byId.get(ids.long)).toMatchObject({ state: "current", summary: SUMMARY });
    expect(byId.get(ids.board)).toMatchObject({ state: "current", summary: GROUP_SUMMARY });
    expect(byId.get(ids.short)).toBeNull();
    expect(byId.get(ids.secret)).toBeNull();
    expect(calls).toHaveLength(2);
  }, 60_000);

  it("an edit leaves the old summary stale, with its age", async () => {
    const file = path.join(home, "launch.md");
    await fs.writeFile(file, LONG_AGAIN);
    const edited = await isocan("edit", ids.long!, file);
    expect(edited.code, edited.stderr).toBe(0);
    const run = await isocan("summary", ids.long!);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain(`≈ ${SUMMARY}`);
    expect(run.stdout).toMatch(/^stale — describes text .* as it was .* ago/m);
    const read = await json("summary", ids.long!);
    expect(read).toMatchObject({ state: "stale", summary: SUMMARY });
    expect(read.ageMs).toBeGreaterThanOrEqual(0);
    const listed = (await json("ls", "--summaries")).find((row: any) => row.id === ids.long);
    expect(listed.summary.state).toBe("stale");
  }, 60_000);

  it("--refresh over the canvas's hourly budget prints the home's answer and exits 0", async () => {
    const run = await isocan("summary", ids.long!, "--refresh");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^over budget — this canvas has made its 2 summaries for the hour/m);
    expect(run.stdout).toMatch(/^stale — /m);
    const answer = await json("summary", ids.long!, "--refresh");
    expect(answer.refresh).toMatchObject({ code: SUMMARY_OVER_BUDGET });
    expect(answer.state).toBe("stale");
    expect(calls).toHaveLength(2);
  }, 60_000);

  it("--stats says what the summaries cost, and --json is the home's answer", async () => {
    const stats = await json("summary", "--stats");
    expect(stats).toMatchObject({ canvasId, total: { calls: 2, makes: 2 }, budget: { perHour: 2, usedThisHour: 2 } });
    expect(stats.entries.held).toBeGreaterThanOrEqual(3);
    const run = await isocan("summary", "--stats", "--days", "7");
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain(`summaries on ${canvasId}`);
    expect(run.stdout).toMatch(/^today \(\d{4}-\d{2}-\d{2}\)\s+\d+/m);
    expect(run.stdout).toMatch(/^budget — 2 of 2 made this hour/m);
    expect(run.stdout).toMatch(/^cache — \d+ of \d+ entries held/m);
    const wrong = await isocan("summary", ids.long!, "--stats");
    expect(wrong.code).toBe(1);
  }, 60_000);

  it("a view-only identity reads, and its --refresh is refused with no model call", async () => {
    const narrowed = await isocan("share", "--link", "view");
    expect(narrowed.code, narrowed.stderr).toBe(0);
    const read = await asViewer("summary", ids.board!);
    expect(read.code, read.stderr).toBe(0);
    expect(read.stdout).toContain(`≈ ${GROUP_SUMMARY}`);
    const refused = await asViewer("summary", ids.long!, "--refresh");
    expect(refused.code).toBe(1);
    expect(refused.stderr).toMatch(/^error: /m);
    expect(refused.stderr).toMatch(/you may read this canvas .* but not change it/);
    // What somebody's key spent is the editors' to read, not a viewer's.
    const stats = await asViewer("summary", "--stats");
    expect(stats.code).toBe(1);
    expect(stats.stderr).toMatch(/^error: /m);
    expect(calls).toHaveLength(2);
  }, 60_000);
});
