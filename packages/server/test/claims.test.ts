import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ActorClaimOp } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import * as p from "../src/paths.ts";

/**
 * actor.claim at the single writer (#57). Naming yourself is an operation:
 * atomic (two claimants serialize), allocating (the daemon hands out the next
 * free name), idempotent (the same key gets the same actor back), and logged.
 */

let home: string;
let daemon: Daemon;
let base: string;
let port: number;
/** One badge for the whole file: a machine has one, and its claims are the
 * agents on it. Two agents on one machine are two claims under one badge,
 * which is exactly the shape the re-key is for. */
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-claims-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  badge = await mintTestBadge(base);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function claim(
  op: Omit<ActorClaimOp, "type">,
): Promise<{ status: number; actor?: { id: string; name: string }; error?: string; code?: string }> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ projectId: null, op: { type: "actor.claim", ...op } }),
  });
  const json = (await res.json().catch(() => null)) as any;
  return res.ok
    ? { status: res.status, actor: json.envelope.actor }
    : { status: res.status, error: json?.error, code: json?.code };
}

describe("atomic allocation", () => {
  it("two simultaneous claims of one name cannot both win", async () => {
    // The race heldNames() could never close: both pass a client-side check
    // in the same second. At the single writer, one of them is second.
    const [a, b] = await Promise.all([
      claim({ sessionKey: "claude-code:s-1", name: "Kenny" }),
      claim({ sessionKey: "codex:s-2", name: "Kenny" }),
    ]);
    const wins = [a, b].filter((r) => r.status === 200);
    const losses = [a, b].filter((r) => r.status === 400);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]!.code).toBe("name-taken");
  });

  it("two nameless claims are handed two different names", async () => {
    const [a, b] = await Promise.all([
      claim({ sessionKey: "claude-code:s-1" }),
      claim({ sessionKey: "codex:s-2" }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.actor!.name).not.toBe(b.actor!.name);
    expect(["Isaac", "Kenny"]).toContain(a.actor!.name);
    expect(["Isaac", "Kenny"]).toContain(b.actor!.name);
  });
});

describe("a key is an agent", () => {
  it("re-claiming is being told who you already are", async () => {
    const first = await claim({ sessionKey: "claude-code:s-1", name: "Kenny" });
    const again = await claim({ sessionKey: "claude-code:s-1" });
    expect(again.actor).toEqual(first.actor);
  });

  it("renaming keeps the id — the history stays yours", async () => {
    const first = await claim({ sessionKey: "claude-code:s-1", name: "Kenny" });
    const renamed = await claim({ sessionKey: "claude-code:s-1", name: "Kenny the Second" });
    expect(renamed.actor!.id).toBe(first.actor!.id);
    expect(renamed.actor!.name).toBe("Kenny the Second");
  });

  it("fresh mints a second wearer of the name on purpose", async () => {
    const first = await claim({ sessionKey: "claude-code:s-1", name: "Kenny" });
    const second = await claim({ sessionKey: "codex:s-2", name: "Kenny", fresh: true });
    expect(second.status).toBe(200);
    expect(second.actor!.id).not.toBe(first.actor!.id);
  });
});

describe("reincarnation is deliberate", () => {
  it("`as` binds a new key to an old actor and unseats the dead session", async () => {
    const first = await claim({ sessionKey: "claude-code:s-1", name: "Kenny" });
    // Age the binding out of the claim-stands window by editing the DESK's
    // snapshot under a stopped daemon — which also proves the claims table
    // survives one. The claim moved out of `actors.json` and onto the badge;
    // what is asserted below did not move.
    await daemon.close();
    const file = p.badgesFile(home);
    const desk = JSON.parse(await fs.readFile(file, "utf8"));
    const rows = desk.badges[badge.badgeId].claims as { sessionKey: string; boundAt: string }[];
    rows.find((row) => row.sessionKey === "claude-code:s-1")!.boundAt = new Date(
      Date.now() - 60 * 60 * 1000,
    ).toISOString();
    await fs.writeFile(file, JSON.stringify(desk));
    daemon = await startDaemon({ port, home });

    const back = await claim({ sessionKey: "claude-code:s-9", as: first.actor!.id });
    expect(back.status).toBe(200);
    expect(back.actor).toEqual(first.actor);

    const bindings = (await (
      await fetch(`${base}/api/actors`, { headers: badge.headers })
    ).json()) as { key: string }[];
    expect(bindings.map((b) => b.key)).toEqual(["claude-code:s-9"]);
  });

  it("`as` is refused while the actor was claimed moments ago", async () => {
    const first = await claim({ sessionKey: "claude-code:s-1", name: "Kenny" });
    const steal = await claim({ sessionKey: "claude-code:s-9", as: first.actor!.id });
    expect(steal.status).toBe(400);
    expect(steal.code).toBe("name-taken");
  });

  it("`as` for an actor nobody has heard of needs a name", async () => {
    const lost = await claim({ sessionKey: "claude-code:s-9", as: "usr_stranded" });
    expect(lost.status).toBe(400);
    expect(lost.code).toBe("unknown-actor");
    // With one, it imports the actor — how a stranded identity file migrates.
    const brought = await claim({ sessionKey: "claude-code:s-9", as: "usr_stranded", name: "Osian" });
    expect(brought.status).toBe(200);
    expect(brought.actor).toEqual({ id: "usr_stranded", name: "Osian" });
  });
});

describe("the registry is logged and recoverable", () => {
  it("replays the jsonl tail when the snapshot is missing", async () => {
    const first = await claim({ sessionKey: "claude-code:s-1", name: "Kenny" });
    await daemon.close();
    await fs.rm(p.actorsFile(home)); // lose the snapshot, keep the log
    daemon = await startDaemon({ port, home });

    const again = await claim({ sessionKey: "claude-code:s-1" });
    expect(again.actor).toEqual(first.actor); // recovered from actors.jsonl
  });

  it("claims are not canvas ops and cannot arrive with a projectId actor path", async () => {
    // Submitting through the canvas door is refused: the engine's claim()
    // is the one way in, and /api/ops routes there by op type.
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        projectId: null,
        actor: { id: "usr_x", name: "X" },
        op: { type: "project.create", projectId: "prj_1", title: "P" },
      }),
    });
    expect(res.status).toBe(200); // ordinary ops still flow

    const noActor = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ projectId: "prj_1", op: { type: "trash.empty" } }),
    });
    expect(noActor.status).toBe(400); // everything but a claim still needs an actor
  });
});
