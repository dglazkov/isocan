import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

const alice = { id: "usr_alice", name: "Alice" };

let home: string;
let root: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

/** The app's gesture: a path typed into the files pane. */
async function bind(dir: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}/api/projects/prj_1/bind`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ path: dir }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-bindhome-"));
  root = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-bind-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(alice);
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: alice,
      op: { type: "project.create", canvasId: "prj_1", title: "P" },
    }),
  });
  expect(res.status).toBe(200);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(root, { recursive: true, force: true });
});

/**
 * **Binding a directory from the app** — what `isocan use` does, asked for by
 * a browser that cannot name a directory itself (a `FileSystemHandle` exposes
 * `kind` and `name` and never a path, by design). So the browser asks and the
 * daemon does, and every refusal names its own rule: this route is
 * loopback-only and owner-scoped, the caller is the person who typed the
 * path, and "which no was that" is the whole of what they need to fix it.
 */
describe("binding a directory over HTTP", () => {
  it("refuses a path that is not there, and says which path", async () => {
    const res = await bind(path.join(root, "nowhere-at-all"));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("no-such-dir");
    expect(res.body.error).toContain("nowhere-at-all");
  });

  it("refuses a file, and points at the directory holding it", async () => {
    await fs.writeFile(path.join(root, "notes.md"), "hi");
    const res = await bind(path.join(root, "notes.md"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("not-a-dir");
  });

  it("refuses the home directory, which would claim every canvas under it", async () => {
    const res = await bind(os.homedir());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("unbindable");
  });

  it("refuses a directory that already belongs to another canvas, by name", async () => {
    const other = path.join(root, "someone-elses");
    await fs.mkdir(path.join(other, ".isocan"), { recursive: true });
    await fs.writeFile(
      path.join(other, ".isocan", "project.json"),
      JSON.stringify({ projectId: "prj_other", title: "Acme Board" }),
    );
    const res = await bind(other);
    // A click is a cheaper gesture than a typed command, so the mistake is
    // cheaper to make: the CLI overwrites here and this refuses.
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("bound-elsewhere");
    expect(res.body.error).toContain("Acme Board");
  });

  it("binds a fresh directory, writing the marker the CLI writes", async () => {
    const target = path.join(root, "fresh");
    await fs.mkdir(target, { recursive: true });
    const res = await bind(target);
    expect(res.status).toBe(200);
    expect(res.body.adopted).toBe(false);
    // The marker is the authoritative half and it travels with the directory
    // — it is what a teammate cloning the repo gets.
    const marker = JSON.parse(
      await fs.readFile(path.join(target, ".isocan", "project.json"), "utf8"),
    ) as { projectId: string };
    expect(marker.projectId).toBe("prj_1");
    // And the tree route, which was refusing a moment ago, now answers.
    const tree = await fetch(`${base}/api/projects/prj_1/tree`, { headers: badge.headers });
    expect(tree.status).toBe(200);
  });

  it("adopts a directory whose marker already names this canvas", async () => {
    // The clone case: the marker rode in with the repo, and all this machine
    // is missing is the roster row. Not a refusal — the answer is yes.
    const clone = path.join(root, "cloned");
    await fs.mkdir(path.join(clone, ".isocan"), { recursive: true });
    await fs.writeFile(
      path.join(clone, ".isocan", "project.json"),
      JSON.stringify({ projectId: "prj_1", title: "P" }),
    );
    const res = await bind(clone);
    expect(res.status).toBe(200);
    expect(res.body.adopted).toBe(true);
  });
});
