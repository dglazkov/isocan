import { describe, expect, it } from "vitest";
import { buildRecapHead, clipRecapLabel, emptyCanvas, formatRecapHead, recapHeadRoute, type LogEntry, type Operation } from "../src/index.ts";
import { apply, envelope, seedState } from "./helpers.ts";

function entry(seq: number, op: Operation, name = "Maya"): LogEntry {
  return { seq, envelope: envelope(op, { id: `usr_${name}`, name }), inverse: null };
}

describe("bounded inherited recap heads", () => {
  it("deduplicates and sorts a contiguous current range without claiming missing older history", () => {
    const rows = Array.from({ length: 105 }, (_, n) => entry(n + 1, { type: "item.move", itemId: "itm_1", x: n, y: 0 }));
    const canvas = seedState().canvas;
    const head = buildRecapHead([...rows.slice(4).reverse(), rows[4]!], canvas, 105)!;
    expect(head).toMatchObject({ fromSeq: 6, toSeq: 105, count: 100, items: [{ id: "itm_1", title: "One", ops: 100 }], omitted: { earlierAvailableOps: 1 } });
    expect(head.fromTs).toBe(rows[5]!.envelope.ts);
    expect(head.toTs).toBe(rows[104]!.envelope.ts);
    expect(buildRecapHead(rows.filter((row) => row.seq !== 99), canvas, 105)).toBeNull();
    expect(buildRecapHead(rows.slice(0, -1), canvas, 105)).toBeNull();
    expect(buildRecapHead([...rows, entry(99, { type: "project.update", patch: { title: "conflict" } })], canvas, 105)).toBeNull();
    expect(buildRecapHead([...rows, { ...rows[98]!, envelope: { ...rows[98]!.envelope, op: { type: "item.move", itemId: "itm_other", x: 0, y: 0 } } }], canvas, 105)).toBeNull();
    expect(buildRecapHead([...rows, { envelope: rows[98]!.envelope, inverse: null, seq: 99 }], canvas, 105)).not.toBeNull();
    expect(buildRecapHead(rows, canvas, 104)).toBeNull();
    expect(buildRecapHead([], canvas, 0)).toBeNull();
  });

  it("suppresses current descendants of an excluded group and genuinely trashed items", () => {
    const state = apply(seedState(), { type: "item.delete", itemId: "itm_2" })!;
    expect(state.canvas.trash.some((row) => row.item.id === "itm_2")).toBe(true);
    state.canvas.items.itm_group = { ...state.canvas.items.itm_1!, id: "itm_group", title: "EXCLUDED_GROUP", properties: { kind: "group", context: "excluded" } };
    state.canvas.items.itm_1!.containerId = "itm_group";
    state.canvas.items.itm_1!.title = "EXCLUDED_DESCENDANT";
    const head = buildRecapHead([
      entry(1, { type: "items.move", moves: [{ itemId: "itm_1", x: 1, y: 1 }, { itemId: "itm_group", x: 0, y: 0 }] }),
      entry(2, { type: "item.delete", itemId: "itm_2" }),
    ], state.canvas, 2)!;
    expect(head).toMatchObject({ count: 2, items: [], omitted: { hiddenItems: 3 } });
    expect(JSON.stringify(head)).not.toMatch(/EXCLUDED_|itm_1|itm_2|itm_group|Two/);
  });

  it("bounds names and current rows while dropping removed/excluded names and raw Chat payloads", () => {
    const canvas = seedState().canvas;
    const template = canvas.items.itm_1!;
    canvas.items = Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`itm_${n}`, { ...template, id: `itm_${n}`, title: `Title ${n} ${"🪴".repeat(170)}` }]));
    canvas.items.itm_hidden = { ...template, id: "itm_hidden", title: "EXCLUDED_TITLE", properties: { context: "excluded" } };
    const rows: LogEntry[] = Array.from({ length: 96 }, (_, n) => entry(n + 1, { type: "item.move", itemId: `itm_${n % 12}`, x: n, y: 0 }, `Actor ${n % 7} ${"🪴".repeat(170)}`));
    rows.push(entry(97, { type: "item.update", itemId: "itm_hidden", patch: { title: "EXCLUDED_OLD_TITLE" } }));
    rows.push(entry(98, { type: "item.update", itemId: "itm_removed", patch: { title: "REMOVED_TITLE" } }));
    rows.push(entry(99, { type: "thread.create", threadId: "thr_acme", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_acme", body: "PRIVATE_CHAT_PAYLOAD" } }));
    rows.push(entry(100, { type: "thread.reply", threadId: "thr_acme", comment: { id: "cmt_again", body: "PRIVATE_REPLY_PAYLOAD" } }));
    const head = buildRecapHead(rows, canvas, 100)!;
    expect(head).toMatchObject({ count: 100, comments: 2, omitted: { actors: 3, items: 4, hiddenItems: 2, clippedLabels: 13 } });
    expect(head.actors).toHaveLength(5);
    expect(head.items).toHaveLength(8);
    for (const label of [...head.actors.map((row) => row.name), ...head.items.map((row) => row.title)]) expect(Array.from(label)).toHaveLength(160);
    expect(JSON.stringify(head)).not.toMatch(/EXCLUDED_|REMOVED_|PRIVATE_|envelope|inverse|blobHash/);
    const report = formatRecapHead(head);
    expect(report).toContain("seq 1–100: 100 operations, 2 comments");
    expect(report).toContain("4 less-active current item rows omitted");
    expect(report).toContain("2 removed or excluded item details omitted");
    expect(report).toContain("13 labels clipped at 160 Unicode code points");
  });

  it("a newly created source has real activity, even with no item rows", () => {
    const head = buildRecapHead([entry(1, { type: "project.create", canvasId: "prj_acme", title: "Acme" })], emptyCanvas(), 1)!;
    expect(head).toMatchObject({ count: 1, items: [], comments: 0, omitted: { earlierAvailableOps: 0, actors: 0, items: 0, hiddenItems: 0, clippedLabels: 0 } });
    expect(recapHeadRoute("prj_acme/a")).toBe("/api/projects/prj_acme%2Fa/context/recap");
    expect(clipRecapLabel("🪴".repeat(161))).toEqual({ text: "🪴".repeat(160), clipped: true });
  });
});
