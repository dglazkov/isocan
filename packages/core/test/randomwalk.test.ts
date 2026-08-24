import { describe, expect, it } from "vitest";
import type { Operation, CanvasState } from "../src/index.ts";
import { applyOperation, invertOperation } from "../src/index.ts";
import { alice, bob, envelope, normalize, nv, seedState } from "./helpers.ts";

/**
 * Property test with a seeded PRNG: apply a random sequence of undoable ops,
 * then apply their stored inverses in reverse order. Items and threads must
 * return to the initial state (trash is excluded: undoing an item.add
 * intentionally parks the item in the trash).
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uid = 0;
const fresh = (prefix: string) => `${prefix}_rw${++uid}`;

/** Build a random op that is valid against the given state, or null. */
function randomOp(state: CanvasState, rnd: () => number): Operation | null {
  const items = Object.values(state.canvas.items);
  const threads = Object.values(state.canvas.threads);
  const pickItem = () => items[Math.floor(rnd() * items.length)]!;
  const pickThread = () => threads[Math.floor(rnd() * threads.length)]!;
  const coord = () => Math.floor(rnd() * 2000) - 1000;

  type Gen = { weight: number; when: boolean; make: () => Operation };
  const gens: Gen[] = [
    {
      weight: 2,
      when: true,
      make: () => ({
        type: "item.add",
        itemId: fresh("itm"),
        version: nv(fresh("ver")),
        width: 50 + Math.floor(rnd() * 400),
        height: 50 + Math.floor(rnd() * 300),
        placement:
          items.length > 0 && rnd() < 0.3
            ? { anchorItemId: pickItem().id }
            : { x: coord(), y: coord() },
      }),
    },
    {
      weight: 3,
      when: items.length > 0,
      make: () => ({ type: "item.move", itemId: pickItem().id, x: coord(), y: coord() }),
    },
    {
      weight: 1,
      when: items.length > 0,
      make: () => ({
        type: "item.resize",
        itemId: pickItem().id,
        width: 50 + Math.floor(rnd() * 400),
        height: 50 + Math.floor(rnd() * 300),
      }),
    },
    {
      weight: 1,
      when: items.length > 0,
      make: () => ({
        type: "item.update",
        itemId: pickItem().id,
        patch: {
          title: fresh("title"),
          properties: { [fresh("k")]: "v", shared: fresh("s") },
          removeProperties: rnd() < 0.5 ? ["shared"] : [],
        },
      }),
    },
    {
      weight: 1,
      when: items.length > 0,
      make: () => ({ type: "item.addVersion", itemId: pickItem().id, version: nv(fresh("ver")) }),
    },
    {
      weight: 1,
      when: items.length > 0,
      make: () => {
        const item = pickItem();
        const version = item.versions[Math.floor(rnd() * item.versions.length)]!;
        return { type: "item.setCurrentVersion", itemId: item.id, versionId: version.id };
      },
    },
    {
      weight: 1,
      when: items.length > 1,
      make: () => ({ type: "item.delete", itemId: pickItem().id }),
    },
    {
      weight: 1,
      when: state.canvas.trash.length > 0,
      make: () => ({
        type: "item.restore",
        itemId: state.canvas.trash[Math.floor(rnd() * state.canvas.trash.length)]!.item.id,
      }),
    },
    {
      weight: 1,
      when: true,
      make: () => ({
        type: "thread.create",
        threadId: fresh("thr"),
        x: coord(),
        y: coord(),
        anchorItemId: items.length > 0 && rnd() < 0.5 ? pickItem().id : null,
        comment: { id: fresh("cmt"), body: fresh("body") },
      }),
    },
    {
      weight: 2,
      when: threads.length > 0,
      make: () => ({
        type: "thread.reply",
        threadId: pickThread().id,
        comment: { id: fresh("cmt"), body: fresh("body") },
      }),
    },
    {
      weight: 1,
      when: threads.length > 0,
      make: () => ({
        type: "thread.setAnchor",
        threadId: pickThread().id,
        anchorItemId: items.length > 0 && rnd() < 0.5 ? pickItem().id : null,
        x: coord(),
        y: coord(),
      }),
    },
    {
      weight: 1,
      when: threads.length > 0,
      make: () => ({
        type: "thread.setMain",
        threadId: rnd() < 0.25 ? null : pickThread().id,
      }),
    },
    {
      weight: 1,
      when: threads.length > 0,
      make: () => ({ type: "thread.delete", threadId: pickThread().id }),
    },
    {
      weight: 1,
      when: true,
      make: () => ({
        type: "project.update",
        patch: { title: fresh("proj"), properties: { [fresh("pk")]: "pv" } },
      }),
    },
  ];

  const eligible = gens.filter((g) => g.when);
  const total = eligible.reduce((sum, g) => sum + g.weight, 0);
  let roll = rnd() * total;
  for (const g of eligible) {
    roll -= g.weight;
    if (roll <= 0) return g.make();
  }
  return null;
}

describe("random walks", () => {
  it("apply N random ops, then apply stored inverses in reverse → initial items/threads", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rnd = mulberry32(seed);
      const initial = seedState();
      let state: CanvasState = initial;
      const inverses: Operation[] = [];

      for (let step = 0; step < 40; step++) {
        const op = randomOp(state, rnd);
        if (!op) continue;
        const inverse = invertOperation(state, op);
        expect(inverse, `seed ${seed} step ${step}: ${op.type} must be invertible`).not.toBeNull();
        const next = applyOperation(state, envelope(op, rnd() < 0.5 ? alice : bob));
        expect(next).not.toBeNull();
        state = next!;
        inverses.push(inverse!);
      }

      for (const inverse of inverses.reverse()) {
        state = applyOperation(state, envelope(inverse, bob))!;
      }

      expect(normalize(state.canvas.items), `seed ${seed}`).toEqual(
        normalize(initial.canvas.items),
      );
      expect(normalize(state.canvas.threads), `seed ${seed}`).toEqual(
        normalize(initial.canvas.threads),
      );
      expect(normalize(state.project), `seed ${seed}`).toEqual(normalize(initial.project));
    }
  });
});
