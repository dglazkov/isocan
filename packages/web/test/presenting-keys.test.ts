// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "@isocan/core";
import { AUTO_ADVANCE_DEFAULT_S, autoAdvanceSeconds, nextInLoop, reclaimKeyboard, spaceTogglesChrome, stageFrameHolding } from "../src/lib/presenting.ts";

/**
 * **Presenting keeps the keyboard, and a deck left running loops.**
 *
 * Dion, 10 Nov 2026: in full screen, after leaving the tab and coming back,
 * the arrows stopped turning the deck. Coming back is usually a click on the
 * slide, and a click on the slide put focus in its cross-origin frame — whose
 * key presses never reach the page that listens for them. Reproduced in a real
 * browser (focus `IFRAME.html-view`, → did nothing) and fixed by taking focus
 * back from the slide's frame; the same day asked for the deck to turn itself
 * every so many seconds, looping from the last slide to the first.
 */

const slide = (id: string, x: number): Item =>
  ({
    id,
    title: id,
    x,
    y: 0,
    width: 100,
    height: 100,
    properties: {},
    reactions: {},
    versions: [],
    currentVersionId: "v",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }) as unknown as Item;

const canvasOf = (items: Item[]) =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} }) as unknown as CanvasContents;

describe("the slide's frame never keeps the keyboard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function stage(): HTMLIFrameElement {
    document.body.innerHTML = `<div class="fullscreen"><div class="fullscreen-stage"><iframe class="html-view" title="Acme slide"></iframe></div></div><iframe id="elsewhere" title="Acme elsewhere"></iframe>`;
    return document.querySelector(".fullscreen-stage iframe") as HTMLIFrameElement;
  }

  it("finds the stage's frame when it holds focus, and takes focus back from it", () => {
    const frame = stage();
    frame.focus();
    expect(document.activeElement).toBe(frame);
    expect(stageFrameHolding(document)).toBe(frame);
    expect(reclaimKeyboard(document)).toBe(true);
    expect(document.activeElement).not.toBe(frame);
    expect(stageFrameHolding(document)).toBeNull();
  });

  it("leaves focus alone anywhere but the slide's frame", () => {
    stage();
    const elsewhere = document.getElementById("elsewhere") as HTMLIFrameElement;
    elsewhere.focus();
    expect(stageFrameHolding(document)).toBeNull();
    expect(reclaimKeyboard(document)).toBe(false);
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe("a deck left running", () => {
  const canvas = canvasOf([slide("acme-1", 0), slide("acme-2", 150), slide("acme-3", 300)]);

  it("turns to the next slide, and from the last back to the first", () => {
    expect(nextInLoop(canvas, "acme-1")?.id).toBe("acme-2");
    expect(nextInLoop(canvas, "acme-2")?.id).toBe("acme-3");
    expect(nextInLoop(canvas, "acme-3")?.id).toBe("acme-1");
  });

  it("has nowhere to go with one slide", () => {
    expect(nextInLoop(canvasOf([slide("acme-only", 0)]), "acme-only")).toBeNull();
  });

  it("runs at ten seconds unless told otherwise, and only at a pace a deck can keep", () => {
    expect(AUTO_ADVANCE_DEFAULT_S).toBe(10);
    expect(autoAdvanceSeconds("")).toBe(10);
    expect(autoAdvanceSeconds("abc")).toBe(10);
    expect(autoAdvanceSeconds(0)).toBe(2);
    expect(autoAdvanceSeconds(7.4)).toBe(7);
    expect(autoAdvanceSeconds(99_999)).toBe(600);
  });
});

describe("Space and the bar", () => {
  const space = (target: EventTarget | null, mods: Partial<KeyboardEvent> = {}) =>
    spaceTogglesChrome({ code: "Space", key: " ", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target, ...mods });

  it("shows or hides the bar from the slide itself", () => {
    expect(space(document.body)).toBe(true);
  });

  it("leaves Space to a field being typed in", () => {
    const field = document.createElement("input");
    document.body.append(field);
    expect(space(field)).toBe(false);
    field.remove();
  });

  it("is not a modified Space, nor any other key", () => {
    expect(space(document.body, { shiftKey: true })).toBe(false);
    expect(spaceTogglesChrome({ code: "KeyA", key: "a", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target: document.body })).toBe(false);
  });

  it("takes Space from a button a click left focused, so ▶ Auto is not pressed twice", () => {
    const button = document.createElement("button");
    document.body.append(button);
    expect(space(button)).toBe(true);
    button.remove();
  });
});
