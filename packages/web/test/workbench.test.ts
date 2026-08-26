import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CanvasContents, PresenceSession } from "@isocan/core";
import { workbenchItemPath, workbenchPath, workbenchUrl } from "@isocan/core";

import { agentRows, answeringExcerpt } from "../src/lib/roster.ts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * The workbench's standing constraints, held as tests rather than as
 * sentences in the design doc.
 *
 * The doc's headline finding was that the agent room costs ZERO new
 * operations — everything in it is a projection of presence, canvas state
 * and the one main thread, and its only write path is the composer, which is
 * the same component the canvas docks. These tests are what keep that
 * finding true after the doc stops being read.
 */
describe("the workbench writes nothing of its own", () => {
  const workbench = read("../src/components/Workbench.tsx");
  const stage = read("../src/components/ArtifactStage.tsx");

  it("sends no operations from its own code", () => {
    // The composer inside it does — through MainThreadBody, the same
    // component the canvas docks, which is the point: one channel, two
    // frames. The workbench's OWN code is a projection and must stay one.
    expect(workbench).not.toContain("sendOp");
    expect(workbench).not.toContain("applyLocalEcho");
    expect(stage).not.toContain("sendOp");
  });

  it("renders the main thread through the shared component, never a copy", () => {
    expect(workbench).toContain("MainThreadBody");
    expect(workbench).not.toContain("postToMain");
  });

  it("builds every address from core's one spelling", () => {
    // address.test.ts sweeps the whole source for hand-spelled paths; this
    // asserts the positive half — the workbench actually imports the
    // builders it navigates with.
    for (const name of ["workbenchPath", "workbenchItemPath", "workbenchUrl"]) {
      expect(workbench).toContain(name);
    }
  });

  it("shares the stage with full screen — one renderer, two addresses", () => {
    // The two-products tell: the same artifact rendering differently at
    // /i/:itemId and /w/:itemId. Both frames must mount ArtifactStage.
    expect(workbench).toContain("<ArtifactStage");
    expect(read("../src/components/FullScreen.tsx")).toContain("<ArtifactStage");
  });

  it("never classifies a status string into a semantic badge", () => {
    // The design doc bans string-matching lifecycle copy ("waiting for
    // you…") into a PARKED state until statusSource crosses the wire. The
    // verbatim string is honest; a badge built from it is a lie waiting for
    // the day the copy changes.
    expect(workbench).not.toContain("waiting for you");
  });
});

/** A minimal session; only what the roster reads. */
function session(over: Partial<PresenceSession>): PresenceSession {
  return {
    sessionId: "ses_x",
    actor: { id: "usr_a", name: "Kenny" },
    kind: "cli",
    harness: "claude-code",
    label: null,
    cursor: null,
    selection: [],
    status: null,
    activity: null,
    onThread: null,
    lastSeen: "2026-08-25T12:00:00.000Z",
    ...over,
  } as PresenceSession;
}

describe("the roster's rows", () => {
  it("is one row per ACTOR, led by the cli session", () => {
    // The facepile's recorded bug, inherited as law: one agent holding a
    // terminal and a browser tab is ONE row — and unlike facesFor's
    // first-push-wins, the ACTING surface leads regardless of arrival order.
    const rows = agentRows([
      session({ sessionId: "web1", kind: "web", harness: null }),
      session({ sessionId: "cli1", kind: "cli" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.primary.sessionId).toBe("cli1");
    expect(rows[0]!.others.map((s) => s.sessionId)).toEqual(["web1"]);
  });

  it("shows no row for a person at a browser", () => {
    // kind:"web" with no cli surface is a person — the facepile's, not the
    // agent view's.
    expect(
      agentRows([session({ sessionId: "web1", kind: "web", harness: null })]),
    ).toEqual([]);
  });

  it("says 'terminal' rather than guessing an agent from a bare cli session", () => {
    const rows = agentRows([session({ harness: null })]);
    expect(rows[0]!.harness).toBeNull();
  });

  it("puts working rows first, and keeps idle order stable", () => {
    const rows = agentRows([
      session({ sessionId: "a", actor: { id: "usr_a", name: "A" } }),
      session({
        sessionId: "b",
        actor: { id: "usr_b", name: "B" },
        activity: { kind: "working", itemId: "itm_1" },
      }),
    ]);
    expect(rows.map((r) => r.actorId)).toEqual(["usr_b", "usr_a"]);
  });

  it("prefers the freshest cli surface when an actor holds two", () => {
    const rows = agentRows([
      session({ sessionId: "old", lastSeen: "2026-08-25T11:00:00.000Z" }),
      session({ sessionId: "new", lastSeen: "2026-08-25T12:00:00.000Z" }),
    ]);
    expect(rows[0]!.primary.sessionId).toBe("new");
  });
});

describe("what an agent is answering", () => {
  const canvas = {
    threads: {
      th_1: { id: "th_1", comments: [{ body: "first" }, { body: "make it match the mock" }] },
    },
    items: {},
  } as unknown as CanvasContents;

  it("excerpts the LAST comment of the thread the session is on", () => {
    const found = answeringExcerpt(canvas, session({ onThread: "th_1" }));
    expect(found).toEqual({ threadId: "th_1", body: "make it match the mock" });
  });

  it("answers nothing off-thread, and nothing for a thread that is gone", () => {
    expect(answeringExcerpt(canvas, session({}))).toBeNull();
    expect(answeringExcerpt(canvas, session({ onThread: "th_gone" }))).toBeNull();
  });
});

describe("the workbench address family", () => {
  it("builds both levels, and the url form takes the item optionally", () => {
    expect(workbenchPath("prj_1")).toBe("/p/prj_1/w");
    expect(workbenchItemPath("prj_1", "itm_2")).toBe("/p/prj_1/w/itm_2");
    expect(workbenchUrl("https://isocan.io", "prj_1")).toBe("https://isocan.io/p/prj_1/w");
    expect(workbenchUrl("https://isocan.io/", "prj_1", "itm_2")).toBe(
      "https://isocan.io/p/prj_1/w/itm_2",
    );
  });

  it("escapes an id the way the item route does", () => {
    expect(workbenchItemPath("prj_1", "itm/odd")).toBe("/p/prj_1/w/itm%2Fodd");
  });
});
