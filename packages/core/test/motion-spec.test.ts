import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addMotionItem,
  addMotionMovie,
  authoredSpec,
  buildMotion,
  MOTION_ASK_MARK,
  MOTION_BESIDE,
  MOTION_CONTROLS_HEIGHT,
  MOTION_MESSAGES,
  MOTION_PROPS,
  motionAsk,
  motionDocumentSpec,
  motionLayerSources,
  motionMessage,
  motionSeek,
  motionSpecFrom,
  motionStale,
  motionStaleLine,
  motionTargets,
  rebuildMotion,
  versionMotionItem,
  type MotionSource,
  type MotionWriter,
} from "@isocan/core/motion";
import { applyOperation, OpValidationError, type Actor, type CanvasContents, type CanvasState, type Item, type Operation } from "../src/index.ts";

/**
 * **Motion phase 2's core half** (`docs/projects/motion/design.md` §2, §3,
 * §5): the spec an agent writes and reads back, the sources found again for
 * an edit or a refresh, the stale line, the summons *Animate…* posts, the
 * player's messages, the one write each surface makes, and a comment's `at`.
 *
 * Fixtures are synthetic: Scene 1's "Acme Bakery" logo.
 */

const fixture = (name: string) => readFileSync(new URL(`./fixtures/motion/${name}.svg`, import.meta.url), "utf8");

const LOGO: MotionSource[] = [
  { item: "itm_circle", version: "ver_c1", title: "Circle", box: { x: 0, y: 0, width: 200, height: 200 }, svg: fixture("circle") },
  { item: "itm_wheat", version: "ver_w1", title: "Wheat", box: { x: 58, y: 30, width: 84, height: 140 }, svg: fixture("wheat") },
  { item: "itm_word", version: "ver_m1", title: "Wordmark", box: { x: -60, y: 210, width: 320, height: 60 }, svg: fixture("wordmark") },
];

/** Scene 1's words, as an agent would write them down. */
const SCENE_1 = {
  seconds: 3,
  loop: false,
  moves: [
    { target: "circle", channels: { draw: { keys: [{ t: 0, v: 0 }, { t: 0.9, v: 1, ease: "inOut" }] } } },
    {
      target: "wheat/stalk",
      pivot: "base",
      follows: "circle",
      channels: {
        scale: { keys: [{ t: 0.5, v: 0.2 }, { t: 1.5, v: 1, ease: "outBack" }] },
        rotate: { keys: [{ t: 0.5, v: -10 }, { t: 1.5, v: 0, ease: "outBack" }], wave: { period: 3, amp: 3, from: 1.5 } },
      },
    },
    { target: "wordmark", follows: "wheat/stalk", channels: { opacity: { keys: [{ t: 1.7, v: 0 }, { t: 2, v: 1 }] }, y: { keys: [{ t: 1.7, v: 8 }, { t: 2.3, v: 0, ease: "outBack" }] } } },
  ],
};

const recipeBuilt = await buildMotion({ sources: LOGO, recipe: "assemble" });
const layers = recipeBuilt.spec.layers;
const stage = recipeBuilt.spec.stage;

