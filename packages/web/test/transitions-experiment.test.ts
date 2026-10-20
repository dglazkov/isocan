// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TRANSITIONS_EXPERIMENT, flipTo, takeLiveFlip } from "../src/lib/deckflip.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

/**
 * **Slide transitions are an experiment** (20 Oct 2026). Dion found the live
 * push between screens janky and asked for the transitions behind
 * "Presentation Transitions", with the flip as it used to be when it is off:
 * screens dissolve (the frame pool), pictures push, a frame never rides a
 * view transition, and the canvas's chosen motion is not read.
 */

const web = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(web, rel), "utf8");

let clock = 1_000_000;
beforeEach(() => {
  // Each flip far enough from the last that none counts as "rapid".
  clock += 10_000;
  vi.spyOn(Date, "now").mockReturnValue(clock);
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  takeLiveFlip();
});
afterEach(() => {
  vi.restoreAllMocks();
  useUiStore.setState({ experiments: [] });
});

describe("Presentation Transitions, off", () => {
  it("lets a flip between two screens dissolve, as before, whatever the canvas chose", () => {
    useUiStore.setState({ experiments: [] });
    const navigate = vi.fn();
    flipTo(navigate, "/p/prj_acme/i/itm_2", "next", "both", "depth");
    expect(navigate).toHaveBeenCalledWith("/p/prj_acme/i/itm_2");
    // No note for the frame pool: the pages are not moved, the pool dissolves.
    expect(takeLiveFlip()).toBeNull();
  });

  it("offers no choice and mounts no morph twins", () => {
    expect(read("src/components/FocusHeader.tsx")).toMatch(/canEdit && transitionsOn && \(/);
    expect(read("src/components/Toolbar.tsx")).toMatch(/\.\.\.\(transitionsOn\(\) \? \{\s*\n\s*deckTransition:/);
    expect(read("src/components/MorphStage.tsx")).toMatch(/=== "morph"\) && transitionsOn;/);
  });

  it("is listed in Settings under the name Dion gave it", () => {
    expect(read("src/lib/experiments.ts")).toContain(`id: "${TRANSITIONS_EXPERIMENT}",\n    name: "Presentation Transitions",`);
  });
});

describe("Presentation Transitions, on", () => {
  it("plays the canvas's chosen motion on the live pages", () => {
    useUiStore.setState({ experiments: [TRANSITIONS_EXPERIMENT] });
    const navigate = vi.fn();
    flipTo(navigate, "/p/prj_acme/i/itm_2", "next", "both", "depth");
    expect(navigate).toHaveBeenCalledWith("/p/prj_acme/i/itm_2");
    expect(takeLiveFlip()).toMatchObject({ dir: "next", transition: "depth" });
  });
});
