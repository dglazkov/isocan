import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("../src/components/OnIt.tsx", import.meta.url)), "utf8");
/** Comments quote the sentences this file no longer says; the code is what is
 *  under test. Same stripper as `switcher.test.ts`. */
const bare = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");
const onit = bare(source);

/**
 * **Silence with a clock on it** (#197 phase 1).
 *
 * `OnIt` already answered most of the question the standing-agents note asks —
 * who picked this up, who was woken, who is listening. What it could not do
 * was say **no**. Its last branch read *"Sent. One agent is listening."* and
 * went on reading that however long nothing happened, which describes the room
 * rather than the request, and leaves a person unable to tell a model thinking
 * from an rc that is wedged.
 *
 * These assert the shape of the fix rather than its wording — the words live
 * in `core/summons.ts` and are tested there, once, so the thread and a future
 * `isocan comment --wait` cannot drift apart.
 */
describe("the thread stops implying an answer is coming", () => {
  it("takes its bound and its words from core, not from here", () => {
    /* The wording is the feature — "that last sentence is the whole feature:
       it converts a mystery into a fact" — so a second copy in the component
       is a second thing to keep true. This is the same rule the minimap's
       kind-colours were rewritten for on the same day. */
    expect(onit).toContain("wokenLine(names, waitedMs)");
    expect(onit).toContain("waitingLine(parked)");
    expect(onit).toContain("ANSWER_WITHIN_MS");
    expect(onit, "no sentence is spelled here").not.toMatch(/Sent\. One agent|was woken —|has not picked this up/);
  });

  it("puts the clock on WOKEN, and never on nobody-was-woken", () => {
    /**
     * The bound went on the wrong branch first, and a parked `wait` on a real
     * canvas showed it. The branch below "woken" means the daemon reached
     * nobody — a line that aged into an accusation there would blame an agent
     * for not replying to something nobody asked it.
     *
     * `waitingLine` taking no time at all is what keeps that true: there is no
     * `waitedMs` to thread through, so the mistake cannot be made again by
     * accident.
     */
    const woken = onit.indexOf("wokenLine(names, waitedMs)");
    const nobody = onit.indexOf("waitingLine(parked)");
    expect(woken).toBeGreaterThan(-1);
    expect(nobody).toBeGreaterThan(woken);
    expect(onit).not.toContain("waitingLine(parked, ");
  });

  it("measures from the ask, which is the last comment", () => {
    // No store, no new state: the thread already holds when you asked. A
    // per-tab record of pending summonses would have been a second source of
    // truth for a fact the canvas already carries.
    expect(onit).toMatch(/Date\.parse\(last\.createdAt\)/);
  });

  it("ticks on the shared clock rather than starting one", () => {
    /* A display that is a function of the clock needs a re-render nothing else
       will cause. `useClockSecond` is the one shared tick, and it stops while
       the tab is hidden — a second interval here would be a second thing
       burning a background tab, which this codebase spent 6 Sep fixing. */
    expect(onit).toContain("useClockSecond()");
    expect(onit, "no interval of its own").not.toContain("setInterval");
  });

  it("keeps the clock above the early returns", () => {
    /* `OnIt` returns early when somebody is working and again when nothing is
       awaited. A hook below either is a hook whose order depends on whether an
       agent happens to be busy — React's one unbreakable rule, and a crash
       that only appears once somebody picks the thread up. */
    const hook = onit.indexOf("useClockSecond()");
    const firstReturn = onit.indexOf("if (working.length > 0)");
    expect(hook).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(firstReturn);
  });

  it("marks the overdue state so it can be seen, not only read", () => {
    // The one place in the thread that says something is wrong earns a colour;
    // everything else here is deliberately quiet.
    expect(onit).toContain("overdue");
    const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
    expect(css).toContain(".onit.waiting.overdue");
  });
});
