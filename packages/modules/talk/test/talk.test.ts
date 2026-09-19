import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mainThread } from "@isocan/core";
import type { DialogFacts } from "@isocan/core";
import { canvasSnapshotText, commandsBrief } from "../src/live.ts";
import { decodeMessage, runTool, snapshotItemsFor, talkWeb } from "../src/web.tsx";

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

const versionOf = (id: string, filename: string) => ({ id, filename, blobHash: "h", mimeType: "text/markdown", size: 3 });
const canvas = {
  items: {
    itm_1: {
      id: "itm_1", title: "Checkout screen", x: 10, y: 20, width: 320, height: 240,
      description: "", properties: {},
      versions: [versionOf("ver_1", "a.md"), versionOf("ver_2", "b.md")],
      currentVersionId: "ver_2",
    },
    itm_2: { id: "itm_2", title: "Launch plan", x: 400, y: 100, width: 320, height: 240, description: "", properties: {}, versions: [versionOf("ver_3", "plan.md")], currentVersionId: "ver_3" },
  },
  threads: {
    thr_main: { id: "thr_main", comments: [], main: true },
  },
  trash: [
    { item: { id: "itm_gone", title: "Old banner", x: 0, y: 0, width: 100, height: 100, description: "", properties: {}, versions: [versionOf("ver_9", "old.md")], currentVersionId: "ver_9" } },
  ],
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

  /**
   * **isocan-xsh.8.5, the browser half.** The microphone used to send on
   * `readyState === OPEN` alone — the same defect the harness had, in the second
   * place audio leaves the machine. This is a SOURCE assertion in this file's own
   * idiom (there is no DOM/WebSocket harness here), so it holds the shape of the
   * fix, not a measured browser run: the capture callback must consult
   * `providerReady` before it consults `readyState`, and `providerReady` must be
   * set by `setupComplete`. A behavioural browser capture is isocan-xsh.6's job.
   */
  it("gates the microphone on the provider's setupComplete, not on the socket being open", () => {
    const web = readFileSync(fileURLToPath(new URL("../src/web.tsx", import.meta.url)), "utf8");
    const gateAt = web.indexOf("if (!providerReady) {");
    const openAt = web.indexOf("if (socket.readyState === WebSocket.OPEN) {", gateAt);
    expect(gateAt, "the capture callback no longer checks providerReady").toBeGreaterThan(-1);
    expect(openAt, "the readyState check moved out of the capture callback").toBeGreaterThan(gateAt);
    // The flag is the provider's own acknowledgement, and nothing else sets it.
    expect(web).toMatch(/if \(message\.setupComplete\) \{\s*providerReady = true;/);
    expect(web.match(/providerReady = true/g)).toHaveLength(1);
    // A dropped frame is counted and said, not discarded in silence.
    expect(web).toMatch(/gatedFrames\+\+/);
    expect(web).toContain("dropped before the provider was ready");
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
  const acme = (over: Partial<Parameters<typeof canvasSnapshotText>[0][number]> = {}) => ({
    id: "itm_1", title: "Checkout screen", kind: "image",
    x: 100, y: 200, width: 320, height: 240, ...over,
  });

  it("writes the snapshot in the one wording — ids, kind, size and corner", () => {
    const text = canvasSnapshotText([acme()], [{ id: "thr_1", comments: [{}, {}] }]);
    expect(text).toBe(
      "Current canvas state (ids are authoritative — echo them in tool calls).\n" +
        "Geometry is world pixels: x grows right, y grows down, and (x,y) is an item's top-left corner.\n" +
        "Items (1, in reading order):\n" +
        '- "Checkout screen" [itm_1] image 320x240 at (100,200)\n' +
        "Threads: thr_1 (2 comments)",
    );
  });

  /** #337: the geometry is the point. A session told only titles and ids
   *  cannot be asked to move one thing next to another, because `move_item`
   *  takes pixels and nothing it was shown says where anything is. */
  it("says where every item is, so 'next to' is arithmetic the model can do", () => {
    const text = canvasSnapshotText(
      [acme(), acme({ id: "itm_2", title: "Settings", kind: "text", x: 460, y: 200, width: 200, height: 120 })],
      [],
    );
    expect(text).toContain('"Checkout screen" [itm_1] image 320x240 at (100,200)');
    expect(text).toContain('"Settings" [itm_2] text 200x120 at (460,200)');
    expect(text).toContain("x grows right, y grows down");
  });

  it("names the group an item sits in, and says nothing when it sits in none", () => {
    expect(canvasSnapshotText([acme({ containerId: "itm_grp" })], [])).toContain("inside [itm_grp]");
    expect(canvasSnapshotText([acme()], [])).not.toContain("inside");
  });

  it("orders by reading order and breaks ties by id, so nothing reshuffles itself", () => {
    const rows = canvasSnapshotText(
      [
        acme({ id: "itm_c", title: "C", y: 400, x: 0 }),
        acme({ id: "itm_b", title: "B", y: 0, x: 50 }),
        acme({ id: "itm_a", title: "A", y: 0, x: 50 }),
      ],
      [],
    ).split("\n").filter((l) => l.startsWith("- "));
    expect(rows.map((l) => l.match(/\[(itm_\w+)\]/)![1])).toEqual(["itm_a", "itm_b", "itm_c"]);
  });

  /** A bounded list that admits its bound can be asked about; one that does
   *  not is a model talking confidently about a canvas it saw a third of. */
  it("caps the list and discloses what it left out", () => {
    const many = Array.from({ length: 5 }, (_, n) => acme({ id: `itm_${n}`, title: `Acme ${n}`, y: n }));
    const text = canvasSnapshotText(many, [], 2);
    expect(text).toContain("Items (2 of 5, in reading order):");
    expect(text).toContain("- 3 more not listed — ask for one by title if what you want is not here.");
    expect(text).not.toContain("[itm_4]");
  });

  it("says so plainly when the canvas is empty", () => {
    const text = canvasSnapshotText([], []);
    expect(text).toContain("Items: none.");
    expect(text).toContain("Threads: none");
  });

  /** A title with a bracket or a newline in it would otherwise run into the
   *  id beside it and make the row unparseable. */
  it("quotes a title so punctuation cannot forge the shape of a row", () => {
    const text = canvasSnapshotText([acme({ title: "Acme [itm_9] fake" })], []);
    expect(text).toContain('"Acme [itm_9] fake" [itm_1] image');
  });
});

describe("the browser's half of the snapshot row", () => {
  /** #337: the shell hands this module ordinary `Item`s, and the standing
   *  harness lists `ListedItem`s that already carry a kind. Both must arrive
   *  at the same row, so the browser's mapping is spelled once and proved. */
  it("carries geometry and a derived kind for every item on the canvas", () => {
    const rows = snapshotItemsFor(canvas as never);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "itm_1", title: "Checkout screen", x: 10, y: 20, width: 320, height: 240,
    });
    expect(typeof rows[0]!.kind).toBe("string");
    expect(rows[0]!.kind).not.toBe("");
  });

  it("omits the group rather than naming an absent one", () => {
    expect(snapshotItemsFor(canvas as never)[0]).not.toHaveProperty("containerId");
    const nested = { ...canvas, items: { itm_1: { ...canvas.items.itm_1, containerId: "itm_grp" } } };
    expect(snapshotItemsFor(nested as never)[0]).toMatchObject({ containerId: "itm_grp" });
  });

  it("feeds the shared wording, so what the browser sends has the geometry in it", () => {
    const text = canvasSnapshotText(snapshotItemsFor(canvas as never), []);
    expect(text).toContain("at (10,20)");
    expect(text).toContain("320x240");
    expect(text).toContain("x grows right, y grows down");
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

  it("resolves a relative move against the item's real position", async () => {
    const result = await runTool("move_item", { item_ref: "checkout", by_x: 50, by_y: -10 }, facts);
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op).toMatchObject({ type: "item.move", itemId: "itm_1", x: 60, y: 10 });
    expect(op.by).toBeUndefined();
  });

  it("restores an item from the trash, where the live list no longer holds it", async () => {
    const result = await runTool("restore_item", { item_ref: "old banner" }, facts);
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op).toMatchObject({ type: "item.restore", itemId: "itm_gone" });
  });

  it("switches versions by first, last, and filename — the wire gets a version id", async () => {
    for (const [ref, expected] of [["first", "ver_1"], ["last", "ver_2"], ["a.md", "ver_1"]] as const) {
      const result = await runTool("item_set_current_version", { item_ref: "checkout", version_ref: ref }, facts);
      expect(result.ok, ref).toBe(true);
      const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
      expect(op.versionId, ref).toBe(expected);
      expect(op.versionRef).toBeUndefined();
    }
    const bad = await runTool("item_set_current_version", { item_ref: "checkout", version_ref: "nope" }, facts);
    expect(bad.ok).toBe(false);
  });

  it("anchors a thread at the item's own coordinates when the planner gives none", async () => {
    const result = await runTool("comment_on_item", { item_ref: "checkout", text: "look at this" }, facts);
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op.type).toBe("thread.create");
    expect(op.anchorItemId).toBe("itm_1");
    expect(op.x).toBe(10);
    expect(op.y).toBe(20);
  });

  it("builds a page itself: kind html becomes an embedded interactive item", async () => {
    const result = await runTool("add_item", { kind: "html", title: "Calculator", text: "<html><body>7*8</body></html>" }, facts);
    expect(result.ok).toBe(true);
    expect(blobs.at(-1)).toEqual({ body: "<html><body>7*8</body></html>", filename: "index.html" });
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op.type).toBe("item.add");
    expect(op.version).toMatchObject({ mimeType: "text/html", filename: "index.html" });
    expect(op.width).toBeGreaterThan(0);
  });

  it("leaves a legacy canvas's item.add free of group fields — its daemon refuses them", async () => {
    const legacy = { ...facts, groupMode: "legacy" } as DialogFacts;
    const result = await runTool("add_item", { title: "Legacy note", text: "plain" }, legacy);
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op.containerId).toBeUndefined();
    expect(op.groupPlacement).toBeUndefined();
    expect(op.placement).toEqual({ x: 160, y: 120 });
  });

  it("names the commands the canvas's agents run, with their usage, from the one catalogue", () => {
    const brief = commandsBrief();
    expect(brief).toContain("/accessibility-audit");
    expect(brief).toContain("/design-audit");
    expect(brief).toContain("/skill find <what you want> | add <owner/repo/path>");
  });

  it("a tool the dialog does not wire is said so, not faked", async () => {
    const result = await runTool("viewport_focus", { x: 1, y: 2 }, facts);
    expect(result.ok).toBe(false);
  });
});
