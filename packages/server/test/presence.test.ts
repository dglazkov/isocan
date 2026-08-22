import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { PresenceSession, ServerMessage } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { PresenceHub, opLocus } from "../src/presence.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
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

  it("an actor's sessions can be ended at once — the daemon is the truth", () => {
    // The ghost-cursor case: a CLI whose session pointer was lost cannot end
    // by id, so it ends by actor — on every canvas. A web tab held by the
    // same actor is not the CLI's to take down.
    const hub = new PresenceHub(1000);
    hub.createSession("prj-1", kenny, "cli", { label: "Kenny 🤖" });
    hub.createSession("prj-2", kenny, "cli");
    const tab = hub.createSession("prj-1", kenny, "web");
    hub.createSession("prj-1", alice, "cli");

    expect(hub.endActorSessions(kenny.id, "cli")).toBe(2);
    expect(hub.roster("prj-1").map((s) => s.sessionId).sort()).toEqual(
      [tab.sessionId, hub.roster("prj-1").find((s) => s.actor.id === alice.id)!.sessionId].sort(),
    );
    expect(hub.roster("prj-2")).toEqual([]);
    hub.close();
  });

  it("a beat re-asserts who is holding the session — renaming is not reconnecting", () => {
    const hub = new PresenceHub(1000);
    const session = hub.createSession("prj", kenny, "web");
    hub.touch("prj", session.sessionId, { actor: { ...kenny, name: "Kenny 🤖" } });
    expect(hub.roster("prj")[0]!.actor).toEqual({ id: kenny.id, name: "Kenny 🤖" });

    // Becoming someone else entirely reuses the one session this tab owns,
    // rather than leaving a ghost of the person who left.
    hub.touch("prj", session.sessionId, { actor: alice, cursor: { x: 1, y: 2 } });
    const roster = hub.roster("prj");
    expect(roster).toHaveLength(1);
    expect(roster[0]!.actor).toEqual(alice);
    expect(roster[0]!.cursor).toEqual({ x: 1, y: 2 });
    hub.close();
  });

  it("a session is on ONE canvas — no other roster ever lists it", () => {
    // On-call (home-wide) presence was retired with #60: an agent belongs to
    // the canvas of the directory it works in.
    const hub = new PresenceHub(1000);
    const here = hub.createSession("prj_1", kenny, "cli", { label: "Kenny 🤖" });
    hub.touch("prj_1", here.sessionId, { cursor: { x: 3, y: 4 } });

    const roster = hub.roster("prj_1");
    expect(roster).toHaveLength(1);
    expect(roster[0]!.cursor).toEqual({ x: 3, y: 4 });
    expect(hub.roster("prj_2")).toEqual([]);
    hub.close();
  });

  it("a said status outranks inferred narration; lifecycle outranks everything", () => {
    const hub = new PresenceHub(1000);
    const session = hub.createSession("prj", kenny, "cli");
    const sid = session.sessionId;
    const status = () => hub.roster("prj")[0]!.status;

    // Inferred narration fills silence…
    hub.touch("prj", sid, { status: "looking at X", statusSource: "inferred" });
    expect(status()).toBe("looking at X");
    // …but never displaces what the agent said out loud…
    hub.touch("prj", sid, { status: "building the dashboard" });
    hub.touch("prj", sid, { status: "reading comments…", statusSource: "inferred" });
    expect(status()).toBe("building the dashboard");
    // …while a lifecycle turn (parking, waking) overrides anything.
    hub.touch("prj", sid, { status: "waiting for your feedback…", statusSource: "lifecycle" });
    expect(status()).toBe("waiting for your feedback…");
    // Lifecycle text is not sticky: narration may take over again.
    hub.touch("prj", sid, { status: "editing Y…", statusSource: "inferred" });
    expect(status()).toBe("editing Y…");
    hub.close();
  });

  it("ops retire narration; a posted comment retires even a said status", () => {
    const canvas = {
      ...emptyCanvas(),
      items: {
        itm_1: {
          id: "itm_1", x: 0, y: 0, width: 10, height: 10,
          title: "", description: "", properties: {},
          versions: [], currentVersionId: "v",
          createdAt: "", createdBy: alice, updatedAt: "", updatedBy: alice,
        },
      },
    };
    const hub = new PresenceHub(1000);
    const sid = hub.createSession("prj", kenny, "cli").sessionId;
    const status = () => hub.roster("prj")[0]!.status;
    const move = { type: "item.move", itemId: "itm_1", x: 0, y: 0 } as const;
    const reply = {
      type: "thread.reply", threadId: "th_1", comment: { id: "c", body: "done" },
    } as const;

    // Derived narration is swept by any applied op — working resolved.
    hub.touch("prj", sid, { status: "editing X…", statusSource: "inferred" });
    hub.opApplied("prj", sid, kenny, move, canvas);
    expect(status()).toBeNull();

    // A said status survives ordinary ops…
    hub.touch("prj", sid, { status: "building the dashboard" });
    hub.opApplied("prj", sid, kenny, move, canvas);
    expect(status()).toBe("building the dashboard");
    // …but the reply is the receipt for the whole episode.
    hub.opApplied("prj", sid, kenny, reply, canvas);
    expect(status()).toBeNull();
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
  let badge: TestBadge;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-presence-"));
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    badge = await mintTestBadge(base);
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
      headers: { "Content-Type": "application/json", ...badge.headers },
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
    const roster = (await (await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })).json()) as PresenceSession[];
    expect(roster).toHaveLength(1);
    expect(roster[0]!.cursor).toEqual({ x: 1050, y: 2030 });

    // Status + explicit cursor via PUT.
    const put = await fetch(`${base}/api/projects/prj_1/sessions/${sid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ status: "thinking…", cursor: { x: 1, y: 2 } }),
    });
    expect(put.status).toBe(200);

    // DELETE removes it; PUT afterwards 404s.
    await fetch(`${base}/api/projects/prj_1/sessions/${sid}`, {
      method: "DELETE",
      headers: badge.headers,
    });
    const gone = await fetch(`${base}/api/projects/prj_1/sessions/${sid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...badge.headers },
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
    const roster = (await (await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })).json()) as PresenceSession[];
    expect(roster).toHaveLength(1);
    expect(roster[0]!.sessionId).toBe("ses_ghost1234");
    expect(roster[0]!.actor).toEqual(kenny);
    expect(roster[0]!.cursor).toEqual({ x: 90, y: 90 }); // item center after move
  });

  it("the on-call routes are gone — home-wide presence was retired with #60", async () => {
    const created = await post("/api/presence/oncall", { actor: kenny, label: "Kenny 🤖" });
    expect(created.status).toBe(404);
  });

  it("web presence flows to the roster and other clients", async () => {
    const messages: ServerMessage[] = [];
    const ws = new WebSocket(`${base.replace("http", "ws")}/ws?projectId=prj_1`, {
      headers: badge.headers,
    });
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

    // The tab becomes someone else on the same socket (#43): one face, the
    // new name, broadcast to everyone watching.
    ws.send(
      JSON.stringify({
        type: "presence",
        sessionId: "cli_tab1",
        actor: { id: "usr_nico", name: "Nico" },
        cursor: { x: 7, y: 8 },
        selection: [],
      }),
    );
    await until(() =>
      messages.some(
        (m) =>
          m.type === "presence-roster" &&
          m.sessions.length === 2 &&
          m.sessions.some((s) => s.kind === "web" && s.actor.name === "Nico") &&
          !m.sessions.some((s) => s.actor.id === alice.id),
      ),
    );

    // Socket close ends the web session.
    ws.close();
    const deadline = Date.now() + 2000;
    let roster: PresenceSession[] = [];
    for (;;) {
      roster = (await (await fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers })).json()) as PresenceSession[];
      if (roster.length === 1 || Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(roster.map((s) => s.kind)).toEqual(["cli"]);
  });
});
