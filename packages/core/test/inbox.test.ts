import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Actor, CanvasContents } from "../src/model.ts";
import {
  addressesActor,
  inboxLine,
  inboxNewestFirst,
  inboxOn,
  inboxTally,
  namesFor,
} from "../src/inbox.ts";

/**
 * The rule came from `isocan wait`, which has decided "is this for me" across
 * several canvases for weeks. `docs/research/2026-08-29-the-inbox.md` is the
 * argument for moving it: a rule one surface enforces and the other does not
 * know is a habit, not a rule, and two definitions of "for me" disagree
 * silently — which shows up as somebody not being told something.
 */
const dion: Actor = { id: "usr_dion", name: "Dion" };
const kenny: Actor = { id: "usr_kenny", name: "Kenny" };
const names = namesFor(dion);

const comment = (
  id: string,
  author: Actor,
  body: string,
  at: string,
  mentions?: string[],
) => ({ id, author, body, createdAt: at, ...(mentions ? { mentions } : {}) });

const canvasWith = (threads: Record<string, unknown>) =>
  ({ items: {}, threads }) as unknown as CanvasContents;

describe("what is addressed to you", () => {
  it("a direct mention, by the id resolved when it was written", () => {
    const canvas = canvasWith({
      t1: {
        id: "t1",
        comments: [comment("c1", kenny, "@Dion can you look?", "2026-08-01", ["usr_dion"])],
      },
    });
    const found = inboxOn(canvas, dion, names, "prj_a");
    expect(found).toHaveLength(1);
    expect(found[0]!.reason).toBe("mentioned");
  });

  it("and by the words, because older comments predate the resolved field", () => {
    const canvas = canvasWith({
      t1: { id: "t1", comments: [comment("c1", kenny, "@Dion thoughts?", "2026-08-01")] },
    });
    expect(inboxOn(canvas, dion, names, "prj_a")).toHaveLength(1);
  });

  it("a name you answer to this run, not only your identity name", () => {
    // An agent wearing the label "Percy" is @Percy to everybody on the canvas.
    // `wait` has always looked for both; so does this.
    const percy = namesFor(dion, "Percy");
    const canvas = canvasWith({
      t1: { id: "t1", comments: [comment("c1", kenny, "@Percy the numbers?", "2026-08-01")] },
    });
    expect(inboxOn(canvas, dion, percy, "prj_a")).toHaveLength(1);
    expect(inboxOn(canvas, dion, names, "prj_a"), "not under the other name").toEqual([]);
  });

  it("the Chat, because it is the channel everybody is in", () => {
    const canvas = canvasWith({
      t1: { id: "t1", main: true, comments: [comment("c1", kenny, "shipping now", "2026-08-01")] },
    });
    expect(inboxOn(canvas, dion, names, "prj_a")[0]!.reason).toBe("main-thread");
  });

  it("a reply to a thread you are in, even when it does not repeat your name", () => {
    const canvas = canvasWith({
      t1: {
        id: "t1",
        comments: [
          comment("c1", dion, "what about the dock?", "2026-08-01"),
          comment("c2", kenny, "fixed", "2026-08-02"),
        ],
      },
    });
    const found = inboxOn(canvas, dion, names, "prj_a");
    expect(found.map((f) => f.comment.id)).toEqual(["c2"]);
    expect(found[0]!.reason).toBe("in-your-thread");
  });

  it("NEVER your own words", () => {
    /**
     * Obvious once said and exactly what a filter forgets: you are in every
     * thread you wrote in, so without this every comment you ever left comes
     * back to you and the inbox is a mirror.
     */
    const canvas = canvasWith({
      t1: {
        id: "t1",
        main: true,
        comments: [
          comment("c1", dion, "@Dion note to self", "2026-08-01", ["usr_dion"]),
          comment("c2", dion, "and another", "2026-08-02"),
        ],
      },
    });
    expect(inboxOn(canvas, dion, names, "prj_a")).toEqual([]);
  });

  it("is silent about a room you are not in", () => {
    // Everything else is ether — `wait`'s word, and the reason an inbox is
    // worth having rather than a firehose.
    const canvas = canvasWith({
      t1: { id: "t1", comments: [comment("c1", kenny, "talking to nobody", "2026-08-01")] },
    });
    expect(inboxOn(canvas, dion, names, "prj_a")).toEqual([]);
  });
});

describe("reading it", () => {
  const entries = [
    ...inboxOn(
      canvasWith({
        t1: { id: "t1", main: true, comments: [comment("c1", kenny, "one", "2026-08-01")] },
        t2: { id: "t2", comments: [comment("c2", kenny, "@Dion two", "2026-08-03", ["usr_dion"])] },
      }),
      dion,
      names,
      "prj_a",
      "Lake House",
    ),
  ];

  it("comes newest first, sorted in one place", () => {
    // Every surface must agree on "newest", and it is exactly the sort
    // somebody reimplements slightly differently.
    expect(inboxNewestFirst(entries).map((e) => e.comment.id)).toEqual(["c2", "c1"]);
  });

  it("counts by WHY, so the room being loud is not somebody asking you", () => {
    expect(inboxTally(entries)).toEqual({
      mentioned: 1,
      "main-thread": 1,
      "in-your-thread": 0,
    });
  });

  it("says who, where, and what — in one line", () => {
    expect(inboxLine(entries[1]!)).toBe("Kenny · Lake House — @Dion two");
  });
});

describe("addressesActor on its own", () => {
  it("prefers the resolved ids and falls back to the words", () => {
    expect(addressesActor(comment("c", kenny, "nothing", "x", ["usr_dion"]), names)).toBe(true);
    expect(addressesActor(comment("c", kenny, "@Dion", "x"), names)).toBe(true);
    expect(addressesActor(comment("c", kenny, "@Kenny", "x"), names)).toBe(false);
  });
});

/**
 * **One definition of "for me", enforced.**
 *
 * This rule lived in `isocan wait` and nowhere else. Moving it was the point
 * of the exercise, and the failure it prevents is quiet: two filters that
 * disagree do not error, they simply mean somebody is not told something. The
 * same argument `itemThread` was moved for — a rule one surface enforces and
 * the other does not know is a habit, not a rule.
 */
describe("both surfaces ask the same question", () => {
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

  it("the inbox reads core's rule rather than restating it", () => {
    const cli = read("../../cli/src/main.ts");
    expect(cli).toContain("inboxOn(");
    expect(cli).toContain("namesFor(");
  });

  it("the three reasons are spelled once, here", () => {
    // If a surface grows its own list of why a comment is yours, the two lists
    // drift and the drift is invisible.
    const core = read("../src/inbox.ts");
    for (const reason of ["mentioned", "main-thread", "in-your-thread"]) {
      expect(core).toContain(`"${reason}"`);
    }
    const cli = read("../../cli/src/main.ts");
    // The CLI may FILTER on a reason; it may not decide one.
    expect(cli).not.toMatch(/reason:\s*"(main-thread|in-your-thread)"/);
  });
});
