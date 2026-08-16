import { describe, expect, it } from "vitest";
import { collectCanvasActors, extractMentions } from "../src/index.ts";
import { seedState } from "./helpers.ts";

const dimitri = { id: "usr_d", name: "Dimitri Glazkov" };
const claude = { id: "usr_c", name: "Claude" };
const claudeLabel = { id: "usr_c", name: "Claude 🤖" };

describe("extractMentions", () => {
  it("matches full names and first-name tokens, case-insensitively", () => {
    expect(extractMentions("@Dimitri Glazkov please review", [dimitri, claude])).toEqual(["usr_d"]);
    expect(extractMentions("@dimitri please review", [dimitri, claude])).toEqual(["usr_d"]);
    expect(extractMentions("ping @CLAUDE about this", [dimitri, claude])).toEqual(["usr_c"]);
  });

  it("matches presence labels and dedupes to one id", () => {
    expect(extractMentions("@Claude 🤖 build it", [claude, claudeLabel])).toEqual(["usr_c"]);
    expect(extractMentions("hey @Claude and again @Claude", [claude, claudeLabel])).toEqual([
      "usr_c",
    ]);
  });

  it("collects multiple distinct mentions", () => {
    expect(extractMentions("@Claude and @Dimitri: thoughts?", [dimitri, claude])).toEqual([
      "usr_d",
      "usr_c",
    ]);
  });

  it("requires @ to start a word — emails and partial names don't mention", () => {
    expect(extractMentions("mail dimitri@example.com", [dimitri])).toEqual([]);
    expect(extractMentions("@Claudette is someone else", [claude])).toEqual([]);
    expect(extractMentions("no at-sign Dimitri", [dimitri])).toEqual([]);
  });

  it("handles punctuation after the name", () => {
    expect(extractMentions("@Claude, take a look.", [claude])).toEqual(["usr_c"]);
    expect(extractMentions("(@Dimitri)", [dimitri])).toEqual(["usr_d"]);
  });
});

describe("collectCanvasActors", () => {
  it("collects item creators/editors, trashed items' actors, and comment authors", () => {
    const actors = collectCanvasActors(seedState().canvas);
    expect(actors.map((a) => a.id).sort()).toEqual(["usr_alice", "usr_bob"]);
  });
});
