import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { cliEnv, runCli, type Run } from "./cli.ts";
import { EXIT_CONFLICT, EXIT_UNSUPPORTED, appliedResult, conditionalEditSentence, parseExpectedMeta, parseOpId, staleBeforeSending } from "../src/conditional-edit.ts";

/**
 * **`isocan edit --if-version` against a real daemon.**
 *
 * The consumer is a generator that keeps one card current — a weekly report,
 * a live pulse — and must not stack a version over whatever a person did to
 * the card since it last looked. Each claim below is one the generator's
 * correctness rests on: it lands when nothing moved; it refuses, writing
 * nothing, when the content or the metadata moved; a retry under the same op
 * id is told what already landed; and the flags that only mean something
 * conditionally say so.
 *
 * Synthetic: Acme's weekly pulse card.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;
let canvas: string;
let itemId: string;
let file: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-conditional-edit-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...acme, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  client = new DaemonClient(`http://127.0.0.1:${port}`, home);
  canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme pulse")).canvasId;
  file = path.join(home, "pulse.md");
  await fs.writeFile(file, "# Pulse\n\nweek 40\n");
  itemId = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme pulse", "--prop", "kind=pulse")).itemId;
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port }) });
}

async function ok(...args: string[]): Promise<string> {
  const run = await isocan(...args);
  expect(run.code, run.stderr).toBe(0);
  return run.stdout;
}

const item = async () => (await client.snapshot(canvas)).canvas.items[itemId]!;
const edit = (...flags: string[]) => isocan("--canvas", canvas, "--json", "edit", itemId, file, ...flags);

describe("isocan edit --if-version", () => {
  it("lands content, title and a property as one act when nothing moved, and one undo takes all of it back", async () => {
    const before = await item();
    await fs.writeFile(file, "# Pulse\n\nweek 41\n");
    const run = await edit("--if-version", before.currentVersionId, "--if-meta", JSON.stringify({ title: before.title, properties: before.properties }), "--title", "Acme pulse — week 41", "--prop", "week=41");
    expect(run.code, run.stderr).toBe(0);
    const said = JSON.parse(run.stdout);
    expect(said).toMatchObject({ status: "applied", itemId, title: "Acme pulse — week 41", properties: { kind: "pulse", week: "41" } });
    const after = await item();
    expect(after.currentVersionId).toBe(said.versionId);
    expect(after.versions).toHaveLength(before.versions.length + 1);
    expect(after.title).toBe("Acme pulse — week 41");

    // One act: a single undo restores the content AND the metadata.
    await ok("--canvas", canvas, "undo");
    const undone = await item();
    expect(undone).toMatchObject({ currentVersionId: before.currentVersionId, title: before.title, properties: before.properties });
    await ok("--canvas", canvas, "redo");
  });

  it("refuses a stale version with its own exit code, writes nothing, and says where the item is now", async () => {
    const before = await item();
    const log = (await client.getLog(canvas, 0)).length;
    const run = await edit("--if-version", "ver_longgone00");
    expect(run.code).toBe(EXIT_CONFLICT);
    expect(JSON.parse(run.stdout)).toMatchObject({ status: "conflict", itemId, currentVersionId: before.currentVersionId, expectedVersionId: "ver_longgone00" });
    expect((await item()).versions).toHaveLength(before.versions.length);
    expect((await client.getLog(canvas, 0)).length, "a refusal is not an op").toBe(log);
  });

  it("refuses when a person renamed the card, even though the version is still the one it read", async () => {
    const read = await item();
    await ok("--canvas", canvas, "set", itemId, "--title", "Dion's pulse");
    const run = await edit("--if-version", read.currentVersionId, "--if-meta", JSON.stringify({ title: read.title, properties: read.properties }));
    expect(run.code).toBe(EXIT_CONFLICT);
    expect(JSON.parse(run.stdout)).toMatchObject({ status: "conflict", title: "Dion's pulse" });
    expect((await item()).versions).toHaveLength(read.versions.length);
    // Without --if-meta the same edit is allowed: the caller asked only about the version.
    expect((await edit("--if-version", read.currentVersionId)).code).toBe(0);
  });

  it("answers a retry under the same op id with what already landed, and applies nothing twice", async () => {
    const before = await item();
    const first = await edit("--if-version", before.currentVersionId, "--op-id", "op_acmeweek42pulse");
    expect(first.code, first.stderr).toBe(0);
    const landed = JSON.parse(first.stdout);
    expect(landed.status).toBe("applied");

    // The connection "dropped": the caller never saw that answer and sends again, unchanged.
    const again = await edit("--if-version", before.currentVersionId, "--op-id", "op_acmeweek42pulse");
    expect(again.code, again.stderr).toBe(0);
    expect(JSON.parse(again.stdout)).toMatchObject({ status: "replayed", versionId: landed.versionId, opId: "op_acmeweek42pulse" });
    expect((await item()).versions, "the retry stacked nothing").toHaveLength(before.versions.length + 1);

    // A NEW op id against the now-stale version is somebody arriving late, and is refused.
    const late = await edit("--if-version", before.currentVersionId, "--op-id", "op_acmeweek43pulse");
    expect(late.code).toBe(EXIT_CONFLICT);
    expect(JSON.parse(late.stdout)).toMatchObject({ status: "conflict", currentVersionId: landed.versionId });
  });

  it("says, in words, that metadata and op ids travel only with a condition — and never edits unconditionally instead", async () => {
    const before = await item();
    for (const flags of [["--title", "Sneaked"], ["--op-id", "op_acmenocondition"], ["--if-meta", "{}"]]) {
      const run = await edit(...flags);
      expect(run.code).not.toBe(0);
      expect(run.stderr).toContain("--if-version");
    }
    const bad = await edit("--if-version", before.currentVersionId, "--op-id", "week-42");
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain("not an op id");
    expect((await item()).versions).toHaveLength(before.versions.length);
  });

  it("an ordinary edit is unchanged: no condition, a new version", async () => {
    const before = await item();
    const said = JSON.parse(await ok("--canvas", canvas, "--json", "edit", itemId, file));
    expect(said).toMatchObject({ itemId, versions: before.versions.length + 1 });
    expect(said.status).toBeUndefined();
  });
});

describe("the conditional edit's own words", () => {
  it("reads --if-meta strictly, because a loose match is a guard that cannot refuse", () => {
    expect(parseExpectedMeta('{"title":"Acme","properties":{"kind":"pulse"}}')).toEqual({ title: "Acme", properties: { kind: "pulse" } });
    expect(() => parseExpectedMeta("not json")).toThrow("not JSON");
    expect(() => parseExpectedMeta('{"title":"Acme"}')).toThrow("properties");
    expect(() => parseExpectedMeta('{"title":"Acme","properties":{"n":1}}')).toThrow('"n"');
    expect(() => parseOpId("op_x")).toThrow("not an op id");
    expect(parseOpId("op_acmeweek42pulse")).toBe("op_acmeweek42pulse");
  });

  it("names what moved, and tells an older home from a conflict", () => {
    const card = { id: "itm_acme", title: "Acme", properties: { kind: "pulse" }, currentVersionId: "ver_now" } as never;
    expect(staleBeforeSending(card, "ver_now")).toBeNull();
    expect(staleBeforeSending(card, "ver_then")).toContain("ver_now");
    expect(staleBeforeSending(card, "ver_now", { title: "Other", properties: { kind: "pulse" } })).toContain("title");
    expect(staleBeforeSending(card, "ver_now", { title: "Acme", properties: {} })).toContain('"kind"');
    expect(conditionalEditSentence({ status: "unsupported", itemId: "itm_acme", reason: "this home does not know conditional edits" })).toContain("no unconditional edit was tried");
    expect(EXIT_CONFLICT).not.toBe(EXIT_UNSUPPORTED);
    // A replay is recognised by the version that landed not being the one this send carried.
    const response = { seq: 7, envelope: { op: { type: "item.edit", version: { id: "ver_first" } } } } as never;
    expect(appliedResult(response, card, "ver_second", "op_acmeweek42pulse").status).toBe("replayed");
    expect(appliedResult(response, card, "ver_first", "op_acmeweek42pulse").status).toBe("applied");
  });
});
