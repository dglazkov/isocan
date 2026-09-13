import { describe, expect, it } from "vitest";
import type { Actor, PresenceSession } from "../src/index.ts";
import {
  answerPolicy,
  collectCanvasNames,
  dispatchReason,
  gateSetAside,
  policyWords,
  refusedMentions,
  speakersFor,
  turnedAway,
  turnedAwayLine,
  extractMentions,
  invertOperation,
  LISTEN_ANYONE,
  lapsedFor,
  listensTo,
  listenUntil,
  listenWords,
  mayWake,
  parseListen,
  readsAsTurnedAway,
  spellListen,
  untilWords,
  withListener,
  OpValidationError,
  roster,
  rulesOf,
  SYSTEM_ACTOR,
} from "../src/index.ts";
import { alice, apply, bob, seedState } from "./helpers.ts";

/**
 * **The enrolment record's home half** (agents-on-demand phase 2): standing
 * agents as canvas state, written by `agent.enroll` / `agent.withdraw`.
 * What these pin: the record's shape, re-enrolment updating in place,
 * withdrawal removing the standing and nothing else, neither op being
 * undoable, and the property the whole storage decision was made for — an
 * enrolled agent that has never spoken is mentionable, so `@Sian` can
 * summon before Sian ever runs.
 */

const sian: Actor = { id: "usr_sian", name: "Sian" };

describe("agent.enroll / agent.withdraw", () => {
  it("enrolment writes the row, rules verbatim", () => {
    const s = apply(seedState(), {
      type: "agent.enroll",
      agent: sian,
      rules: { items: ["itm_1"], ops: ["item.addVersion"] },
    })!;
    expect(s.canvas.agents).toEqual({
      usr_sian: {
        actor: sian,
        rules: { items: ["itm_1"], ops: ["item.addVersion"] },
        // Stamped from the envelope (owner-only summons): who wrote the
        // enrolment as it stands, so the rc can tell its owner's gate from
        // anybody else's.
        writtenBy: alice,
      },
    });
  });

  it("re-enrolment by somebody else re-stamps who wrote it", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian, rules: { listen: [] } })!;
    s = apply(s, { type: "agent.enroll", agent: sian, rules: { listen: ["*"] } }, bob)!;
    expect(s.canvas.agents!["usr_sian"]!.writtenBy).toEqual(bob);
  });

  it("re-enrolment updates in place — the standing was already there", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian, rules: { a: 1 } })!;
    s = apply(s, { type: "agent.enroll", agent: sian, rules: { a: 2 } })!;
    expect(Object.keys(s.canvas.agents ?? {})).toEqual(["usr_sian"]);
    expect(s.canvas.agents!["usr_sian"]!.rules).toEqual({ a: 2 });
  });

  it("withdrawal removes the standing, not the rest of the canvas", () => {
    const before = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const after = apply(before, { type: "agent.withdraw", actorId: sian.id })!;
    expect(after.canvas.agents).toEqual({});
    expect(after.canvas.threads).toEqual(before.canvas.threads);
    expect(after.canvas.items).toEqual(before.canvas.items);
  });

  it("withdrawing a stranger is refused", () => {
    expect(() => apply(seedState(), { type: "agent.withdraw", actorId: "usr_ghost" })).toThrow(
      OpValidationError,
    );
  });

  it("neither op is undoable — standing never moves on a casual ⌘Z", () => {
    const s = seedState();
    expect(invertOperation(s, { type: "agent.enroll", agent: sian })).toBeNull();
    const enrolled = apply(s, { type: "agent.enroll", agent: sian })!;
    expect(invertOperation(enrolled, { type: "agent.withdraw", actorId: sian.id })).toBeNull();
  });

  it("a canvas from before the field behaves as empty", () => {
    const s = seedState();
    delete (s.canvas as { agents?: unknown }).agents;
    const enrolled = apply(s, { type: "agent.enroll", agent: sian })!;
    expect(Object.keys(enrolled.canvas.agents ?? {})).toEqual(["usr_sian"]);
  });
});

