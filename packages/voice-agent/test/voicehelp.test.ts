// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wireSettingsHelp } from "../src/help.ts";
import { voiceBody } from "./page.ts";

/**
 * **The "?" beside a setting, in a DOM that has no Popover API at all.**
 *
 * jsdom has neither `showPopover` nor `:popover-open`, so the two methods are
 * stubbed here the way the platform behaves: they flip state and fire a
 * `toggle` carrying the new one, which is the event the module takes as its
 * only account of what is showing. Everything else is the real `voice.html` —
 * a help card written out again in this file would be a test of the copy.
 *
 * What a browser alone can prove — where the card lands, whether it overflows,
 * whether two of them can be on screen at once — is driven in Chrome by
 * `scripts/voice-settings-evidence.mjs`, not asserted here.
 */

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
};

const buttons = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("#settings .voice-help")];
const cardOf = (button: HTMLElement): HTMLElement => element(button.getAttribute("commandfor") ?? "");
const showingNow = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(".voice-help-card")].filter((c) => c.dataset.showing === "open");

/** One turn of the platform's own wheel: the state changes, then `toggle`. */
function toggle(card: HTMLElement, newState: "open" | "closed"): void {
  card.dataset.showing = newState === "open" ? "open" : "closed";
  card.dispatchEvent(Object.assign(new Event("toggle"), { newState }));
}

function stubPopover(): void {
  for (const card of document.querySelectorAll<HTMLElement>(".voice-help-card")) {
    card.showPopover = vi.fn(() => {
      // The real API throws on an already-showing popover, and a module that
      // called it twice would be a bug the stub should not paper over.
      if (card.dataset.showing === "open") throw new DOMException("already showing", "InvalidStateError");
      toggle(card, "open");
    });
    card.hidePopover = vi.fn(() => {
      if (card.dataset.showing !== "open") throw new DOMException("not showing", "InvalidStateError");
      toggle(card, "closed");
    });
  }
}

const pointer = (target: EventTarget, type: string, pointerType: string): void => {
  target.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerType }));
};

