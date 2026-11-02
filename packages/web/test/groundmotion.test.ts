// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";

import { MOTIONS, MOTION_KEY, ambientOf, currentMotion, motionMode, onMotion, readMotion, writeMotion, type Motion, type Store } from "../src/lib/groundmotion.ts";
import { GroundHost } from "../src/components/themes/GroundHost.ts";
import type { Field, LivingGround as Ground } from "../src/components/themes/livingkit.ts";
import { LivingGround } from "../src/components/themes/LivingGround.tsx";

/**
 * **Motion: Full · Calm · Still, for this viewer** (living grounds phase 4,
 * design.md §5).
 *
 * Three promises a test can hold without a GPU: the choice survives storage
 * that throws; Calm hands a ground no ambient term and draws nothing an
 * untouched ground did not need; Still is the painted still and no WebGL. The
 * `ground-motion` journey proves the same three in Chrome, on a real meadow.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const throwing: Store = {
  getItem: () => {
    throw new Error("SecurityError: storage is off in this frame");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};
const memory = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

afterEach(() => {
  try {
    localStorage.removeItem(MOTION_KEY);
  } catch {
    /* no storage here either */
  }
});

describe("the Motion setting is read and written without ever throwing", () => {
  it("is Full until something else is chosen", () => {
    expect(readMotion(memory())).toBe("full");
  });

  it("reads back each choice, and anything else as Full", () => {
    const s = memory();
    for (const m of MOTIONS) {
      writeMotion(m, s);
      expect(s.data.get(MOTION_KEY)).toBe(m);
      expect(readMotion(s)).toBe(m);
    }
    s.setItem(MOTION_KEY, "frantic");
    expect(readMotion(s)).toBe("full");
  });

  it("reads storage that throws as never chosen", () => {
    expect(readMotion(throwing)).toBe("full");
  });

  it("keeps a choice storage refused for this tab, and still tells the grounds", () => {
    const heard: Motion[] = [];
    const off = onMotion((m) => heard.push(m));
    expect(() => writeMotion("calm", throwing)).not.toThrow();
    expect(currentMotion(), "the tab draws what was chosen").toBe("calm");
    expect(heard).toEqual(["calm"]);
    off();
    writeMotion("full", memory());
    expect(heard, "a listener that left hears nothing").toEqual(["calm"]);
  });

  it("is one key for every canvas, in the real localStorage", () => {
    writeMotion("still");
    expect(localStorage.getItem(MOTION_KEY)).toBe("still");
    expect(currentMotion()).toBe("still");
  });
});

describe("Still selects the still path, and reduced motion always wins", () => {
  it("draws the still for Still, and for anything under reduced motion", () => {
    expect(motionMode("still", false)).toBe("still");
    for (const m of MOTIONS) expect(motionMode(m, true), `${m} under reduced motion`).toBe("still");
    expect(motionMode("calm", false)).toBe("calm");
    expect(motionMode("full", false)).toBe("full");
  });

  it("renders the painted still and no WebGL canvas when Still is chosen", async () => {
    writeMotion("still");
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root: Root = createRoot(el);
    await act(async () =>
      root.render(h(LivingGround, { theme: "meadow", anchor: "world", still: h("div", { className: "the-still" }) })),
    );
    expect(el.querySelector(".the-still"), "the still is drawn").toBeTruthy();
    expect(el.querySelector("canvas.ground-canvas"), "no ground canvas").toBeNull();
    expect(getContext, "no context was ever asked for").not.toHaveBeenCalled();
    act(() => root.unmount());
    el.remove();
    getContext.mockRestore();
  });
});

