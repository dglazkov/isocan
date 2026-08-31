import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * **The emoji you just picked has to be the one the next thing to open shows.**
 *
 * Reported from the identity menu: the facepile wore the rainbow, and the
 * square inside the menu — the one with the pencil on it, two inches below —
 * still read `D`. Same actor, same map, two different answers.
 *
 * The difference was *when each one mounted*. `loadActorMarks` memoises its
 * fetch for the life of the tab, which is the point: a canvas draws a face in
 * eight places and none of them should be a request. But the memoised promise
 * also kept resolving with the object that fetch returned, frozen at first
 * light. `rememberMark` would update the cache and tell every live subscriber
 * — the facepile among them — and then a component mounting *afterwards*
 * would call `loadActorMarks()`, receive that fossil, and set it as state,
 * undoing the pick for itself alone.
 *
 * So the property is not "the fetch is cached". It is **the cache is what
 * answers**: a late subscriber must see every mark chosen before it existed.
 */

const fetchActorMarks = vi.fn();
vi.mock("../src/lib/api.ts", () => ({ fetchActorMarks }));

async function freshModule() {
  vi.resetModules();
  return await import("../src/lib/marks.ts");
}

beforeEach(() => {
  fetchActorMarks.mockReset();
});

describe("a mark that was just picked", () => {
  it("is what a later loader is handed, not the snapshot from before it", async () => {
    fetchActorMarks.mockResolvedValue({});
    const { loadActorMarks, rememberMark } = await freshModule();

    expect(await loadActorMarks()).toEqual({});

    rememberMark("usr_dion", "🌈");

    // The identity menu, mounting now. It must not be told `{}`.
    expect(await loadActorMarks()).toEqual({ usr_dion: "🌈" });
  });

  it("still only asks the home once, however many faces there are", async () => {
    fetchActorMarks.mockResolvedValue({ usr_di: "⚓" });
    const { loadActorMarks } = await freshModule();

    await Promise.all([loadActorMarks(), loadActorMarks(), loadActorMarks()]);
    await loadActorMarks();

    expect(fetchActorMarks).toHaveBeenCalledTimes(1);
  });

  it("survives a home that will not answer, and keeps the pick anyway", async () => {
    fetchActorMarks.mockRejectedValue(new Error("no daemon"));
    const { loadActorMarks, rememberMark } = await freshModule();

    expect(await loadActorMarks()).toEqual({});
    rememberMark("usr_dion", "🌈");
    expect(await loadActorMarks()).toEqual({ usr_dion: "🌈" });
  });

  it("takes a mark back when it is removed", async () => {
    fetchActorMarks.mockResolvedValue({ usr_dion: "🌈" });
    const { loadActorMarks, rememberMark } = await freshModule();

    expect(await loadActorMarks()).toEqual({ usr_dion: "🌈" });
    rememberMark("usr_dion", null);
    expect(await loadActorMarks()).toEqual({});
  });
});
