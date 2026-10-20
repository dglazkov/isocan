import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DECK_TRANSITIONS, deckTransitionLabel } from "@isocan/core";
import { DECK_TRANSITION_MS, framingOf } from "../src/lib/deckflip.ts";
import { chromeMenu } from "../src/lib/menuentries.tsx";
import type { MenuAction } from "../src/components/ContextMenu.tsx";
import { loadedWith, rules, selectorsOf } from "./cssrules.ts";

/**
 * **The deck's transition is drawn twice, and must be drawn the same.**
 *
 * Images and text ride a view transition (`::view-transition-old/new(slide)`,
 * steered from the root); screens and sites cannot be photographed, so their
 * two LIVE frames in the pool wear `.deck-out`/`.deck-in` instead. A motion
 * that only one wearer knows is a deck that pushes its images and cuts its
 * screens — so every motion the core lists has keyframes for both, in both
 * directions, and a length the pool can wait out.
 */
/** The deck flip ships with the two faces of the deck, not with the entry sheet. */
const css = loadedWith("presentation.css");
const all = rules(css);
const keyframes = new Set(
  [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]),
);

function animationFor(match: (selector: string) => boolean): string | null {
  for (const rule of all) {
    if (rule.at.some((at) => at.startsWith("@keyframes"))) continue;
    if (!selectorsOf(rule).some(match)) continue;
    const name = /animation-name:\s*([\w-]+)/.exec(rule.body)?.[1];
    if (name) return name;
  }
  return null;
}

const flipped = (sel: string, dir: string) => sel.includes(`[data-flip="${dir}"]`) || (!/data-flip="/.test(sel));

describe("every deck transition is drawn on both wearers", () => {
  // `cut` draws nothing; `morph` is drawn by the twins in MorphStage, and a
  // flip it cannot play fades (see "the morph" below).
  for (const t of DECK_TRANSITIONS.filter((one) => one !== "cut" && one !== "morph")) {
    for (const dir of ["next", "prev"]) {
      for (const [side, pseudo, cls] of [
        ["out", "::view-transition-old(slide)", "> .deck-out"],
        ["in", "::view-transition-new(slide)", "> .deck-in"],
      ] as const) {
        it(`${t} ${dir} ${side}`, () => {
          const snapshot = animationFor(
            (sel) => sel.startsWith("html[data-flip") && sel.includes(`[data-transition="${t}"]`) && sel.endsWith(pseudo) && flipped(sel, dir),
          );
          const live = animationFor(
            (sel) => sel.startsWith(".deck-moving") && sel.includes(`[data-transition="${t}"]`) && sel.endsWith(cls) && flipped(sel, dir),
          );
          expect(snapshot, "the view-transition wearer").not.toBeNull();
          expect(live, "the live-frame wearer").toBe(snapshot);
          expect(keyframes.has(snapshot!), `@keyframes ${snapshot}`).toBe(true);
        });
      }
    }
  }
});

describe("the pool can wait out every motion", () => {
  it("has a length for each, and none for a cut", () => {
    for (const t of DECK_TRANSITIONS) expect(DECK_TRANSITION_MS[t], t).toBeGreaterThanOrEqual(0);
    expect(DECK_TRANSITION_MS.cut).toBe(0);
    expect(DECK_TRANSITION_MS.push).toBe(220);
  });
});

describe("which flips can be animated live", () => {
  it("two frames can, one frame cannot, none rides a view transition", () => {
    expect(framingOf(true, true)).toBe("both");
    expect(framingOf(true, false)).toBe("one");
    expect(framingOf(false, true)).toBe("one");
    expect(framingOf(false, false)).toBe("none");
  });
});

describe("the menu rows", () => {
  it("offer every motion, tick the current one, and mark the 3D ones", () => {
    const picked: string[] = [];
    const drawer = chromeMenu({
      canvasId: "prj_acme", filesOpen: false, agentsOpen: false, contextOpen: false, personasOpen: false,
      mainOpen: false, trashOpen: false, trashCount: 0, historyOpen: false, unreadNews: 0, theme: null,
      setTheme: () => {}, ownGround: false, pickGround: () => {}, cursor: null, setCursor: () => {},
      openSwitcher: () => {}, anchor: "world", toggleAnchor: () => {}, toWorkbench: () => {},
      deckTransition: "depth", setDeckTransition: (t) => void picked.push(t),
    }) as MenuAction[];
    const parent = drawer.find((e) => e.label === "Slide transition");
    expect(parent?.value).toBe("Depth");
    const rows = (parent?.submenu ?? []) as MenuAction[];
    expect(rows.map((r) => r.label)).toEqual(DECK_TRANSITIONS.map(deckTransitionLabel));
    expect(rows.filter((r) => r.checked).map((r) => r.label)).toEqual(["Depth"]);
    expect(rows.filter((r) => r.value === "3D").map((r) => r.label)).toEqual(["Morph", "Depth", "Cube", "Flip"]);
    expect(rows.every((r) => r.writes)).toBe(true);
    rows.find((r) => r.label === "Cube")!.run();
    expect(picked).toEqual(["cube"]);
  });
});

describe("the morph", () => {
  const flip = readFileSync(fileURLToPath(new URL("../src/lib/deckflip.ts", import.meta.url)), "utf8");
  const stage = readFileSync(fileURLToPath(new URL("../src/components/MorphStage.tsx", import.meta.url)), "utf8");

  it("asks the stage first, and fades when the stage is not ready", () => {
    // A presenter's arrow never waits for twins that are still loading.
    expect(flip).toMatch(/if \(framed === "both" && morphPlayer\?\.\(path, dir, \(\) => navigate\(path\)\)\)/);
    expect(flip).toMatch(/transition = "fade";/);
  });

  it("loads its twins under the lone allow-scripts every item frame gets", () => {
    // An opaque origin: no cookie, no API, no storage — never allow-same-origin.
    expect(stage).toContain('sandbox="allow-scripts"');
    expect(stage).not.toContain("allow-same-origin");
  });

  it("hears a scene only from its own twins' windows", () => {
    expect(stage).toContain("frame.contentWindow !== e.source");
  });
});

describe("a slide's twin", () => {
  it("is the slide's own HTML with the runtime at the end of the body", async () => {
    const { morphTwin } = await import("../src/lib/morphruntime.ts");
    const twin = morphTwin("<html><body><h1>Acme</h1></body></html>");
    expect(twin.startsWith("<html><body><h1>Acme</h1><script>")).toBe(true);
    expect(twin.endsWith("</script></body></html>")).toBe(true);
    expect(twin).toContain("isocan:morph:scene");
    expect(morphTwin("<h1>Acme</h1>").startsWith("<h1>Acme</h1><script>")).toBe(true);
  });
});
