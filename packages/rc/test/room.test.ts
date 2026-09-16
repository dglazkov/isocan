import { describe, expect, it } from "vitest";
import type {
  Actor,
  CanvasSnapshotResponse,
  CommentThread,
  EnrolledAgent,
  Operation,
  WatchLogRequest,
  WatchedLogEntry,
} from "@isocan/core";
import { ApiError } from "@isocan/core";
import {
  mapState,
  runRoom,
  type RcAgentRow,
  type RoomAdapter,
  type RoomDeps,
  type RoomRoutes,
  type RoomRows,
  type RoomState,
} from "../src/index.ts";

/**
 * **The room over in-memory deps** (docs/projects/room/phases.md, phase 1's
 * proof). No daemon, no disk, no process, no wall clock: a home that is a log
 * and a roster in this file, rows in an array, adapters that reply through the
 * routes they were handed, and a clock this file advances by hand — so a night
 * of the guard's window runs in well under a second.
 */

const CANVAS = { id: "prj_acme", title: "Acme Board" };
const OWNER: Actor = { id: "usr_ada", name: "Ada" };
const STRANGER: Actor = { id: "usr_sam", name: "Sam" };
const WRITER: Actor = { id: "usr_nico", name: "Nico" };
const PERCY: Actor = { id: "act_percy", name: "Percy" };

/** The key this machine's host derives for an agent (room phase 3.5): opaque,
 * with nothing of the name in it that a reader of the canvas could spell. */
const machineKey = (name: string): string =>
  `agent:m-${[...name].map((c) => (c.charCodeAt(0) * 7919).toString(36)).join("")}`;

/** A clock and its timers, advanced by hand. `sleep` is the room's only way
 * to wait, and every long poll below waits on it too. */
class HandClock {
  now = 1_000_000;
  private timers: { at: number; fire: () => void }[] = [];

  sleep = (ms: number, signal: AbortSignal): Promise<void> =>
    new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const timer = { at: this.now + ms, fire: () => done() };
      const done = () => {
        this.timers = this.timers.filter((t) => t !== timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      this.timers.push(timer);
      signal.addEventListener("abort", done, { once: true });
    });

  /** Move time forward, firing every timer on the way in order, and letting
   * whatever each one wakes run before the next. */
  async advance(ms: number): Promise<void> {
    const until = this.now + ms;
    for (;;) {
      await drain();
      const next = [...this.timers].sort((a, b) => a.at - b.at)[0];
      if (!next || next.at > until) break;
      this.now = next.at;
      next.fire();
    }
    this.now = until;
    await settle();
  }
}

/** Let every promise already queued move: nothing in the room or the home
 * below waits on anything but promises and the hand clock. */
async function drain(): Promise<void> {
  for (let i = 0; i < 60; i++) await Promise.resolve();
}

/** And once more past a turn of the event loop, where a step ends. */
async function settle(): Promise<void> {
  await drain();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await drain();
}

/** A home in memory: one canvas's log, roster and threads, the park rows, the
 * presence sessions, and every long poll waiting on the hand clock. */
class AcmeHome {
  log: WatchedLogEntry[] = [];
  agents: Record<string, EnrolledAgent> = {};
  threads: Record<string, CommentThread> = {};
  parks = new Map<string, number>();
  sessions = new Map<string, { actor: Actor; harness?: string; kind?: string }>();
  ended: string[] = [];
  holds: AbortSignal[] = [];
  polls: AbortSignal[] = [];
  /** Lap polls to refuse as a lost connection before answering again. */
  dropLaps = 0;
  /** What lands just before the room's start tip is read — after its opening
   * roster read, inside the window neither branch of the lap can see. */
  beforeStartTip: (() => void) | null = null;
  claims: string[] = [];
  /**
   * The claim rule (room phase 3). Null: the badge holds every actor, as
   * before the cursor and hold routes checked. A set: the actors the room's
   * badge holds, and `parkClaim` and `rcHold` refuse any other with
   * `not-your-actor`, as the daemon does.
   */
  badgeHolds: Set<string> | null = null;
  /** Actors a claim under the agent's own key wins for this badge: this
   * machine's own agents. Anybody else's is refused, and holds nothing. */
  claimable = new Set<string>();
  /** Every claim, park and hold, in order: `claim:<id>`, `park:<id>`,
   * `hold:<ids>` and `hold-refused:<ids>`. */
  calls: string[] = [];
  /** The session key each claim presented, in order. */
  claimKeys: string[] = [];
  /** Actors a claim is refused for, `name-taken`, with this reason: another
   * badge holds them (`held-elsewhere`), or a refusal that passes on its own
   * (`claimed-just-now`, `live`). */
  claimRefused = new Map<string, string>();
  private waiters: (() => void)[] = [];
  private nextSession = 1;

  constructor(private clock: HandClock) {}

  enrol(agent: Actor, writtenBy: Actor = OWNER, rules?: unknown): void {
    this.agents[agent.id] = { actor: agent, writtenBy, ...(rules ? { rules } : {}) } as EnrolledAgent;
    this.append(writtenBy, { type: "agent.enroll", agent } as Operation);
  }

