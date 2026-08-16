import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptIdentity,
  enterAs,
  knownIdentities,
  readIdentity,
  renameIdentity,
  signOut,
} from "../src/lib/identity.ts";

/** localStorage, in memory — the module reads it lazily, so a stub is enough. */
function stubStorage(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("web identity", () => {
  beforeEach(stubStorage);

  it("mints an id on first entry and remembers it", () => {
    const me = enterAs("Dimitri");
    expect(me.id).toMatch(/^usr_/);
    expect(readIdentity()).toEqual(me);
    expect(knownIdentities()).toEqual([me]);
  });

  it("renaming keeps the id — you are the same person, differently spelled", () => {
    const before = enterAs("Dimitri");
    const after = renameIdentity("Dimitri G");
    expect(after.id).toBe(before.id);
    expect(readIdentity()).toEqual(after);
    // One roster entry, not two: renaming does not clone you.
    expect(knownIdentities()).toEqual([after]);
  });

  it("leaving and re-entering under a name used before returns the SAME actor", () => {
    const first = enterAs("Dimitri");
    signOut();
    expect(readIdentity()).toBeNull();
    expect(knownIdentities()).toEqual([first]); // leaving is not forgetting

    const back = enterAs("dimitri"); // case is not a different person
    expect(back).toEqual(first);
  });

  it("a name never used before is someone new, and both are remembered", () => {
    const dimitri = enterAs("Dimitri");
    const kenny = enterAs("Kenny");
    expect(kenny.id).not.toBe(dimitri.id);
    // Most recently worn first.
    expect(knownIdentities()).toEqual([kenny, dimitri]);

    expect(adoptIdentity(dimitri)).toEqual(dimitri);
    expect(readIdentity()).toEqual(dimitri);
    expect(knownIdentities()).toEqual([dimitri, kenny]);
  });

  it("survives a browser that refuses storage", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const me = enterAs("Nico");
    expect(me.name).toBe("Nico");
    expect(readIdentity()).toBeNull(); // not remembered, but not broken
    expect(knownIdentities()).toEqual([]);
  });
});