describe("an enrolled agent is mentionable before it ever speaks", () => {
  it("@Sian resolves with no comment, item or session by Sian anywhere", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const candidates = collectCanvasNames(s.canvas);
    expect(extractMentions("@Sian take a look?", candidates)).toEqual([sian.id]);
  });

  it("…and stops resolving through the enrolment once withdrawn", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    s = apply(s, { type: "agent.withdraw", actorId: sian.id })!;
    expect(extractMentions("@Sian still there?", collectCanvasNames(s.canvas))).toEqual([]);
  });
});

describe("the roster shows the record (phase 2.5)", () => {
  const rcSession = (actor: Actor): PresenceSession =>
    ({
      sessionId: "ses_rc",
      actor,
      kind: "rc",
      harness: null,
      label: null,
      cursor: null,
      selection: [],
      status: null,
      statusSource: null,
      activity: null,
      onThread: null,
      lastSeen: new Date().toISOString(),
    }) as PresenceSession;

  it("an enrolled agent is a row with no session at all — that is the point", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const rows = roster([], s.canvas, Date.now());
    const row = rows.find((r) => r.actorId === sian.id);
    expect(row).toMatchObject({ name: "Sian", state: "enrolled", primary: null });
  });

  it("an enrolled agent never doubles into the away half", () => {
    // Give Sian history (a thread), then withdraw-free: enrolled + activity
    // must still be ONE row.
    let s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    s = apply(
      s,
      {
        type: "thread.create",
        threadId: "th_s",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_s", body: "here" },
      },
      sian,
    )!;
    const rows = roster([], s.canvas, Date.now()).filter((r) => r.actorId === sian.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe("enrolled");
  });

  it("answerable is the caller's derivation, never the record's claim (phase 6)", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    // A caller that can see the connection-bound holds passes the set…
    const seen = roster([], s.canvas, Date.now(), new Set([sian.id]));
    expect(seen.find((r) => r.actorId === sian.id)!.state).toBe("answerable");
    // …and one that cannot (the web on a replica) under-claims, safely.
    const blind = roster([], s.canvas, Date.now());
    expect(blind.find((r) => r.actorId === sian.id)!.state).toBe("enrolled");
  });

  it("a parked rc's announcement is a process fact, never a roster row", () => {
    const person: Actor = { id: "usr_dimitri", name: "Dimitri" };
    const s = seedState();
    const rows = roster([rcSession(person)], s.canvas, Date.now());
    expect(rows.find((r) => r.actorId === person.id && r.state !== "away")).toBeUndefined();
  });
});

describe("dispatchReason — THE routing composition (phase 4)", () => {
  const sianCtx = (rules?: unknown) => ({
    actorId: sian.id,
    names: [{ id: sian.id, name: sian.name }],
    rules: rules === undefined ? null : (rules as { items?: string[]; ops?: string[] }),
  });
  const comment = (body: string, threadId = "th_x") =>
    ({
      type: "thread.create",
      threadId,
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: "cmt_x", body },
    }) as const;

  it("your own ops never wake you, mention or not", () => {
    const s = seedState();
    expect(dispatchReason(comment("@Sian hi"), sian.id, sianCtx(), s.canvas)).toBeNull();
  });

  it("a mention pierces any filter; unmatched noise stays noise", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const ctx = sianCtx({ ops: ["item.move"] });
    expect(dispatchReason(comment("@Sian look"), "usr_alice", ctx, s.canvas)).toBe("mentioned");
    expect(
      dispatchReason({ type: "item.move", itemId: "itm_1", x: 1, y: 2 }, "usr_alice", ctx, s.canvas),
    ).toBe("change");
    expect(
      dispatchReason({ type: "item.resize", itemId: "itm_1", width: 9, height: 9 }, "usr_alice", ctx, s.canvas),
    ).toBeNull();
  });

  it("empty rules mean comments only — the enrolled default", () => {
    const s = seedState();
    expect(
      dispatchReason({ type: "item.move", itemId: "itm_1", x: 1, y: 2 }, "usr_alice", sianCtx({}), s.canvas),
    ).toBeNull();
    expect(
      dispatchReason({ type: "item.move", itemId: "itm_1", x: 1, y: 2 }, "usr_alice", sianCtx({ ops: ["*"] }), s.canvas),
    ).toBe("change");
  });

  it("rulesOf reads the opaque field tolerantly", () => {
    expect(rulesOf(null)).toEqual({});
    expect(rulesOf("nonsense")).toEqual({});
    expect(rulesOf({ items: ["a", 3], ops: "not-an-array", extra: true })).toEqual({ items: ["a"] });
    expect(rulesOf({ listen: ["usr_dion", 7] })).toEqual({ listen: ["usr_dion"] });
  });
});

