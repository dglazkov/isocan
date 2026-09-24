import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEXT_HEADING_EM } from "@isocan/core";
import { rules } from "./cssrules.ts";

/**
 * **A text node's headings, and the box that holds them** (24 Sep 2026).
 *
 * A `#` in a text node was drawn by the card renderer's `.md-view h1 { 18px }`
 * — larger than body's 16, a seventh the size of display's 128, so in a big
 * node the heading was SMALLER than the paragraph under it. The stylesheet now
 * sets them in em, and core's estimate carries the largest of them as
 * `TEXT_HEADING_EM`. Two copies of one fact is only safe while something holds
 * them together; this is that something. If they drift, the estimate thinks a
 * heading is smaller than it draws and the box crops it — lessons #94.
 */
const textnode = rules().filter((r) => r.selector.startsWith(".item.textnode .md-view"));
const sizeOf = (tag: string): string | undefined =>
  textnode
    .find((r) => new RegExp(`(^|[\\s(,])${tag}([\\s),]|$)`).test(r.selector.replace(".item.textnode .md-view", "")) && /font-size/.test(r.body))
    ?.body.match(/font-size:\s*([^;]+)/)?.[1]
    ?.trim();

describe("a text node's headings are sized from its own words", () => {
  it("sets every level in em, never in px", () => {
    for (let level = 1; level <= 6; level++) expect(sizeOf(`h${level}`), `h${level}`).toMatch(/^[\d.]+em$/);
  });

  it("draws h1 at exactly what core's estimate assumes, and no level larger", () => {
    expect(parseFloat(sizeOf("h1")!)).toBe(TEXT_HEADING_EM);
    for (let level = 2; level <= 6; level++) expect(parseFloat(sizeOf(`h${level}`)!), `h${level}`).toBeLessThanOrEqual(TEXT_HEADING_EM);
  });

  it("never draws a heading smaller than the words, so no step inverts the hierarchy", () => {
    for (let level = 1; level <= 6; level++) expect(parseFloat(sizeOf(`h${level}`)!), `h${level}`).toBeGreaterThanOrEqual(1);
  });
});

describe("the composer's mirror, and a heading it cannot see", () => {
  it("asks the estimate too when the words hold a heading, and keeps the bigger box", () => {
    // The mirror measures the RAW words — `# Plan` as one line at the node's
    // size — so a heading's box has to come from the estimate. What the
    // committed node then draws is checked in a real browser (the report of
    // 24 Sep 2026); this holds the one line that makes it so.
    const composer = readFileSync(fileURLToPath(new URL("../src/components/TextComposer.tsx", import.meta.url)), "utf8");
    expect(composer).toMatch(/TEXT_HEADING_LINE\.test\(body\) && textRefit\(measured, body, style, face\)\) \|\| measured/);
  });
});
