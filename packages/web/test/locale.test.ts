import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A number or a date is formatted in the reader's locale, and the app never
 * names one.**
 *
 * `formatDistance` called `toLocaleString("en-US")`, so the edge radar's
 * "1,400px away" was American for everybody — a German reader got a comma
 * where they write a dot. It was the one real internationalization bug the
 * 7 Sep note found (`docs/research/2026-09-07-internationalization.md`), fixed
 * 11 Sep 2026, and the note's point about it was that it is GREPPABLE: every
 * other `toLocale*` call in the app passes no locale, which is the viewer's
 * own, and the one that was wrong spelled a literal.
 *
 * So the rule is about the spelling. A locale that must be pinned — a test
 * that wants a stable string — is passed IN, the way `formatDistance(n,
 * "de-DE")` is in `edgeradar.test.ts`; tests live outside src and are not read.
 */
const SRC = fileURLToPath(new URL("../src", import.meta.url));

/** `x.toLocaleString("en-US")`, `d.toLocaleDateString('en')`, and the
 *  `Intl` constructors given a literal first argument. */
const LITERAL_LOCALE = /\btoLocale[A-Za-z]*\(\s*["'`]|\bIntl\.[A-Za-z]+\(\s*["'`]/;

const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
  (rel) => rel.endsWith(".ts") || rel.endsWith(".tsx"),
);

describe("the app formats in the reader's locale", () => {
  it("names no locale literal anywhere in src", () => {
    const offenders = files.flatMap((rel) =>
      readFileSync(`${SRC}/${rel}`, "utf8")
        .split("\n")
        .flatMap((line, i) => (LITERAL_LOCALE.test(line) ? [`${rel}:${i + 1}  ${line.trim()}`] : [])),
    );
    expect(offenders, "pass no locale (the viewer's own), or take one as a parameter").toEqual([]);
  });

  it("would have caught the line it was written for", () => {
    // The guard is only worth something if it reddens on the bug it remembers.
    expect(LITERAL_LOCALE.test('return `${distance.toLocaleString("en-US")}px away`;')).toBe(true);
    expect(LITERAL_LOCALE.test("new Intl.NumberFormat('de-DE').format(n)")).toBe(true);
    // And stays quiet on the right spellings.
    expect(LITERAL_LOCALE.test("distance.toLocaleString(locale)")).toBe(false);
    expect(LITERAL_LOCALE.test("new Date(at).toLocaleTimeString()")).toBe(false);
    expect(LITERAL_LOCALE.test("new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })")).toBe(false);
  });

  it("reads the app, not nothing", () => {
    // A scan over an empty list passes vacuously, so it must be seen reading.
    expect(files.length).toBeGreaterThan(50);
  });
});
