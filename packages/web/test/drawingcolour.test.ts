import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor, InkStroke } from "@isocan/core";

/**
 * **The Pen's half of "move the red one", tested where it is decided.**
 *
 * `addDrawing` had no test anywhere in this repository, which is how it came
 * to record no colour at all: the projection offered "a drawing's ink" as a
 * colour source, `Item` has no colour field, and a drawing's strokes vanish
 * into an SVG blob the moment it is made. Nothing downstream could ever
 * answer "which one is red", and "move the red one" — the sentence the voice
 * work is named for — was unresolvable on every canvas.
 *
 * `upload.ts`'s existing coverage is source-shape assertions in other files
 * (`memory.test.ts`, `inception.test.ts` read the file and check it CONTAINS a
 * line). Those could not have caught this: a line that exists is not a line
 * that runs. So this mocks the two seams `addDrawing` writes through and reads
 * the operation it actually mints.
 */
const mocks = vi.hoisted(() => ({ upload: vi.fn(), send: vi.fn() }));
vi.mock("../src/lib/api.ts", () => ({ uploadBlob: mocks.upload }));
vi.mock("../src/lib/groupplacement.ts", () => ({
  sendCreatedItem: mocks.send,
  creationDestination: () => ({ originGroupMode: "groups" }),
}));

import { addDrawing } from "../src/lib/upload.ts";

const actor: Actor = { id: "usr_pen", name: "Acme person" };
/** A stroke long enough to win on total length, which is how `inkColour`
 *  decides — a dot of another colour must not outvote a line. */
const stroke = (color: string, length: number): InkStroke => ({
  color,
  width: 6,
  points: [{ x: 0, y: 0 }, { x: length, y: 0 }],
});
const opFor = () => mocks.send.mock.calls[0]![2] as { properties: Record<string, string> };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ blobHash: "hash", size: 12 });
  mocks.send.mockResolvedValue(undefined);
});

describe("a drawing is born knowing what colour it is", () => {
  it("records the ink as a word the projection can read", async () => {
    await addDrawing("canvas", actor, [stroke("#e02424", 200)]);
    expect(opFor().properties).toMatchObject({ kind: "drawing", ink: "red" });
  });

  it("would notice if the colour stopped being written", async () => {
    // Falsification: the assertion above is only worth having if a drawing
    // CAN come out without the word.
    await addDrawing("canvas", actor, [stroke("currentColor", 200)]);
    expect(opFor().properties).not.toHaveProperty("ink");
    expect(opFor().properties).toMatchObject({ kind: "drawing" });
  });

  it("names the ink that covers the most ground, not the first stroke laid", async () => {
    await addDrawing("canvas", actor, [stroke("#0000ff", 20), stroke("#e02424", 400)]);
    expect(opFor().properties.ink).toBe("red");
  });

  it("keeps the colour when the ink is an annotation over another item", async () => {
    // The annotated branch builds its properties separately, so it is its own
    // chance to drop the word.
    await addDrawing("canvas", actor, [stroke("#e02424", 200)], {
      id: "itm_target", x: 0, y: 0, width: 100, height: 100,
    });
    expect(opFor().properties).toMatchObject({ kind: "drawing", ink: "red" });
  });
});
