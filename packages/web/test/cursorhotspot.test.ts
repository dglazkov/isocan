// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PresenceHub } from "../../server/src/presence.ts";
import { CursorLayer } from "../src/components/CursorLayer.tsx";
import { rememberMark } from "../src/lib/marks.ts";
import { worldToScreen } from "../src/lib/viewport.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

/**
 * **A mark is worn AS the pointer, and the point does not move** (agent
 * pointers, 30 Sep 2026).
 *
 * An emoji has no tip, so the arrow keeps one: shrunk, in the actor's colour,
 * with its point at the cursor div's origin exactly where the full arrow's was
 * — and the emoji sits where the arrow's body was. Rendered, not read: what is
 * asserted is where the div a person sees actually lands, at three zooms,
 * marked and not, against `worldToScreen` — the function selection outlines
 * and `session point` already go through. The stylesheet half — that nothing
 * in CSS moves the tip — is `cursorglyph.test.ts`, which reads files and so
 * runs outside jsdom.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Who the registry says is an agent — the fact the facepile reads too. */
const agents = vi.hoisted(() => ({ ids: new Set<string>() }));
vi.mock("../src/lib/actorkinds.ts", async (actual) => ({
  ...(await actual<typeof import("../src/lib/actorkinds.ts")>()),
  useActorKinds: () => Object.fromEntries([...agents.ids].map((id) => [id, "agent"])),
}));

const rover = { id: "usr_rover_acme", name: "Rover" };
const AT = { x: 240, y: -130 };

let host: HTMLDivElement;
let root: Root;
let hub: PresenceHub;

beforeEach(() => {
  // Colours, names and marks each ask the home once; here it never answers,
  // so the only mark is the one this test remembers.
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  hub = new PresenceHub();
  const session = hub.createSession("prj_acme", rover, "cli");
  hub.touch("prj_acme", session.sessionId, { cursor: AT });
  useCanvasStore.setState({ sessions: hub.roster("prj_acme") });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  hub.close();
  rememberMark(rover.id, null);
  agents.ids.clear();
  useCanvasStore.setState({ sessions: [] });
  vi.unstubAllGlobals();
});

function draw(scale: number): HTMLElement {
  useUiStore.setState({ viewport: { tx: 37, ty: 12, scale } });
  act(() => root.render(h(CursorLayer)));
  const cursor = host.querySelector<HTMLElement>(".remote-cursor");
  expect(cursor).not.toBeNull();
  return cursor!;
}

describe("the pointer a mark is worn as", () => {
  for (const scale of [0.3, 1, 3]) {
    it(`lands on the same point with and without a mark at zoom ${scale}`, () => {
      const want = worldToScreen({ tx: 37, ty: 12, scale }, AT.x, AT.y);

      const plain = draw(scale);
      expect([parseFloat(plain.style.left), parseFloat(plain.style.top)]).toEqual([want.x, want.y]);
      expect(plain.classList.contains("marked")).toBe(false);
      expect(plain.querySelector(".cursor-glyph")).toBeNull();
      expect(plain.querySelector("svg")).not.toBeNull();

      act(() => rememberMark(rover.id, "🐕"));
      const marked = draw(scale);
      expect([parseFloat(marked.style.left), parseFloat(marked.style.top)]).toEqual([want.x, want.y]);
      expect(marked.classList.contains("marked")).toBe(true);
      expect(marked.querySelector(".cursor-glyph")?.textContent).toBe("🐕");
      // The tip stays: an emoji has no point of its own.
      expect(marked.querySelector("svg path")).not.toBeNull();
      // Said once — on the pointer, not again in the chip.
      expect(marked.querySelector(".cursor-chip")?.textContent).toBe("Rover");
    });
  }

  it("rings the glyph in the actor's colour, which the cursor carries", () => {
    const cursor = draw(1);
    const fill = cursor.querySelector("svg path")?.getAttribute("fill");
    expect(fill).toBeTruthy();
    expect(cursor.style.color).not.toBe("");
  });
});

/**
 * **An agent nobody dressed is a robot** (Dion, 30 Sep 2026: *"can we default
 * bots to use an emoji that is a 🤖? Always?"*). Decided when the pointer is
 * drawn, from the same "is this an agent" the facepile asks — never written
 * as a mark, so the registry holds nothing for it and no op was sent.
 */
describe("who wears the robot", () => {
  it("an agent with no mark is drawn as 🤖, on the same point", () => {
    agents.ids.add(rover.id);
    const cursor = draw(3);
    expect(cursor.querySelector(".cursor-glyph")?.textContent).toBe("🤖");
    expect(cursor.classList.contains("marked")).toBe(true);
    const want = worldToScreen({ tx: 37, ty: 12, scale: 3 }, AT.x, AT.y);
    expect([parseFloat(cursor.style.left), parseFloat(cursor.style.top)]).toEqual([want.x, want.y]);
  });

  it("an agent whose owner chose a mark wears the mark instead", () => {
    agents.ids.add(rover.id);
    act(() => rememberMark(rover.id, "🐕"));
    expect(draw(1).querySelector(".cursor-glyph")?.textContent).toBe("🐕");
  });

  it("a person with no mark keeps the arrow", () => {
    const cursor = draw(1);
    expect(cursor.querySelector(".cursor-glyph")).toBeNull();
    expect(cursor.classList.contains("marked")).toBe(false);
  });
});
