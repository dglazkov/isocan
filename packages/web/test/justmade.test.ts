import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **A create that worked, made visible.**
 *
 * Reported twice, the second time as "I created a canvas on isocan.io and it
 * didn't work". Both times it had worked. `file-store.ts` sorts the home's
 * canvases by `createdAt` ASCENDING, and the create form is the FIRST cell of
 * the grid — so the new canvas lands at the far end of a list you are standing
 * at the top of, and the only thing that changes where you are actually
 * looking is the field going empty. Success and silence rendered identically.
 *
 * This is the guard for the introduction that closes it: the page walks you to
 * the new card and marks it for a moment. Four things have to hold together or
 * it stops being an introduction, and each is checked below, because three of
 * them are the kind that decay silently — a class that is never set, a mark
 * that is never cleared, a motion nobody can opt out of.
 *
 * **What this cannot prove**: there is no DOM harness in this package, so
 * these read the source rather than a rendered page. They can show the wiring
 * is present and cannot show it fires. That is a real limit and the reason the
 * fix was also driven in a browser against the built app before it shipped.
 */
const page = readFileSync(
  fileURLToPath(new URL("../src/pages/CanvasListPage.tsx", import.meta.url)),
  "utf8",
);
/* Comments here DISCUSS `just-made` at length; they do not set it. A guard
   that greps the raw file passes on its own explanation — this repo has been
   bitten by exactly that three times. */
const bare = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("the new canvas introduces itself", () => {
  it("scrolls from an effect, not from the card's ref", () => {
    /* The card MOUNTS a render before the mark exists — `refresh()` sets the
       list and returns, `setJustMade` runs after that await. A ref that checks
       the mark as it attaches is asking a question whose answer has not
       arrived yet, and it fails silently: the ring still appears on the next
       render, so the feature looks finished. */
    const effect = bare.slice(bare.indexOf("scrollIntoView") - 400, bare.indexOf("scrollIntoView"));
    expect(effect).toContain("useEffect");
    expect(bare).toMatch(/\}, \[justMade, canvases\]\)/);
  });

  it("marks the canvas the create just made", () => {
    /* The success branch — the one that runs when the new id IS in the
       refreshed list — has to be the thing that sets the mark. Setting it
       before `refresh()` would mark a card on a create that was refused. */
    const success = bare.slice(bare.indexOf("found.some("));
    expect(success.slice(0, 200)).toContain("setJustMade(canvasId)");
  });

  it("puts the class on the card, and only on that one", () => {
    expect(bare).toMatch(/justMade === canvas\.id \? " just-made" : ""/);
  });

  it("clears the mark, so it stays an introduction", () => {
    /* Without this the ring is permanent: every visit afterwards shows a card
       wearing a state whose meaning nobody remembers. */
    expect(bare).toMatch(/setJustMade\(null\)/);
  });

  it("lets someone refuse the motion", () => {
    /* An involuntary smooth scroll down a long page is precisely the motion
       `prefers-reduced-motion` exists to refuse. The card must still arrive —
       so the escape is an INSTANT jump, never a skipped scroll. */
    const scroll = bare.slice(bare.indexOf("scrollIntoView") - 300, bare.indexOf("scrollIntoView") + 120);
    expect(scroll).toContain("prefers-reduced-motion");
    expect(scroll).toMatch(/behavior: \w+ \? "auto" : "smooth"/);
  });
});

describe("the mark's stylesheet", () => {
  const sheet = rules(withoutComments());
  const mark = sheet.filter((r) => r.selector.includes(".just-made"));

  it("exists at all", () => {
    expect(mark.length).toBeGreaterThan(0);
  });

  it("says which card with a ring, not only with a moving light", () => {
    /* The sweep is decoration; the ring is the information. If the only thing
       identifying the card were the animation, then reduced motion — and any
       screenshot — would show nothing at all. */
    const steady = mark.filter((r) => r.at.length === 0);
    expect(steady.some((r) => /border-color|box-shadow/.test(r.body))).toBe(true);
  });

  it("drops the travelling light under reduced motion, and keeps the ring", () => {
    const reduced = mark.filter((r) => r.at.some((a) => a.includes("prefers-reduced-motion")));
    expect(reduced.length).toBeGreaterThan(0);
    expect(reduced.some((r) => /animation:\s*none/.test(r.body))).toBe(true);
    /* Nothing in the reduced-motion block may remove the ring itself. */
    expect(reduced.some((r) => /border-color:\s*transparent/.test(r.body))).toBe(false);
  });

  it("is theme-aware, like everything else that draws a colour", () => {
    /* A literal hex here would be one theme's ring on both grounds. */
    for (const r of mark) {
      expect(r.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});