describe("the spec an agent writes", () => {
  it("reads Scene 1 written as words become numbers: named pivots resolved on the target's own box", () => {
    const spec = motionSpecFrom(SCENE_1, layers, stage);
    const stalk = spec.moves.find((m) => m.target === "wheat/stalk")!;
    const box = layers.find((l) => l.id === "wheat")!.parts.stalk!;
    expect(stalk.pivot).toEqual({ x: box.x + box.width / 2, y: box.y + box.height, at: "base" });
    expect(spec).toMatchObject({ version: 1, seconds: 3, loop: false });
    expect(spec.layers).toEqual(layers);
    expect(spec.recipe).toBeUndefined();
  });

  it("names the targets there are when one is wrong, and the pivots when a pivot is", () => {
    expect(motionTargets(layers)).toEqual(["circle", "wheat", "wheat/stalk", "wordmark"]);
    expect(() => motionSpecFrom({ seconds: 1, moves: [{ target: "wheat/stem", channels: {} }] }, layers, stage))
      .toThrow('move 1 moves "wheat/stem", which is not here — the targets are circle, wheat, wheat/stalk, wordmark');
    expect(() => motionSpecFrom({ seconds: 1, moves: [{ target: "wheat/stalk", pivot: "root", channels: { rotate: { keys: [{ t: 0, v: 0 }] } } }] }, layers, stage))
      .toThrow('"wheat/stalk" turns on "root" — a pivot is base, center, top, left, right');
  });

  it("refuses what cannot play honestly, in words: no pivot, a typo'd key, no length", () => {
    expect(() => motionSpecFrom({ seconds: 1, moves: [{ target: "wheat/stalk", channels: { rotate: { keys: [{ t: 0, v: 3 }] } } }] }, layers, stage)).toThrow(/names no pivot/);
    expect(() => motionSpecFrom({ seconds: 1, moves: [{ target: "circle", pviot: "base", channels: {} }] }, layers, stage)).toThrow('not "pviot"');
    expect(() => motionSpecFrom({ moves: [] }, layers, stage)).toThrow(/"seconds", a number/);
    expect(() => motionSpecFrom("make it move", layers, stage)).toThrow(/a JSON object/);
  });

  it("reads back what it wrote: authoredSpec, then motionSpecFrom, is the same spec", () => {
    const authored = authoredSpec(recipeBuilt.spec);
    expect(authored.moves.find((m) => m.target === "wheat/stalk")!.pivot).toBe("base");
    const again = motionSpecFrom(authored, layers, stage);
    expect(again.moves).toEqual(recipeBuilt.spec.moves);
  });

  it("builds a motion from a spec, and the document carries it", async () => {
    const built = await buildMotion({ sources: LOGO, spec: SCENE_1 });
    expect(built.spec.seconds).toBe(3);
    expect(built.warnings).toEqual([]);
    expect(motionDocumentSpec(built.html)!.moves).toEqual(built.spec.moves);
    expect(motionDocumentSpec("<html>not a motion</html>")).toBeNull();
    await expect(buildMotion({ sources: LOGO })).rejects.toThrow(/a recipe, or a spec/);
  });
});

