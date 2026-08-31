import { describe, expect, it } from "vitest";
import { news, newsFrom, newestDay, unseen } from "../src/whatsnew.ts";

/**
 * `docs/changelog/` is written for whoever maintains this. What's new is
 * written for whoever uses it, lives in the same file so the two cannot
 * drift, and is optional — because most days genuinely have nothing a person
 * would notice, and a notice board with an entry every day is one nobody
 * believes by the second week.
 */
const day = (body: string) => `# 29 August 2026\n\nSome developer prose.\n\n${body}`;

describe("reading a day's news", () => {
  it("takes the bullets under What's new, and nothing else", () => {
    const md = day(`## What's new\n\n- Mind maps lay themselves out.\n- The history shows dates.\n\n## Under the hood\n\n- \`applyOperation\` got a branch\n`);
    expect(newsFrom("2026-08-29", md)?.items).toEqual([
      "Mind maps lay themselves out.",
      "The history shows dates.",
    ]);
  });

  it("says nothing for a day that has nothing to say", () => {
    /* A day of refactoring or chasing a flake genuinely has nothing a user
       would notice, and the honest answer is absence rather than filler. */
    expect(newsFrom("2026-08-29", day("## Personas\n\nA symlink, and why.\n"))).toBeNull();
  });

  it("says nothing for an empty section rather than an empty day", () => {
    expect(newsFrom("2026-08-29", day("## What's new\n\n## Next\n"))).toBeNull();
  });

  it("keeps the day's own heading, because that is what a person reads", () => {
    const md = day("## What's new\n\n- Something.\n");
    expect(newsFrom("2026-08-29", md)?.title).toBe("29 August 2026");
    expect(newsFrom("2026-08-29", md)?.day).toBe("2026-08-29");
  });

  it("takes either bullet character, since both are markdown", () => {
    expect(newsFrom("2026-08-29", day("## What's new\n\n* Starred.\n"))?.items).toEqual(["Starred."]);
  });
});

describe("the list", () => {
  const files = [
    { day: "2026-08-27", markdown: day("## What's new\n\n- Older.\n") },
    { day: "2026-08-29", markdown: day("## What's new\n\n- Newer.\n") },
    { day: "2026-08-28", markdown: day("## Nothing for users\n") },
  ];

  it("is newest first, and skips the quiet days", () => {
    expect(news(files).map((d) => d.day)).toEqual(["2026-08-29", "2026-08-27"]);
  });

  it("counts as unread only what came after the last day read", () => {
    /* Keyed on the DAY: a count would be wrong the moment a day gained a
       second line, and a hash would mark everything unread over a typo. */
    expect(unseen(news(files), "2026-08-27").map((d) => d.day)).toEqual(["2026-08-29"]);
    expect(unseen(news(files), "2026-08-29")).toEqual([]);
  });

  it("shows no dot to somebody who has never read it", () => {
    /**
     * A first visit met with fifty unread notices is a chore, not a welcome.
     * The list is still there to read; what is suppressed is the CLAIM that
     * they are behind on something they have never been offered.
     */
    expect(unseen(news(files), null)).toEqual([]);
  });

  it("knows the newest day, for marking everything read", () => {
    expect(newestDay(news(files))).toBe("2026-08-29");
    expect(newestDay([])).toBeNull();
  });
});
