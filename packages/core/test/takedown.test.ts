import { describe, expect, it } from "vitest";
import {
  OPERATOR_LOOK_MS,
  OPERATOR_PROOF_WINDOW_MS,
  TAKEDOWN_REASONS,
  TAKEN_DOWN,
  inForce,
  isTakedownReason,
  noticeOf,
  operatorLookUrl,
  takedownDate,
  takedownDateShort,
  takedownReasonList,
  takedownSentence,
  type CanvasTakedown,
} from "../src/index.ts";

/**
 * **The sentence, and the one place it is written** — operator phase 2.
 *
 * The tab, the wait, the canvas list, `isocan status` and the operator's own
 * terminal all show this, and they show it by calling the function below
 * rather than by each composing their own. So what is tested here is the thing
 * every one of them then says.
 */

const ROW: CanvasTakedown = {
  canvasId: "prj_reported1",
  at: "2026-09-12T14:02:00.000Z",
  reason: "stolen-content",
  note: "kai, 12 Sep — the third report about this one",
  by: "email:olu@example.com",
  actId: "opr_1",
};

describe("the sentence the affected person reads", () => {
  it("is journey 4 step 1, word for word", () => {
    expect(takedownSentence(ROW)).toBe(
      "This canvas was taken down by the operator of this home on 12 September 2026: " +
        "stolen content. Write to olu@example.com.",
    );
  });

  it("says neither `not found` nor `withdrawn`, because neither is what happened", () => {
    // The design's whole message, as an assertion: the difference between
    // *there is nothing here* and *this was removed, and here is who to ask*.
    for (const reason of Object.keys(TAKEDOWN_REASONS)) {
      const sentence = takedownSentence({ ...ROW, reason: reason as CanvasTakedown["reason"] });
      expect(sentence).not.toMatch(/not found|deleted|withdrawn|removed you/i);
      expect(sentence).toMatch(/taken down by the operator of this home/);
      expect(sentence).toMatch(/Write to olu@example\.com\./);
    }
  });

  it("carries the three things it has to: the date, the category, and an address", () => {
    const sentence = takedownSentence(ROW);
    expect(sentence).toContain("12 September 2026");
    expect(sentence).toContain(TAKEDOWN_REASONS["stolen-content"]);
    expect(sentence).toContain("olu@example.com");
    // The normalized shape the desk stores is not the shape it goes out in:
    // this is read by somebody about to write an email.
    expect(sentence).not.toContain("email:");
  });

  it("never reaches the note — that is the operator's, and nobody else's", () => {
    expect(takedownSentence(ROW)).not.toContain("kai");
    const notice = noticeOf(ROW);
    expect(JSON.stringify(notice)).not.toContain("kai");
    // And no act id either: the shape that crosses the wire carries neither of
    // the two fields the design calls innkeeper-private. A type that COULD
    // carry them is a type somebody eventually fills in.
    expect(Object.keys(notice).sort()).toEqual(["at", "by", "canvasId", "reason", "sentence"]);
  });

  it("dates in UTC, so one act has one date on every surface", () => {
    // A tab in Auckland rendering the day after would be two dates for one
    // act, quoted back in two different replies.
    expect(takedownDate("2026-09-12T23:59:59.000Z")).toBe("12 September 2026");
    expect(takedownDate("2026-01-01T00:00:00.000Z")).toBe("1 January 2026");
    expect(takedownDateShort("2026-09-12T14:02:00.000Z")).toBe("12 Sep");
    // A date nothing can parse comes back as itself rather than as
    // "Invalid Date" in a sentence somebody is about to paste into an email.
    expect(takedownDate("not a date")).toBe("not a date");
  });
});

describe("the reason is a category from a short list", () => {
  it("refuses anything not on it, and the list is printable", () => {
    expect(isTakedownReason("stolen-content")).toBe(true);
    expect(isTakedownReason("because I say so")).toBe(false);
    expect(isTakedownReason("")).toBe(false);
    // Not reachable through the prototype: `constructor` is not a reason.
    expect(isTakedownReason("constructor")).toBe(false);
    expect(takedownReasonList()).toContain("stolen-content");
  });

  it("every category renders to words a person would write", () => {
    for (const [key, words] of Object.entries(TAKEDOWN_REASONS)) {
      expect(words, key).not.toContain("-");
      expect(words.toLowerCase(), key).toBe(words);
    }
  });
});

describe("a row in force, and a row that was lifted", () => {
  it("is in force until it is lifted, and the row survives the lift", () => {
    expect(inForce(ROW)).toBe(true);
    const lifted: CanvasTakedown = { ...ROW, liftedAt: "2026-09-13T09:00:00.000Z" };
    expect(inForce(lifted)).toBe(false);
    // Journey 5 step 3 wants both halves readable afterwards.
    expect(lifted.reason).toBe("stolen-content");
    expect(lifted.actId).toBe("opr_1");
  });
});

describe("the look's window, and the address it opens", () => {
  it("is an hour, and deliberately not the proof's ten minutes", () => {
    expect(OPERATOR_LOOK_MS).toBe(60 * 60 * 1000);
    // A proof is for an act; a look IS the act, and reading a canvas to judge
    // a report takes longer than signing in does.
    expect(OPERATOR_LOOK_MS).toBeGreaterThan(OPERATOR_PROOF_WINDOW_MS);
  });

  it("opens the deck, read-only, with the pass in the FRAGMENT", () => {
    const url = operatorLookUrl("https://dev.isocan.io", "prj_reported1", "pss_1.secret");
    expect(url).toBe("https://dev.isocan.io/p/prj_reported1/deck#pss_1.secret");
    // A fragment is not sent to the server, which for a bearer credential is
    // the difference between a token in one tab and a token in an access log.
    expect(url.split("#")[0]).not.toContain("secret");
    // A trailing slash on the home does not produce a double one.
    expect(operatorLookUrl("https://dev.isocan.io/", "prj_1", "t")).toBe(
      "https://dev.isocan.io/p/prj_1/deck#t",
    );
  });
});

describe("the close reason", () => {
  it("is its own word, and never `canvas-deleted`", () => {
    // The one string a linked daemon reads to decide between keeping its copy
    // and erasing it.
    expect(TAKEN_DOWN).toBe("taken-down");
    expect(TAKEN_DOWN).not.toBe("canvas-deleted");
    // And it fits in a WebSocket close frame, which is capped at 123 BYTES and
    // throws rather than truncating.
    expect(Buffer.byteLength(TAKEN_DOWN, "utf8")).toBeLessThanOrEqual(123);
  });
});