  withdraw(agent: Actor, by: Actor = OWNER): void {
    delete this.agents[agent.id];
    this.append(by, { type: "agent.withdraw", actorId: agent.id } as Operation);
  }

  /** A comment, by `by`, mentioning `about`, on a new thread. */
  mention(by: Actor, about: Actor, body: string): string {
    const threadId = `thr_${this.log.length + 1}`;
    this.append(by, {
      type: "thread.create",
      threadId,
      x: 0,
      y: 0,
      comment: { id: `cmt_${this.log.length + 1}`, body, mentions: [about.id] },
    } as unknown as Operation);
    return threadId;
  }

  append(actor: Actor, op: Operation): void {
    const seq = this.log.length + 1;
    this.log.push({ seq, envelope: { actor, op, ts: new Date(this.clock.now).toISOString() } } as unknown as WatchedLogEntry);
    if (op.type === "thread.create" || op.type === "thread.reply") {
      const o = op as unknown as { threadId: string; comment: { id: string; body: string } };
      const thread = (this.threads[o.threadId] ??= { id: o.threadId, createdBy: actor, comments: [] } as unknown as CommentThread);
      thread.comments.push({ id: o.comment.id, body: o.comment.body, author: actor } as CommentThread["comments"][number]);
    }
    for (const wake of this.waiters.splice(0)) wake();
  }

  get tip(): number {
    return this.log.length;
  }

  private snapshotNow(): CanvasSnapshotResponse {
    return {
      project: CANVAS,
      canvas: { agents: structuredClone(this.agents), threads: structuredClone(this.threads), items: {}, trash: [] },
      lastSeq: this.tip,
      colors: {},
      names: {},
    } as unknown as CanvasSnapshotResponse;
  }

  routes(): RoomRoutes {
    const home = this;
    const routes = {
      snapshot: async () => home.snapshotNow(),
      actorBindings: async () => [],
      claimActor: async (op: { as?: string; sessionKey: string }) => {
        home.calls.push(`claim:${op.as}`);
        home.claimKeys.push(op.sessionKey);
        const refused = op.as ? home.claimRefused.get(op.as) : undefined;
        if (refused !== undefined) {
          throw new ApiError(400, `${op.as} is somebody else here (${refused})`, "name-taken", refused);
        }
        const name = op.as ? home.agents[op.as]?.actor.name : undefined;
        if (op.as && name !== undefined && home.claimable.has(op.as) && op.sessionKey === machineKey(name)) {
          home.badgeHolds?.add(op.as);
          return {};
        }
        if (home.badgeHolds) throw new ApiError(400, "that name is somebody else's", "name-taken");
        return {};
      },
      createSession: async (_canvasId: string, actor: Actor, _label?: string, harness?: string, kind?: string) => {
        const sessionId = `ses_${home.nextSession++}`;
        home.sessions.set(sessionId, { actor, ...(harness ? { harness } : {}), ...(kind ? { kind } : {}) });
        return { sessionId };
      },
      updateSession: async (_canvasId: string, sessionId: string) => {
        if (!home.sessions.has(sessionId)) throw new ApiError(404, "no such session");
        return { ok: true };
      },
      endSession: async (_canvasId: string, sessionId: string) => {
        home.sessions.delete(sessionId);
        home.ended.push(sessionId);
        return { ok: true };
      },
      getLog: async () => [...home.log],
      parkClaim: async (request: { actorId: string; seedAt?: number }) => {
        home.calls.push(`park:${request.actorId}`);
        home.refuseUnheld([request.actorId]);
        home.claims.push(request.actorId);
        const cursor = home.parks.get(request.actorId) ?? request.seedAt ?? 0;
        home.parks.set(request.actorId, cursor);
        return { parkId: `park_${request.actorId}`, cursor, redeliverUpTo: null };
      },
      parkDelivered: async () => ({ ok: true }),
      parkAdvance: async (request: { actorId: string; to: number }) => {
        home.parks.set(request.actorId, Math.max(home.parks.get(request.actorId) ?? 0, request.to));
        return { ok: true };
      },
      sendOp: async (_canvasId: string, actor: Actor, op: Operation) => {
        home.append(actor, op);
        return { seq: home.tip };
      },
      rcHold: async (request: { actorIds: string[] }, signal?: AbortSignal) => {
        try {
          home.refuseUnheld(request.actorIds);
        } catch (err) {
          home.calls.push(`hold-refused:${request.actorIds.join(",")}`);
          throw err;
        }
        home.calls.push(`hold:${request.actorIds.join(",")}`);
        home.holds.push(signal!);
        return home.wait(10_000, signal).then(() => ({ ok: true, asks: [] }));
      },
      watchLog: async (request: WatchLogRequest, signal?: AbortSignal) => {
        if (!request.cursors) {
          home.beforeStartTip?.();
          home.beforeStartTip = null;
          return { entries: [], cursors: { [CANVAS.id]: home.tip } };
        }
        home.polls.push(signal!);
        if (home.dropLaps > 0) {
          home.dropLaps--;
          throw new TypeError("fetch failed");
        }
        const from = request.cursors[CANVAS.id] ?? 0;
        if (home.tip <= from) await home.wait(request.waitMs ?? 30_000, signal);
        return { entries: home.log.filter((e) => e.seq > from), cursors: { [CANVAS.id]: home.tip } };
      },
    };
    return routes as unknown as RoomRoutes;
  }

