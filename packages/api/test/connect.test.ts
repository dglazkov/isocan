import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { newCanvasId } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { ApiError, DaemonClient, connect, harnessVars } from "@isocan/api";

/**
 * **`connect()`, held to what journey 1 forces** (iso-api phase 2): the same
 * resolution as the CLI against a real daemon — identity as a parameter,
 * canvases open by ref, content as values, ops returning what they made, and
 * errors as types. No mocks: the daemon is the house's own, started the way
 * every CLI test starts one, because the surface under test is precisely "the
 * CLI's middle layer, callable".
 */

const sha256 = (text: string) => createHash("sha256").update(Buffer.from(text)).digest("hex");

let home: string;
let work: string;
let daemon: Daemon;
let port: number;
let base: string;
let cwdBefore: string;
const saved: Record<string, string | undefined> = {};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-connect-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-connect-work-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  // `connect()` resolves from the directory and the environment, exactly as
  // the CLI does — so the test controls both: a scratch home, a scratch cwd
  // with no marker, and no harness session unless a test states one.
  saved.ISOCAN_HOME = process.env.ISOCAN_HOME;
  process.env.ISOCAN_HOME = home;
  for (const v of harnessVars) {
    saved[v] = process.env[v];
    delete process.env[v];
  }
  saved.ISOCAN_DIRECT = process.env.ISOCAN_DIRECT;
  delete process.env.ISOCAN_DIRECT;
  cwdBefore = process.cwd();
  process.chdir(work);
});

afterEach(async () => {
  process.chdir(cwdBefore);
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await daemon.close().catch(() => {});
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

/** An actor claimed under a stated session key, the way a script's identity
 * is prepared: `isocan identity --name … --session` with the key exported. */
async function claim(session: string, harness: string, name: string): Promise<void> {
  const client = new DaemonClient(base, home);
  await client.claimActor({
    type: "actor.claim",
    sessionKey: `${harness}:${session}`,
    name,
  });
}

describe("connect()", () => {
  it("refuses a harness-less environment with a reason, and never prompts", async () => {
    // No session in the environment, no home identity in the scratch home:
    // the settled door (phases.md, Deliberately open) — refuse, don't mint.
    await expect(connect({ port })).rejects.toThrow(/no identity/);
  });

  it("an explicit identity that nobody claimed is refused with the claim gesture", async () => {
    await expect(
      connect({ port, identity: { session: "acme-board", harness: "acme" } }),
    ).rejects.toThrow(/isocan identity .*--session/);
  });

  it("an explicit identity resolves to the claimed actor — the same actor the CLI's key resolves", async () => {
    await claim("acme-board", "acme", "Roster");
    const home1 = await connect({ port, identity: { session: "acme-board", harness: "acme" } });
    expect(home1.actor.name).toBe("Roster");
    // The stated identity never falls back to the machine's person, and the
    // resolution records which harness stated it, as the ambient walk would.
    expect(home1.ctx.harness).toBe("acme");
  });

  it("canvases open by ref off one connection, and the only canvas is the default reach", async () => {
    await claim("acme-board", "acme", "Roster");
    const h = await connect({ port, identity: { session: "acme-board", harness: "acme" } });
    const canvasId = newCanvasId();
    await h.ctx.client.sendOp(null, h.actor, {
      type: "project.create",
      canvasId,
      title: "Acme Panels",
    });
    // By id, by unique title prefix (--canvas's own matching), and by default.
    expect((await h.canvas(canvasId)).id).toBe(canvasId);
    expect((await h.canvas("acme p")).id).toBe(canvasId);
    expect((await h.canvas()).id).toBe(canvasId);
    await expect(h.canvas("nothing-here")).rejects.toThrow(/no canvas matches/);
  });

  it("content goes in as a value and the op returns what it made — version, blobHash, place", async () => {
    await claim("acme-board", "acme", "Roster");
    const h = await connect({ port, identity: { session: "acme-board", harness: "acme" } });
    const canvasId = newCanvasId();
    await h.ctx.client.sendOp(null, h.actor, {
      type: "project.create",
      canvasId,
      title: "Acme Panels",
    });
    const canvas = await h.canvas(canvasId);

    const html = "<h1>green</h1>";
    const made = await canvas.add({
      title: "Build",
      content: html,
      mime: "text/html",
      at: { x: 10, y: 20 },
      size: { width: 300, height: 200 },
      properties: { board: "build" },
    });
    // The call that created it hands it back: the no-op check a publisher
    // runs next time needs nothing but this return.
    expect(made.versions).toHaveLength(1);
    expect(made.versions[0]!.blobHash).toBe(sha256(html));
    expect(made.versions[0]!.mimeType).toBe("text/html");
    // The filename defaulted from the title and the mime, core's own spelling.
    expect(made.versions[0]!.filename).toBe("build.html");
    expect(made.currentVersionId).toBe(made.versions[0]!.id);
    expect([made.x, made.y, made.width, made.height]).toEqual([10, 20, 300, 200]);
    expect(made.properties.board).toBe("build");

    // A new version from a value, mime and filename inherited from the one
    // it succeeds — and the grown stack comes back.
    const edited = await canvas.edit(made.id, { content: "<h1>red</h1>" });
    expect(edited.versions).toHaveLength(2);
    expect(edited.currentVersionId).toBe(edited.versions[1]!.id);
    expect(edited.versions[1]!.blobHash).toBe(sha256("<h1>red</h1>"));
    expect(edited.versions[1]!.filename).toBe("build.html");

    // The slice of `set` and `move` a publisher reaches for, read back from
    // the store rather than trusted.
    await canvas.set(made.id, { properties: { note: "adopted" }, size: { width: 400, height: 220 } });
    await canvas.move(made.id, 50, 60);
    const listed = await canvas.items();
    const after = listed.find((i) => i.id === made.id)!;
    expect(after.properties).toMatchObject({ board: "build", note: "adopted" });
    expect([after.x, after.y, after.width, after.height]).toEqual([50, 60, 400, 220]);
    expect(after.kind).toBe("screen");
  });

  it("unreachable is a typed refusal, not a stack trace", async () => {
    await claim("acme-board", "acme", "Roster");
    const h = await connect({ port, identity: { session: "acme-board", harness: "acme" } });
    const canvasId = newCanvasId();
    await h.ctx.client.sendOp(null, h.actor, {
      type: "project.create",
      canvasId,
      title: "Acme Panels",
    });
    const canvas = await h.canvas(canvasId);
    await daemon.close();
    const refusal = await canvas.items().then(
      () => null,
      (err: unknown) => err,
    );
    expect(refusal).toBeInstanceOf(ApiError);
    expect((refusal as ApiError).code).toBe("unreachable");
    // "Unreachable is not empty" needs a sentence a panel can print.
    expect((refusal as ApiError).message).toContain(base);
  });
});
