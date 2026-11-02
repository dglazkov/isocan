import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mainThread } from "@isocan/core";
import type { DialogFacts } from "@isocan/core";
import { canvasSnapshotText, commandsBrief } from "../src/live.ts";
import { decodeMessage, foldLine, runTool, sealLines, snapshotItemsFor, talkWeb } from "../src/web.tsx";
import type { Line } from "../src/web.tsx";

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
/** What the host was asked to run, and how it says it ran it. */
const ran: string[] = [];
let ranAs: "local" | "posted" = "local";

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
    // The composer's list: a built-in, and a MODULE command the compiled
    // catalogue does not carry — which is the case that failed.
    commands: () => [
      { name: "design-audit", description: "Audit the design", source: "built-in" },
      { name: "wire", description: "Wireframes from a request", usage: "[basic] <request>", source: "module", opens: "wire" },
    ],
    runCommand: async (text: string) => {
      ran.push(text);
      return ranAs;
    },
  },
} as unknown as DialogFacts;

describe("the talk module declares the door, the dialog and the composer's control", () => {
  it("is a palette action that opens the config dialog", () => {
    expect(talkWeb.actions?.map((a) => [a.id, a.name, a.opens])).toEqual([
      ["talk", "Configure voice", "voice"],
    ]);
    expect(talkWeb.dialogs?.map((d) => [d.id, d.title])).toEqual([["voice", "Voice settings"]]);
  });

  it("puts its control in the composer, and floats nothing", () => {
    /**
     * **The floating mic is gone, and its absence is the assertion.**
     *
     * It was the module's first door and the composer's control outgrew it:
     * the composer has the transcript, the names, the voice picker and a full
     * row for the glow to rise from, while the floating one could only show
     * two unattributed fragments over the canvas — and looked, on screen,
     * like a button hanging beside the tool rail with captions colliding
     * with it.
     *
     * The rail was the other candidate and is not open to a module: the rail
     * and the dock keep FIXED lists exactly so two modules cannot fight over
     * them. It is also the wrong shape, since a voice bar wants horizontal
     * room and a rail is a narrow vertical strip.
     *
     * Nothing became unreachable — ⌘K's "Configure voice" carries its own
     * test listen for when the Chat is closed.
     */
    expect(talkWeb.composer?.map((c) => c.label)).toEqual(["Talk to the canvas"]);
    expect(talkWeb.overlays ?? [], "a second door is a second thing to keep true").toEqual([]);
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
        "A colour word appears on a row only where the canvas KNOWS the colour (a note's paper, an area's tint, " +
        "a drawing's ink); no colour word means the colour is UNKNOWN to the canvas, never that the item is not " +
        "that colour — most items look like something the data does not record, so ask rather than ruling them out.\n" +
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

/**
 * **Colour, and the sentence that keeps an absence honest** (#337, phase 2).
 *
 * `Item` has no colour field, so a row can only say "red" where the data
 * actually does: a note's paper, an area's tint, a drawing's ink. Which makes
 * the missing rows the dangerous ones — a model shown one colour and eleven
 * blanks will conclude the eleven are not that colour, unless it is told
 * otherwise. So the header tells it, and this holds the header there.
 */
describe("colour on a row, and the absence that must not read as a negative", () => {
  const acme = (over: Partial<Parameters<typeof canvasSnapshotText>[0][number]> = {}) => ({
    id: "itm_1", title: "Checkout screen", kind: "image",
    x: 100, y: 200, width: 320, height: 240, ...over,
  });

  it("carries the colour when the canvas knows one", () => {
    const text = canvasSnapshotText(
      [acme({ id: "itm_n", title: "Standup notes", kind: "text", properties: { paper: "yellow" } })],
      [],
    );
    expect(text).toContain('"Standup notes" [itm_n] text 320x240 at (100,200) yellow');
  });

  it("reads an area's tint by the same route, because it is the same palette", () => {
    const text = canvasSnapshotText([acme({ kind: "area", properties: { tint: "blue" } })], []);
    expect(text).toContain("at (100,200) blue");
  });

  /**
   * **The row the header promised and nothing delivered.**
   *
   * The header has always named "a drawing's ink" as a colour source, and
   * until this was fixed no drawing could ever carry one: `Item` has no colour
   * field, a drawing's strokes live inside its SVG blob, and both production
   * callers of `itemColour` hand it `properties` alone. `itemColour` had a
   * stroke branch and `colour.test.ts` exercised it directly, so the unit was
   * green while the seam was dead — which is the shape of bug this file exists
   * to catch, and did not.
   *
   * It matters more than the other two sources because **red is not a paper**:
   * `PAPERS` is yellow, pink, blue, green, grey, and an area's tint reuses it.
   * So ink is the ONLY route by which a canvas can know something is red, and
   * "move the red one" — the sentence the whole voice demo is named for — was
   * unresolvable on every canvas.
   */
  it("carries a drawing's recorded ink colour, which is the only route to red", () => {
    const text = canvasSnapshotText(
      [acme({ id: "itm_d", title: "Sketch", kind: "drawing", properties: { kind: "drawing", ink: "red" } })],
      [],
    );
    expect(text).toContain('"Sketch" [itm_d] drawing 320x240 at (100,200) red');
  });

  it("would notice if ink stopped reaching the row", () => {
    // Falsification: the assertion above is only worth having if dropping the
    // property takes the word away again.
    const text = canvasSnapshotText([acme({ id: "itm_d", kind: "drawing", properties: { kind: "drawing" } })], []);
    expect(text).not.toContain("red");
  });

  it("does not believe an ink property that is not a spoken colour", () => {
    expect(
      canvasSnapshotText([acme({ kind: "drawing", properties: { ink: "#e02424" } })], []),
    ).toContain("at (100,200)\n");
  });

  it("says nothing at all when it does not know", () => {
    // A screenshot that is obviously red in the room is silent in the data,
    // and a guessed colour is worse than none.
    const row = canvasSnapshotText([acme()], [])
      .split("\n")
      .find((l) => l.startsWith("- "))!;
    expect(row).toBe('- "Checkout screen" [itm_1] image 320x240 at (100,200)');
  });

  it("does not believe a property that is not a paper", () => {
    expect(canvasSnapshotText([acme({ properties: { paper: "chartreuse" } })], [])).toContain(
      "at (100,200)\n",
    );
  });

  it("keeps the colour ahead of the group, so a row reads left to right", () => {
    expect(
      canvasSnapshotText([acme({ properties: { paper: "pink" }, containerId: "itm_grp" })], []),
    ).toContain("at (100,200) pink inside [itm_grp]");
  });

  /** The load-bearing sentence: without it the blanks are read as negatives. */
  it("states in the header that a missing colour means unknown, not 'not that colour'", () => {
    const header = canvasSnapshotText([acme()], []);
    expect(header).toContain("A colour word appears on a row only where the canvas KNOWS the colour");
    expect(header).toContain("means the colour is UNKNOWN to the canvas, never that the item is not that colour");
    // And it is there even for an empty canvas, because the rules are the
    // rules before there is anything to apply them to.
    expect(canvasSnapshotText([], [])).toContain("never that the item is not that colour");
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

  /** The colour word is derived inside `canvasSnapshotText` from the property
   *  bag, not computed on either side — this is the browser's end of that,
   *  and the proof that the bag actually travels. */
  it("hands the property bag over, so a note's paper becomes a colour in the wording", () => {
    const papered = {
      ...canvas,
      items: { itm_1: { ...canvas.items.itm_1, properties: { kind: "text", paper: "green" } } },
    };
    expect(snapshotItemsFor(papered as never)[0]!.properties).toMatchObject({ paper: "green" });
    expect(canvasSnapshotText(snapshotItemsFor(papered as never), [])).toContain("at (10,20) green");
    // And the untinted canvas says nothing, on the same code path.
    expect(canvasSnapshotText(snapshotItemsFor(canvas as never), [])).not.toContain("green");
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

  it("a spoken request carries what it is about, the way a typed one does", async () => {
    /**
     * The Chat composer attaches the selection to every message a person
     * sends, so an agent picking up "/redesign this" knows which item "this"
     * is. The voice posted the words alone — so the one path that HAS to
     * delegate (generating a screen's contents is not a canvas operation, it
     * is work for an agent that can think) sent its request with the subject
     * stripped off.
     */
    await runTool("say", { text: "/redesign this screen" }, { ...facts, selection: ["itm_1"] });
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect((op.comment as Record<string, unknown>).items).toEqual(["itm_1"]);
  });

  it("attaches nothing when nothing is picked out", async () => {
    // An empty `items` would say the message is about no items in
    // particular, which is a different claim from not saying.
    await runTool("say", { text: "hello everyone" }, facts);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op.comment as Record<string, unknown>).not.toHaveProperty("items");
  });

  it("read_canvas answers from the facts, with nothing sent", async () => {
    const before = sent.length;
    const result = await runTool("read_canvas", {}, facts);
    expect(result.ok).toBe(true);
    expect(String(result.answer)).toContain("Checkout screen");
    expect(sent.length).toBe(before);
  });

  it("re-reading does not hand back LESS than the session was told at setup", async () => {
    /* It used to answer with its own shorter list — titles and ids and
       nothing else — so a model that re-read the canvas lost the geometry it
       opened with. Re-reading to check something is exactly when the facts
       must not get thinner, so this answers in the projection's one wording. */
    const answer = String((await runTool("read_canvas", {}, facts)).answer);
    expect(answer, "the coordinate convention").toContain("x grows right");
    expect(answer, "geometry per row").toMatch(/\d+x\d+ at \(-?\d+,-?\d+\)/);
  });

  it("says which item the person has picked out, when one is picked", async () => {
    /* The session could `selection_set` and `selection_clear` and had no way
       to READ one, so "can you see what I've selected?" was a question it
       could only guess at. */
    const picked = await runTool("read_canvas", {}, { ...facts, selection: ["itm_1"] });
    expect(String(picked.answer)).toContain("SELECTED");
    expect(String(picked.answer), "the marker is explained where it appears").toContain("when they say");
    const none = await runTool("read_canvas", {}, facts);
    expect(String(none.answer), "no marker, and no line about one").not.toContain("SELECTED");
  });

  it("resolves a relative move against the item's real position", async () => {
    const result = await runTool("move_item", { item_ref: "checkout", by_x: 50, by_y: -10 }, facts);
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op).toMatchObject({ type: "item.move", itemId: "itm_1", x: 60, y: 10 });
    expect(op.by).toBeUndefined();
  });

  /**
   * **"Move the checkout screen next to the launch plan"** (#337, phase 3).
   *
   * The browser resolves this against the canvas it is showing and the
   * standing harness resolves it against a listing, and both call core's
   * `besideBox` — the fixture's numbers are the ones `placement.test.ts`
   * asserts, which is what "the same pixel on both surfaces" means in
   * practice.
   */
  it("puts one item beside another, with the standard gap and the middles lined up", async () => {
    // itm_1 is 320x240 at (10,20); itm_2 ("Launch plan") is 320x240 at (400,100).
    const result = await runTool(
      "move_item",
      { item_ref: "checkout", beside_ref: "launch", side: "right" },
      facts,
    );
    expect(result.ok).toBe(true);
    const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
    expect(op).toMatchObject({ type: "item.move", itemId: "itm_1", x: 760, y: 100 });
    // The planner's referent fields are spent here; the wire never sees them.
    expect(op.besideRef).toBeUndefined();
    expect(op.side).toBeUndefined();
  });

  it("takes the other three sides, and 'next to' with no side said means the right", async () => {
    const at = async (side?: string) => {
      await runTool(
        "move_item",
        { item_ref: "checkout", beside_ref: "launch", ...(side ? { side } : {}) },
        facts,
      );
      const op = sent.at(-1)!.ops[0] as Record<string, unknown>;
      return { x: op.x, y: op.y };
    };
    expect(await at("left")).toEqual({ x: 40, y: 100 });
    expect(await at("above")).toEqual({ x: 400, y: -180 });
    expect(await at("below")).toEqual({ x: 400, y: 380 });
    expect(await at()).toEqual(await at("right"));
  });

  it("refuses an anchor nobody can resolve, and moves nothing", async () => {
    const before = sent.length;
    const result = await runTool(
      "move_item",
      { item_ref: "checkout", beside_ref: "the mauve one" },
      facts,
    );
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("no item matches");
    expect(String(result.error)).toContain("the mauve one");
    expect(sent.length).toBe(before);
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

/**
 * **The transcript, which was reading the wire backwards.**
 *
 * `LiveServerContent` is an *incremental* update: the transcription fields
 * carry PIECES of a sentence, and the API has a separate
 * `interimInputTranscription` for the field that is re-sent as it grows. The
 * panel folded them as though every field were the growing kind and replaced
 * the speaker's line with each piece — so a whole answer rendered as its last
 * fragment, `Enceladus: you need on the canvas.`
 *
 * These are the shapes that got it wrong, held so it cannot come back: pieces
 * join, a tool row in the middle does not end a sentence, an end-of-turn does,
 * and a burst of identical tool rows is one row and a count.
 */
describe("what was said, folded from the pieces it arrives in", () => {
  const fold = (pieces: [Line["who"], string][]) =>
    pieces.reduce<Line[]>((lines, [who, text]) => foldLine(lines, who, text), []);

  it("joins the pieces of one turn into the whole sentence", () => {
    const lines = fold([["model", "you"], ["model", " need"], ["model", " on the canvas."]]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe("you need on the canvas.");
  });

  it("keeps a sentence whole across the tool rows that land inside it", () => {
    const lines = fold([
      ["model", "Moving these"],
      ["system", "move_item → done"],
      ["model", " so they do not overlap."],
    ]);
    const spoken = lines.filter((l) => l.who === "model");
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.text).toBe("Moving these so they do not overlap.");
  });

  it("starts a new line once the turn is sealed", () => {
    const first = fold([["model", "Done."]]);
    const next = foldLine(sealLines(first), "model", "Anything else?");
    expect(next.map((l) => l.text)).toEqual(["Done.", "Anything else?"]);
  });

  it("sealing twice costs one seal", () => {
    const once = sealLines(fold([["you", "hello"]]));
    expect(sealLines(once)).toEqual(once);
  });

  it("a change of speaker starts a line without needing a seal", () => {
    const lines = fold([["you", "select the top screen"], ["model", "Selecting it."]]);
    expect(lines.map((l) => l.who)).toEqual(["you", "model"]);
  });

  it("collapses a burst of identical tool rows into one row and a count", () => {
    const lines = fold(Array(7).fill(["system", "move_item → done"]) as [Line["who"], string][]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.count).toBe(7);
  });

  it("counts only a RUN — a different act in between starts a new row", () => {
    const lines = fold([
      ["system", "move_item → done"],
      ["system", "move_item → done"],
      ["system", "select → done"],
      ["system", "move_item → done"],
    ]);
    expect(lines.map((l) => [l.text, l.count ?? 1])).toEqual([
      ["move_item → done", 2],
      ["select → done", 1],
      ["move_item → done", 1],
    ]);
  });

  it("does not glue a doubled space where a piece brings its own", () => {
    expect(fold([["model", "one "], ["model", " two"]])[0]!.text).toBe("one two");
  });
});

/**
 * **The session block is a record, and the model cannot claim to be one.**
 *
 * The block rides the `say` tool so it takes that path's thread birth, minted
 * id and undo — but `record` is the panel's word, not the model's. It is
 * absent from the tool declarations and the planner never sees it, so a model
 * that names it in its arguments changes nothing.
 */
describe("a voice session lands as a record", () => {
  const lastComment = () =>
    (sent.at(-1)!.ops[0] as { comment: Record<string, unknown> }).comment;

  it("the panel's own channel marks the comment", async () => {
    const result = await runTool("say", { text: "\u{1f399} Voice session" }, facts, { record: true });
    expect(result.ok).toBe(true);
    expect(lastComment().record).toBe(true);
  });

  it("an ordinary spoken comment is not a record", async () => {
    await runTool("say", { text: "done" }, facts);
    expect("record" in lastComment()).toBe(false);
  });

  it("the model cannot mint one through its arguments", async () => {
    await runTool("say", { text: "quiet please", record: true }, facts);
    expect("record" in lastComment()).toBe(false);
  });
});

/**
 * **Voice runs the canvas's skills the way the composer does.**
 *
 * Asked to build wireframes and then told "you know there's a /wire skill —
 * use that", the session answered that it had hit "an issue while trying to
 * enroll the wireframing skill" and drew nothing. Three things were missing,
 * and each has a case here: the brief never named `/wire` (a MODULE command;
 * the brief read the compiled built-ins), there was no tool for running a
 * command at all, and `say "/wire …"` — the old advice — posted straight to
 * the Chat, skipping the composer's local door, so no dialog opened and with
 * nobody parked nothing happened.
 */
describe("commands, from the composer's list and through its door", () => {
  const hostCommands = (facts.host as unknown as { commands: () => { name: string; usage: string; description: string }[] }).commands();

  it("the brief names what the composer offers, module commands included", () => {
    const brief = commandsBrief(hostCommands);
    expect(brief).toContain("/wire [basic] <request> — Wireframes from a request");
    // The compiled default, which is all it used to read, has never heard of it.
    expect(commandsBrief()).not.toContain("/wire");
  });

  it("run_command hands the composer's door the whole line, and says it RAN", async () => {
    ran.length = 0;
    ranAs = "local";
    const before = sent.length;
    const result = await runTool("run_command", { name: "wire", args: "a bowling score tracker" }, facts);
    expect(ran).toEqual(["/wire a bowling score tracker"]);
    expect(result).toMatchObject({ ok: true });
    expect(String(result.answer)).toMatch(/^ran \/wire here/);
    // Nothing of its own went out: the door did the work.
    expect(sent.length).toBe(before);
  });

  it("a posted command is reported as asked-for, never as done", async () => {
    ran.length = 0;
    ranAs = "posted";
    const result = await runTool("run_command", { name: "/design-audit", args: "" }, facts);
    expect(ran).toEqual(["/design-audit"]);
    expect(String(result.answer)).toContain("has NOT run yet");
    ranAs = "local";
  });

  it("an invented command is refused with the real list, and nothing runs", async () => {
    ran.length = 0;
    const result = await runTool("run_command", { name: "wireframes", args: "x" }, facts);
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("/wire");
    expect(ran).toEqual([]);
  });

  it("a say whose words ARE a command goes through the same door", async () => {
    ran.length = 0;
    await runTool("say", { text: "/wire a bowling score tracker" }, facts);
    expect(ran).toEqual(["/wire a bowling score tracker"]);
  });

  it("ordinary speech is still just speech", async () => {
    ran.length = 0;
    const before = sent.length;
    await runTool("say", { text: "the screens are on the left" }, facts);
    expect(ran).toEqual([]);
    expect(sent.length).toBe(before + 1);
  });
});