  refuseUnheld(actorIds: string[]): void {
    const unheld = this.badgeHolds ? actorIds.find((id) => !this.badgeHolds!.has(id)) : undefined;
    if (unheld !== undefined) {
      throw new ApiError(400, `this badge does not speak for ${unheld} — claim that actor first`, "not-your-actor");
    }
  }

  /** Until something is appended, `ms` pass on the hand clock, or the signal
   * aborts — which rejects, the way an aborted fetch does. */
  private wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeUp = new AbortController();
      const finish = () => {
        timeUp.abort();
        signal?.removeEventListener("abort", aborted);
        resolve();
      };
      const aborted = () => {
        timeUp.abort();
        reject(new DOMException("aborted", "AbortError"));
      };
      if (signal?.aborted) return aborted();
      signal?.addEventListener("abort", aborted, { once: true });
      this.waiters.push(finish);
      void this.clock.sleep(ms, timeUp.signal).then(() => {
        if (!timeUp.signal.aborted) finish();
      });
    });
  }
}

/** Rows in an array, with the file-backed verbs' semantics. */
function memoryRows(rows: RcAgentRow[]): RoomRows {
  return {
    list: async () => structuredClone(rows),
    adopt: async (row) => {
      if (rows.some((r) => r.canvasId === row.canvasId && r.actorId === row.actorId)) return false;
      rows.push(row);
      return true;
    },
    remove: async (canvasId, actorId) => {
      const i = rows.findIndex((r) => r.canvasId === canvasId && r.actorId === actorId);
      if (i >= 0) rows.splice(i, 1);
    },
    setSessionId: async (canvasId, actorId, sessionId) => {
      const row = rows.find((r) => r.canvasId === canvasId && r.actorId === actorId);
      if (!row) return false;
      row.sessionId = sessionId;
      return true;
    },
  };
}

/** State that keeps nothing by reference: every value goes through JSON, as a
 * host's persisted store would. */
function jsonState(): RoomState & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => (data.has(key) ? JSON.parse(data.get(key)!) : undefined),
    set: async (key, value) => {
      data.set(key, JSON.stringify(value));
    },
    delete: async (key) => {
      data.delete(key);
    },
  };
}

interface Turn {
  row: RcAgentRow;
  harness: string;
  face: string | null;
  prompt: string;
  at: number;
}

/** The deps a test hands the room: Percy on `claude-code`, an adapter that
 * replies in the thread through the routes, and narration collected. */
function roomOver(
  home: AcmeHome,
  clock: HandClock,
  options: { state?: RoomState; limits?: RoomDeps["limits"]; rows?: RcAgentRow[]; agentKey?: RoomDeps["agentKey"] } = {},
) {
  const lines: string[] = [];
  const turns: Turn[] = [];
  const ended: RcAgentRow[] = [];
  const routes = home.routes();
  const rows: RcAgentRow[] = options.rows ?? [
    { canvasId: CANVAS.id, actorId: PERCY.id, name: PERCY.name, harness: "claude-code", cwd: "/acme/percy", sessionId: null },
  ];
  const deps: RoomDeps = {
    routes,
    canvas: CANVAS,
    owner: OWNER,
    origin: "https://acme.invalid",
    cwd: "/acme",
    rows: memoryRows(rows),
    adapterFor: async (row) => ({
      harness: row.harness ?? "claude-code",
      open: async (turn): Promise<RoomAdapter> => ({
        ensureSession: async (_cwd, stored) => ({ sessionId: stored ?? "acp_percy", resumed: stored !== null }),
        prompt: async (_sessionId, text) => {
          turns.push({ row, harness: row.harness ?? "claude-code", face: turn.face, prompt: text, at: clock.now });
          if (turn.threadId) {
            await routes.sendOp(CANVAS.id, PERCY, {
              type: "thread.reply",
              threadId: turn.threadId,
              comment: { id: `cmt_reply_${turns.length}`, body: "The empty state now says what to do." },
            } as Operation);
          }
          return { stopReason: "end_turn" };
        },
        close: () => {},
      }),
    }),
    endSession: async (row) => {
      ended.push(row);
    },
    whereOf: async () => null,
    enrol: async () => {},
    agentKey: options.agentKey ?? (async (name) => machineKey(name)),
    narrate: (line) => lines.push(line),
    state: options.state ?? mapState(),
    limits: options.limits ?? { turnsPerHour: 12, agentChain: 3 },
    clock: { now: () => clock.now },
    sleep: clock.sleep,
  };
  return { deps, lines, turns, rows, ended };
}

