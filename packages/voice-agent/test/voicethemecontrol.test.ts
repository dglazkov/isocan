// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { wireThemeChoice } from "../src/theme.ts";
import { headScript, voiceBody } from "./page.ts";

/**
 * **The theme choice, wired to the page's own pre-paint applier.**
 *
 * The claim worth testing is not that a radio can be checked. It is that the
 * control and the script that paints the page agree about what "system" means,
 * because they are two files and one preference — so the REAL head script is
 * evaluated here, in this window, and the assertions run through it: a click
 * writes what the script reads, and the script's own resolution sets the
 * attribute the stylesheet paints from. A test that stubbed the applier would
 * pass while the two disagreed.
 *
 * jsdom has no `matchMedia` at all, so one is provided — which is also how the
 * device is made to flip, and how the live-follow claim is made. The script is
 * wrapped in a function before it is evaluated: its `const`s would otherwise
 * land in the global lexical environment and refuse a second boot.
 */

/** Everyone listening for the device to change, as the page's script does. */
let listeners: (() => void)[] = [];
let deviceIsDark = false;
/** Set by a test that wants to be the browser that refuses to store. */
let refuseStorage = false;

function boot(): void {
  document.body.innerHTML = voiceBody;
  delete document.documentElement.dataset.theme;
  listeners = [];
  deviceIsDark = false;
  (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) =>
    ({
      media: query,
      get matches() {
        return deviceIsDark;
      },
      addEventListener: (type: string, listener: () => void) => {
        if (type === "change") listeners.push(listener);
      },
    }) as unknown as MediaQueryList;
  // The real script, run as the page runs it — with the one global it publishes
  // put back where the page puts it.
  const applier = window.eval(`(function () {\n${headScript}\nreturn applyVoiceTheme; })()`);
  (window as unknown as { applyVoiceTheme: unknown }).applyVoiceTheme = applier;
  wireThemeChoice(document);
}

/** The device flips, the way the OS does while a page is open. */
function deviceFlips(dark: boolean): void {
  deviceIsDark = dark;
  for (const listener of listeners) listener();
}

const radio = (value: string): HTMLInputElement => {
  const found = document.querySelector<HTMLInputElement>(`#theme-panel input[value="${value}"]`);
  if (!found) throw new Error(`no ${value} radio`);
  return found;
};
const checked = (): string => [...document.querySelectorAll<HTMLInputElement>("#theme-panel input")].find((i) => i.checked)?.value ?? "none";
const line = (): string => document.getElementById("theme-now")?.textContent ?? "";
const theme = (): string | undefined => document.documentElement.dataset.theme;

function choose(value: string): void {
  const input = radio(value);
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  refuseStorage = false;
  localStorage.clear();
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
    if (refuseStorage) throw new DOMException("refused", "QuotaExceededError");
    setItem.call(this, key, value);
  });
  boot();
});

describe("the theme preference, from the control to the painted attribute", () => {
  it("starts on what the page already has: system, the device's answer", () => {
    expect(checked()).toBe("system");
    expect(theme()).toBe("light");
    expect(line()).toBe("Following your device: light right now.");
  });

  it("writes the preference the pre-paint script reads, and repaints through it", () => {
    choose("dark");
    expect(localStorage.getItem("isocan.theme")).toBe("dark");
    expect(theme()).toBe("dark");
    expect(line()).toBe("Pinned to dark.");
    choose("light");
    expect(localStorage.getItem("isocan.theme")).toBe("light");
    expect(theme()).toBe("light");
    expect(line()).toBe("Pinned to light.");
  });

  it("takes a preference stored before the page was opened", () => {
    localStorage.setItem("isocan.theme", "dark");
    boot();
    expect(checked()).toBe("dark");
    expect(theme()).toBe("dark");
    // And one it does not recognise is "system", as the script decides.
    localStorage.setItem("isocan.theme", "sepia");
    boot();
    expect(checked()).toBe("system");
    expect(theme()).toBe("light");
  });

  it("keeps following the device under Use system, without a reload", () => {
    expect(theme()).toBe("light");
    deviceFlips(true);
    expect(theme()).toBe("dark");
    expect(line()).toBe("Following your device: dark right now.");
    expect(radio("system").checked).toBe(true);
  });

  it("stops following the device once the choice is pinned", () => {
    choose("light");
    deviceFlips(true);
    expect(theme()).toBe("light");
    expect(line()).toBe("Pinned to light.");
    choose("dark");
    deviceFlips(false);
    expect(theme()).toBe("dark");
  });

  it("says so when the browser will not keep the choice, rather than showing a radio that disagrees", () => {
    refuseStorage = true;
    choose("dark");
    expect(theme()).toBe("light");
    expect(checked()).toBe("system");
    expect(line()).toBe("Following your device: light right now. This browser will not remember the choice.");
  });

  it("is a radio group with a name, so the arrow keys and the announced state are the platform's", () => {
    const fieldset = document.querySelector<HTMLFieldSetElement>("#theme-panel .voice-theme");
    expect(fieldset?.tagName).toBe("FIELDSET");
    expect(fieldset?.getAttribute("aria-labelledby")).toBe("theme-title");
    expect(document.getElementById("theme-title")?.textContent).toBe("Theme");
    const inputs = [...document.querySelectorAll<HTMLInputElement>("#theme-panel input")];
    expect(inputs.map((input) => input.type)).toEqual(["radio", "radio", "radio"]);
    expect(new Set(inputs.map((input) => input.name)).size).toBe(1);
    for (const input of inputs) {
      // Every radio is inside its own label, which is the target a thumb hits.
      expect(input.closest("label"), input.value).not.toBeNull();
    }
    expect(inputs.map((input) => input.value)).toEqual(["light", "dark", "system"]);
  });
});
