import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPanelExtension, type CanvasContents } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **Panels, over the wire** (`docs/projects/extensions/phases.md`, phase 3).
 *
 * The manifest rules are core's and tested there. What needs a daemon is the
 * claim the design actually makes about the CLI: a panel is an ORDINARY ITEM,
 * so it needs no new operation, no new route and no new store — and the two
 * ceremonies it does have (read before add, and `src` naming a page that is
 * really here) work against a real home rather than a fixture.
 *
 * **One reader, and the refusals below prove it rather than assert it.** The
 * expected sentence is not written out here: it is asked of
 * `readPanelExtension`, the same function the app calls, and the CLI's stderr
 * has to contain it. A second little parser in `main.ts` would fail this file
 * even if its wording were better, which is the point — a manifest the
 * terminal refuses must be one the dock refuses, for the same reason and in
 * the same words.
 *
 * **Three cases, and the count is the budget.** Every case here spawns the
 * binary five or six times at about a second each, and `test/deep.ts` keeps
 * this file in the fast lane only while it stays under ten seconds — so what
 * belongs in core's tests stays there. A fourth case would buy a rule that is
 * already proven and cost the ordinary run the guard that the verb still runs
 * at all.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-panels-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...nico, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (c) => (stdout += c));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (c) => (stderr += c));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

const review = { kind: "panel", title: "Acme Review", side: "left", src: "review.html" };

/** An empty canvas, for asking core the same question the CLI asks. A src
 * that names nothing is refused the same way on a canvas with no items and on
 * one with the wrong ones — which is why this is enough to pin the sentence. */
const nothingHere: CanvasContents = { items: {}, threads: {}, trash: [] };

async function manifest(body: unknown, name = "panel.json"): Promise<string> {
  const file = path.join(home, name);
  await fs.writeFile(file, JSON.stringify(body));
  return file;
}

/** The page itself, put on the canvas the ordinary way first — which is the
 * order a person works in, and the reason `src` can name it at all. */
async function addPage(name = "review.html"): Promise<void> {
  const file = path.join(home, name);
  await fs.writeFile(file, "<!doctype html><title>Acme</title><p>A review of nothing in particular.");
  const added = await isocan("add", file);
  expect(added.code, added.stderr).toBe(0);
}

describe("a panel in the dock", () => {
  it("reads before it adds, adds an ordinary item, and gives it back with rm", async () => {
    const made = await isocan("canvas", "create", "Board");
    expect(made.code, made.stderr).toBe(0);
    await addPage();
    const file = await manifest(review);

    // The ceremony: printed, and NOTHING added, until --yes. Same gate
    // `tool add` and `command add --from` have — what it may do gets answered
    // before it lands.
    const shown = await json("panel", "add", file);
    expect(shown.added).toBe(false);
    expect(shown.can.join("\n"), "the capability list is derived and shown").toContain("review.html");
    expect(shown.can.join("\n"), "and honest about the phase it is in").toContain("cannot run yet");
    expect(await json("panel", "list"), "nothing was added").toEqual([]);

    const added = await json("panel", "add", file, "--yes");
    expect(added.added).toBe(true);
    expect(added.title).toBe("Acme Review");
    // Resolved to the page on this canvas, not to anything the manifest said.
    expect(added.bytes.itemId).toBeTruthy();

    // An ORDINARY ITEM: `ls` sees it with no knowledge of panels at all,
    // which is the design's claim that this needed no new op, route or store.
    const items = await json("ls");
    const found = items.find((i: any) => i.id === added.itemId);
    expect(found, "a panel is not visible as an item").toBeTruthy();
    expect(found.properties.role).toBe("panel");

    const listed = await json("panel", "list");
    expect(listed).toHaveLength(1);
    expect(listed[0].src).toBe("review.html");
    expect(listed[0].side).toBe("left");
    expect(listed[0].can.join("\n")).toContain("cannot send an operation");

    // Removal has no verb of its own: it is an item, so `rm` takes it out of
    // the dock and the trash gives it back.
    const gone = await isocan("rm", added.itemId);
    expect(gone.code, gone.stderr).toBe(0);
    expect(await json("panel", "list")).toEqual([]);
  }, 60_000);

  it("refuses a src that is not a blob on this canvas, in the app's own words", async () => {
    await isocan("canvas", "create", "Board");
    // The rule the hosted tier turns on: no reading past the canvas it is on.
    // Nobody here ever added `elsewhere.html`.
    const bad = { ...review, src: "elsewhere.html" };
    const run = await isocan("panel", "add", await manifest(bad, "bad.json"), "--yes");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain("src");

    // THE SAME SENTENCE, from the same function the app reads with — asked
    // rather than transcribed, so a second parser on either surface fails here.
    const { problem } = readPanelExtension(JSON.stringify(bad), nothingHere);
    expect(problem).toBeTruthy();
    expect(run.stderr).toContain(problem!);

    // Read before anything was uploaded, so the refusal left nothing behind.
    expect(await json("panel", "list"), "a refused panel left something behind").toEqual([]);
  }, 60_000);

  it("refuses the app's own name with punctuation and case flattened", async () => {
    await isocan("canvas", "create", "Board");
    // "I S O C A N" and "isocan" are ONE attempt. A panel that looks exactly
    // like isocan is where somebody would put a convincing "sign in to
    // continue", so the check has to catch the spelling as well as the string.
    // No page is needed: the name is refused before `src` is ever looked up,
    // which is itself the right order — the impersonation is the worse fault.
    for (const [title, name] of [["isocan", "a.json"], ["I S O C A N", "b.json"]] as const) {
      const run = await isocan("panel", "add", await manifest({ ...review, title }, name), "--yes");
      expect(run.code, `"${title}" was accepted`).not.toBe(0);
      expect(run.stderr).toContain("sign in to continue");
    }
  }, 60_000);
});
