import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { atLeast, capabilityWord, RUNGS } from "@isocan/core";
import { HIDDEN_WRITES } from "../src/lib/capability.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **The read-only canvas is the editor with a list of writes hidden, and
 * this walks the list** (roles design, "The read-only canvas"; phase 1).
 *
 * The refusal is the daemon's — `view-only.test.ts` proves a `read`
 * admission is refused every write — and a test that only proved the app
 * hid a control would prove nothing about access. What this proves is the
 * COURTESY: that every write the design names is gated on the one question
 * (`useCanEdit` / `canEditNow`), in the file that owns it, by the exact
 * expression the list records. A gate that is renamed, moved or deleted
 * fails here by name, rather than shipping as a toolbar a reader can press
 * and be refused by.
 *
 * Source-scanned rather than rendered, for `ownerguard.test.ts`'s reason: the
 * failure is structural, not visual.
 */
describe("the read-only canvas hides every write on the list", () => {
  it("names the writes the design lists", () => {
    // The design's sentence, as a checklist. Each phrase must be covered by
    // some entry's `what`, so a write dropped from the list is noticed even
    // if the gate it named still exists.
    const named = HIDDEN_WRITES.map((entry) => entry.what).join("\n");
    for (const phrase of [
      "tool rail",
      "create",
      "dragging",
      "resizing",
      "text composer",
      "stage composer",
      "comment composer",
      "reactions",
      "trash",
      "context menu",
      "command palette",
      "Share dialog",
    ]) {
      expect(named, `nothing on the list covers "${phrase}"`).toContain(phrase);
    }
  });

  for (const entry of HIDDEN_WRITES) {
    it(`hides ${entry.what}`, () => {
      const source = read(`../src/${entry.file}`);
      expect(source, `${entry.file} no longer gates: ${entry.what}`).toContain(entry.gate);
    });
  }

  it("asks the one question in one place, through core's ladder", () => {
    const gate = read("../src/lib/capability.ts");
    expect(gate).toContain('atLeast(s.capability, "edit")');
    expect(gate).toContain('atLeast(useCanvasStore.getState().capability, "edit")');
    // No surface compares the rung itself: `own` counts as editing because
    // the ladder says so, not because somebody remembered to add a case.
    for (const entry of HIDDEN_WRITES) {
      const source = read(`../src/${entry.file}`);
      expect(source, `${entry.file} compares the rung by hand`).not.toMatch(
        /capability\s*[!=]==\s*"(read|own)"/,
      );
    }
  });

  it("keeps the three surfaces apart: view is the deck, read the canvas, the rest the editor", () => {
    const page = read("../src/pages/CanvasPage.tsx");
    expect(page).toContain('if (capability === "view") {');
    expect(page).toContain("return <Viewer canvasId={canvasId}");
    expect(page).toContain('${canEdit ? "" : " read-only"}');
    // And the gate sends a reader to the door for a name, not to the deck.
    const app = read("../src/App.tsx");
    expect(app).toContain('s.capability === "view" ? "view" : "door"');
  });
});

/**
 * **Presence says the rung, in one word from one map.** The facepile's hover
 * card, the Share roster and `isocan who` all say *reading* for a `read`
 * connection, and none of them spell the word themselves.
 */
describe("a reader is marked as reading", () => {
  it("in the facepile, the Share roster, and the CLI, from core's one map", () => {
    expect(capabilityWord.presence.read).toBe("reading");
    for (const rel of [
      "../src/components/Presence.tsx",
      "../src/components/ShareDialog.tsx",
      "../../cli/src/main.ts",
    ]) {
      const source = read(rel);
      expect(source, `${rel} does not read the presence word from core`).toContain(
        "capabilityWord.presence[",
      );
      expect(source, `${rel} spells the word itself`).not.toMatch(/"reading"/);
    }
  });

  it("stays in presence for read, and out for view — the daemon's rule", () => {
    const ws = read("../../server/src/ws.ts");
    expect(ws).toContain('if (!atLeast(capability, "read")) return;');
    expect(ws).toContain('presence.createSession(canvasId!, actor, "web", { sessionId, capability })');
  });
});

/**
 * **The Share dialog's words are the research's four**, and the two pickers
 * it grew in phase 1 offer the three a link can be set to.
 */
describe("the Share dialog's pickers", () => {
  const dialog = read("../src/components/ShareDialog.tsx");

  it("offers Editor, Canvas Viewer and Presentation Viewer, from core's map", () => {
    expect(capabilityWord.dialog).toEqual({
      own: "Owner",
      edit: "Editor",
      read: "Canvas Viewer",
      view: "Presentation Viewer",
    });
    expect(dialog).toContain('const LINK_RUNGS: readonly Capability[] = ["edit", "read", "view"];');
    expect(dialog).toContain("{capabilityWord.dialog[rung]}");
    expect(dialog).not.toContain("Can view");
    expect(dialog).not.toContain("Can edit");
  });

  it("invites at the picked rung, Editor by default", () => {
    expect(dialog).toContain('useState<Capability>("edit")');
    expect(dialog).toContain("createGrant(canvasId, grantSubjectOf(who), inviteRung, actor.id)");
  });

  it("is the ladder the research described: each rung can do what the ones below can", () => {
    for (let i = 0; i < RUNGS.length; i++) {
      for (let j = 0; j < RUNGS.length; j++) {
        expect(atLeast(RUNGS[i]!, RUNGS[j]!)).toBe(i >= j);
      }
    }
  });
});
