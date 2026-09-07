import { describe, expect, it } from "vitest";
import { ANSWER_WITHIN_MS, summonsLine, summonsState, waitingLine, wokenLine } from "../src/index.ts";
import type { Comment, CommentThread, PresenceSession } from "../src/index.ts";

/**
 * **Silence becomes a fact instead of a mystery** (#197 phase 1).
 *
 * The question this answers is the one that started the standing-agents work:
 * *"it seems hard to know if an agent is actually around and able to wake and
 * answer."* Naming an agent used to produce a reply or nothing, and nothing
 * looked identical whether the agent was thinking, wedged, out of budget, or
 * had never been listening.
 *
 * The cases below are written from the failure modes rather than the happy
 * path, because the happy path is the one that never needed a receipt.
 */
const T0 = Date.parse("2026-09-07T10:00:00.000Z");
const AGENT = "usr_percy";
const THREAD = "thr_1";

const session = (over: Partial<PresenceSession> = {}): PresenceSession =>
  ({
    sessionId: "ses_1",
    actor: { id: AGENT, name: "Percy" },
    capability: "edit",
    onThread: null,
    ...over,
  }) as unknown as PresenceSession;

const thread = (comments: Partial<Comment>[]): CommentThread =>
  ({
    id: THREAD,
    comments: comments.map((c, i) => ({
      id: `c${i}`,
      body: "…",
      author: { id: AGENT, name: "Percy" },
      createdAt: new Date(T0).toISOString(),
      ...c,
    })),
  }) as unknown as CommentThread;

describe("a summons carries a receipt", () => {
  const ask = { actorId: AGENT, threadId: THREAD, askedAt: T0 };

  it("says asked, while it is still reasonable to be waiting", () => {
    const state = summonsState(ask, { sessions: [], rcParked: true }, T0 + 3_000);
    expect(state).toEqual({ state: "asked", waitedMs: 3_000 });
    expect(summonsLine("Percy", state)).toBe("asked Percy");
  });

  it("says picked up the moment presence names this thread", () => {
    /* `PresenceActivity` already carried `{ kind: "working", threadId }` — the
       protocol comment calls it "the question the person who asked it is
       waiting on". This phase is that fact, rendered. */
    const working = session({ onThread: THREAD } as never);
    const state = summonsState(ask, { sessions: [working], rcParked: true }, T0 + 4_000);
    expect(state).toEqual({ state: "picked-up", afterMs: 4_000 });
    expect(summonsLine("Percy", state)).toBe("Percy picked it up (4s)");
  });

  it("ignores the same agent working somewhere else", () => {
    // Presence on ANOTHER thread means it is busy, not that it took this. The
    // whole value of the receipt is that it does not flatter.
    const elsewhere = session({ onThread: "thr_other" } as never);
    const state = summonsState(ask, { sessions: [elsewhere], rcParked: true }, T0 + 4_000);
    expect(state.state).toBe("asked");
  });

  it("ignores a session for somebody else entirely", () => {
    const other = session({ actor: { id: "usr_someone", name: "Someone" }, onThread: THREAD } as never);
    expect(summonsState(ask, { sessions: [other], rcParked: true }, T0 + 4_000).state).toBe("asked");
  });

  it("reads onThread, never activity — the field that means ANSWERING", () => {
    /**
     * The guard for a mistake this file made and shipped for twenty minutes.
     *
     * The first cut read `activity.threadId`, and the protocol comment on
     * `onThread` exists to forbid exactly that: `activity` says where a
     * session is STANDING and moves on every applied op, so an agent
     * "vanished from the thread the instant it started working, which is
     * exactly when you most want to see it".
     *
     * It passed, because the fixtures were built with `activity` — the test
     * validating its own wrong assumption rather than the wire (lessons.md
     * #5). So this session is shaped the way a real one is when an agent is
     * standing on a thread it has NOT picked up: activity there, onThread
     * null. The old code called that picked-up.
     */
    const standingNotAnswering = session({
      onThread: null,
      activity: { kind: "working", threadId: THREAD },
    } as never);
    expect(
      summonsState(ask, { sessions: [standingNotAnswering], rcParked: true }, T0 + 4_000).state,
      "standing on a thread is not answering it",
    ).toBe("asked");
  });

  it("lets a reply outrank everything, even if presence was never seen", () => {
    /* An agent quick enough to answer before its presence reaches this tab
       must never read as "nothing answered" — the receipt would be calling a
       working agent broken, which is worse than no receipt. */
    const replied = thread([{ createdAt: new Date(T0 + 6_000).toISOString() }]);
    const state = summonsState(ask, { sessions: [], rcParked: true, thread: replied }, T0 + ANSWER_WITHIN_MS + 10_000);
    expect(state).toEqual({ state: "answered", afterMs: 6_000 });
    expect(summonsLine("Percy", state)).toBe("Percy answered (6s)");
  });

  it("does not count a comment the agent left BEFORE it was asked", () => {
    // Otherwise every summons in a thread the agent has ever spoken in reads
    // as instantly answered, which is the receipt lying in the flattering
    // direction — the direction nobody checks.
    const older = thread([{ createdAt: new Date(T0 - 60_000).toISOString() }]);
    const state = summonsState(ask, { sessions: [], rcParked: true, thread: older }, T0 + 3_000);
    expect(state.state).toBe("asked");
  });

  it("says nothing answered past the bound, and names the rc when one is parked", () => {
    /* The sentence the whole phase exists for. A parked rc that did not
       respond is a broken agent; that is a different problem from nobody
       being home, and it wants a different next move. */
    const state = summonsState(ask, { sessions: [], rcParked: true }, T0 + ANSWER_WITHIN_MS);
    expect(state).toEqual({ state: "unanswered", waitedMs: ANSWER_WITHIN_MS, rcParked: true });
    expect(summonsLine("Percy", state)).toBe("nothing answered — the rc is parked but did not respond");
  });

  it("says something different when nothing was listening at all", () => {
    const state = summonsState(ask, { sessions: [], rcParked: false }, T0 + ANSWER_WITHIN_MS);
    expect(summonsLine("Percy", state)).toBe("nothing answered — nothing is listening for Percy here");
  });

  it("holds the boundary, on both sides", () => {
    // A tuning constant that must not be frozen gets bracketed, per
    // lessons.md #11: one case that fails if it moves down, one if it moves up.
    expect(summonsState(ask, { sessions: [], rcParked: true }, T0 + ANSWER_WITHIN_MS - 1).state).toBe("asked");
    expect(summonsState(ask, { sessions: [], rcParked: true }, T0 + ANSWER_WITHIN_MS).state).toBe("unanswered");
  });

  it("keeps a pick-up once seen, so a finished turn is not mistaken for silence", () => {
    /* Presence goes when the turn ends. Without the caller remembering the
       moment, an agent that picked something up, worked and stopped would
       fall back through to "nothing answered" — the receipt calling a
       completed turn a failure. */
    const state = summonsState(ask, { sessions: [], rcParked: true, pickedUpAt: T0 + 2_000 }, T0 + ANSWER_WITHIN_MS + 5_000);
    expect(state).toEqual({ state: "picked-up", afterMs: 2_000 });
  });
});