/**
 * **The speaker gate** (`docs/research/2026-09-04-sheepdog.md`, "whom it
 * listens to"), read with NO owner in sight — a `wait` park, which answers
 * for itself. What these pin is the ORDER — the gate is outside the
 * composition, so it beats the one thing nothing else beats, a mention. The
 * rc's reading, where absent means the owner alone, is the next block.
 */
describe("dispatchReason — the speaker gate", () => {
  const gated = (listen?: string[]) => ({
    actorId: sian.id,
    names: [{ id: sian.id, name: sian.name }],
    rules: listen === undefined ? null : { ops: ["*"], listen },
  });
  const comment = (body: string) =>
    ({
      type: "thread.create",
      threadId: "th_x",
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: "cmt_x", body },
    }) as const;
  const move = { type: "item.move", itemId: "itm_1", x: 1, y: 2 } as const;

  it("with no owner in sight, no gate answers everybody — a park answers for itself", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    expect(dispatchReason(comment("@Sian look"), "usr_alice", gated(), s.canvas)).toBe("mentioned");
  });

  it("a mention from outside the gate is nothing at all — not a summons, not a change", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    const ctx = gated(["usr_dion"]);
    // The whole feature in one assertion: a mention pierces every filter and
    // does NOT pierce this. A stranger's `@Sian` costs the owner nothing.
    expect(dispatchReason(comment("@Sian look"), "usr_alice", ctx, s.canvas)).toBeNull();
    expect(dispatchReason(move, "usr_alice", ctx, s.canvas)).toBeNull();
    // And the person it does admit is unaffected in both directions.
    expect(dispatchReason(comment("@Sian look"), "usr_dion", ctx, s.canvas)).toBe("mentioned");
    expect(dispatchReason(move, "usr_dion", ctx, s.canvas)).toBe("change");
  });

  it("the main thread does not pierce it either — the Chat is a speaker too", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    s = apply(s, {
      type: "thread.create",
      threadId: "th_main",
      x: 0,
      y: 0,
      anchorItemId: null,
      main: true,
      comment: { id: "cmt_1", body: "morning" },
    })!;
    const inMain = {
      type: "thread.reply",
      threadId: "th_main",
      comment: { id: "cmt_2", body: "anyone about?" },
    } as const;
    expect(dispatchReason(inMain, "usr_alice", gated(["usr_dion"]), s.canvas)).toBeNull();
    expect(dispatchReason(inMain, "usr_dion", gated(["usr_dion"]), s.canvas)).toBe("main-thread");
  });

  it('"*" turns the gate off without deleting the field', () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    expect(dispatchReason(comment("@Sian hi"), "usr_alice", gated(["*"]), s.canvas)).toBe("mentioned");
    expect(dispatchReason(comment("@Sian hi"), "usr_alice", gated([]), s.canvas)).toBe("mentioned");
  });

  it("listensTo and listenWords answer from the same field, so no surface can be silent", () => {
    expect(listensTo({ listen: ["usr_dion"] }, "usr_dion")).toBe(true);
    expect(listensTo({ listen: ["usr_dion"] }, "usr_alice")).toBe(false);
    expect(listensTo(null, "usr_alice")).toBe(true);
    expect(listensTo({ listen: [LISTEN_ANYONE] }, "usr_alice")).toBe(true);

    const nameOf = (id: string) => ({ usr_dion: "Dion", usr_usama: "Usama" })[id];
    expect(listenWords(null, nameOf)).toBeNull();
    expect(listenWords({ listen: [LISTEN_ANYONE] }, nameOf)).toBeNull();
    expect(listenWords({ listen: ["usr_dion"] }, nameOf)).toBe("listens to Dion");
    expect(listenWords({ listen: ["usr_dion", "usr_usama"] }, nameOf)).toBe("listens to Dion and Usama");
    expect(listenWords({ listen: ["usr_dion", "usr_usama", "usr_jt"] }, nameOf)).toBe(
      "listens to Dion and 2 others",
    );
    // An id nobody can name still reads as something a person can act on.
    expect(listenWords({ listen: ["usr_ghost"] }, nameOf)).toBe("listens to usr_ghost");
  });
});