beforeEach(() => {
  document.body.innerHTML = voiceBody;
  stubPopover();
  vi.useFakeTimers();
  wireSettingsHelp(document);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the help beside each setting", () => {
  it("gives every label a glyph whose target is a card, and names what it explains", () => {
    expect(buttons().length).toBeGreaterThanOrEqual(9);
    const ids = new Set<string>();
    for (const button of buttons()) {
      const id = button.getAttribute("commandfor") ?? "";
      expect(id).toMatch(/^help-/);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      const card = cardOf(button);
      expect(card.getAttribute("popover")).toBe("hint");
      // The glyph is not a submit button and it is not a control that does
      // anything but open the card.
      expect(button.getAttribute("type")).toBe("button");
      // The accessible name says WHICH setting this explains: "?" alone is a
      // button that only makes sense to somebody who can see where it is.
      const label = button.getAttribute("aria-label") ?? "";
      expect(label.length).toBeGreaterThan(6);
      expect(button.textContent).toContain("?");
      // APG's tooltip contract: the description is the trigger's, and nothing
      // inside is focusable, so no focus can be trapped or moved.
      expect(button.getAttribute("aria-describedby")).toBe(id);
      expect(card.querySelector("a, button, input, select, textarea, [tabindex]")).toBeNull();
    }
  });

  it("attaches the same description to the control the row is about", () => {
    for (const control of document.querySelectorAll<HTMLElement>("#settings [aria-describedby]")) {
      const id = control.getAttribute("aria-describedby") ?? "";
      if (!id.startsWith("help-")) continue;
      const card = document.getElementById(id);
      expect(card, `${control.id || control.tagName} describes a card that exists`).not.toBeNull();
      expect(card!.querySelector("p")?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
    // The controls a person actually lands on carry it, not only the glyph.
    for (const id of ["daemon-field", "device", "key", "folder-pick", "open-project"]) {
      const described = element(id).getAttribute("aria-describedby") ?? "";
      expect(described, id).toMatch(/^help-/);
      expect(document.getElementById(described)).not.toBeNull();
    }
  });

  it("says more than the label it sits beside", () => {
    for (const card of document.querySelectorAll<HTMLElement>(".voice-help-card")) {
      const text = card.textContent?.trim() ?? "";
      // A sentence with a reason in it, not a restatement: the point of this
      // test is that "The daemon." would fail it.
      expect(text.length, card.id).toBeGreaterThan(120);
      expect(text.endsWith("."), card.id).toBe(true);
    }
  });

  it("opens on a click and closes on the next one, which is the whole path on a phone", () => {
    const [button] = buttons();
    const card = cardOf(button!);
    expect(showingNow()).toEqual([]);
    button!.click();
    expect(showingNow()).toEqual([card]);
    expect(card.showPopover).toHaveBeenCalledOnce();
    button!.click();
    expect(showingNow()).toEqual([]);
    expect(card.hidePopover).toHaveBeenCalledOnce();
  });

  it("opens on a mouse hovering it, and closes when the mouse leaves", () => {
    const [button] = buttons();
    const card = cardOf(button!);
    pointer(button!, "pointerenter", "mouse");
    vi.advanceTimersByTime(299);
    expect(showingNow()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(showingNow()).toEqual([card]);

    pointer(button!, "pointerleave", "mouse");
    vi.advanceTimersByTime(149);
    expect(showingNow()).toEqual([card]);
    vi.advanceTimersByTime(1);
    expect(showingNow()).toEqual([]);
  });

  it("keeps the card open while the pointer travels onto it", () => {
    const [button] = buttons();
    const card = cardOf(button!);
    pointer(button!, "pointerenter", "mouse");
    vi.advanceTimersByTime(300);
    pointer(button!, "pointerleave", "mouse");
    pointer(card, "pointerenter", "mouse");
    vi.advanceTimersByTime(1000);
    expect(showingNow()).toEqual([card]);
    pointer(card, "pointerleave", "mouse");
    expect(showingNow()).toEqual([]);
  });

  it("ignores the enter and leave a finger makes around its own tap", () => {
    const [button] = buttons();
    pointer(button!, "pointerenter", "touch");
    vi.advanceTimersByTime(2000);
    expect(showingNow()).toEqual([]);
    button!.click();
    expect(showingNow()).toEqual([cardOf(button!)]);
    pointer(button!, "pointerleave", "touch");
    vi.advanceTimersByTime(2000);
    expect(showingNow()).toEqual([cardOf(button!)]);
  });

  it("shows one card at a time", () => {
    const [first, second] = buttons();
    first!.click();
    second!.click();
    expect(showingNow()).toEqual([cardOf(second!)]);
    expect(cardOf(second!).hidePopover).not.toHaveBeenCalled();
  });

  it("dismisses from a press anywhere else, and not from one on itself", () => {
    const [button] = buttons();
    const card = cardOf(button!);
    button!.click();
    pointer(card, "pointerdown", "mouse");
    expect(showingNow()).toEqual([card]);
    pointer(button!, "pointerdown", "mouse");
    expect(showingNow()).toEqual([card]);
    pointer(element("settings-title"), "pointerdown", "mouse");
    expect(showingNow()).toEqual([]);
  });

  it("closes the card on Escape, and leaves the key alone when nothing is open", () => {
    const [button] = buttons();
    button!.click();
    const held = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    button!.dispatchEvent(held);
    // The dialog closes on Escape by itself; with a card open the key means
    // the card, so the event must not reach the surface underneath.
    expect(held.defaultPrevented).toBe(true);
    expect(showingNow()).toEqual([]);

    const idle = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    element("settings").dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
  });

  it("leaves the focus where it was", () => {
    const [button] = buttons();
    const title = element("settings-title");
    title.focus();
    expect(document.activeElement).toBe(title);
    button!.click();
    expect(document.activeElement).toBe(title);
    expect(cardOf(button!).hasAttribute("tabindex")).toBe(false);
  });
});