describe("the line for an agent that was woken and has said nothing", () => {
  /**
   * The rung that needed a clock. `OnIt` said "Fable was woken — waiting for
   * them to pick this up" and went on saying it however long the silence ran:
   * a promise with no deadline, which is what #197 means by silence you cannot
   * tell apart from thinking.
   */
  it("waits patiently while there is reason to", () => {
    expect(wokenLine(["Fable"], 5_000)).toBe(
      "Fable was woken — waiting for them to pick this up.",
    );
    expect(wokenLine(["Fable", "Percy"], 5_000)).toBe(
      "Fable, Percy were woken — waiting for one of them to pick this up.",
    );
  });

  it("stops promising once the promise has expired", () => {
    expect(wokenLine(["Fable"], ANSWER_WITHIN_MS)).toBe(
      "Fable was woken 45s ago and has not picked this up.",
    );
    expect(wokenLine(["Fable", "Percy"], 60_000)).toBe(
      "Fable, Percy were woken 60s ago and none has picked this up.",
    );
  });

  it("says WOKEN rather than parked, because that is the damning fact", () => {
    // Not an agent that might have missed it — one the daemon reached.
    expect(wokenLine(["Fable"], ANSWER_WITHIN_MS)).toContain("woken");
    expect(wokenLine(["Fable"], ANSWER_WITHIN_MS)).not.toContain("parked");
  });

  it("holds the boundary on both sides", () => {
    expect(wokenLine(["Fable"], ANSWER_WITHIN_MS - 1)).toContain("waiting for");
    expect(wokenLine(["Fable"], ANSWER_WITHIN_MS)).toContain("has not picked this up");
  });
});

describe("the line when nothing was woken at all", () => {
  /**
   * This one has NO clock, and the first cut got it backwards — the bound was
   * here, where it would have said "nothing answered" about a comment that
   * woke nobody. Blaming an agent for not replying to something nobody asked
   * it is the same lie as claiming somebody was asked when they were not.
   *
   * Caught by looking at the running app rather than by reading the code: a
   * parked `wait` on a real canvas took the branch above instead.
   */
  it("names the room, and never ages into an accusation", () => {
    expect(waitingLine(0)).toBe("Nobody is parked — this waits on the thread for the next agent.");
    expect(waitingLine(1)).toBe("Sent. One agent is listening.");
    expect(waitingLine(3)).toBe("Sent. 3 agents are listening.");
  });

  it("takes no time at all, so it cannot start accusing later", () => {
    // The signature is the guard: there is no `waitedMs` to thread through, so
    // a future edit cannot quietly make this branch time out.
    expect(waitingLine.length).toBe(1);
  });
});