/**
 * **Owner-only summons** (decided 11 Sep 2026 — issue #238, the rc research
 * note's recommendation 6). The rc reads an enrolment through its owner:
 * absent means the owner alone, a list adds people, "*" is everyone — and
 * only the owner's word (or the owner's machine's) may widen it.
 */
describe("owner-only summons — the rc's reading of the gate", () => {
  const nico: Actor = { id: "usr_nico", name: "Nico" };
  const percy = "usr_percy"; // an agent on Nico's machine
  const keeping = { owner: nico, hands: [nico.id, percy] };
  const comment = (body: string) =>
    ({
      type: "thread.create",
      threadId: "th_x",
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: "cmt_x", body },
    }) as const;
  const at = (rules: unknown, writtenBy?: string) => ({
    actorId: sian.id,
    names: [{ id: sian.id, name: sian.name }],
    rules: rulesOf(rules),
    policy: answerPolicy(rulesOf(rules), keeping, writtenBy),
    hands: keeping.hands,
  });

  it("the default is the owner alone — a stranger's mention wakes nothing", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    // The migration in one line: an enrolment with no gate, which answered
    // everyone until today, now answers its owner.
    expect(answerPolicy({}, keeping, nico.id)).toEqual({ owner: nico, listen: [] });
    expect(dispatchReason(comment("@Sian look"), "usr_alice", at({}, nico.id), s.canvas)).toBeNull();
    expect(dispatchReason(comment("@Sian look"), nico.id, at({}, nico.id), s.canvas)).toBe("mentioned");
  });

  it("the owner's machine is the owner's hands — two agents on one laptop still talk", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    expect(dispatchReason(comment("@Sian over to you"), percy, at({}, nico.id), s.canvas)).toBe("mentioned");
  });

  it("a joined identity of the owner is the owner", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    const joined = { usr_nico_web: nico.id };
    const ctx = { ...at({}, nico.id), joined };
    expect(dispatchReason(comment("@Sian look"), "usr_nico_web", ctx, s.canvas)).toBe("mentioned");
  });

  it("widening: a list admits the owner AND those people; '*' admits everyone", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    const named = at({ listen: ["usr_alice"] }, nico.id);
    expect(dispatchReason(comment("@Sian look"), "usr_alice", named, s.canvas)).toBe("mentioned");
    expect(dispatchReason(comment("@Sian look"), nico.id, named, s.canvas)).toBe("mentioned");
    expect(dispatchReason(comment("@Sian look"), "usr_bob", named, s.canvas)).toBeNull();
    const open = at({ listen: [LISTEN_ANYONE] }, nico.id);
    expect(dispatchReason(comment("@Sian look"), "usr_bob", open, s.canvas)).toBe("mentioned");
    // `--to me` names the owner, which adds nothing and must not say so twice.
    expect(answerPolicy({ listen: [nico.id] }, keeping, nico.id)).toEqual({ owner: nico, listen: [] });
  });

  it("only the owner's word widens — anybody else's enrolment reads as owner-only", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    // Bob re-enrolled Sian open to everyone. The canvas may narrow; it may
    // never spend somebody else's tokens.
    const forged = at({ listen: [LISTEN_ANYONE] }, "usr_bob");
    expect(forged.policy).toEqual({ owner: nico, listen: [] });
    expect(dispatchReason(comment("@Sian look"), "usr_bob", forged, s.canvas)).toBeNull();
    expect(gateSetAside({ listen: [LISTEN_ANYONE] }, keeping, "usr_bob")).toBe(true);
    // The owner's machine writing it is the owner writing it…
    expect(answerPolicy({ listen: [LISTEN_ANYONE] }, keeping, percy).listen).toEqual([LISTEN_ANYONE]);
    // …and a row older than the stamp is taken as it stands.
    expect(answerPolicy({ listen: [LISTEN_ANYONE] }, keeping, undefined).listen).toEqual([LISTEN_ANYONE]);
    expect(gateSetAside({}, keeping, "usr_bob")).toBe(false);
  });

  it("the gate turns away before anything is counted — a change from outside is not a change", () => {
    const s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    const move = { type: "item.move", itemId: "itm_1", x: 1, y: 2 } as const;
    expect(dispatchReason(move, "usr_alice", at({ ops: ["*"] }, nico.id), s.canvas)).toBeNull();
    expect(dispatchReason(move, nico.id, at({ ops: ["*"] }, nico.id), s.canvas)).toBe("change");
  });

  it("a turned-away MENTION gets words; the Chat being loud does not", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    s = apply(s, {
      type: "thread.create",
      threadId: "th_main",
      x: 0,
      y: 0,
      anchorItemId: null,
      main: true,
      comment: { id: "cmt_1", body: "morning" },
    })!;
    const ctx = at({}, nico.id);
    expect(turnedAway(comment("@Sian look"), "usr_alice", ctx)).toBe(true);
    const chat = { type: "thread.reply", threadId: "th_main", comment: { id: "c2", body: "anyone?" } } as const;
    expect(turnedAway(chat, "usr_alice", ctx)).toBe(false);
    expect(turnedAway(comment("@Sian look"), nico.id, ctx)).toBe(false);
    expect(turnedAway(comment("@Sian look"), SYSTEM_ACTOR.id, ctx)).toBe(false);
  });

  it("the words name the owner and the exact gesture, and read 'you' to the owner", () => {
    const nameOf = (id: string) => ({ usr_nico: "Nico", usr_usama: "Usama", usr_alice: "Alice" })[id];
    const alone = { owner: nico, listen: [] };
    expect(policyWords(alone, nameOf)).toBe("listens only to Nico");
    expect(policyWords(alone, nameOf, nico.id)).toBe("listens only to you");
    expect(policyWords({ owner: nico, listen: ["usr_usama"] }, nameOf)).toBe("listens to Nico and Usama");
    expect(policyWords({ owner: nico, listen: ["usr_usama", "usr_alice"] }, nameOf)).toBe(
      "listens to Nico and 2 others",
    );
    expect(policyWords({ owner: nico, listen: [LISTEN_ANYONE] }, nameOf)).toBeNull();
    expect(turnedAwayLine("Sian", alone, nameOf, "Alice")).toBe(
      "Sian listens only to Nico — this did not wake Sian, and spent nothing. " +
        "Nico can widen it: isocan rc listen Sian --to Alice",
    );
    // `--to` replaces the list, so the suggestion keeps who is already in.
    expect(turnedAwayLine("Sian", { owner: nico, listen: ["usr_usama"] }, nameOf, "Alice")).toContain(
      "--to Usama,Alice",
    );
    expect(turnedAwayLine("Sian", alone, nameOf, "Alice Smith")).toContain('--to "Alice Smith"');
  });

  it("a stranger cannot reach it one hop later, through a sibling that listens to everyone", () => {
    /* Found by walking it in a browser on 11 Sep: Alice's Chat line was
       turned away by Sian, woke Percy (open to everyone), and Percy's reply
       — Nico's machine talking — woke Sian anyway. The gate reads the word
       an agent is carrying, not the agent. */
    const s = apply(seedState(), { type: "agent.enroll", agent: sian }, nico)!;
    const carried = new Map<string, ReadonlySet<string>>([[percy, new Set(["usr_alice"])]]);
    const onBehalfOf = [...speakersFor([percy], (id) => carried.get(id))];
    expect(onBehalfOf).toEqual(["usr_alice"]);
    const ctx = { ...at({}, nico.id), onBehalfOf };
    expect(dispatchReason(comment("@Sian over to you"), percy, ctx, s.canvas)).toBeNull();
    expect(turnedAway(comment("@Sian over to you"), percy, ctx)).toBe(true);
    // Percy carrying Nico's word is Nico asking…
    expect(dispatchReason(comment("@Sian over to you"), percy, { ...at({}, nico.id), onBehalfOf: [nico.id] }, s.canvas)).toBe(
      "mentioned",
    );
    // …a turn carrying both is let in by the one the gate admits…
    expect(
      dispatchReason(comment("@Sian"), percy, { ...at({}, nico.id), onBehalfOf: ["usr_alice", nico.id] }, s.canvas),
    ).toBe("mentioned");
    // …and an agent with nothing recorded speaks for itself: its owner's hand.
    expect([...speakersFor([percy], () => undefined)]).toEqual([percy]);
    // Followed through a chain: Alice → Percy → a third agent.
    carried.set("usr_third", speakersFor([percy], (id) => carried.get(id)));
    expect([...carried.get("usr_third")!]).toEqual(["usr_alice"]);
  });

  it("a client reads the same refusal from an announced policy", () => {
    const policies = { [sian.id]: { owner: nico, listen: [] }, usr_open: { owner: nico, listen: ["*"] } };
    expect(refusedMentions([sian.id, "usr_open"], "usr_alice", policies)).toEqual([
      { actorId: sian.id, policy: { owner: nico, listen: [] } },
    ]);
    expect(refusedMentions([sian.id], nico.id, policies)).toEqual([]);
    expect(refusedMentions([sian.id], "usr_alice", undefined)).toEqual([]);
  });

  /**
   * **Granting from the UI** (issue #272). The web writes the same `listen`
   * list `isocan rc listen --to` writes, through the one function both call —
   * so "the CLI and the button write the same op" is a property of the code
   * rather than a promise in a commit message.
   */
  describe("a grant, with or without a clock on it", () => {
    const nameOf = (id: string) => ({ usr_nico: "Nico", usr_usama: "Usama", usr_alice: "Alice" })[id];
    const now = Date.parse("2026-09-11T18:00:00.000Z");
    const later = new Date(now + 86_400_000).toISOString();
    const before = new Date(now - 3_600_000).toISOString();

    it("appends to the gate that already stands rather than replacing it", () => {
      const one = { owner: nico, listen: ["usr_usama"] };
      expect(withListener(one, "usr_alice", true)).toEqual(["usr_usama", "usr_alice"]);
      // Taking a name out leaves the rest — the click says one thing.
      expect(withListener({ owner: nico, listen: ["usr_usama", "usr_alice"] }, "usr_alice", false)).toEqual([
        "usr_usama",
      ]);
      // "Anyone" is the answer INSTEAD of the list, and undoing it leaves the
      // names the owner last chose by hand.
      expect(withListener(one, LISTEN_ANYONE, true)).toEqual([LISTEN_ANYONE]);
      expect(withListener({ owner: nico, listen: [LISTEN_ANYONE] }, LISTEN_ANYONE, false)).toEqual([]);
      // Naming somebody while it stands open is not a narrowing.
      expect(withListener({ owner: nico, listen: [LISTEN_ANYONE] }, "usr_alice", true)).toEqual([LISTEN_ANYONE]);
    });

    it("writes how long as an entry beside the name, and a grant with no expiry stays a bare id", () => {
      const listen = withListener({ owner: nico, listen: [] }, "usr_alice", true, { until: later });
      expect(listen).toEqual([{ id: "usr_alice", until: later }]);
      expect(parseListen(listen[0]!)).toEqual({ id: "usr_alice", until: later });
      // A gate that gains no expiry is byte-identical to what it always was,
      // so nothing already stored changes shape and every reader goes on
      // reading it.
      expect(spellListen("usr_alice", null)).toBe("usr_alice");
      expect(withListener({ owner: nico, listen: [] }, "usr_alice", true)).toEqual(["usr_alice"]);
      // An `until` that is not a time is ignored rather than trusted: a gate
      // must never widen — or narrow — because a value was malformed.
      expect(parseListen({ id: "usr_alice", until: "soonish" })).toEqual({ id: "usr_alice" });
    });

    it("is dropped whole by a reader that has never heard of expiry — the fail-closed direction", () => {
      /**
       * The property the shape was chosen FOR (#272 phase 3, #273). An older
       * build's `rulesOf` kept only strings in this list, so it does not see
       * a listener id that is not an id — it sees no entry at all.
       */
      const asOlderBuildReads = (listen: readonly unknown[]) =>
        listen.filter((v): v is string => typeof v === "string");
      const stored = [`usr_usama`, { id: "usr_alice", until: later }];
      expect(asOlderBuildReads(stored)).toEqual(["usr_usama"]);
      // Alice's grant is simply absent there: she cannot wake it, and — the
      // half that matters — nothing renders half a date as her name.
      const old = answerPolicy({ listen: asOlderBuildReads(stored) }, keeping, nico.id);
      expect(mayWake(old, "usr_alice", undefined, undefined, now)).toBe(false);
      expect(policyWords(old, nameOf, undefined, undefined, now)).toBe("listens to Nico and Usama");
      // `rulesOf` here keeps both shapes and nothing else: a malformed entry
      // is dropped exactly as a string list drops a number.
      expect(rulesOf({ listen: stored }).listen).toEqual(stored);
      expect(rulesOf({ listen: [7, null, { until: later }, "usr_bob"] }).listen).toEqual(["usr_bob"]);
    });

    it("a lapsed grant wakes nothing, and is not named as though it did", () => {
      const lapsedGate = { owner: nico, listen: [{ id: "usr_alice", until: before }] };
      expect(mayWake(lapsedGate, "usr_alice", undefined, undefined, now)).toBe(false);
      expect(mayWake(lapsedGate, nico.id, undefined, undefined, now)).toBe(true);
      // The words say what dispatch does — never "listens to Alice" of a gate
      // that will turn Alice away.
      expect(policyWords(lapsedGate, nameOf, undefined, undefined, now)).toBe("listens only to Nico");
      const live = { owner: nico, listen: [{ id: "usr_alice", until: later }] };
      expect(mayWake(live, "usr_alice", undefined, undefined, now)).toBe(true);
      expect(policyWords(live, nameOf, undefined, undefined, now)).toBe("listens to Nico and Alice");
      // `wait`'s reading of a stored gate keeps the same clock.
      expect(listensTo({ listen: [{ id: "usr_alice", until: before }] }, "usr_alice", undefined, now)).toBe(false);
      expect(listensTo({ listen: [{ id: "usr_alice", until: later }] }, "usr_alice", undefined, now)).toBe(true);
    });

    it("refuses a lapsed grant in the same words, plus the one that says it lapsed", () => {
      const gate = { owner: nico, listen: [{ id: "usr_alice", until: before }] };
      const line = turnedAwayLine("Sian", gate, nameOf, "Alice", {
        lapsed: lapsedFor(gate, "usr_alice", undefined, now),
        now,
      });
      expect(line).toContain("Sian listens only to Nico — this did not wake Sian, and spent nothing.");
      expect(line).toContain("Alice's access lapsed 1h ago.");
      // The suggestion is a command to retype: names, no expiries, and the
      // lapsed one is not smuggled back in as though it still stood.
      expect(line).toContain("--to Alice");
      expect(line).not.toContain("until 2026");
      // A client reading the announced policy reaches the same two facts.
      expect(refusedMentions([sian.id], "usr_alice", { [sian.id]: gate }, undefined, now)).toEqual([
        { actorId: sian.id, policy: gate, lapsed: before },
      ]);
    });

    it("lets a surface recognise a refusal it did not write", () => {
      /* The refusal is a system comment and it stays in the thread forever.
         Once the owner widens the gate the words above the reader are no
         longer true, and saying so beside them means knowing which comment
         they are (#272 phase 1). */
      const body = turnedAwayLine("Sian", { owner: nico, listen: [] }, nameOf, "Alice");
      expect(readsAsTurnedAway(body, "Sian")).toBe(true);
      expect(readsAsTurnedAway(body, "Percy")).toBe(false);
      expect(readsAsTurnedAway("Sian said hello", "Sian")).toBe(false);
    });

    it("says how long in one vocabulary, and resolves a span to an instant", () => {
      expect(listenUntil("never")).toBeNull();
      expect(listenUntil("7d", now)).toBe(new Date(now + 7 * 86_400_000).toISOString());
      expect(listenUntil("24h", now)).toBe(new Date(now + 86_400_000).toISOString());
      expect(() => listenUntil("soonish")).toThrow(/not a length of time/);
      expect(untilWords(new Date(now + 7 * 86_400_000).toISOString(), now)).toBe("for 7d");
      expect(untilWords(before, now)).toBe("lapsed 1h ago");
    });

    it("one name granted twice is one grant, and the longer one wins", () => {
      /* Two clicks, two spans: the owner widening a grant they already gave
         is widening it, and the gate must not end up naming Alice twice. */
      const policy = answerPolicy(
        { listen: [{ id: "usr_alice", until: before }, { id: "usr_alice", until: later }] },
        keeping,
        nico.id,
      );
      expect(policy.listen).toEqual([{ id: "usr_alice", until: later }]);
      expect(mayWake(policy, "usr_alice", undefined, undefined, now)).toBe(true);
      // A grant with no expiry is the longer one, whatever order it arrived in.
      expect(
        answerPolicy({ listen: [{ id: "usr_alice", until: later }, "usr_alice"] }, keeping, nico.id).listen,
      ).toEqual(["usr_alice"]);
      // And a gate somebody else wrote is still set aside, timed or not.
      expect(answerPolicy({ listen: [{ id: "usr_alice", until: later }] }, keeping, "usr_bob").listen).toEqual([]);
      expect(gateSetAside({ listen: [{ id: "usr_alice", until: later }] }, keeping, "usr_bob")).toBe(true);
    });
  });
});

