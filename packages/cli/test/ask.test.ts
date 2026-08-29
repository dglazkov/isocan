import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openAsk, openAsks } from "@isocan/core";
import type { CanvasContents, CommentThread } from "@isocan/core";

/**
 * **The half of `/ask` that was missing, and why it was the wrong half.**
 *
 * `openAsk` shipped with the canvas: an agent that has asked reads as *asked*
 * in the tray and *blocked* in `isocan who`. What did not ship was any way to
 * ASK from the terminal, or to list what is waiting — so a person could see
 * that an agent was blocked and the agent could not re-read its own question.
 * That is backwards for a feature whose whole subject is the moment an agent
 * needs a person.
 *
 * These tests hold the wire format, because the state is a consequence of the
 * words: `openAsk` reads a comment body, and a verb that wrote anything else
 * would produce a comment nobody is blocked on.
 */
const main = fileURLToPath(new URL("../src/main.ts", import.meta.url));
const source = readFileSync(main, "utf8");

const thread = (comments: { id: string; author: string; body: string }[]): CommentThread =>
  ({
    id: "thr_1",
    main: true,
    x: 0,
    y: 0,
    anchorItemId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    comments: comments.map((c, i) => ({
      id: c.id,
      author: { id: c.author, name: c.author },
      body: c.body,
      createdAt: `2026-01-0${i + 1}T00:00:00.000Z`,
    })),
  }) as unknown as CommentThread;

describe("`isocan ask` writes what `openAsk` reads", () => {
  it("prefixes the question, because the prefix IS the state", () => {
    // The roster's `blocked` tier derives from a body starting `/ask`. A verb
    // that wrote anything else would post a comment nobody is blocked on —
    // the feature would look like it worked and change nothing.
    expect(source).toMatch(/question\.startsWith\("\/ask"\) \? question : `\/ask \$\{question\}`/);
  });

  it("does not double the prefix for somebody who typed it", () => {
    // Anybody who has read the guide will type `isocan ask "/ask …"` once.
    // `/ask /ask …` parses as a question whose text begins "/ask", which is
    // not wrong enough to notice and not right.
    const asked = thread([{ id: "c1", author: "a", body: "/ask which one?" }]);
    expect(openAsk(asked)?.body).toBe("which one?");
  });

  it("goes to the Chat by default, which is what `wait` wakes on", () => {
    expect(source).toMatch(/const main = mainThread\(snapshot\.canvas\);/);
  });

  it("reuses an item's existing thread rather than minting a second", () => {
    /**
     * `itemThread` was in the WEB, where ⇧C needed it, and the CLI had never
     * heard of the rule — so this verb was one line away from putting a
     * second conversation on an item that already had one, which is the exact
     * bug ⇧C was fixed for. A rule one surface enforces and the other does
     * not know is a habit, not a rule; it lives in core now.
     */
    expect(source).toMatch(/const existing = itemThread\(snapshot\.canvas, item\.id\)/);
  });
});

describe("`comment list --open` says what is waiting", () => {
  it("asks core, so the list and the badge cannot disagree", () => {
    expect(source).toMatch(/const asks = openAsks\(snapshot\.canvas\)/);
  });

  it("an answer from somebody else closes it", () => {
    const answered = thread([
      { id: "c1", author: "agent", body: "/ask which one?" },
      { id: "c2", author: "person", body: "the second" },
    ]);
    expect(openAsk(answered)).toBeNull();
  });

  it("the asker talking to itself does NOT close it", () => {
    // Verified live as well: replying as the same actor left the question
    // open, which is right — an agent amending its own question has not been
    // answered.
    const amended = thread([
      { id: "c1", author: "agent", body: "/ask which one?" },
      { id: "c2", author: "agent", body: "— or either, if that is easier" },
    ]);
    expect(openAsk(amended)).not.toBeNull();
  });

  it("finds asks across every thread, not just the Chat", () => {
    const canvas = {
      items: {},
      threads: {
        a: thread([{ id: "c1", author: "agent", body: "/ask one?" }]),
        b: { ...thread([{ id: "c2", author: "agent", body: "/ask two?" }]), id: "thr_2" },
      },
    } as unknown as CanvasContents;
    expect(openAsks(canvas)).toHaveLength(2);
  });

  it("tells the reader how to answer", () => {
    // A list of questions with no way to reply is a list that sends somebody
    // to `--help`.
    expect(source).toMatch(/reply: isocan comment reply \$\{ask\.threadId\}/);
  });
});