describe("the player, off the stage", () => {
  it("puts Play, a scrubber and the time in a bar below the stage, never over it", () => {
    const html = recipeBuilt.html;
    expect(html).toContain('<input id="motion-scrub" type="range" min="0" step="0.01" value="0" aria-label="Time">');
    expect(html).not.toMatch(/#motion-controls \{ position: fixed/);
    expect(html).toContain(`height: ${MOTION_CONTROLS_HEIGHT}px`);
    expect(html.indexOf('id="stage"')).toBeLessThan(html.indexOf('id="motion-controls"'));
    expect(html).toContain(MOTION_MESSAGES.seek);
  });

  it("reads only a player's own messages, and only a finite time", () => {
    expect(motionMessage({ type: MOTION_MESSAGES.ready })).toEqual({ kind: "ready" });
    expect(motionMessage({ type: MOTION_MESSAGES.time, at: 1.23456, playing: false })).toEqual({ kind: "time", at: 1.235 });
    expect(motionMessage({ type: MOTION_MESSAGES.time, at: 2, playing: true })).toEqual({ kind: "time", at: null });
    expect(motionMessage({ type: MOTION_MESSAGES.time, at: Infinity })).toBeNull();
    expect(motionMessage({ type: "isocan:anchor", anchor: "x" })).toBeNull();
    expect(motionSeek(1.2)).toEqual({ type: MOTION_MESSAGES.seek, at: 1.2 });
  });
});

/** An item of the canvas, as the snapshot holds it. */
function item(id: string, title: string, versions: string[], props: Record<string, string> = {}): Item {
  return {
    id, title, description: "", properties: props, x: 0, y: 0, width: 100, height: 100,
    versions: versions.map((v) => ({ id: v, blobHash: `hash_${v}`, mimeType: "image/svg+xml", filename: `${id}.svg`, size: 1, createdAt: "2026-10-22T00:00:00Z", createdBy: { id: "usr_maya", name: "Maya" } })),
    currentVersionId: versions[versions.length - 1]!,
  } as unknown as Item;
}

describe("a motion's sources, found again", () => {
  const motion = item("itm_motion", "Acme logo — assemble", ["ver_mo1"], {
    [MOTION_PROPS.motion]: "true",
    [MOTION_PROPS.sources]: JSON.stringify([{ item: "itm_circle", version: "ver_c1" }, { item: "itm_wheat", version: "ver_w1" }, { item: "itm_word", version: "ver_m1" }]),
  });
  const canvas = {
    items: {
      itm_circle: item("itm_circle", "Circle", ["ver_c1"]),
      itm_wheat: item("itm_wheat", "Wheat", ["ver_w1", "ver_w2"]),
      itm_motion: motion,
    },
    trash: [{ item: item("itm_word", "Wordmark", ["ver_m1"]), deletedAt: "2026-10-22T00:00:00Z", deletedBy: { id: "usr_maya", name: "Maya" } }],
    threads: {},
  } as unknown as CanvasContents;

  it("says which source has a newer version — the details line", () => {
    const stale = motionStale(canvas, motion);
    expect(stale).toEqual([{ item: "itm_wheat", title: "Wheat", taken: "ver_w1", current: "ver_w2" }]);
    expect(motionStaleLine(stale)).toBe("Wheat has a newer version");
    expect(motionStaleLine([{ title: "Wheat" }, { title: "Circle" }, { title: "Wordmark" }])).toBe("Wheat, Circle and Wordmark have newer versions");
    expect(motionStaleLine([])).toBeNull();
  });

  it("finds the versions it took for an edit — from the trash, too — and the current ones for a refresh", () => {
    const taken = motionLayerSources(recipeBuilt.spec, canvas, "taken");
    expect(taken.map((s) => [s.item.id, s.version.id, s.title])).toEqual([["itm_circle", "ver_c1", "Circle"], ["itm_wheat", "ver_w1", "Wheat"], ["itm_word", "ver_m1", "Wordmark"]]);
    expect(taken[2]!.box).toEqual(layers[2]!.box);
    expect(() => motionLayerSources(recipeBuilt.spec, canvas, "current")).toThrow("Wordmark is not on this canvas any more");
  });

  it("reruns a recipe on a refresh, so a part a newer drawing added moves too; a written spec keeps its moves", async () => {
    const withLeaf = LOGO.map((s) => (s.item === "itm_wheat"
      ? { ...s, version: "ver_w2", svg: s.svg.replace("</svg>", '<g id="leaf" fill="#d9a441"><ellipse cx="90" cy="150" rx="10" ry="4"/></g></svg>') }
      : s));
    const sources = withLeaf.map((s, i) => ({ ...s, box: layers[i]!.box }));
    const refreshed = await rebuildMotion(recipeBuilt.spec, sources, "Acme logo — assemble");
    expect(refreshed.spec.moves.map((m) => m.target)).toContain("wheat/leaf");
    expect(refreshed.spec.layers.find((l) => l.id === "wheat")!.version).toBe("ver_w2");
    const written = await buildMotion({ sources: LOGO, spec: SCENE_1 });
    const kept = await rebuildMotion(written.spec, sources, "Acme logo");
    expect(kept.spec.moves.map((m) => m.target)).toEqual(["circle", "wheat/stalk", "wordmark"]);
  });
});

describe("Animate…'s words, as a summons", () => {
  it("names the lead, every source by title and id, the words, and the one command to RUN — not to paste", () => {
    const body = motionAsk({ name: "Kit" }, [{ id: "itm_circle", title: "Circle" }, { id: "itm_wheat", title: "Wheat" }], 'assemble, then a slow "idle" sway');
    expect(body.startsWith(`@Kit ${MOTION_ASK_MARK} “Circle” (itm_circle), “Wheat” (itm_wheat) — “assemble, then a slow "idle" sway”.`)).toBe(true);
    expect(body).toContain("then RUN `isocan motion new itm_circle itm_wheat --spec <file.json> --say \"assemble, then a slow 'idle' sway\"` yourself — the motion on the canvas is your answer, not the command.");
    expect(body).toContain("isocan --agent-help motion");
  });
});

describe("the one write each surface makes", () => {
  const sent: Array<{ op: Operation; group: string }> = [];
  const uploads: Array<{ mimeType: string; filename: string; size: number }> = [];
  const w: MotionWriter = {
    upload: async (bytes, mimeType, filename) => { uploads.push({ mimeType, filename, size: bytes.length }); return { blobHash: `hash_${uploads.length}`, size: bytes.length }; },
    send: async (op, group) => { sent.push({ op, group }); },
  };

  it("adds a motion beside the selection, the controls' height below the stage, in one group", async () => {
    const { itemId } = await addMotionItem(w, recipeBuilt, "Circle + Wheat + Wordmark — assemble", "assemble, then breathe");
    const { op } = sent.at(-1)!;
    expect(op).toMatchObject({
      type: "item.add", itemId, width: 320, height: 270 + MOTION_CONTROLS_HEIGHT,
      placement: { x: -60 + 320 + MOTION_BESIDE, y: 0 }, description: "assemble, then breathe",
      version: { mimeType: "text/html", filename: "circle-wheat-wordmark-assemble.html" },
    });
    expect(uploads.at(-1)!.mimeType).toBe("text/html");
  });

  it("stacks a version on the motion it read, conditional on that read", async () => {
    const motion = { id: "itm_m", title: "Logo", currentVersionId: "ver_1", versions: [{ id: "ver_1", filename: "logo.html" }] } as unknown as Item;
    await versionMotionItem(w, motion, recipeBuilt);
    expect(sent.at(-1)!.op).toMatchObject({ type: "item.edit", itemId: "itm_m", expectedVersionId: "ver_1", version: { filename: "logo.html" }, patch: { properties: { [MOTION_PROPS.seconds]: "2.4" } } });
  });

  it("adds a movie beside the motion, its shape the frame's, wearing renderedFrom", async () => {
    const renderedFrom = { item: "itm_m", version: "ver_1", fps: 60, size: "1920x1080", seconds: 6, background: "#ffffff" };
    const { title } = await addMotionMovie(w, { title: "Logo", x: 100, y: 20, width: 320 }, new Uint8Array(10), renderedFrom);
    expect(title).toBe("Logo — movie");
    expect(sent.at(-1)!.op).toMatchObject({ type: "item.add", width: 320, height: 180, placement: { x: 100 + 320 + MOTION_BESIDE, y: 20 }, properties: { renderedFrom: JSON.stringify(renderedFrom) } });
    expect(new Set(sent.map((s) => s.group)).size).toBe(sent.length);
  });
});

describe("a comment at a moment", () => {
  const maya: Actor = { id: "usr_maya", name: "Maya" };
  let n = 0;
  const step = (s: CanvasState | null, op: Operation) => applyOperation(s, { id: `op_${++n}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor: maya, ts: new Date(Date.UTC(2026, 9, 22, 9, 0, n)).toISOString(), op })!;
  const base = () => step(null, { type: "project.create", canvasId: "prj_acme", title: "Acme", description: "" });
  const pinned = (at: unknown) => ({ type: "thread.create", threadId: `thr_${n}`, x: 0, y: 0, anchorItemId: null, comment: { id: `cmt_${n}`, body: "wordmark overshoots here", at } }) as unknown as Operation;

  it("keeps the time, to the millisecond", () => {
    const s = step(base(), pinned(1.20004));
    expect(Object.values(s.canvas.threads)[0]!.comments[0]!.at).toBe(1.2);
  });

  it("refuses a time that is not one, and drops the timestamp a voice post once sent there", () => {
    expect(() => step(base(), pinned(-1))).toThrow(OpValidationError);
    expect(() => step(base(), pinned(Number.NaN))).toThrow(/seconds into the item/);
    const s = step(base(), pinned("2026-10-22T09:00:00.000Z"));
    expect(Object.values(s.canvas.threads)[0]!.comments[0]!.at).toBeUndefined();
  });
});
