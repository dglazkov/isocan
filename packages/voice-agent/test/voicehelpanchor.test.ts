import { describe, expect, it } from "vitest";
import { rules, withoutComments } from "./cssrules.ts";
import { voiceHtml } from "./page.ts";

/**
 * **The pair of names that decides where a help card lands.**
 *
 * Anchoring is a pair — `anchor-name` on the glyph, `position-anchor` on the
 * card — and CSS cannot derive one name from the other. Written out by hand,
 * the failure is a copy-paste that anchors a card to a DIFFERENT row's glyph,
 * which is invisible until somebody opens the setting next to it and reads a
 * card that is not about it.
 *
 * This is a guard on the sheet rather than on the page because that is where
 * the mistake lives. What it can prove is that the names line up; where a card
 * actually lands is driven in Chrome by `scripts/voice-settings-evidence.mjs`.
 */

const anchors = [...voiceHtml.matchAll(/commandfor="(help-[\w-]+)"/g)].map((m) => m[1]!);

describe("the anchor each help card hangs from", () => {
  const sheet = rules();
  const declared = new Map<string, string>();
  for (const rule of sheet) {
    const name = /--help-anchor:\s*(--help-[\w-]+)/.exec(rule.body)?.[1];
    if (!name) continue;
    // Declared twice means the later rule wins and one card silently follows
    // another row's glyph.
    expect(declared.has(name), `${name} is declared once`).toBe(false);
    declared.set(name, rule.selector);
  }

  it("names one anchor per glyph, all of them, and nothing else", () => {
    expect(anchors.length).toBeGreaterThanOrEqual(9);
    expect([...declared.keys()].sort()).toEqual(anchors.map((id) => `--${id}`).sort());
  });

  it("names the container the glyph and its card both live in", () => {
    for (const [name, selector] of declared) {
      const id = name.replace(/^--/, "");
      if (selector.includes(`commandfor="${id}"`)) continue;
      // A panel is the exception and the reason this check exists: its glyph
      // sits in the heading and its card does not, so the name goes on the
      // section — and the section has to really hold both halves.
      const container = /#([\w-]+)/.exec(selector.replace("#settings", ""))?.[1];
      expect(container, `${selector} names a container`).toBeTruthy();
      const at = voiceHtml.indexOf(`id="${container}"`);
      expect(at, `${container} is in the page`).toBeGreaterThan(-1);
      const section = voiceHtml.slice(at, voiceHtml.indexOf("</section>", at));
      expect(section, container).toContain(`commandfor="${id}"`);
      expect(section, container).toContain(`id="${id}"`);
    }
  });

  it("hangs the card off that name and the glyph on it, in one place each", () => {
    const glyph = sheet.filter((rule) => rule.body.includes("anchor-name: var(--help-anchor"));
    const card = sheet.filter((rule) => rule.body.includes("position-anchor: var(--help-anchor"));
    expect(glyph.map((rule) => rule.selector)).toEqual(["#settings .voice-help"]);
    expect(card.map((rule) => rule.selector)).toEqual([".voice-help-card"]);
  });

  it("keeps a last-resort position for the card that cannot fit beside its glyph", () => {
    const fallbacks = sheet.find((rule) => rule.body.includes("position-try-fallbacks"));
    expect(fallbacks?.body).toContain("flip-block");
    expect(fallbacks?.body).toContain("flip-inline");
    expect(fallbacks?.body).toContain("--voice-help-narrow");
    expect(fallbacks?.body).toContain("--voice-help-sheet");
    // The names are defined, not fallbacks that resolve to nothing. The
    // declarations inside an at-rule are a scope rather than a rule, so these
    // two are read off the sheet itself.
    expect(withoutComments()).toContain("@position-try --voice-help-narrow");
    expect(withoutComments()).toContain("@position-try --voice-help-sheet");
  });
});
