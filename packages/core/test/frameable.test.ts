import { describe, expect, it } from "vitest";
import { frameVerdict } from "../src/frameable.ts";

/**
 * **"I tried yahoo.com and it didn't work."**
 *
 * It worked exactly as built: the item was created, and the browser refused to
 * render `yahoo.com` in a frame because it sends `x-frame-options: SAMEORIGIN`.
 * What was missing was anybody saying so — the canvas showed a blank rectangle
 * and left the person to conclude the feature was broken.
 *
 * The rule these tests hold is that the app never guesses STRICTER than a
 * browser would. A false refusal is worse than a blank frame: it turns a site
 * that would have worked into one the product claims it cannot show.
 */
const headers = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
});

describe("whether a site will let itself be framed", () => {
  it("says yes when a site says nothing", () => {
    // The common case, and the one that matters: a dev server sends no such
    // header, which is why localhost has always worked.
    expect(frameVerdict(headers({}))).toEqual({ ok: true });
  });

  it("reads the refusal that actually bit", () => {
    const v = frameVerdict(headers({ "x-frame-options": "SAMEORIGIN" }));
    expect(v.ok).toBe(false);
    // The site's own words, so the reason is checkable rather than our summary.
    expect(v.refusedBy).toBe("x-frame-options: SAMEORIGIN");
    expect(v.why).toMatch(/its own site/);
  });

  it("treats DENY and SAMEORIGIN alike, because we are never the same origin", () => {
    expect(frameVerdict(headers({ "x-frame-options": "DENY" })).ok).toBe(false);
    expect(frameVerdict(headers({ "x-frame-options": "deny" })).ok).toBe(false);
  });

  it("ignores values a browser would ignore", () => {
    // `ALLOWALL` was never standard and browsers ignore what they do not know.
    // Guessing stricter than the browser refuses sites that in fact work.
    expect(frameVerdict(headers({ "x-frame-options": "ALLOWALL" })).ok).toBe(true);
    expect(frameVerdict(headers({ "x-frame-options": "" })).ok).toBe(true);
  });

  it("lets frame-ancestors outrank the older header, in both directions", () => {
    // CSP is the modern spelling and wins where both are present — including
    // when it is the PERMISSIVE one, which is the case a naive reading gets
    // backwards and refuses a site that works.
    expect(
      frameVerdict(
        headers({ "x-frame-options": "DENY", "content-security-policy": "frame-ancestors *" }),
      ).ok,
    ).toBe(true);
    expect(
      frameVerdict(
        headers({
          "x-frame-options": "ALLOWALL",
          "content-security-policy": "frame-ancestors 'none'",
        }),
      ).ok,
    ).toBe(false);
  });

  it("does not read out a list of twenty", () => {
    // Yahoo's `frame-ancestors` names twenty domains. Printing all of them
    // fills the error with noise and buries the only fact that matters —
    // that this canvas is not among them. The full header stays in
    // `refusedBy` for anybody who needs it.
    const many = Array.from({ length: 20 }, (_, i) => `https://s${i}.example`).join(" ");
    const v = frameVerdict(headers({ "content-security-policy": `frame-ancestors ${many}` }));
    expect(v.why).toBe("only allows itself to be framed by https://s0.example, https://s1.example and 18 others");
    expect(v.refusedBy, "the whole header survives, for whoever needs it").toContain("s19.example");
  });

  it("names the list, so somebody who owns the site knows what to add", () => {
    const v = frameVerdict(
      headers({ "content-security-policy": "default-src 'self'; frame-ancestors https://ok.example" }),
    );
    expect(v.ok).toBe(false);
    expect(v.why).toContain("https://ok.example");
  });

  it("allows us when the list names us", () => {
    const v = frameVerdict(
      headers({ "content-security-policy": "frame-ancestors https://isocan.io" }),
      "https://isocan.io",
    );
    expect(v.ok).toBe(true);
  });

  it("is not confused by another directive containing the word", () => {
    // `frame-src` is a different rule about what the SITE may embed, and has
    // nothing to say about who may embed it.
    expect(frameVerdict(headers({ "content-security-policy": "frame-src 'none'" })).ok).toBe(true);
  });
});
