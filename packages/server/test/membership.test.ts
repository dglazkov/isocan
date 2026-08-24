import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { ServerMessage } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * Actor binding and registry scope — the identity desk's mechanisms 5 and 10.
 *
 * Phase 2 made "who is connected" checkable. This is "who is SPEAKING":
 * everywhere an actor is named — an op, an undo, a presence beat — the name
 * must be one the speaker's badge vouches for, and the refusal is
 * `not-your-actor`. And it is "who is LISTENING": name uniqueness and colour
 * repaints stop at the claiming badge's admissions instead of walking the
 * whole home.
 *
 * Two things stay desk-blind on purpose, and nothing here should ever need to
 * change that: the reducer keeps judging actors and never learns badges
 * exist, and the oplog keeps carrying `actor` and `clientId` with badge ids
 * nowhere in it. Enforcement lands UNDER the vocabulary.
 */

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-membership-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

const post = (badge: TestBadge, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });

const del = (badge: TestBadge, url: string) =>
  fetch(`${base}${url}`, { method: "DELETE", headers: badge.headers });

const put = (badge: TestBadge, url: string, body: unknown) =>
  fetch(`${base}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });

const codeOf = async (res: Response) => ((await res.json()) as { code?: string }).code;

/** A canvas with one item on it, made by an actor this badge speaks for. */
async function seed(
  badge: TestBadge,
  canvasId: string,
  actor: { id: string; name: string },
): Promise<void> {
  await badge.speakAs(actor);
  await post(badge, "/api/ops", {
    canvasId: null,
    actor,
    op: { type: "project.create", canvasId, title: canvasId },
  });
  await post(badge, "/api/ops", {
    canvasId,
    actor,
    op: {
      type: "item.add",
      itemId: `itm_${canvasId}`,
      version: { id: "ver_1", blobHash: "h", mimeType: "text/markdown", filename: "a.md", size: 1 },
      width: 10,
      height: 10,
      placement: { x: 0, y: 0 },
    },
  });
}

/** Open a socket on a room and collect what it is told. */
async function room(
  badge: TestBadge,
  canvasId: string,
): Promise<{ socket: WebSocket; messages: ServerMessage[] }> {
  const socket = new WebSocket(`${base.replace("http", "ws")}/ws?canvasId=${canvasId}`, {
    headers: badge.headers,
  });
  const messages: ServerMessage[] = [];
  socket.on("error", () => {});
  socket.on("message", (data) => messages.push(JSON.parse(String(data)) as ServerMessage));
  await new Promise((resolve, reject) => (socket.on("open", resolve), socket.on("error", reject)));
  // Both of the messages a room opens with. Waiting for the roster too is
  // what makes "did this room hear anything NEW?" a stable question.
  await until(() => messages.some((m) => m.type === "snapshot"));
  await until(() => messages.some((m) => m.type === "presence-roster"));
  return { socket, messages };
}

async function until(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 20));
  }
}

const settle = () => new Promise((r) => setTimeout(r, 250));

// ---- mechanism 5: speaking as somebody you are not ----

describe("an actor a badge does not claim", () => {
  const kenny = { id: "usr_kenny", name: "Kenny" };
  const stranger = { id: "usr_stranger", name: "Stranger" };

  it("cannot put anything on a canvas", async () => {
    const mine = await mintTestBadge(base);
    await seed(mine, "prj_1", kenny);

    // A second holder, admitted to the canvas exactly as anyone is — the
    // address still admits — and claiming nobody.
    const theirs = await mintTestBadge(base);
    expect((await fetch(`${base}/api/projects/prj_1/canvas`, { headers: theirs.headers })).status).toBe(200);

    const forged = await post(theirs, "/api/ops", {
      canvasId: "prj_1",
      actor: kenny,
      op: { type: "item.move", itemId: "itm_prj_1", x: 99, y: 99 },
    });
    expect(forged.status).toBe(400);
    expect(await codeOf(forged)).toBe("not-your-actor");

    // Not even as an actor nobody has ever claimed: an unclaimed name is not
    // a free one, or "assert whoever you like" would still be the rule for
    // anybody willing to make up an id.
    const invented = await post(theirs, "/api/ops", {
      canvasId: "prj_1",
      actor: stranger,
      op: { type: "item.move", itemId: "itm_prj_1", x: 99, y: 99 },
    });
    expect(invented.status).toBe(400);
    expect(await codeOf(invented)).toBe("not-your-actor");

    // And the canvas is untouched — refusal happens before the reducer.
    const snapshot = (await (
      await fetch(`${base}/api/projects/prj_1/canvas`, { headers: mine.headers })
    ).json()) as { canvas: { items: Record<string, { x: number }> } };
    expect(snapshot.canvas.items["itm_prj_1"]!.x).toBe(0);
  });

  it("cannot undo their work, which is the whole point of checking undo", async () => {
    const mine = await mintTestBadge(base);
    await seed(mine, "prj_1", kenny);
    await post(mine, "/api/ops", {
      canvasId: "prj_1",
      actor: kenny,
      op: { type: "item.move", itemId: "itm_prj_1", x: 42, y: 42 },
    });

    const theirs = await mintTestBadge(base);
    for (const verb of ["undo", "redo"]) {
      const stolen = await post(theirs, `/api/projects/prj_1/${verb}`, { actor: kenny });
      expect(stolen.status).toBe(400);
      expect(await codeOf(stolen)).toBe("not-your-actor");
    }

    // Undo is actor-scoped, so naming somebody else is not a slip — it is
    // undoing their work. Kenny's own move is still where he left it.
    const snapshot = (await (
      await fetch(`${base}/api/projects/prj_1/canvas`, { headers: mine.headers })
    ).json()) as { canvas: { items: Record<string, { x: number }> } };
    expect(snapshot.canvas.items["itm_prj_1"]!.x).toBe(42);
  });

  it("cannot put their face up, move it, or take it down", async () => {
    const mine = await mintTestBadge(base);
    await seed(mine, "prj_1", kenny);
    const session = (await (
      await post(mine, "/api/projects/prj_1/sessions", { actor: kenny, label: "Kenny 🤖" })
    ).json()) as { sessionId: string };

    const theirs = await mintTestBadge(base);
    const raised = await post(theirs, "/api/projects/prj_1/sessions", { actor: kenny });
    expect(await codeOf(raised)).toBe("not-your-actor");

    const beat = await put(theirs, `/api/projects/prj_1/sessions/${session.sessionId}`, {
      actor: kenny,
      cursor: { x: 1, y: 1 },
    });
    expect(await codeOf(beat)).toBe("not-your-actor");

    const dropped = await del(theirs, `/api/projects/prj_1/sessions/${session.sessionId}`);
    expect(await codeOf(dropped)).toBe("not-your-actor");

    const swept = await del(theirs, `/api/presence/actors/${kenny.id}`);
    expect(await codeOf(swept)).toBe("not-your-actor");

    // One face, still Kenny's, still up.
    const roster = (await (
      await fetch(`${base}/api/projects/prj_1/sessions`, { headers: mine.headers })
    ).json()) as { actor: { id: string }; label: string | null }[];
    expect(roster).toEqual([expect.objectContaining({ label: "Kenny 🤖" })]);
    expect(roster[0]!.actor.id).toBe(kenny.id);
  });

  it("cannot repaint them — a colour is the actor's own choice", async () => {
    const mine = await mintTestBadge(base);
    await seed(mine, "prj_1", kenny);
    const theirs = await mintTestBadge(base);
    await theirs.speakAs(stranger);

    // Speaking as themselves, but changing somebody else's face: two
    // assertions in one op, and both are checked.
    const repaint = await post(theirs, "/api/ops", {
      canvasId: null,
      actor: stranger,
      op: { type: "actor.setColor", actorId: kenny.id, color: "#c93a55" },
    });
    expect(repaint.status).toBe(400);
    expect(await codeOf(repaint)).toBe("not-your-actor");
    expect(await (await fetch(`${base}/api/colors`, { headers: mine.headers })).json()).toEqual({});
  });

  it("is relayed presence checked PER ACTOR, not per connection", async () => {
    // One socket carrying several actors is the thick daemon's shape — and
    // the reason the check cannot be taken once at the handshake.
    const mine = await mintTestBadge(base);
    await seed(mine, "prj_1", kenny);
    const nico = { id: "usr_nico", name: "Nico" };

    const { socket, messages } = await room(mine, "prj_1");
    const beat = (actor: { id: string; name: string }) =>
      socket.send(
        JSON.stringify({
          type: "presence",
          sessionId: "cli_tab",
          actor,
          cursor: { x: 1, y: 1 },
          selection: [],
        }),
      );

    // Nico is not on this badge yet: the beat is dropped, and the socket
    // stays open — the tab may simply be mid-claim.
    beat(nico);
    await settle();
    expect(socket.readyState).toBe(WebSocket.OPEN);
    expect(
      messages.some((m) => m.type === "presence-roster" && m.sessions.length > 0),
    ).toBe(false);

    // Kenny is, so Kenny's face goes up on the very same connection.
    beat(kenny);
    await until(() =>
      messages.some(
        (m) => m.type === "presence-roster" && m.sessions.some((s) => s.actor.id === kenny.id),
      ),
    );

    // And claiming Nico afterwards is all it takes — the answer is
    // remembered per actor, never per socket.
    await mine.speakAs(nico);
    beat(nico);
    await until(() =>
      messages.some(
        (m) => m.type === "presence-roster" && m.sessions.some((s) => s.actor.id === nico.id),
      ),
    );
    socket.close();
  });
});

describe("the honest paths, unchanged", () => {
  it("a badge that claims its actor does all of it", async () => {
    const badge = await mintTestBadge(base);
    const kenny = { id: "usr_kenny", name: "Kenny" };
    await seed(badge, "prj_1", kenny);

    const moved = await post(badge, "/api/ops", {
      canvasId: "prj_1",
      actor: kenny,
      op: { type: "item.move", itemId: "itm_prj_1", x: 42, y: 42 },
    });
    expect(moved.status).toBe(200);
    // The envelope still carries the actor and nothing else about the
    // speaker: badge ids stay out of the oplog (mechanism 5).
    const { envelope } = (await moved.json()) as { envelope: Record<string, unknown> };
    expect(envelope.actor).toEqual(kenny);
    expect(JSON.stringify(envelope)).not.toContain(badge.badgeId);

    expect((await post(badge, "/api/projects/prj_1/undo", { actor: kenny })).status).toBe(200);
    expect((await post(badge, "/api/projects/prj_1/redo", { actor: kenny })).status).toBe(200);
    expect((await post(badge, "/api/projects/prj_1/sessions", { actor: kenny })).status).toBe(200);
    expect(
      (
        await post(badge, "/api/ops", {
          canvasId: null,
          actor: kenny,
          op: { type: "actor.setColor", actorId: kenny.id, color: "#0f8a80" },
        })
      ).status,
    ).toBe(200);
    expect((await del(badge, `/api/presence/actors/${kenny.id}`)).status).toBe(200);
  });
});

// ---- mechanism 10: registry scope ----

describe("two tenants, one home", () => {
  /**
   * Two badges, two unrelated canvases, an Isaac on each — the day phase 5
   * makes the home multi-tenant, this is two strangers. Neither ever hears
   * about the other: not when the second one takes the name, and not when the
   * first one changes colour.
   *
   * The solo home degenerates correctly by construction, which is why this
   * test does not need a second one to prove it: a local daemon's badge is
   * admitted to the canvases it works on, so admission-scoped checks collapse
   * to walking the home — the same code, with the scope emerging from the
   * badge instead of being hard-coded. Every other test in this repo is that
   * case.
   */
  async function tenants() {
    const priya = await mintTestBadge(base);
    const jordan = await mintTestBadge(base);
    await seed(priya, "prj_priya", { id: "usr_isaac_p", name: "Isaac" });
    await seed(jordan, "prj_jordan", { id: "usr_isaac_j", name: "Kenny" });
    return { priya, jordan };
  }

  it("lets both of them have an Isaac", async () => {
    const { priya, jordan } = await tenants();

    // Jordan's agent asks for the name Priya's agent already wears. It was
    // never a global property: uniqueness exists so `@`-mentions resolve and
    // the facepile reads, and neither roster contains the other.
    const named = await post(jordan, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "codex:t-1", name: "Isaac", canvasId: "prj_jordan" },
    });
    expect(named.status).toBe(200);
    const { envelope } = (await named.json()) as { envelope: { actor: { id: string; name: string } } };
    expect(envelope.actor.name).toBe("Isaac");
    expect(envelope.actor.id).not.toBe("usr_isaac_p");

    // On Priya's side it is still taken, and the refusal names a holder she
    // could already see — the leak closes for free, because the check never
    // consulted anybody else.
    const taken = await post(priya, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "claude-code:s-9", name: "Isaac", canvasId: "prj_priya" },
    });
    expect(taken.status).toBe(400);
    const refusal = (await taken.json()) as { code: string; error: string };
    expect(refusal.code).toBe("name-taken");
    expect(refusal.error).toContain("usr_isaac_p");
    expect(refusal.error).not.toContain(envelope.actor.id);
    expect(refusal.error).not.toContain("prj_jordan");
  });

  it("does not allocate around a name it cannot see", async () => {
    // Allocation walks the same scope: Jordan's nameless claim is handed
    // "Isaac" — the first name on the roster — even though a stranger on
    // another canvas wears it.
    const { jordan } = await tenants();
    const allocated = await post(jordan, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "codex:t-2", canvasId: "prj_jordan" },
    });
    const { envelope } = (await allocated.json()) as { envelope: { actor: { name: string } } };
    expect(envelope.actor.name).toBe("Isaac");
  });

  it("still refuses a name that is taken in a room the badge IS in", async () => {
    // The other side of the narrowing, and the boundary of the home
    // identity's own claim: scope is not "nothing", it is "where this badge
    // has been". A holder standing in Priya's room may not import a stranger
    // wearing a name somebody there already answers to — `@Isaac` would
    // reach both of them.
    const { priya } = await tenants();
    const visitor = await mintTestBadge(base);
    expect(
      (await fetch(`${base}/api/projects/prj_priya/canvas`, { headers: visitor.headers })).status,
    ).toBe(200);

    const refused = await post(visitor, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "cli:s-1", as: "usr_elsewhere", name: "Isaac" },
    });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { code: string }).code).toBe("name-taken");
  });

  it("keeps an actor id global, so nobody can reincarnate a stranger", async () => {
    // Ids are the one thing mechanism 10 does NOT scope: continuity across
    // canvases is the point of them, and `as` is judged against every claim
    // on the desk, however far away its holder sits.
    const { jordan } = await tenants();
    const stolen = await post(jordan, "/api/ops", {
      canvasId: null,
      op: { type: "actor.claim", sessionKey: "codex:t-3", as: "usr_isaac_p" },
    });
    expect(stolen.status).toBe(400);
    expect(((await stolen.json()) as { code: string }).code).toBe("name-taken");
  });

  it("repaints only the rooms where that actor appears", async () => {
    const { priya, jordan } = await tenants();
    const hers = await room(priya, "prj_priya");
    const his = await room(jordan, "prj_jordan");
    const rosters = (r: { messages: ServerMessage[] }) =>
      r.messages.filter((m) => m.type === "presence-roster").length;
    const before = { hers: rosters(hers), his: rosters(his) };

    // Priya's Isaac chooses a colour. It travels with the actor — colours are
    // per-actor and global — but the BROADCAST is not: `engine.onColors`
    // used to flood every room on the home.
    expect(
      (
        await post(priya, "/api/ops", {
          canvasId: null,
          actor: { id: "usr_isaac_p", name: "Isaac" },
          op: { type: "actor.setColor", actorId: "usr_isaac_p", color: "#7a3fd0" },
        })
      ).status,
    ).toBe(200);

    await until(() =>
      hers.messages.some(
        (m) => m.type === "presence-roster" && m.colors["usr_isaac_p"] === "#7a3fd0",
      ),
    );
    await settle();
    expect(rosters(his)).toBe(before.his); // Jordan's room never heard a thing

    hers.socket.close();
    his.socket.close();
  });

  it("re-letters the words an absent author wrote, which is why appearing is wider than being here", async () => {
    // A rename has to reach the comments the renamed actor wrote BEFORE it,
    // in a room where nobody by that name is currently connected. Narrowing
    // the broadcast to live presence would have quietly broken that.
    const { priya } = await tenants();
    const hers = await room(priya, "prj_priya");

    expect(
      (
        await post(priya, "/api/ops", {
          canvasId: null,
          // Her own session, renaming itself in place — the id is the
          // history, so it stays.
          op: {
            type: "actor.claim",
            sessionKey: "test:usr_isaac_p",
            as: "usr_isaac_p",
            name: "Isaac the Second",
          },
        })
      ).status,
    ).toBe(200);

    await until(() =>
      hers.messages.some(
        (m) => m.type === "presence-roster" && m.names["usr_isaac_p"] === "Isaac the Second",
      ),
    );
    hers.socket.close();
  });
});
