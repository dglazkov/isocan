import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { PresenceSession, ServerMessage } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { PresenceHub, opLocus } from "../src/presence.ts";
import { emptyCanvas } from "@isocan/core";

const alice = { id: "usr_alice", name: "Alice" };
const kenny = { id: "usr_kenny", name: "Kenny" };

describe("PresenceHub", () => {
  it("creates, touches, ends, and expires sessions", () => {
    const hub = new PresenceHub(1000);
    const session = hub.createSession("prj", kenny, "cli", { label: "Kenny 🤖" });
    expect(hub.roster("prj")).toHaveLength(1);
    expect(hub.touch("prj", session.sessionId, { cursor: { x: 5, y: 6 }, status: "reading" })).toBe(
      true,
    );
    const [state] = hub.roster("prj");
    expect(state!.cursor).toEqual({ x: 5, y: 6 });
    expect(state!.status).toBe("reading");
    expect(state!.label).toBe("Kenny 🤖");

    hub.endSession("prj", session.sessionId);
    expect(hub.roster("prj")).toEqual([]);
    expect(hub.touch("prj", session.sessionId, {})).toBe(false);
    hub.close();
  });

  it("opLocus maps ops to canvas positions", () => {
    const canvas = {
      ...emptyCanvas(),
      items: {
        itm_1: {
          id: "itm_1", x: 100, y: 200, width: 50, height: 30,
          title: "", description: "", properties: {},
          versions: [], currentVersionId: "v",
          createdAt: "", createdBy: alice, updatedAt: "", updatedBy: alice,
        },
      },
    };
    expect(opLocus({ type: "item.move", itemId: "itm_1", x: 0, y: 0 }, canvas)).toEqual({
      x: 125, y: 215,
    });
    expect(
      opLocus(
        { type: "thread.create", threadId: "t", x: 10, y: 20, anchorItemId: "itm_1", comment: { id: "c", body: "x" } },
        canvas,
      ),
    ).toEqual({ x: 110, y: 220 });
    expect(opLocus({ type: "trash.empty" }, canvas)).toBeNull();
  });
});

describe("presence over the daemon", () => {
  let home: string;
  let daemon: Daemon;
  let base: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-presence-"));
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    await post("/api/ops", {
      projectId: null,
      actor: alice,
      op: { type: "project.create", projectId: "prj_1", title: "P" },
    });
    await post("/api/ops", {
      projectId: "prj_1",
      actor: alice,
      op: {
        type: "item.add",
        itemId: "itm_1",
        version: { id: "v1", blobHash: "h", mimeType: "text/markdown", filename: "a.md", size: 1 },
        width: 100,
        height: 60,
        placement: { x: 500, y: 300 },
      },
    });
  });

  afterEach(async () => {
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true });
  });

  async function post(url: string, body: unknown) {
    const res = await fetch(`${base}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  }

  async function until(fn: () => boolean, ms = 2000): Promise<void> {
    const start = Date.now();
    while (!fn()) {
      if (Date.now() - start > ms) throw new Error("timed out");
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  it("CLI session lifecycle + op piggyback + who", async () => {
    const created = await post("/api/projects/prj_1/sessions", { actor: kenny, label: "Kenny" });
    expect(created.status).toBe(200);
    const sid = created.json.sessionId as string;

    // Bound op moves the session cursor to the op's locus (item center).
    await post("/api/ops", {
      projectId: "prj_1",
      actor: kenny,
      clientId: sid,
      op: { type: "item.move", itemId: "itm_1", x: 1000, y: 2000 },
    });
    await new Promise((r) => setTimeout(r, 80)); // allow the async piggyback hook
    const roster = (await (await fetch(`${base}/api/projects/prj_1/sessions`)).json()) as PresenceSession[];
    expect(roster).toHaveLength(1);
    expect(roster[0]!.cursor).toEqual({ x: 1050, y: 2030 });

    // Status + explicit cursor via PUT.
    const put = await fetch(`${base}/api/projects/prj_1/sessions/${sid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "thinking…", cursor: { x: 1, y: 2 } }),
    });
    expect(put.status).toBe(200);

    // DELETE removes it; PUT afterwards 404s.
    await fetch(`${base}/api/projects/prj_1/sessions/${sid}`, { method: "DELETE" });
    const gone = await fetch(`${base}/api/projects/prj_1/sessions/${sid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(gone.status).toBe(404);
  });

  it("an expired CLI session is revived by its own ops", async () => {
    // No session exists for this id — the op resurrects it from its actor.
    await post("/api/ops", {
      projectId: "prj_1",
      actor: kenny,
      clientId: "ses_ghost1234",
      op: { type: "item.move", itemId: "itm_1", x: 40, y: 60 },
    });
    await new Promise((r) => setTimeout(r, 80));
    const roster = (await (await fetch(`${base}/api/projects/prj_1/sessions`)).json()) as PresenceSession[];
    expect(roster).toHaveLength(1);
    expect(roster[0]!.sessionId).toBe("ses_ghost1234");
    expect(roster[0]!.actor).toEqual(kenny);
    expect(roster[0]!.cursor).toEqual({ x: 90, y: 90 }); // item center after move
  });

  it("web presence flows to the roster and other clients", async () => {
    const messages: ServerMessage[] = [];
    const ws = new WebSocket(`${base.replace("http", "ws")}/ws?projectId=prj_1`);
    ws.on("message", (data) => messages.push(JSON.parse(String(data))));
    await new Promise((resolve, reject) => (ws.on("open", resolve), ws.on("error", reject)));
    await until(() => messages.some((m) => m.type === "snapshot"));

    // This tab publishes presence; a CLI session joins too.
    ws.send(
      JSON.stringify({
        type: "presence",
        sessionId: "cli_tab1",
        actor: alice,
        cursor: { x: 7, y: 8 },
        selection: ["itm_1"],
      }),
    );
    await post("/api/projects/prj_1/sessions", { actor: kenny });

    await until(() =>
      messages.some(
        (m) =>
          m.type === "presence-roster" &&
          m.sessions.length === 2 &&
          m.sessions.some((s) => s.kind === "web" && s.cursor?.x === 7 && s.selection[0] === "itm_1"),
      ),
    );

    // Socket close ends the web session.
    ws.close();
    const deadline = Date.now() + 2000;
    let roster: PresenceSession[] = [];
    for (;;) {
      roster = (await (await fetch(`${base}/api/projects/prj_1/sessions`)).json()) as PresenceSession[];
      if (roster.length === 1 || Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(roster.map((s) => s.kind)).toEqual(["cli"]);
  });
});
