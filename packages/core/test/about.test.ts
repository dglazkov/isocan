import { describe, expect, it } from "vitest";
import type { LogEntry, Operation } from "../src/ops.ts";
import { majorWhat, majors } from "../src/timeline.ts";

/**
 * **A seam names what it was about.** "Beckham added something" says who
 * moved and nothing about what. The op already carries the words — the
 * title, the file, the opening line — so a seam carries them too, and one
 * sentence on every surface says the thing.
 */
const entry = (seq: number, op: Operation): LogEntry =>
  ({
    seq,
    envelope: { id: `op_${seq}`, canvasId: "prj_1", actor: { id: "usr_b", name: "Beckham" }, ts: "2026-09-02T10:00:00.000Z", op },
  }) as unknown as LogEntry;

const version = { id: "v1", blobHash: "h", mimeType: "text/html", filename: "schedule.html", size: 1 };

describe("what a seam is about", () => {
  it("names an added item by its title, and a new version by its file", () => {
    const [added, versioned] = majors([
      entry(1, { type: "item.add", itemId: "itm_1", version, width: 1, height: 1, placement: { x: 0, y: 0 }, title: "Round-robin fixtures" }),
      entry(2, { type: "item.addVersion", itemId: "itm_1", version: { ...version, id: "v2" } }),
    ]);
    expect(added?.about).toBe("Round-robin fixtures");
    expect(majorWhat(added!)).toBe("Beckham added something — “Round-robin fixtures”");
    expect(versioned?.about).toBe("schedule.html");
  });

  it("quotes the opening line of a conversation — a summons says what was asked", () => {
    const [started] = majors([
      entry(1, {
        type: "thread.create",
        threadId: "thr_1",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "c1", body: "@Beckham can you solve the Tuesday clash?\n\nDetails below." },
      }),
    ]);
    expect(started?.about).toBe("@Beckham can you solve the Tuesday clash?");
    expect(majorWhat(started!)).toContain("started a conversation — “@Beckham can you solve the Tuesday clash?”");
  });

  it("keeps a long line to a sentence, and says nothing about a move", () => {
    const long = "x".repeat(200);
    const [started, moved] = majors([
      entry(1, { type: "thread.create", threadId: "thr_1", x: 0, y: 0, anchorItemId: null, comment: { id: "c1", body: long } }),
      entry(2, { type: "item.delete", itemId: "itm_1" }),
    ]);
    expect(started?.about?.length).toBe(80);
    expect(started?.about?.endsWith("…")).toBe(true);
    expect(moved?.about).toBeNull();
    expect(majorWhat(moved!)).toBe("Beckham deleted something");
  });
});
