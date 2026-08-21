import { describe, expect, it } from "vitest";
import { recentActivity, type CanvasState } from "../src/index.ts";

const DI = { id: "usr_di", name: "Di" };
const FABLE = { id: "usr_fable", name: "Fable" };

function version(at: string, by = DI, id = `ver_${at}`) {
  return { id, blobHash: "h", mimeType: "text/markdown", filename: "f.md", size: 1, createdAt: at, createdBy: by };
}

function item(id: string, title: string, opts: { at: string; by?: typeof DI; versions?: ReturnType<typeof version>[] }) {
  const versions = opts.versions ?? [version(opts.at, opts.by ?? DI)];
  return {
    id, x: 0, y: 0, width: 10, height: 10, title, description: "", properties: {},
    versions, currentVersionId: versions[versions.length - 1]!.id,
    createdAt: opts.at, createdBy: opts.by ?? DI,
    updatedAt: versions[versions.length - 1]!.createdAt, updatedBy: versions[versions.length - 1]!.createdBy,
  };
}

const canvas = (over: Partial<CanvasState> = {}): CanvasState => ({ items: {}, threads: {}, trash: [], ...over });

describe("what somebody has been up to", () => {
  it("reports making an item, editing it, and saying something — newest first", () => {
    const state = canvas({
      items: {
        a: item("a", "Pricing page", {
          at: "2026-08-19T10:00:00.000Z",
          versions: [version("2026-08-19T10:00:00.000Z"), version("2026-08-20T10:00:00.000Z", DI, "ver_2")],
        }),
      },
      threads: {
        t1: {
          id: "t1", x: 0, y: 0, anchorItemId: "a", main: false,
          comments: [{ id: "c1", body: "moved the table up", author: DI, createdAt: "2026-08-21T09:00:00.000Z" }],
        } as CanvasState["threads"][string],
      },
    });
    const out = recentActivity(state, DI.id);
    expect(out.map((e) => e.kind)).toEqual(["said", "edited", "made"]);
    expect(out[0]).toMatchObject({ threadId: "t1", itemId: "a", subject: "Pricing page", body: "moved the table up" });
  });

  it("counts the first version as the making, not as an edit", () => {
    // Otherwise adding an item reports two acts one second apart.
    const state = canvas({ items: { a: item("a", "Sketch", { at: "2026-08-19T10:00:00.000Z" }) } });
    expect(recentActivity(state, DI.id).map((e) => e.kind)).toEqual(["made"]);
  });

  it("leaves out everyone else's work", () => {
    const state = canvas({ items: { a: item("a", "Fable's page", { at: "2026-08-19T10:00:00.000Z", by: FABLE }) } });
    expect(recentActivity(state, DI.id)).toEqual([]);
    expect(recentActivity(state, FABLE.id)).toHaveLength(1);
  });

  it("credits an edit to whoever added that version, not to the item's author", () => {
    const state = canvas({
      items: {
        a: item("a", "Tracker", {
          at: "2026-08-19T10:00:00.000Z",
          versions: [version("2026-08-19T10:00:00.000Z", DI), version("2026-08-20T10:00:00.000Z", FABLE, "ver_2")],
        }),
      },
    });
    expect(recentActivity(state, FABLE.id).map((e) => e.kind)).toEqual(["edited"]);
    expect(recentActivity(state, DI.id).map((e) => e.kind)).toEqual(["made"]);
  });

  it("says where a freestanding comment is, and names the main thread", () => {
    const thread = (id: string, over: object) => ({
      id, x: 0, y: 0, anchorItemId: null, main: false,
      comments: [{ id: `c_${id}`, body: "hi", author: DI, createdAt: "2026-08-21T09:00:00.000Z" }],
      ...over,
    }) as CanvasState["threads"][string];
    const state = canvas({ threads: { t1: thread("t1", {}), t2: thread("t2", { main: true }) } });
    expect(recentActivity(state, DI.id).map((e) => e.subject).sort()).toEqual(["the canvas", "the main thread"]);
  });

  it("keeps the newest few and drops the rest", () => {
    const threads: CanvasState["threads"] = {};
    for (let i = 0; i < 10; i++) {
      threads[`t${i}`] = {
        id: `t${i}`, x: 0, y: 0, anchorItemId: null, main: false,
        comments: [{ id: `c${i}`, body: `note ${i}`, author: DI, createdAt: `2026-08-2${i % 10}T09:00:00.000Z` }],
      } as CanvasState["threads"][string];
    }
    const out = recentActivity(canvas({ threads }), DI.id, 3);
    expect(out).toHaveLength(3);
    expect(out[0]!.body).toBe("note 9");
  });

  it("does not offer a trip to something that was deleted", () => {
    // The thread survives its anchor; a row saying "go and look" must not.
    const state = canvas({
      threads: {
        t1: {
          id: "t1", x: 0, y: 0, anchorItemId: "gone", main: false,
          comments: [{ id: "c1", body: "about that", author: DI, createdAt: "2026-08-21T09:00:00.000Z" }],
        } as CanvasState["threads"][string],
      },
    });
    expect(recentActivity(state, DI.id)).toEqual([]);
  });
});