describe("Calm has no ambient, and an untouched Calm ground draws nothing more", () => {
  it("hands a ground no ambient term under Calm, and the whole envelope under Full", () => {
    for (const ease of [0, 0.25, 0.5, 1]) {
      expect(ambientOf(ease, "calm")).toBe(0);
      expect(ambientOf(ease, "full")).toBe(ease);
    }
  });

  /** A WebGL2 context that accepts everything and draws nothing — enough for
   *  the host's own setup (the trail program) to succeed. */
  const fakeGl = () =>
    new Proxy({} as Record<string, unknown>, {
      get(_t, key) {
        if (typeof key !== "string") return undefined;
        if (/^[A-Z0-9_]+$/.test(key)) return key.length; // a constant
        if (key === "isContextLost") return () => false;
        if (key === "getProgramParameter") return (_p: unknown, what: number) => (what === "ACTIVE_UNIFORMS".length ? 0 : true);
        if (key === "getShaderParameter") return () => true;
        if (key === "drawingBufferWidth" || key === "drawingBufferHeight") return 100;
        return () => ({});
      },
    });

  let frames: FrameRequestCallback[] = [];
  let now = 1000;
  /** Run every frame the host has asked for, `ms` apart, up to `limit`. */
  const run = (ms = 16, limit = 600) => {
    let ran = 0;
    while (frames.length && ran < limit) {
      now += ms;
      const due = frames;
      frames = [];
      for (const f of due) f(now);
      ran++;
    }
    return ran;
  };

  beforeEach(() => {
    frames = [];
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => (frames.push(f), frames.length));
    vi.stubGlobal("cancelAnimationFrame", () => {
      frames = [];
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** A ground that records the field it is handed and is moving while the
   *  host's envelope is — the shape every shipped ground has. */
  function recorder() {
    const seen: Pick<Field, "ease" | "ambient">[] = [];
    const ground: Ground = {
      name: "meadow",
      cursor: "ladybird",
      setup() {},
      step(_dt, f) {
        seen.push({ ease: f.ease, ambient: f.ambient });
        return f.ease > 0.002;
      },
      draw() {},
      dispose() {},
    };
    return { ground, seen };
  }

  function mount(motion: "full" | "calm") {
    const canvas = document.createElement("canvas");
    canvas.getContext = (() => fakeGl()) as unknown as HTMLCanvasElement["getContext"];
    const { ground, seen } = recorder();
    const host = new GroundHost(canvas, ground, { onStill: () => {}, motion });
    return { host, canvas, seen };
  }

  it("draws one frame at mount under Calm, and then nothing while untouched", () => {
    const { host, canvas, seen } = mount("calm");
    expect(canvas.dataset.groundState).toBe("asleep");
    run();
    expect(host.frames, "the one paint a mounted ground needs").toBe(1);
    expect(canvas.dataset.groundState, "never woke").toBe("asleep");
    // A pan, an item moving: one paint each, still asleep, no loop left running.
    host.setView({ scale: 1, tx: 40, ty: 0 });
    host.setItems(new Float32Array([0, 0, 10, 10]));
    run();
    expect(host.frames).toBe(2);
    expect(frames.length).toBe(0);
    expect(seen.every((f) => f.ambient === 0)).toBe(true);
    host.dispose();
  });

  it("still wakes for a cursor under Calm, with the ease rising and the ambient at zero", () => {
    const { host, canvas, seen } = mount("calm");
    run();
    const before = host.frames;
    host.pointer("self", 10, 10, 30, false);
    expect(canvas.dataset.groundState).toBe("awake");
    run();
    expect(host.frames, "the cursor's reaction is drawn").toBeGreaterThan(before + 10);
    expect(Math.max(...seen.map((f) => f.ease)), "the envelope rose").toBeGreaterThan(0.1);
    expect(seen.every((f) => f.ambient === 0), "and none of it was ambient").toBe(true);
    expect(canvas.dataset.groundState, "and it settled").toBe("asleep");
    host.dispose();
  });

  it("is what it was under Full: mounting wakes it, and the ambient is the envelope", () => {
    const { host, seen } = mount("full");
    run();
    expect(host.frames, "Full settles in from a wake").toBeGreaterThan(5);
    expect(Math.max(...seen.map((f) => f.ambient))).toBeGreaterThan(0.1);
    expect(seen.every((f) => f.ambient === f.ease)).toBe(true);
    host.dispose();
  });
});
