import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error — a .mjs script with no types, imported for its reading on
// purpose: a second copy of "which operations a surface can send" is the thing
// this guard exists to prevent one level up.
import { audit, mentionedIn, operations, producedByUndo, sharedApiOperations } from "../scripts/isomorphism.mjs";

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
// The repository is one immutable subject for these assertions. Resolve its
// shared API symbols once, as the command-line audit does, rather than building
// the same TypeScript program for each column of the resulting report.
const rows = audit();
describe("every shared fact is an operation either surface can send", () => {
  it("has nothing a person can do that an agent cannot", () => {
    const webOnly = rows
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
    const orphans = rows
      .filter((r: { unreachable: boolean }) => r.unreachable)
      .map((r: { op: string }) => r.op);
    expect(orphans, "in the vocabulary, sent by nothing").toEqual([]);
  });

  it("follows both module entry points into their shared operation helpers", () => {
    expect(rows.find((row: { op: string }) => row.op === "item.edit"))
      .toMatchObject({ web: true, cli: true, unreachable: false });
  });

  it("reaches questionnaire producers through both surfaces' actual shared API calls", () => {
    for (const op of ["questionnaire.ask", "questionnaire.answer"]) {
      expect(rows.find((row: { op: string }) => row.op === op))
        .toMatchObject({ web: true, cli: true, unreachable: false });
    }
  });

  it("reaches agent comparison publication and both-surface response and adoption and paired restoration through Undo", () => {
    expect(rows.find((row: { op: string }) => row.op === "design.compare"))
      .toMatchObject({ cli: true, unreachable: false });
    for (const op of ["design.respond", "design.decide"]) {
      expect(rows.find((row: { op: string }) => row.op === op))
        .toMatchObject({ web: true, cli: true, unreachable: false });
    }
    expect(producedByUndo().has("design.restore")).toBe(true);
    expect(rows.find((row: { op: string }) => row.op === "design.restore"))
      .toMatchObject({ unreachable: false });
  });

  it("reaches canonical design repair through the actual shared prepared API on both surfaces", () => {
    expect(rows.find((row: { op: string }) => row.op === "design.repair"))
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
      const row = rows.find((r: { op: string }) => r.op === op);
      expect(row?.unreachable, `${op} is reachable, through undo`).toBe(false);
    }
  });

  it("does not mistake writing ABOUT an operation for sending it", () => {
    /* `OnIt.tsx` explains that retracting a request "is `comment.remove`" and
       never sends it — it is internal, reached only as undo's inverse. A
       reading that counted prose would report the web as able to send it.

       This guard read `agent.enroll` until 11 Sep 2026, when the web began
       sending it for real: the owner's "Let anyone ask" on their own agent's
       row re-enrols it with a wider gate (owner-only summons), the same op
       `isocan rc listen` sends. Adding an agent is still the rc's handshake —
       `agenttray.test.ts` pins that the add dialog never sends the op. */
    expect(mentionedIn("packages/web/src").has("comment.remove")).toBe(false);
    expect(mentionedIn("packages/web/src").has("agent.enroll")).toBe(true);
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

describe("the shared API reachability instrument", () => {
  it("loses one entrance when its consumer is removed, without granting unused API or core vocabulary", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "isocan-api-reachability-"));
    const write = (relative: string, source: string) => {
      const file = path.join(root, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, source);
      return file;
    };
    try {
      write("node_modules/@isocan/api/package.json", JSON.stringify({ name: "@isocan/api", type: "module", exports: { ".": "./src/index.ts", "./questionnaire": "./src/shared.ts" } }));
      write("node_modules/@isocan/core/package.json", JSON.stringify({ name: "@isocan/core", type: "module", exports: "./index.ts" }));
      write("node_modules/@isocan/core/index.ts", `
        export type Operation = { type: "fixture.typeOnly" } | { type: "fixture.coreOnly" };
        export function coreOnly() { return { type: "fixture.coreOnly" }; }
      `);
      write("node_modules/@isocan/api/src/index.ts", 'export * from "./shared.ts"; export * from "./unused.ts";');
      write("node_modules/@isocan/api/src/unused.ts", 'export function absentConsumer() { return { type: "fixture.absent" }; }');
      write("node_modules/@isocan/api/src/shared.ts", `
        import type { Operation } from "@isocan/core";
        import { coreOnly } from "@isocan/core";
        // A shared receipt reader knows about both tags but constructs neither.
        function receipt(value: unknown) {
          const hint: Extract<Operation, { type: "fixture.typeOnly" }> | null = null;
          return value === "fixture.answer" || hint;
        }
        export function ask() { coreOnly(); receipt(null); return { type: "fixture.ask" }; }
        export function answer() { return { type: "fixture.answer" }; }
        export function unused() { return { type: "fixture.unused" }; }
        export class CanvasHandle {
          designAsk() { return ask(); }
          designAnswer() { return answer(); }
          unusedMethod() { return unused(); }
        }
      `);
      const web = write("web.ts", `
        import { ask, unused, absentConsumer } from "@isocan/api";
        import { answer } from "@isocan/api/questionnaire";
        ask(); answer();
      `);
      const cli = write("cli.ts", `
        import { CanvasHandle } from "@isocan/api";
        const handle = new CanvasHandle(); handle.designAsk(); handle.designAnswer();
      `);
      const vocabulary = ["fixture.ask", "fixture.answer", "fixture.unused", "fixture.absent", "fixture.typeOnly", "fixture.coreOnly"];
      const read = () => sharedApiOperations({ web: [web], cli: [cli] }, vocabulary, path.join(root, "node_modules/@isocan/api/src"));
      const both = read();
      expect([...both.web].sort()).toEqual(["fixture.answer", "fixture.ask"]);
      expect([...both.cli].sort()).toEqual(["fixture.answer", "fixture.ask"]);

      // The API continues exporting answer, the CLI still calls it, and the
      // web even imports it. Removing the actual web use must remove its reach.
      writeFileSync(web, 'import { ask, answer } from "@isocan/api"; ask();');
      const oneConsumer = read();
      expect([...oneConsumer.web]).toEqual(["fixture.ask"]);
      expect([...oneConsumer.cli].sort()).toEqual(["fixture.answer", "fixture.ask"]);

      // Merely describing a method or importing a runtime binding is not a use.
      writeFileSync(web, 'import { ask } from "@isocan/api"; import type { CanvasHandle } from "@isocan/api"; type Answer = CanvasHandle["designAnswer"];');
      const noConsumer = read();
      expect([...noConsumer.web]).toEqual([]);
      expect([...noConsumer.cli].sort()).toEqual(["fixture.answer", "fixture.ask"]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
