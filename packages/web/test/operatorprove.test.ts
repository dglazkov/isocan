import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { encodeHandoff, provePath, type OperatorHandoff } from "@isocan/core";
import { faceFor } from "../src/lib/faces.ts";

/**
 * **`/operator/prove/<handoff>` — the web surface of the operator** (operator
 * phase 1).
 *
 * There is no DOM in this suite (see `frontdoor.test.ts` for why), so what is
 * proved here is what a face DECIDES and what a render PUTS on the page. The
 * two properties worth holding still are exactly the two that would be
 * catastrophic to get wrong, and neither needs a browser:
 *
 * - **the act is on the page before any control is** — a consent page that
 *   asked first and explained second is the shape every phishing flow has;
 * - **a destination that is not loopback is refused, and nothing is offered**
 *   — no sign-in field, no form, no button, for a link somebody was handed.
 *
 * The hand-over itself is a form POST into a terminal, and that is proved from
 * the other end: `packages/cli/test/operator.test.ts` stands a real loopback
 * listener up and posts into it.
 */

const handoff: OperatorHandoff = {
  to: "http://127.0.0.1:54321/",
  state: "nonce-1",
  act: "take down prj_reported1",
};

function stubBrowserGlobals(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { window?: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
}

stubBrowserGlobals();
const { MemoryRouter } = await import("react-router-dom");
const { OperatorProvePage } = await import("../src/pages/OperatorProvePage.tsx");

const at = (pathname: string): string =>
  renderToStaticMarkup(
    h(MemoryRouter, { initialEntries: [pathname] }, h(OperatorProvePage, null)),
  );

describe("which face a prove link wears", () => {
  it("is the prove page, whether or not this browser is anybody yet", () => {
    // The terms page's reason: a terminal opens this in whatever browser the
    // person uses, which is very often not the one their canvases are in.
    // Meeting "pick your name" there would be the wrong question in the wrong
    // order.
    const path = provePath(handoff);
    expect(faceFor(path, null)).toBe("operator-prove");
    expect(faceFor(path, { id: "usr_priya", name: "Priya" })).toBe("operator-prove");
  });

  it("does not widen to anything else — the share link still meets the door", () => {
    // The regression adding a face can cause. `/operator` alone carries no
    // handoff and is not this page.
    expect(faceFor("/operator", null)).toBe("door");
    expect(faceFor("/operator/prove", null)).toBe("door");
    expect(faceFor("/p/prj_acme", null)).toBe("door");
    expect(faceFor("/", null)).toBe("front-page");
  });
});

describe("what the page says, and in what order", () => {
  it("puts the act above everything, before it asks for anything", () => {
    // Journey 1 step 2: *before anything else it says what the terminal asked
    // for*. Asserted as an ORDER rather than as presence, because a page that
    // showed the act below the sign-in field would contain the same words and
    // be the wrong page.
    const html = at(provePath(handoff));
    expect(html).toContain("take down prj_reported1");
    const act = html.indexOf("take down prj_reported1");
    const heading = html.indexOf("asks to act as this home&#x27;s operator");
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(heading).toBeLessThan(act);
    // Nothing to sign in with has been drawn yet: the offer has not arrived,
    // and the page does not draw a control from an answer it has not been
    // given (`useAttestOffer`'s null case, as the door treats it).
    expect(html).not.toContain("<form");
  });

  it("names where the proof would go, so a person can see it is their machine", () => {
    expect(at(provePath(handoff))).toContain("http://127.0.0.1:54321/");
  });

  it("refuses a destination that is not loopback, and offers nothing at all", () => {
    /**
     * The attack this page exists to refuse: a link somebody was handed,
     * pointing at a machine that is not theirs, collecting a live credential.
     * The sentence above a button is not a defence against a person who was
     * told to click it — so there is no button.
     */
    const html = at(provePath({ ...handoff, to: "https://evil.example/collect" }));
    expect(html).toContain("evil.example");
    expect(html).toMatch(/will not hand a sign-in/i);
    expect(html).toMatch(/Nothing was signed in and nothing was sent/);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    // And the act is NOT repeated: a refused link must not get to put its
    // sentence on this home's page.
    expect(html).not.toContain("take down prj_reported1");
  });

  it("refuses `localhost`, because a name resolves and a literal does not", () => {
    expect(at(provePath({ ...handoff, to: "http://localhost:54321/" }))).toMatch(
      /will not hand a sign-in/i,
    );
  });

  it("says so in a sentence when the address carries no handoff at all", () => {
    const html = at("/operator/prove/not-a-handoff");
    expect(html).toMatch(/not an operator link/i);
    expect(html).not.toContain("<form");
  });

  it("carries the handoff as one opaque segment, so the magic link brings it back", () => {
    // The measured reason (see `core/test/operator.test.ts`): `/__/auth/action`
    // keeps the PATH of `continueUrl`, and the provider appends that value
    // unencoded, so a second query parameter would not survive the round trip.
    const path = provePath(handoff);
    expect(path).toBe(`/operator/prove/${encodeHandoff(handoff)}`);
    expect(path).not.toContain("?");
  });
});