describe("the room over in-memory deps", () => {
  it("dispatches a summons to the adapter the deps name, and the reply lands through routes", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    const { deps, lines, turns } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    expect(lines).toContain(`answering on "Acme Board" — https://acme.invalid/p/${CANVAS.id}`);

    const threadId = home.mention(OWNER, PERCY, "@Percy the empty state reads wrong");
    await clock.advance(0);

    expect(turns).toHaveLength(1);
    expect(turns[0]!.row).toMatchObject({ actorId: PERCY.id, harness: "claude-code", cwd: "/acme/percy" });
    expect(turns[0]!.prompt).toContain("@Percy the empty state reads wrong");
    // The face went on under the harness the deps named, and came off.
    expect(turns[0]!.face).not.toBeNull();
    expect(home.ended).toContain(turns[0]!.face);
    const thread = home.threads[threadId]!;
    expect(thread.comments.map((c) => `${c.author.name}: ${c.body}`)).toEqual([
      "Ada: @Percy the empty state reads wrong",
      "Percy: The empty state now says what to do.",
    ]);
    expect(lines).toEqual(
      expect.arrayContaining([
        "Percy · summons from Ada, 1 entry — starting a session",
        "Percy · session started in /acme/percy",
        "Percy · turn ended — end_turn",
      ]),
    );
    // The cursor advanced past the summons the turn answered.
    expect(home.parks.get(PERCY.id)).toBeGreaterThanOrEqual(2);
    await room.stop();
    await room.done;
  });

  /**
   * **The startup window, from both sides** (sheep-harness phase 2). The room
   * reads its opening roster, then its start tip; an enrolment or a
   * withdrawal landing between the two is absent from the opening roster and
   * at or below the tip, so neither the reconcile nor the lap's enrol and
   * withdraw branches see it. The roster read after the tip is what does.
   * These were source-shape checks over `main.ts` while the room lived there.
   */
  it("an enrolment landing between the opening roster and the start tip is adopted, claimed and said", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    // Nobody enrolled when the room opens — the web's first add, arriving as
    // the room starts: no cursor sits below the tip to read the enrolment
    // back, and the first lap's poll is a quiet thirty seconds.
    const QUINN: Actor = { id: "act_quinn", name: "Quinn" };
    home.beforeStartTip = () => home.enrol(QUINN);
    const { deps, lines, rows } = roomOver(home, clock, { rows: [] });
    const room = runRoom(deps);
    // Well inside the first thirty-second poll: nothing else would take Quinn
    // up before it ends.
    await clock.advance(1_000);
    expect(rows).toContainEqual({ canvasId: CANVAS.id, actorId: QUINN.id, name: "Quinn", harness: null, cwd: "/acme", sessionId: null });
    expect(home.claims).toContain(QUINN.id);
    expect(lines).toContain("Quinn · where and how supplied — /acme");
    expect(lines).toContain("nobody is enrolled yet — Add an agent in the tray at that address; this rc picks it up without a restart");
    // The same sentence the enrol branch says for an enrolment it does see.
    const RUE: Actor = { id: "act_rue", name: "Rue" };
    home.enrol(RUE);
    await clock.advance(0);
    expect(lines).toContain("Rue · where and how supplied — /acme");
    await room.stop();
    await room.done;
  });

  it("a withdrawal landing between the opening roster and the start tip is reaped, and its session ended", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    home.beforeStartTip = () => home.withdraw(PERCY);
    const sheepRow: RcAgentRow = {
      canvasId: CANVAS.id,
      actorId: PERCY.id,
      name: PERCY.name,
      harness: "sheep",
      cwd: "/acme/percy",
      sessionId: "sheep_percy",
      sheep: { kennel: "/acme/.sheep", home: "https://sheep.acme.invalid" },
    };
    const { deps, lines, rows, ended } = roomOver(home, clock, { rows: [sheepRow] });
    const room = runRoom(deps);
    await clock.advance(60_000);
    expect(rows).toEqual([]);
    expect(ended.map((r) => r.sessionId)).toEqual(["sheep_percy"]);
    expect(lines).toContain("Percy was withdrawn as this rc started — ending what it left");
    await room.stop();
    await room.done;
  });

  it("stop() ends the hold and both polls within one tick", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    const { deps } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    const hold = home.holds.at(-1)!;
    const poll = home.polls.at(-1)!;
    expect(hold.aborted).toBe(false);
    expect(poll.aborted).toBe(false);
    const announcement = [...home.sessions].find(([, s]) => s.kind === "rc")![0];

    let stopped = false;
    void room.done.then(() => (stopped = true));
    const standing = room.stop();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(hold.aborted).toBe(true);
    expect(poll.aborted).toBe(true);
    expect(stopped).toBe(true);
    await standing;
    expect(home.ended).toContain(announcement);
    // Nothing is parked afterwards: no new hold, no new poll, however long.
    const holds = home.holds.length;
    const polls = home.polls.length;
    await clock.advance(3_600_000);
    expect(home.holds.length).toBe(holds);
    expect(home.polls.length).toBe(polls);
  });

  it("a second runRoom over the same state does not re-narrate what the first said, and keeps its guard", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    // A gate somebody else wrote, widening Percy to Sam: set aside, and said
    // once, at start.
    home.enrol(PERCY, WRITER, { listen: [STRANGER.id] });
    const state = jsonState();
    const limits = { turnsPerHour: 2, agentChain: 3 };
    const setAside = expect.stringContaining("Percy's gate was last written by Nico, not you");

    const first = roomOver(home, clock, { state, limits });
    const one = runRoom(first.deps);
    await clock.advance(0);
    expect(first.lines).toEqual(expect.arrayContaining([setAside]));
    // A stranger asks: turned away, said in words once.
    home.mention(STRANGER, PERCY, "@Percy can you look?");
    await clock.advance(0);
    const turnedAway = "Percy · Sam asked; listens only to you (Ada) — said so in the thread, nothing started";
    expect(first.lines).toContain(turnedAway);
    // Ada asks twice, a minute apart: two turns, the whole ceiling.
    home.mention(OWNER, PERCY, "@Percy the empty state reads wrong");
    await clock.advance(60_000);
    home.mention(OWNER, PERCY, "@Percy and the heading above it");
    await clock.advance(60_000);
    expect(first.turns).toHaveLength(2);
    await one.stop();
    await one.done;

    // The second room meets a home whose park rows are gone: its cursors seed
    // at the enrolment, so the whole backlog comes back around.
    home.parks.clear();
    const second = roomOver(home, clock, { state, limits });
    const two = runRoom(second.deps);
    await clock.advance(5_000);
    expect(second.lines).toContain(`answering on "Acme Board" — https://acme.invalid/p/${CANVAS.id}`);
    expect(second.lines).not.toEqual(expect.arrayContaining([setAside]));
    expect(second.lines).not.toContain(turnedAway);
    // The replayed asks are held by the first room's two turns.
    expect(second.turns).toHaveLength(0);
    expect(second.lines).toContain("Percy is at its ceiling — 2 turns in the past hour. This summons waits (about 58 min).");
    // And lifted when the hour the first room spent has passed.
    await clock.advance(3_600_000);
    expect(second.lines).toContain("Percy's hold lifted — dispatching what waited");
    expect(second.turns).toHaveLength(1);
    await two.stop();
    await two.done;
  });

  it("a routes that refuses with a lost connection is retried, with no ensureDaemon in sight", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    const { deps, lines, turns } = roomOver(home, clock);
    expect("ensureDaemon" in deps.routes).toBe(false);
    home.dropLaps = 2;
    const room = runRoom(deps);
    // Two refused laps, 400ms apart, and a third that is parked again.
    await clock.advance(1_000);
    expect(lines.filter((l) => l.startsWith("the daemon stopped answering"))).toEqual([
      "the daemon stopped answering — retrying, and starting it if it is gone",
    ]);
    expect(home.polls).toHaveLength(3);
    home.mention(OWNER, PERCY, "@Percy still there?");
    await clock.advance(0);
    expect(lines).toContain("daemon back after 1s — nothing missed");
    expect(turns).toHaveLength(1);
    await room.stop();
    await room.done;
  });

  it("a refusal the daemon answered ends the room, as `isocan rc` exits on it", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    const { deps } = roomOver(home, clock);
    const routes = deps.routes;
    let laps = 0;
    const refusing = {
      ...routes,
      watchLog: async (request: WatchLogRequest, signal?: AbortSignal) => {
        if (request.cursors && ++laps > 1) throw new ApiError(403, "not admitted", "not-admitted");
        return routes.watchLog(request, signal);
      },
    } as RoomRoutes;
    const room = runRoom({ ...deps, routes: refusing });
    const ended = room.done.then(
      () => null,
      (err: unknown) => err,
    );
    await clock.advance(31_000);
    expect(await ended).toBeInstanceOf(ApiError);
    await room.stop();
  });

  it("runs a night of the guard's window in under a second by the clock", async () => {
    const started = performance.now();
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    const { deps, turns, lines } = roomOver(home, clock, { limits: { turnsPerHour: 2, agentChain: 3 } });
    const room = runRoom(deps);
    await clock.advance(0);
    // Eight hours, Ada asking every twenty minutes: three asks an hour against
    // a ceiling of two.
    const asks = 24;
    for (let i = 0; i < asks; i++) {
      home.mention(OWNER, PERCY, `@Percy ask ${i + 1}`);
      await clock.advance(20 * 60_000);
    }
    await clock.advance(2 * 3_600_000);
    await room.stop();
    await room.done;

    // Never more than two turns in any sliding hour…
    for (let i = 2; i < turns.length; i++) {
      expect(turns[i]!.at - turns[i - 2]!.at).toBeGreaterThanOrEqual(3_600_000);
    }
    // …and nothing dropped: every ask reached a turn.
    for (let i = 0; i < asks; i++) {
      expect(turns.some((t) => t.prompt.includes(`@Percy ask ${i + 1}`))).toBe(true);
    }
    expect(lines.some((l) => l.startsWith("Percy is at its ceiling — 2 turns in the past hour."))).toBe(true);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  /**
   * **The claim rule** (room phase 3; docs/projects/room/design.md). The
   * cursor and hold routes require the actor, and the room parks each agent
   * before it does anything else for it. An agent its badge does not hold,
   * whether another machine holds it or nobody does, is said once and is
   * otherwise left alone.
   */
  const notHeld = (name: string) =>
    `${name} is not held by this machine — a pass from whoever holds ${name} hands it over`;
  const WENDY: Actor = { id: "act_wendy", name: "Wendy" };

  it("an agent another badge holds is said once, and never held, faced or dispatched — not said again by a second runRoom over the same state", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    // Percy is the first machine's; this machine's rows name Wendy alone.
    home.enrol(PERCY, OWNER, { listen: ["*"] });
    home.enrol(WENDY, OWNER, { listen: ["*"] });
    home.badgeHolds = new Set([WENDY.id]);
    home.claimable = new Set([WENDY.id]);
    const state = jsonState();
    const wendyRow: RcAgentRow = { canvasId: CANVAS.id, actorId: WENDY.id, name: WENDY.name, harness: "claude-code", cwd: "/acme/wendy", sessionId: null };
    const first = roomOver(home, clock, { state, rows: [wendyRow] });
    const one = runRoom(first.deps);
    await clock.advance(0);

    expect(first.lines.filter((l) => l === notHeld("Percy"))).toHaveLength(1);
    expect(first.lines).not.toContain(notHeld("Wendy"));
    // No row for Percy, no claim for Percy, and the hold names Wendy alone.
    expect(first.rows.map((r) => r.actorId)).toEqual([WENDY.id]);
    expect(home.calls).not.toContain(`claim:${PERCY.id}`);
    expect(home.calls.filter((c) => c.startsWith("hold")).every((c) => c === `hold:${WENDY.id}`)).toBe(true);
    // Whose word wakes Percy is not this machine's to say.
    expect(first.lines.some((l) => l.startsWith("Percy") && l !== notHeld("Percy"))).toBe(false);

    // A summons for Percy: no turn, no face, no turn-away, no system voice.
    const percyThread = home.mention(OWNER, PERCY, "@Percy the empty state reads wrong");
    await clock.advance(61_000);
    expect(first.turns).toHaveLength(0);
    expect([...home.sessions.values()].some((s) => s.actor.id === PERCY.id)).toBe(false);
    expect(home.threads[percyThread]!.comments.map((c) => c.author.name)).toEqual(["Ada"]);
    expect(first.lines.some((l) => l.startsWith("Percy ·"))).toBe(false);
    // A summons for Wendy is answered here.
    home.mention(OWNER, WENDY, "@Wendy and the heading");
    await clock.advance(0);
    // (The in-memory adapter replies as Percy, which wakes Wendy once more in
    // her own thread; every turn is hers.)
    expect(first.turns.length).toBeGreaterThan(0);
    expect(new Set(first.turns.map((t) => t.row.actorId))).toEqual(new Set([WENDY.id]));
    // Read once: the laps did not park Percy again, nor say him again.
    expect(home.calls.filter((c) => c === `park:${PERCY.id}`)).toHaveLength(1);
    expect(first.lines.filter((l) => l === notHeld("Percy"))).toHaveLength(1);
    await one.stop();
    await one.done;

    // The next start asks the park again (a pass may have handed Percy over),
    // is refused again, and does not say it again.
    const second = roomOver(home, clock, { state, rows: [wendyRow] });
    const two = runRoom(second.deps);
    await clock.advance(1_000);
    expect(home.calls.filter((c) => c === `park:${PERCY.id}`)).toHaveLength(2);
    expect(second.lines).toContain(`answering on "Acme Board" — https://acme.invalid/p/${CANVAS.id}`);
    expect(second.lines).not.toContain(notHeld("Percy"));
    await two.stop();
    await two.done;

    // Handed over (a pass): the start after that parks Percy and answers him.
    home.badgeHolds.add(PERCY.id);
    const third = roomOver(home, clock, { state, rows: [wendyRow] });
    const three = runRoom(third.deps);
    await clock.advance(1_000);
    expect(third.lines).not.toContain(notHeld("Percy"));
    expect(third.rows.map((r) => r.actorId).sort()).toEqual([PERCY.id, WENDY.id].sort());
    expect(home.calls.some((c) => c.startsWith("hold:") && c.includes(PERCY.id))).toBe(true);
    expect(await state.get(`said:${CANVAS.id}:not-held:${PERCY.id}`)).toBeUndefined();
    await three.stop();
    await three.done;
  });

  it("an agent in this machine's rows is claimed under its own key before its cursor is parked", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    // Re-badged: the badge holds nothing until it claims its own agents.
    home.badgeHolds = new Set();
    home.claimable = new Set([PERCY.id]);
    const { deps, lines, turns } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    const claim = home.calls.indexOf(`claim:${PERCY.id}`);
    const park = home.calls.indexOf(`park:${PERCY.id}`);
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(park).toBeGreaterThan(claim);
    expect(lines).not.toContain(notHeld("Percy"));
    home.mention(OWNER, PERCY, "@Percy still yours?");
    await clock.advance(0);
    expect(turns).toHaveLength(1);
    await room.stop();
    await room.done;
  });

  it("every claim the room makes presents the key its host derives, and a key spelled from the name holds nothing", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    home.badgeHolds = new Set();
    home.claimable = new Set([PERCY.id]);
    const { deps, lines, turns } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    home.mention(OWNER, PERCY, "@Percy the empty state reads wrong");
    await clock.advance(0);
    expect(turns).toHaveLength(1);
    // The start's claim and the summons's claim, both under the host's key.
    expect(home.claimKeys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(home.claimKeys)).toEqual(new Set([machineKey("Percy")]));
    expect(home.claimKeys.some((key) => key.includes("Percy"))).toBe(false);
    expect(lines).not.toContain(notHeld("Percy"));
    await room.stop();
    await room.done;

    // Falsified: a host whose key is the name's own spelling claims nothing
    // here, so the park is refused and Percy is not this machine's.
    const clock2 = new HandClock();
    const home2 = new AcmeHome(clock2);
    home2.enrol(PERCY);
    home2.badgeHolds = new Set();
    home2.claimable = new Set([PERCY.id]);
    const spelled = roomOver(home2, clock2, { agentKey: async (name) => `agent:${name}` });
    const room2 = runRoom(spelled.deps);
    await clock2.advance(0);
    expect(home2.claimKeys).toEqual(["agent:Percy"]);
    expect(spelled.lines).toContain(notHeld("Percy"));
    home2.mention(OWNER, PERCY, "@Percy anyone?");
    await clock2.advance(61_000);
    expect(spelled.turns).toHaveLength(0);
    await room2.stop();
    await room2.done;
  });

  it("a host key that cannot be derived is a claim not made: the park that follows decides", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    // Still held from before (a claim under the old key): the park succeeds.
    home.badgeHolds = new Set([PERCY.id]);
    home.claimable = new Set([PERCY.id]);
    const { deps, lines } = roomOver(home, clock, {
      agentKey: async () => {
        throw new Error("the agent secret is unreadable");
      },
    });
    const room = runRoom(deps);
    await clock.advance(0);
    expect(home.calls).toContain(`park:${PERCY.id}`);
    expect(home.claimKeys).toEqual([]);
    expect(lines).not.toContain(notHeld("Percy"));
    await room.stop();
    await room.done;
  });

  it("an agent of this machine's rows that another badge also holds is not held here: said once, never parked, held, faced or dispatched", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY, OWNER, { listen: ["*"] });
    // Dual-held: this badge still holds Percy under the old key, so the park
    // alone would take him; the claim under the machine key is refused.
    home.badgeHolds = new Set([PERCY.id]);
    home.claimable = new Set([PERCY.id]);
    home.claimRefused.set(PERCY.id, "held-elsewhere");
    const { deps, lines, turns, rows } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    expect(lines.filter((l) => l === notHeld("Percy"))).toHaveLength(1);
    expect(home.calls).toContain(`claim:${PERCY.id}`);
    expect(home.calls).not.toContain(`park:${PERCY.id}`);
    expect(home.calls.some((c) => c.startsWith("hold") && c.includes(PERCY.id))).toBe(false);
    const thread = home.mention(OWNER, PERCY, "@Percy the empty state reads wrong");
    await clock.advance(61_000);
    expect(turns).toHaveLength(0);
    expect(home.threads[thread]!.comments).toHaveLength(1);
    expect([...home.sessions.values()].some((s) => s.actor.id === PERCY.id)).toBe(false);
    expect(lines.some((l) => l.startsWith("Percy ·"))).toBe(false);
    expect(lines.filter((l) => l === notHeld("Percy"))).toHaveLength(1);
    // The row is this machine's record of how Percy runs, and it stays.
    expect(rows.map((r) => r.actorId)).toEqual([PERCY.id]);
    await room.stop();
    await room.done;
  });

  it("a summons whose claim meets another badge's hold stands the agent down: said once, no failed turn, nothing in the thread", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY, OWNER, { listen: ["*"] });
    home.badgeHolds = new Set([PERCY.id]);
    home.claimable = new Set([PERCY.id]);
    const { deps, lines, turns } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    expect(home.calls).toContain(`park:${PERCY.id}`);
    // Another badge takes Percy up while the room runs.
    home.claimRefused.set(PERCY.id, "held-elsewhere");
    const first = home.mention(OWNER, PERCY, "@Percy one");
    await clock.advance(0);
    expect(turns).toHaveLength(0);
    expect(lines.filter((l) => l === notHeld("Percy"))).toHaveLength(1);
    expect(lines.some((l) => l.includes("turn FAILED"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Percy ·"))).toBe(false);
    expect(home.threads[first]!.comments).toHaveLength(1);
    const holdsBefore = home.calls.filter((c) => c.startsWith("hold")).length;
    // Out of the hold from here on, and a second summons says nothing more.
    const second = home.mention(OWNER, PERCY, "@Percy two");
    await clock.advance(61_000);
    const later = home.calls.filter((c) => c.startsWith("hold")).slice(holdsBefore);
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((c) => !c.includes(PERCY.id))).toBe(true);
    expect(turns).toHaveLength(0);
    expect(home.threads[second]!.comments).toHaveLength(1);
    expect(lines.filter((l) => l === notHeld("Percy"))).toHaveLength(1);
    await room.stop();
    await room.done;
  });

  it("a claim refused for a reason that passes (claimed just now, live) is retried, and the agent is never said to be not held", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY, OWNER, { listen: ["*"] });
    home.badgeHolds = new Set([PERCY.id]);
    home.claimable = new Set([PERCY.id]);
    home.claimRefused.set(PERCY.id, "claimed-just-now");
    const { deps, lines, turns } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    // At start: the park decides, and it takes Percy.
    expect(home.calls).toContain(`park:${PERCY.id}`);
    // At a summons: the turn fails and is held for a retry, as any refusal.
    home.mention(OWNER, PERCY, "@Percy now?");
    await clock.advance(0);
    expect(lines.some((l) => l.startsWith("Percy · turn FAILED") && l.includes("(retrying in 60s)"))).toBe(true);
    home.claimRefused.set(PERCY.id, "live");
    await clock.advance(61_000);
    expect(lines.filter((l) => l.startsWith("Percy · turn FAILED"))).toHaveLength(2);
    // The refusal passes: the retry runs the turn.
    home.claimRefused.delete(PERCY.id);
    await clock.advance(61_000);
    expect(turns).toHaveLength(1);
    expect(lines).not.toContain(notHeld("Percy"));
    await room.stop();
    await room.done;
  });

  it("an orphan enrolment, whose actor no badge holds, is inert: said once, no row, no dispatch, no turn-away", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    const QUINN: Actor = { id: "act_quinn", name: "Quinn" };
    const RUE: Actor = { id: "act_rue", name: "Rue" };
    // A raw enrolment, as web adds made before the ask: nobody holds Quinn.
    home.enrol(QUINN);
    home.badgeHolds = new Set();
    const { deps, lines, turns, rows } = roomOver(home, clock, { rows: [] });
    const room = runRoom(deps);
    await clock.advance(0);
    // And one landing while the room runs.
    home.enrol(RUE);
    await clock.advance(0);
    for (const orphan of [QUINN, RUE]) {
      expect(lines.filter((l) => l === notHeld(orphan.name))).toHaveLength(1);
      expect(lines.some((l) => l.startsWith(`${orphan.name} ·`))).toBe(false);
      expect(home.calls).not.toContain(`claim:${orphan.id}`);
    }
    expect(lines.some((l) => l.includes("enrolled Rue"))).toBe(false);
    expect(rows).toEqual([]);
    // A stranger and the owner both ask: nothing starts, nothing is said back.
    const asked = home.mention(STRANGER, QUINN, "@Quinn can you look?");
    const owned = home.mention(OWNER, QUINN, "@Quinn please");
    await clock.advance(61_000);
    expect(turns).toHaveLength(0);
    expect(home.threads[asked]!.comments).toHaveLength(1);
    expect(home.threads[owned]!.comments).toHaveLength(1);
    expect([...home.sessions.values()].filter((s) => s.kind !== "rc")).toEqual([]);
    await room.stop();
    await room.done;
  });

  it("a hold refused mid-room re-claims this machine's agents and holds again; still refused, it says it could not hold, never that they are elsewhere", async () => {
    const clock = new HandClock();
    const home = new AcmeHome(clock);
    home.enrol(PERCY);
    home.badgeHolds = new Set([PERCY.id]);
    home.claimable = new Set([PERCY.id]);
    const { deps, lines, turns } = roomOver(home, clock);
    const room = runRoom(deps);
    await clock.advance(0);
    const before = home.calls.length;

    // A 401 went to the door, and the door's badge was re-claimed as the
    // person alone: the next hold naming Percy is refused.
    home.badgeHolds.clear();
    await clock.advance(10_000);
    const after = home.calls.slice(before);
    const refused = after.indexOf(`hold-refused:${PERCY.id}`);
    expect(refused).toBeGreaterThanOrEqual(0);
    expect(after.indexOf(`claim:${PERCY.id}`)).toBeGreaterThan(refused);
    expect(after.indexOf(`hold:${PERCY.id}`)).toBeGreaterThan(after.indexOf(`claim:${PERCY.id}`));
    expect(lines.some((l) => l.startsWith("could not hold"))).toBe(false);
    expect(lines).not.toContain(notHeld("Percy"));
    home.mention(OWNER, PERCY, "@Percy after the re-badge");
    await clock.advance(0);
    expect(turns).toHaveLength(1);

    // Now the claim is refused too: said once, as a hold it could not make.
    home.claimable.clear();
    home.badgeHolds.clear();
    await clock.advance(60_000);
    const couldNot = lines.filter((l) => l.startsWith("could not hold Percy's cursor — this badge does not speak for act_percy"));
    expect(couldNot).toHaveLength(1);
    expect(lines).not.toContain(notHeld("Percy"));
    expect(home.calls.filter((c) => c === `hold-refused:${PERCY.id}`).length).toBeGreaterThan(2);
    await room.stop();
    await room.done;
  });
});
