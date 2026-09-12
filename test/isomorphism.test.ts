import { describe, expect, it } from "vitest";
// @ts-expect-error — a .mjs script with no types, imported for its reading on
// purpose: a second copy of "which operations a surface can send" is the thing
// this guard exists to prevent one level up.
import { audit, mentionedIn, operations, producedByUndo } from "../scripts/isomorphism.mjs";

/**
 * **Can an agent do everything a person can?**
 *
 * The product's central claim, checked rather than believed: *every shared
 * fact is an Operation either surface can send.* A canvas the web app can
 * change in a way the CLI cannot is a canvas an agent is a second-class
 * citizen on — and it would be invisible, because both surfaces would go on
 * working perfectly by themselves.
 *
 * Audited 8 Sep 2026 at Dion's ask, and it held: **33 operations, none of them
 * web-only.**
 *
 * ## The reading was wrong twice before it was right, in both directions
 *
 * The first pass looked for `type: "<op>"` at a send site and reported three
 * operations as CLI-only and five as sent by nobody. **Six of those eight were
 * wrong.** The web enrols an agent through `lib/api.ts`, so `agent.enroll`
 * never appears beside a `type:` in a component. And `comment.restore`,
 * `thread.restore` and `item.restoreVersion` are written by nobody and sent
 * constantly — they are what `core/invert.ts` returns when a removal is
 * undone, so they run every time anybody presses ⌘Z. Calling them dead
 * vocabulary would have argued for deleting three operations that work.
 *
 * The second pass over-corrected: grepping for the bare name found both in
 * PROSE — `AddAgent.tsx` explains that "the `agent.enroll` op lands", and
 * `OnIt.tsx` says `comment.remove` is internal — and counted a comment ABOUT
 * an operation as the ability to send it.
 *
 * So the reading requires the quoted form, and treats inversion as its own
 * route. Both mistakes are the same shape: **a reading that cannot see how an
 * operation is actually reached invents a gap**, and an invented gap costs a
 * day chasing something that was never broken.
 */
describe("every shared fact is an operation either surface can send", () => {
  it("has nothing a person can do that an agent cannot", () => {
    const webOnly = audit()
      .filter((r: { webOnly: boolean }) => r.webOnly)
      .map((r: { op: string }) => r.op);
    expect(
      webOnly,
      "the web app can send these and the CLI cannot — a person can change the canvas " +
        "in a way an agent cannot, which is the isomorphism failing in the direction that " +
        "matters. Give the CLI a verb, or take the operation off the web.",
    ).toEqual([]);
  });

  it("leaves no operation reachable from neither surface", () => {
    /* Dead vocabulary against a ratcheted bound: `op-types` is held at 33 and
       every rise is meant to cost somebody a sentence, so an operation nothing
       can send is a seat in that count nobody is sitting in. */
    const orphans = audit()
      .filter((r: { unreachable: boolean }) => r.unreachable)
      .map((r: { op: string }) => r.op);
    expect(orphans, "in the vocabulary, sent by nothing").toEqual([]);
  });

  it("follows both module entry points into their shared operation helpers", () => {
    expect(audit().find((row: { op: string }) => row.op === "item.edit"))
      .toMatchObject({ web: true, cli: true, unreachable: false });
  });

  it("counts inversion as a way an operation is reached", () => {
    /**
     * The mistake that would have deleted working code. `comment.restore`,
     * `thread.restore` and `item.restoreVersion` appear in neither surface and
     * run on every undo of a removal, because `invert.ts` returns them.
     */
    const undo = producedByUndo();
    for (const op of ["comment.restore", "thread.restore", "item.restoreVersion"]) {
      expect(undo.has(op), `${op} is what undo returns`).toBe(true);
      const row = audit().find((r: { op: string }) => r.op === op);
      expect(row?.unreachable, `${op} is reachable, through undo`).toBe(false);
    }
  });

  it("does not mistake writing ABOUT an operation for sending it", () => {
    /* `AddAgent.tsx` explains that "the `agent.enroll` op lands" and does not
       send it — enrolment is a handshake the rc completes (agent-custody). A
       reading that counted prose would report the web as able to enrol. */
    expect(mentionedIn("packages/web/src").has("agent.enroll")).toBe(false);
    expect(mentionedIn("packages/cli/src").has("agent.enroll")).toBe(true);
  });

  it("reads a vocabulary that is actually there", () => {
    // The other half of every guard whose subject is an empty set.
    const ops = operations();
    expect(ops.length).toBeGreaterThan(25);
    expect(ops).toContain("item.add");
    expect(ops).toContain("project.update");
    expect(mentionedIn("packages/cli/src").size).toBeGreaterThan(15);
  });
});
