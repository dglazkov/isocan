import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient } from "@isocan/api";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan diff` against a real daemon** (docs/projects/version-diff/design.md).
 *
 * An item seeded with two versions through the binary, then diffed by the
 * default pair, by named versions, and a variation against its source —
 * and the log read before and after, because a diff that wrote anything
 * would be a read that could be undone, which is a bug with a shape.
 *
 * Synthetic: Acme's pricing page.
 */

const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-diff-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...acme, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  client = new DaemonClient(`http://127.0.0.1:${port}`, home);
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

const V1 = `<!doctype html><html><body><h1>Pricing</h1><div class="card">Basic</div><div class="card">Pro</div></body></html>`;
const V2 = `<!doctype html><html><body><h1>Plans</h1><div class="card">Basic</div><div class="card">Team</div><div class="card">Pro</div></body></html>`;

describe("isocan diff", () => {
  it("says what the last edit did, by default and by name, and writes nothing", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme diff")).canvasId;
    const file = path.join(home, "pricing.html");
    await fs.writeFile(file, V1);
    const itemId = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme pricing")).itemId;
    await fs.writeFile(file, V2);
    await ok("--canvas", canvas, "edit", itemId, file);
    const variant = path.join(home, "bold.html");
    await fs.writeFile(variant, V2.replace("<h1>", '<h1 class="bold">'));
    const boldId = JSON.parse(await ok("--canvas", canvas, "--json", "add", variant, "--title", "Acme bold", "--prop", `parent=${itemId}`)).itemId;

    const before = (await client.getLog(canvas, 0)).length;

    const text = await ok("--canvas", canvas, "diff", itemId);
    const lines = text.trim().split("\n");
    expect(lines[0]).toBe('"Acme pricing" v1 → v2');
    expect(lines[1]).toBe("1 element added, 1 changed: the “Pricing” heading: “Pricing” → “Plans”; added a “Team” block");
    expect(text).toContain("+ added a “Team” block  [html/body[1]/div[2]]");

    // Named versions, backwards, as JSON: the structured diff, the same engine.
    const json = JSON.parse(await ok("--canvas", canvas, "--json", "diff", itemId, "v2", "v1"));
    expect(json).toMatchObject({ itemId, kind: "html", counts: { removed: 1, changed: 1 } });
    expect(json.changes.map((c: { what: string }) => c.what)).toContain("removed a “Team” block");

    // A variation against the screen it was made from: the pair `choose` decides.
    const source = await ok("--canvas", canvas, "diff", boldId, "--source");
    expect(source).toContain('"Acme pricing" v2 → "Acme bold" v1');
    expect(source).toContain("the “Plans” heading: class now .bold");

    // Reading is not writing.
    expect((await client.getLog(canvas, 0)).length).toBe(before);
  });

  it("refuses with a reason", async () => {
    const canvas = JSON.parse(await ok("--json", "canvas", "create", "Acme refusals")).canvasId;
    const file = path.join(home, "lone.md");
    await fs.writeFile(file, "# Acme\n");
    const lone = JSON.parse(await ok("--canvas", canvas, "--json", "add", file, "--title", "Acme lone")).itemId;
    const one = await isocan("--canvas", canvas, "diff", lone);
    expect(one.code).toBe(1);
    expect(one.stderr).toContain("has one version");
    const missing = await isocan("--canvas", canvas, "diff", lone, "v9", "v1");
    expect(missing.stderr).toContain('no version "v9"');
  });
});
