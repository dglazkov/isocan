import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import {
  HOME_JOIN_ROUTE,
  INSTALL_SPEC,
  RENAMED_WIRE_KEYS,
  staleClientRefusal,
  STALE_CLIENT_CODE,
  STALE_CLIENT_STATUS,
  WS_CLOSE_REASON_BYTES,
  WS_STALE_CLIENT,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The break, saying what it is** (phase 13.5).
 *
 * `projectId` became `canvasId` on the wire, in persisted JSON, in the socket's
 * query string. That was taken as a BREAK on purpose — three people use this
 * and launch has not happened, so a compat shim would be permanent scaffolding
 * around a week of inconvenience. What was NOT on purpose is how it announced
 * itself: measured against this build, a pre-rename CLI can still READ (a GET
 * carries its canvas in the path, and paths did not change) and dies on its
 * first WRITE with
 *
 *     error: internal error
 *
 * which is this codebase's oldest recurring failure — an unreadable answer to a
 * knowable condition — and leaves the person holding it no way to reach the
 * one-line fix.
 *
 * So these are about the SENTENCE, not the policy. Every case asserts a status,
 * a branchable code, and that the words name the command that fixes it; and one
 * case asserts the opposite, because a version story told about every malformed
 * request is worse than `internal error` — it is confidently wrong.
 */

/** Somebody for a fixture canvas to belong to. */
const usrA = { id: "usr_a", name: "A" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-stale-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(usrA);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

const post = async (route: string, body: unknown) => {
  const res = await fetch(`${base}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as { error?: string; code?: string } | null };
};

/** The canvas a modern client makes, for the cases about ops on one. */
async function seedCanvas(canvasId = "prj_acme"): Promise<string> {
  const { status } = await post("/api/ops", {
    canvasId: null,
    actor: usrA,
    op: { type: "project.create", canvasId, title: "Acme" },
  });
  expect(status).toBe(200);
  return canvasId;
}

/**
 * What the refusal must SAY, asserted the same way everywhere: the cause named
 * in both spellings, and the remedy as a runnable command built from
 * `INSTALL_SPEC` rather than typed here — a command string written out by hand
 * is a copy that ages, and `test/packaging.test.ts` greps for exactly that.
 */
function readsAsAnUpgradeNotice(text: string): void {
  expect(text).toContain("canvasId");
  expect(text).toContain("projectId");
  expect(text).toContain(`npx ${INSTALL_SPEC} setup`);
}

describe("a client older than this home is told so", () => {
  it("refuses a pre-rename write on /api/ops with the command that fixes it", async () => {
    const canvasId = await seedCanvas();
    // The shape a pre-rename CLI puts on the wire for any ordinary write: the
    // key it was built to send, and nothing named `canvasId` anywhere.
    const { status, body } = await post("/api/ops", {
      projectId: canvasId,
      actor: usrA,
      op: { type: "project.update", patch: { title: "Acme renamed" } },
    });
    expect(status).toBe(STALE_CLIENT_STATUS);
    expect(status).toBe(426);
    expect(body!.code).toBe(STALE_CLIENT_CODE);
    readsAsAnUpgradeNotice(body!.error!);
    // The failure this replaces, gone: never the generic 500, whose body is
    // `internal error` and whose message belongs to us rather than to them.
    expect(body!.error).not.toContain("internal error");
  });

  it("refuses a pre-rename project.create, whose id rides INSIDE the op", async () => {
    // The one op that carries a canvas id in the operation itself, so a
    // pre-rename create is stale in two places at once: `{projectId: null}`
    // outside (which is literally what the old CLI posts) and `projectId`
    // within. Checking only the outer key would still catch this one; checking
    // only the inner would not catch the case above. Both are checked.
    const { status, body } = await post("/api/ops", {
      projectId: null,
      actor: usrA,
      op: { type: "project.create", projectId: "prj_old", title: "Acme" },
    });
    expect(status).toBe(STALE_CLIENT_STATUS);
    expect(body!.code).toBe(STALE_CLIENT_CODE);
    readsAsAnUpgradeNotice(body!.error!);

    // And with the outer key OMITTED rather than sent as null, which is what
    // any client that builds its body conditionally produces (`...(id ? {id} :
    // {})`, or a serializer that drops nulls). The only evidence left is then
    // inside the op, and without the nested check this request has nothing
    // stale about it and falls through to whatever the reducer does with a
    // canvas nobody named.
    const nested = await post("/api/ops", {
      actor: usrA,
      op: { type: "project.create", projectId: "prj_old", title: "Acme" },
    });
    expect(nested.status).toBe(STALE_CLIENT_STATUS);
    expect(nested.body!.code).toBe(STALE_CLIENT_CODE);
    readsAsAnUpgradeNotice(nested.body!.error!);
  });

  it("refuses a pre-rename REPLICA at the join route, where nobody is watching", async () => {
    // The worse blast radius: the caller here is a daemon, not a person, so
    // the refusal is read by no one at the moment it happens and the symptom
    // is a canvas that simply never arrives. It still has to be legible —
    // somebody eventually reads a log.
    const { status, body } = await post(HOME_JOIN_ROUTE, { projectId: "prj_acme" });
    expect(status).toBe(STALE_CLIENT_STATUS);
    expect(body!.code).toBe(STALE_CLIENT_CODE);
    readsAsAnUpgradeNotice(body!.error!);
  });

  it("closes a pre-rename socket with 4426 and the same sentence, shortened", async () => {
    await seedCanvas();
    const ws = new WebSocket(`${base.replace("http", "ws")}/ws?projectId=prj_acme`, {
      headers: badge.headers,
    });
    ws.on("error", () => {});
    const closed = await new Promise<{ code: number; reason: string }>((resolve) =>
      ws.on("close", (code, reason) => resolve({ code, reason: String(reason) })),
    );
    expect(closed.code).toBe(WS_STALE_CLIENT);
    readsAsAnUpgradeNotice(closed.reason);
  });

  it("keeps every close reason inside the 123 bytes a socket allows", () => {
    // Not a style point: `ws.close()` THROWS on a longer reason, so a refusal
    // that outgrew the cap would replace a legible close with a crash in the
    // upgrade handler. The list is closed, so every member of it is measured
    // rather than the one that happens to be used above.
    for (const [now, before] of RENAMED_WIRE_KEYS) {
      const stale = staleClientRefusal({ [before]: "x" });
      expect(stale, `${before} → ${now} is not detected`).not.toBeNull();
      expect(Buffer.byteLength(stale!.closeReason, "utf8"), stale!.closeReason).toBeLessThanOrEqual(
        WS_CLOSE_REASON_BYTES,
      );
    }
  });
});

describe("and everybody else is answered as they always were", () => {
  it("leaves a request carrying NEITHER key with its original refusal", async () => {
    // The line this must not cross. "The new key is absent" alone describes
    // every malformed request in the product; only "absent AND the old one is
    // present" describes a stale client. Sniffing the first would relabel a
    // missing field as a version problem — a confident lie, which is a worse
    // failure than the vague one this whole change exists to remove.
    const noActor = await post("/api/ops", {
      canvasId: "prj_acme",
      op: { type: "project.update", patch: { title: "Acme renamed" } },
    });
    expect(noActor.status).toBe(400);
    expect(noActor.body!.code).toBe("bad-op");
    expect(noActor.body!.error).toContain("actor is required");
    expect(noActor.body!.error).not.toContain(INSTALL_SPEC);

    const emptyJoin = await post(HOME_JOIN_ROUTE, {});
    expect(emptyJoin.status).toBe(400);
    expect(emptyJoin.body!.error).toContain("canvasId is required");
    expect(emptyJoin.body!.error).not.toContain(INSTALL_SPEC);

    const ws = new WebSocket(`${base.replace("http", "ws")}/ws`, { headers: badge.headers });
    ws.on("error", () => {});
    const code = await new Promise<number>((resolve) => ws.on("close", resolve));
    expect(code).toBe(4400);
  });

  it("leaves a correct modern request alone, on every surface it guards", async () => {
    const canvasId = await seedCanvas(); // /api/ops, and `canvasId: null` on it
    const added = await post("/api/ops", {
      canvasId,
      actor: usrA,
      op: { type: "project.update", patch: { title: "Acme renamed" } },
    });
    expect(added.status).toBe(200);

    // The join route on a home: refused for being a home, which is its own
    // answer and not the upgrade one.
    const join = await post(HOME_JOIN_ROUTE, { canvasId });
    expect(join.status).toBe(409);
    expect(join.body!.code).toBe("not-a-replica");

    const ws = new WebSocket(`${base.replace("http", "ws")}/ws?canvasId=${canvasId}`, {
      headers: badge.headers,
    });
    const hello = await new Promise<string>((resolve, reject) => {
      ws.on("message", (data) => resolve(String(data)));
      ws.on("error", reject);
    });
    expect(JSON.parse(hello).type).toBe("snapshot");
    ws.close();
  });
});
