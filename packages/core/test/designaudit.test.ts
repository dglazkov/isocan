import { describe, expect, it } from "vitest";
import type { DesignTokens } from "../src/designmd.ts";
import { auditScreen, offSystemTotal } from "../src/designaudit.ts";

/**
 * **The number that makes an audit something other than a thing to remember.**
 *
 * `/design-audit` had produced zero documents on six live canvases when this
 * was written. The command is good; a step somebody has to type is a step that
 * does not happen, so the one question that is arithmetic got a number.
 *
 * The danger with a check like this is lesson #14 — a check whose answer cannot
 * be "no", or the mirror of it, a check whose answer is always "no". Both are
 * decoration that looks like a measurement, and both are easy here: read
 * `var(--ink)` as a colour and every well-built screen fails; excuse too much
 * and every screen passes. So the two extremes are asserted directly, and the
 * cases in between are the four real ways a screen can be right.
 */

const SYSTEM: DesignTokens = {
  name: "Test",
  colors: { primary: "#1a73e8", ink: "#3C4043", paper: "#fff" },
  typography: { body: { fontSize: "16px" }, display: { fontSize: "52px" } },
  rounded: { card: "8px", pill: "999px" },
};

describe("which values a screen used that its system never named", () => {
  it("finds nothing in a screen built from the system", () => {
    /* The "always no" failure. If this ever reports a finding, the check is
       calling correct work wrong and nobody will read it twice. */
    const html = `<style>a{color:#1a73e8;font-size:16px;border-radius:8px}</style>`;
    expect(auditScreen(html, SYSTEM).offSystem).toEqual([]);
  });

  it("finds the fourth blue", () => {
    /* And the "always yes" failure: if this passes, the check answers nothing.
       Six type scales and four blues is the whole reason the system exists. */
    const audit = auditScreen(`<style>a{color:#0b5fff;font-size:15px}</style>`, SYSTEM);
    expect(audit.offSystem.map((o) => o.value)).toEqual(["#0b5fff", "15px"]);
    expect(audit.offSystem.map((o) => o.kind)).toEqual(["colour", "type size"]);
  });

  it("counts a token reference as the good case, not as a colour", () => {
    /**
     * The guide's own instruction is to build against the variables — *"a
     * screen full of hex codes is a screen that cannot follow the system when
     * it changes"* — so the screen that followed it hardest contains almost no
     * colours at all. Reading `var(--ink, #222)` as a stray `#222` would make
     * the most careful screen on the canvas the worst-scoring one.
     */
    const audit = auditScreen(`<style>a{color:var(--ink, #222);background:var(--paper)}</style>`, SYSTEM);
    expect(audit.offSystem).toEqual([]);
    expect(audit.onSystem).toBe(2);
  });

  it("reads a dimmed token as the token it came from", () => {
    /* `rgba(60,64,67,.28)` is `#3C4043` at 28% — a shadow made from the ink,
       which is the system being used rather than departed from. Without this
       the number is mostly shadows, and a number that is mostly noise is one
       nobody acts on: it was 11 of 46 on the first real canvas. */
    const audit = auditScreen(`<style>a{box-shadow:0 1px 2px rgba(60,64,67,.28)}</style>`, SYSTEM);
    expect(audit.offSystem).toEqual([]);
  });

  it("splits a shorthand into the decisions it actually contains", () => {
    /* `border-radius: 0 0 8px 8px` read whole is a finding that is true and
       impossible to act on. Split, the 8px is on-system and only the 0 is not
       — and `0` is excused as a non-value, so this screen is clean. */
    expect(auditScreen(`<style>a{border-radius:0 0 8px 8px}</style>`, SYSTEM).offSystem).toEqual([]);
    const mixed = auditScreen(`<style>a{border-radius:8px 3px}</style>`, SYSTEM);
    expect(mixed.offSystem.map((o) => o.value)).toEqual(["3px"]);
  });

  it("says nothing about a kind the system never spoke about", () => {
    /**
     * Silence is not a rule. A system with no `rounded` section has not
     * decided anything about corners, so every radius on every screen would be
     * a departure from nothing — which is how a measurement gets a number so
     * large that its only use is to be ignored.
     */
    const quiet: DesignTokens = { name: "Quiet", colors: { primary: "#1a73e8" } };
    const audit = auditScreen(`<style>a{border-radius:13px;font-size:15px;color:#1a73e8}</style>`, quiet);
    expect(audit.offSystem).toEqual([]);
  });

  it("counts repeats without reporting them twice, and points at the first", () => {
    /* A value used ten times is one decision made once and copied, so it is
       one finding with a count — a list of ten identical rows is a list nobody
       reads to the bottom of. The line is the first, so it can be pointed at. */
    const html = `<style>\na{color:#0b5fff}\nb{color:#0b5fff}\nc{color:#0b5fff}\n</style>`;
    const [only] = auditScreen(html, SYSTEM).offSystem;
    expect(only).toMatchObject({ value: "#0b5fff", count: 3, line: 2 });
  });

  it("adds up across screens, which is the number a person would watch", () => {
    const a = auditScreen(`<style>x{color:#0b5fff}</style>`, SYSTEM);
    const b = auditScreen(`<style>y{color:#1a73e8}</style>`, SYSTEM);
    expect(offSystemTotal([a, b])).toBe(1);
    expect(offSystemTotal([])).toBe(0);
  });
});
