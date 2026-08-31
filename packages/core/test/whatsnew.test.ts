import { describe, expect, it } from "vitest";
import { dayOf, news, newestDay, unseen } from "../src/whatsnew.ts";

/**
 * `WHATSNEW.md` is the only document written for the person USING this.
 * `docs/changelog/` is the other one, written for whoever maintains it — and
 * excluded from the production image on purpose, which is why the first
 * version of this feature (a section inside each day's changelog) answered
 * `{"days":[]}` on prod while working perfectly on a checkout.
 */
const FILE = `# What's new

Some preamble that is not a day.

## 29 August 2026

- Personas keep their name across sessions.
- Panning is smoother.

## 27 August 2026

- Browse for a folder instead of typing its path.

## 26 August 2026
`;

describe("reading the public file", () => {
  it("takes a day per heading, and its bullets", () => {
    const days = news(FILE);
    expect(days.map((d) => d.title)).toEqual(["29 August 2026", "27 August 2026"]);
    expect(days[0]!.items).toEqual([
      "Personas keep their name across sessions.",
      "Panning is smoother.",
    ]);
  });

  it("skips a heading with nothing under it", () => {
    /* A day that turned out to have nothing a person would notice is not an
       empty entry — it is not an entry. */
    expect(news(FILE).map((d) => d.title)).not.toContain("26 August 2026");
  });

  it("ignores the preamble, which is prose and not a day", () => {
    expect(news(FILE)).toHaveLength(2);
  });

  it("derives the sortable date rather than writing it twice", () => {
    expect(dayOf("29 August 2026")).toBe("2026-08-29");
    expect(dayOf("1 March 2027")).toBe("2027-03-01");
  });

  it("keeps an odd heading visible instead of dropping it", () => {
    /* Sorting by its own text is wrong-ish and VISIBLE; dropping it is wrong
       and silent. */
    expect(dayOf("Coming soon")).toBe("Coming soon");
  });

  it("sorts newest first even if somebody types one in the wrong place", () => {
    const jumbled = "## 1 August 2026\n\n- older\n\n## 5 August 2026\n\n- newer\n";
    expect(news(jumbled).map((d) => d.day)).toEqual(["2026-08-05", "2026-08-01"]);
  });

  it("has nothing to say about an empty file", () => {
    expect(news("")).toEqual([]);
  });
});

describe("what somebody has not read", () => {
  const days = news(FILE);

  it("counts only what came after the last day read", () => {
    expect(unseen(days, "2026-08-27").map((d) => d.day)).toEqual(["2026-08-29"]);
    expect(unseen(days, "2026-08-29")).toEqual([]);
  });

  it("shows nothing unread to somebody who has never opened it", () => {
    /* A dot is a claim about a person's attention; on a first visit it is a
       false one. The list still reads. */
    expect(unseen(days, null)).toEqual([]);
  });

  it("knows the newest day, for marking everything read", () => {
    expect(newestDay(days)).toBe("2026-08-29");
    expect(newestDay([])).toBeNull();
  });
});

describe("the file this ships with", () => {
  it("parses, and has something to say", async () => {
    /* The guard that would have caught the original mistake: not "does the
       parser work" but "does the thing we actually ship parse". */
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const text = readFileSync(
      fileURLToPath(new URL("../../../WHATSNEW.md", import.meta.url)),
      "utf8",
    );
    const days = news(text);
    expect(days.length, "WHATSNEW.md parsed to no days").toBeGreaterThan(5);
    for (const day of days) {
      expect(day.day, `"${day.title}" is not a date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.items.length, `${day.title} has no notes`).toBeGreaterThan(0);
    }
  });
});