describe("the system voice (phase 5)", () => {
  it("is a voice, not a participant: unmentionable, no roster row", () => {
    let s = seedState();
    s = apply(
      s,
      {
        type: "thread.create",
        threadId: "th_sys",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_sys", body: "Sian couldn't answer — machinery reporting" },
      },
      SYSTEM_ACTOR,
    )!;
    expect(extractMentions("@isocan are you there?", collectCanvasNames(s.canvas))).toEqual([]);
    expect(roster([], s.canvas, Date.now()).find((r) => r.actorId === SYSTEM_ACTOR.id)).toBeUndefined();
  });

  it("its reports never summon — the failure message must not wake the failure", () => {
    let s = apply(seedState(), { type: "agent.enroll", agent: sian })!;
    // Sian is IN this thread (wrote in it), so an ordinary reply would be
    // in-your-thread; the system's reply is not.
    s = apply(
      s,
      { type: "thread.create", threadId: "th_g", x: 0, y: 0, anchorItemId: null, comment: { id: "c0", body: "hello" } },
      sian,
    )!;
    const systemReply = {
      type: "thread.reply",
      threadId: "th_g",
      comment: { id: "c1", body: "Sian couldn't answer — the adapter died" },
    } as const;
    expect(
      dispatchReason(systemReply, SYSTEM_ACTOR.id, { actorId: sian.id, names: [sian] }, s.canvas),
    ).toBeNull();
  });
});
