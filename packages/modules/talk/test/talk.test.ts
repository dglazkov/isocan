import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mainThread } from "@isocan/core";
import type { DialogFacts } from "@isocan/core";
import { canvasSnapshotText } from "@isocan/voice-agent/live";
import { decodeMessage, runTool, talkWeb } from "../src/web.tsx";

/**
 * **Talk: the dialog's tool-call half, driven with a fake host.**
 *
 * The contract that matters is not the React — it is that a spoken request
 * becomes the SAME operations a click sends: ids minted here, a `ref`
 * resolved against this canvas's items, `item.add` content through
 * `host.putBlob`, everything delivered through `host.send` (so it wears the
 * viewer's identity and undo), and the read tools answered from the facts
 * the shell already handed over. The provider contract itself is the
 * harness's, shared via `@isocan/voice-agent/live`.
 */

const canvas = {
  items: {
    itm_1: { id: "itm_1", title: "Checkout screen" },
    itm_2: { id: "itm_2", title: "Launch plan" },
  },
  threads: {
    thr_main: { id: "thr_main", comments: [], main: true },
  },
  trash: [],
  agents: {},
};

const sent: { ops: unknown[]; group: string }[] = [];
const blobs: { body: string; filename: string }[] = [];

const facts = {
  canvasId: "prj_1",
  groupMode: "groups",
  canvas,
  selection: [],
  args: "",
  rcParked: false,
  canEdit: true,
  host: {
    send: async (ops: readonly unknown[], group: string) => {
      sent.push({ ops: [...ops], group });
    },
    putBlob: async (bytes: Blob, filename: string) => {
      blobs.push({ body: await bytes.text(), filename });
      return { blobHash: "h1", size: 3 };
    },
    close: () => undefined,
    viewer: { id: "usr_a", name: "A" },
    reveal: () => undefined,
    enrol: async () => ({ actorId: "usr_x" }),
  },
} as unknown as DialogFacts;

describe("the talk module declares the door, the dialog and the floating mic", () => {
  it("is a palette action that opens the config dialog", () => {
    expect(talkWeb.actions?.map((a) => [a.id, a.name, a.opens])).toEqual([
      ["talk", "Configure voice", "voice"],
    ]);
    expect(talkWeb.dialogs?.map((d) => [d.id, d.title])).toEqual([["voice", "Voice settings"]]);
  });

  it("floats a mic overlay on the right edge", () => {
    expect(talkWeb.overlays?.map((o) => [o.region, o.label])).toEqual([["right", "Voice"]]);
  });

  it("imports nothing from the shell's stores — facts in, ops out", () => {
    const web = readFileSync(fileURLToPath(new URL("../src/web.tsx", import.meta.url)), "utf8");
    expect(web).not.toMatch(/useCanvasStore|useUiStore/);
  });
});

describe("a WebSocket frame is decoded whatever the browser makes of it", () => {
  it("reads a string, a Blob and an ArrayBuffer the same way", async () => {
    const json = { setupComplete: {} };
    expect(await decodeMessage(JSON.stringify(json))).toEqual(json);
    expect(await decodeMessage(new Blob([JSON.stringify(json)]))).toEqual(json);
    expect(await decodeMessage(new TextEncoder().encode(JSON.stringify(json)).buffer)).toEqual(json);
  });

  it("returns null for the provider's binary audio frames and for garbage", async () => {
    // A raw PCM Blob is a binary frame, not JSON — it must be SKIPPED, not
    // parsed into "[object Blob]" (the bug the first build shipped).
    expect(await decodeMessage(new Blob([new Uint8Array([1, 2, 3, 4])]))).toBeNull();
    expect(await decodeMessage("not json at all")).toBeNull();
  });
});

describe("the session is handed the canvas it is standing on", () => {
  it("writes the snapshot in the one wording — ids first, titles for a person", () => {
    const text = canvasSnapshotText(
      [{ id: "itm_1", title: "Checkout screen" }],
      [{ id: "thr_1", comments: [{}, {}] }],
    );
    expect(text).toBe(
      "Current canvas state (ids are authoritative — echo them in tool calls):\n" +
        "- items: Checkout screen [itm_1]\n" +
        "- threads: thr_1 (2 comments)",
    );
  });
});

describe("a spoken request becomes the same operations a click sends", () => {
  it("add_item mints ids, puts the text through the host, and sends one groups-shaped op", async () => {
    const result = await runTool("add_item", { title: "Banana", text: "a note" }, facts);
    expect(result.ok).toBe(true);
    expect(blobs.at(-1)).toEqual({ body: "a note", filename: "note.md" });
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op.type).toBe("item.add");
    expect(String(op.itemId)).toMatch(/^itm_/);
    expect(op.version).toMatchObject({ blobHash: "h1", mimeType: "text/markdown", filename: "note.md" });
    // The wire wants geometry, a position, and — on a groups canvas — the
    // insertion named, the same shape the shell's own creators send.
    expect(Number(op.width)).toBeGreaterThan(0);
    expect(Number(op.height)).toBeGreaterThan(0);
    expect(op.placement).toEqual({ x: 160, y: 120 });
    expect(op.containerId).toBeNull();
    expect(op.groupPlacement).toBe("auto");
  });

  it("rename_item resolves the spoken ref against this canvas's items", async () => {
    const result = await runTool("rename_item", { item_ref: "checkout", title: "Checkout v2" }, facts);
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op).toMatchObject({ type: "item.update", itemId: "itm_1" });
    expect((op.patch as Record<string, unknown>).title).toBe("Checkout v2");
  });

  it("a ref nobody matches is refused in words, not sent", async () => {
    const before = sent.length;
    const result = await runTool("delete_item", { item_ref: "nothing like this" }, facts);
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("no item matches");
    expect(sent.length).toBe(before);
  });

  it("say replies on the canvas's main thread with a minted comment", async () => {
    const result = await runTool("say", { text: "putting the build in the chat" }, facts);
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op.type).toBe("thread.reply");
    expect(op.threadId).toBe(mainThread(canvas as never)?.id);
    expect((op.comment as Record<string, unknown>).id).toMatch(/^cmt_/);
  });

  it("read_canvas answers from the facts, with nothing sent", async () => {
    const before = sent.length;
    const result = await runTool("read_canvas", {}, facts);
    expect(result.ok).toBe(true);
    expect(String(result.answer)).toContain("Checkout screen [itm_1]");
    expect(sent.length).toBe(before);
  });

  it("a tool the dialog does not wire is said so, not faked", async () => {
    const result = await runTool("viewport_focus", { x: 1, y: 2 }, facts);
    expect(result.ok).toBe(false);
  });
});
