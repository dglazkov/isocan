import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NARROW_MINIMAP_PX,
  NARROW_MINIMAP_QUERY,
  chooseMinimap,
  minimapShown,
  type MinimapFold,
} from "../src/lib/minimapfold.ts";
import { rules } from "./cssrules.ts";

/**
 * **Below 460px the minimap folds — and the width writes nothing** (#182).
 *
 * The mobile note asked for a fold on a phone. The first fix stacked the map
 * above the zoom row instead, because the only fold there was wrote
 * `isocan.minimap`, and a width deciding a stored preference follows the
 * person to their desktop as a setting they never chose. Both halves have to
 * hold at once, so they are tested together: the map IS folded on a narrow
 * window, and storage is exactly as the person left it — whether the width
 * crossed, whether they unfolded it on the phone, whether they folded it
 * again.
 *
 * The store is loaded against a stubbed window whose media query says
 * "narrow" and a storage that records every write, so this is the store's
 * real initialiser and real setters, not a model of them.
 */

const MINIMAP_KEY = "isocan.minimap";
const storage = new Map<string, string>([[MINIMAP_KEY, "1"]]);
const writes: Array<[string, string | null]> = [];
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    writes.push([key, value]);
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    writes.push([key, null]);
    storage.delete(key);
  },
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() {
    return storage.size;
  },
};
const asked: string[] = [];
(globalThis as { window?: unknown }).window = {
  innerWidth: 375,
  matchMedia: (query: string) => {
    asked.push(query);
    return {
      matches: query === NARROW_MINIMAP_QUERY,
      addEventListener() {},
      removeEventListener() {},
    };
  },
};

const { useUiStore } = await import("../src/stores/uiStore.ts");
const ui = () => useUiStore.getState();
const minimapWrites = () => writes.filter(([key]) => key === MINIMAP_KEY);

describe("a narrow window folds the map without touching the preference", () => {
  it("starts folded on a phone even though the stored choice is open", () => {
    expect(asked, "the width is read from the same query the component watches").toContain(
      NARROW_MINIMAP_QUERY,
    );
    expect(storage.get(MINIMAP_KEY), "the person's choice, as stored").toBe("1");
    expect(ui().minimapFold.narrow).toBe(true);
    expect(ui().minimapOpen, "folded by the width on first paint").toBe(false);
    expect(minimapWrites(), "and nothing written to fold it").toEqual([]);
  });

  it("unfolds on a tap there, for the visit, and still writes nothing", () => {
    ui().setMinimapOpen(true);
    expect(ui().minimapOpen).toBe(true);
    ui().setMinimapOpen(false);
    expect(ui().minimapOpen).toBe(false);
    ui().setMinimapOpen(true);
    expect(minimapWrites(), "a phone's fold and unfold are not a preference").toEqual([]);
    expect(storage.get(MINIMAP_KEY)).toBe("1");
  });

  it("gives the stored choice back when the window widens, and stores a wide choice", () => {
    storage.set(MINIMAP_KEY, "1");
    ui().setMinimapOpen(false); // narrow: this visit's fold, not stored
    ui().setMinimapNarrow(false);
    expect(ui().minimapOpen, "wide again: the preference, not the phone's fold").toBe(true);
    expect(minimapWrites(), "crossing the line writes nothing either").toEqual([]);

    ui().setMinimapOpen(false);
    expect(minimapWrites(), "a wide window's fold IS the preference").toEqual([[MINIMAP_KEY, "0"]]);
    ui().setMinimapOpen(true);
    expect(storage.get(MINIMAP_KEY)).toBe("1");
  });

  it("keeps this visit's narrow choice across a rotation, and only for the visit", () => {
    ui().setMinimapNarrow(true);
    ui().setMinimapOpen(true); // tapped open on the phone
    ui().setMinimapNarrow(false);
    ui().setMinimapNarrow(true);
    expect(ui().minimapOpen, "rotated away and back: still the choice they made here").toBe(true);
    // Never written, so the next visit starts folded again.
    expect(ui().minimapFold.narrowOpen).toBe(true);
    expect(storage.get(MINIMAP_KEY)).toBe("1");
  });
});

describe("the rule, as a pure function", () => {
  const fold = (over: Partial<MinimapFold> = {}): MinimapFold => ({
    kept: true,
    narrow: false,
    narrowOpen: false,
    ...over,
  });

  it("draws the preference on a wide window and the visit's choice on a narrow one", () => {
    expect(minimapShown(fold())).toBe(true);
    expect(minimapShown(fold({ kept: false }))).toBe(false);
    expect(minimapShown(fold({ narrow: true }))).toBe(false);
    expect(minimapShown(fold({ narrow: true, narrowOpen: true }))).toBe(true);
    // A kept fold stays folded on a phone too: the width only ever folds.
    expect(minimapShown(fold({ kept: false, narrow: true }))).toBe(false);
  });

  it("marks only a wide window's choice as one to store", () => {
    expect(chooseMinimap(fold(), false)).toEqual({ fold: fold({ kept: false }), store: true });
    expect(chooseMinimap(fold({ narrow: true }), true)).toEqual({
      fold: fold({ narrow: true, narrowOpen: true }),
      store: false,
    });
  });
});

describe("one number for the fold and the sheet", () => {
  it("folds at the width the stylesheet lifts an open map at", () => {
    /* Two homes for 460 is how the fold and the stack would come to disagree
       — a map folded at 470 but lifted only below 460, or the reverse. */
    const lifted = rules().find((r) => r.selector === ".minimap-dock:not(.folded)");
    expect(lifted?.at).toEqual([`@media (max-width: ${NARROW_MINIMAP_PX}px)`]);
    expect(NARROW_MINIMAP_QUERY).toBe(`(max-width: ${NARROW_MINIMAP_PX}px)`);
  });

  it("is watched by the minimap, and fed to the store rather than to storage", () => {
    const map = readFileSync(
      fileURLToPath(new URL("../src/components/Minimap.tsx", import.meta.url)),
      "utf8",
    );
    expect(map).toContain("window.matchMedia(NARROW_MINIMAP_QUERY)");
    expect(map).toContain("setMinimapNarrow(narrow.matches)");
    expect(map).toContain('addEventListener("change", sync)');
  });
});
