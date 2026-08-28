import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { anchorOffset } from "@isocan/core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CHROME_INSET,
  FULL_LABEL_ROOM,
  ICON_ROOM,
  MARK_ROOM,
  MIN_NAME_ROOM,
  PIN_NUDGE,
  ROW_END_ROOM,
  UNDER_ROW_PAD,
  hasRoomForChrome,
  nameFits,
  nameRoom,
  titleRow,
  underRowSpellsItOut,
  underSlotFor,
} from "../src/lib/chrome.ts";

const actor = { id: "usr_a", name: "A" };
const stamp = { createdAt: "", createdBy: actor, updatedAt: "", updatedBy: actor };

const item = (x: number, y: number, width = 200, height = 150): Item => ({
  id: "itm_1",
  x,
  y,
  width,
  height,
  title: "Thing",
  description: "",
  properties: {},
  versions: [],
  currentVersionId: "",
  ...stamp,
});

describe("hasRoomForChrome", () => {
  it("says yes to an item you can actually read", () => {
    expect(hasRoomForChrome(200, 150, 1)).toBe(true);
  });

  it("says no once the zoom has made it a speck", () => {
    expect(hasRoomForChrome(200, 150, 0.2)).toBe(false);
  });

  it("measures the item on SCREEN, not in the world", () => {
    // A big item still has room until the zoom actually shrinks it: 2000 world
    // units at 5% is a legible 100px, at 2% it is 40px and there is nowhere to
    // put a label.
    expect(hasRoomForChrome(2000, 1500, 0.05)).toBe(true);
    expect(hasRoomForChrome(2000, 1500, 0.02)).toBe(false);
    expect(hasRoomForChrome(60, 44, 1)).toBe(true);
  });

  it("wants both dimensions — a wide sliver has no room either", () => {
    expect(hasRoomForChrome(400, 20, 1)).toBe(false);
  });
});

/**
 * **A minimum that exceeds what exists is not a minimum, it is an overlap.**
 *
 * The name's width was `Math.max(MIN_NAME_ROOM, width * scale - ROW_END_ROOM)`.
 * At 13% a 480-unit item is 62 screen pixels; the star wants 26 and the row is
 * inset 5 a side, so 26 is what is left — and the floor handed the name 48, so
 * it was drawn straight through the star. It shipped, and it shipped with the
 * whole suite green, because the rule lived inline in a component that no test
 * could reach (lessons.md #5).
 *
 * These cases are stated without the constants wherever they can be, so
 * retuning the star's room or the row's inset does not make them lie.
 */
describe("the room a name is given", () => {
  const SCALES = [0.02, 0.05, 0.13, 0.5, 1, 3];
  const WIDTHS = [40, 80, 200, 480, 1200, 4000];

  it("is linear in what the item is worth on screen, within one row layout", () => {
    // A floor is a BEND in this line, and the bend is where the name went
    // through the star. Stated with no constant in it: doubling the item's
    // width adds exactly the item's screen width to the room. `Math.max(48, …)`
    // flattens it to zero below the knee.
    //
    // Compared only WITHIN one layout, because there is now one honest step in
    // this function: the icon appears, and its room stops being the name's.
    // The step is the next case's business.
    for (const scale of SCALES) {
      for (const width of WIDTHS) {
        const here = titleRow(width, scale);
        const twice = titleRow(2 * width, scale);
        // Same layout means the same pair showing. `nameRoom` is documented as
        // meaningless where the name is hidden, so a case that compares a
        // hidden name to a shown one compares one real number to one that was
        // never a promise.
        if (!here.name || !twice.name || here.icon !== twice.icon) continue;
        expect(
          nameRoom(2 * width, scale) - nameRoom(width, scale),
          `a bend at ${width} world units @ ${scale}`,
        ).toBeCloseTo(width * scale, 6);
      }
    }
  });

  it("never claims more of the item than is left after whatever else the row shows", () => {
    // Only where the name is actually SHOWN: below that it is hidden, and what
    // a hidden element was offered is not a thing anybody can see. The budget
    // is conditional on the glyph now — subtracting for an icon that is not
    // there would be the mirror of the original bug, a name given LESS than
    // exists rather than more.
    for (const scale of SCALES) {
      for (const width of WIDTHS) {
        const row = titleRow(width, scale);
        if (!row.name) continue;
        expect(
          row.nameRoom,
          `${width} world units @ ${scale} overflows the row's far end or the kind icon`,
        ).toBeLessThanOrEqual(
          width * scale - ROW_END_ROOM - (row.icon ? ICON_ROOM : 0) - CHROME_INSET * 2 + 1e-9,
        );
      }
    }
  });

  it("costs the name at most the icon's room when the icon arrives", () => {
    // Zooming IN can shorten the visible name by one step, once, as the glyph
    // appears and takes its room back. That is a real cost and it is bounded:
    // never more than the glyph occupies, and never below the width where a
    // name says something. Anything worse is the row re-laying itself out.
    for (const scale of [0.05, 0.13, 0.2, 0.5, 1]) {
      for (let width = 40; width < 2000; width += 1) {
        const before = titleRow(width, scale);
        const after = titleRow(width + 1, scale);
        if (before.icon || !after.icon || !after.name) continue;
        expect(after.nameRoom).toBeGreaterThanOrEqual(MIN_NAME_ROOM);
        expect(
          before.nameRoom - after.nameRoom,
          `the icon cost the name more than it occupies at ${width} @ ${scale}`,
        ).toBeLessThanOrEqual(ICON_ROOM + 1e-9);
      }
    }
  });

  it("hides the name rather than squeezing it — the 13% item this was found on", () => {
    // 480 world units at 13% is 62.4 screen px. Measured on the real canvas.
    expect(nameRoom(480, 0.13)).toBeLessThan(MIN_NAME_ROOM);
    expect(nameRoom(480, 0.13)).toBeGreaterThan(0); // there IS room, just not enough
    expect(nameFits(480, 0.13)).toBe(false);
    // …and the same item at 100% is fine, so this is about the zoom and not
    // about the item.
    expect(nameFits(480, 1)).toBe(true);
  });

  it("depends only on what the item is worth on SCREEN, not on how it got there", () => {
    // A big item zoomed out and a small item at 1:1 are the same problem.
    expect(nameRoom(480, 0.13)).toBeCloseTo(nameRoom(62.4, 1), 6);
    expect(nameFits(480, 0.13)).toBe(nameFits(62.4, 1));
  });

  it("brackets the width where a name starts to say something", () => {
    // Room to tune, none to delete. Under ~12 screen px a name is a smudge;
    // over ~120 the threshold would start hiding names on items that plainly
    // have space for one.
    expect(MIN_NAME_ROOM).toBeGreaterThan(12);
    expect(MIN_NAME_ROOM).toBeLessThan(120);
    // And the star's room is real: an item with nothing left over must not be
    // told it can show a name.
    expect(nameFits(ROW_END_ROOM + ICON_ROOM + CHROME_INSET * 2, 1)).toBe(false);
  });
});

/**
 * One number, two homes. `CHROME_INSET` is what ItemView subtracts from the
 * name's width; `.item-titlebar`'s horizontal padding is what actually insets
 * the row. Nothing but this test connects them, and the day they disagree the
 * name is measured against a width it was not given — which is the same
 * arithmetic that drew it through the star.
 */
describe("the row's inset is one number", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../src/styles.css", import.meta.url)),
    "utf8",
  );

  /** `.item-titlebar`'s own rule, comments stripped. */
  function titlebarRule(): string | null {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selectors = (rule[1] ?? "").split(",").map((one) => one.trim());
      if (selectors.includes(".item-titlebar")) return rule[2] ?? "";
    }
    return null;
  }

  it("matches the stylesheet's padding, in screen pixels", () => {
    const rule = titlebarRule();
    expect(rule, "no .item-titlebar rule — renamed, or the parser is wrong").not.toBeNull();
    // Two legal spellings, and only two. A screen-measured inset must divide by
    // --scale; a zero inset has no unit to measure, so it is written `0`.
    // Anything else — `padding: 0 3px` — is WORLD pixels: a different number at
    // every zoom, while ItemView subtracts a screen one.
    const scaled = /padding:\s*0\s+calc\(\s*([\d.]+)px\s*\/\s*var\(--scale/.exec(rule!);
    const zero = /(^|[;{\s])padding:\s*0\s*(;|$)/.test(rule!);
    expect(
      scaled !== null || zero,
      ".item-titlebar must inset by calc(<n>px / var(--scale)), or by `0` when " +
        "there is no inset at all — a bare `<n>px` is world pixels",
    ).toBe(true);
    expect(Number(scaled?.[1] ?? 0), "styles.css and CHROME_INSET disagree").toBe(CHROME_INSET);
  });

  it("does not change when the item is selected", () => {
    // ItemView computes ONE number for both states, so a selected-only inset
    // in CSS is a width the name was never told about. This is the shape that
    // made the row hop 7px in the moment you clicked it.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = (rule[1] ?? "").trim();
      if (!/\.item\.selected\b/.test(selector) || !/\.item-titlebar\b/.test(selector)) continue;
      expect(
        rule[2] ?? "",
        `${selector} moves or insets the row only while selected — ItemView cannot see that`,
      ).not.toMatch(/(^|[;{\s])(padding|padding-left|padding-right|top|bottom|left|right)\s*:/);
    }
  });
});

/**
 * One slot under the item, two things that want it.
 *
 * The size chip and "double-click to interact" occupy the same strip. They can
 * share it because their triggers differ, but "differ" is only true if
 * something enforces the precedence — otherwise the day both apply you get two
 * pills stacked under the card, in the space comment pins land in.
 */
describe("the strip under an item", () => {
  const idle = { entered: false, resizing: false, soleSelection: false, interactive: false };

  it("says nothing under a plain unselected image", () => {
    expect(underSlotFor(idle)).toBeNull();
  });

  it("offers the hint on something you could open", () => {
    expect(underSlotFor({ ...idle, interactive: true })).toBe("hint");
  });

  it("shows the size once the item is the sole selection", () => {
    expect(underSlotFor({ ...idle, soleSelection: true })).toBe("size");
  });

  it("prefers the size when both apply — the collision this rule exists for", () => {
    expect(underSlotFor({ ...idle, soleSelection: true, interactive: true })).toBe("size");
    expect(underSlotFor({ ...idle, resizing: true, interactive: true })).toBe("size");
  });

  it("shows the size mid-resize even when the item is not the sole selection", () => {
    // Resizing IS the gesture the number reports on; nothing outranks it.
    expect(underSlotFor({ ...idle, resizing: true })).toBe("size");
  });

  it("says nothing at all once you are inside the item", () => {
    // Entered, your clicks belong to the page — chrome stops talking over it.
    for (const on of [{ soleSelection: true }, { resizing: true }, { interactive: true }]) {
      expect(underSlotFor({ ...idle, ...on, entered: true })).toBeNull();
    }
  });
});

/**
 * There is no size at which a card says nothing about itself.
 *
 * Reported from a real canvas: between roughly 12% and 19% zoom on a 480-unit
 * item, the title row showed a bare star. The name had been dropped (correctly
 * — text is a smudge down there) and the kind icon went with it, because both
 * lived in one element that was hidden as a pair. Adding the glyph had also
 * pushed the name's own vanish threshold up by three points of zoom, since its
 * room came out of the name's.
 *
 * The rule that fixes both: the glyph yields to the name, and then outlives it.
 */
describe("what a card says as it shrinks", () => {
  const WIDTH = 480; // the item this was reported on

  it("always says something while the chrome is shown at all", () => {
    for (let pct = 1; pct <= 300; pct += 1) {
      const scale = pct / 100;
      if (!hasRoomForChrome(WIDTH, WIDTH, scale)) continue; // no chrome at all: fine
      const row = titleRow(WIDTH, scale);
      expect(
        row.icon || row.name,
        `a bare star at ${pct}% — the card says nothing about itself`,
      ).toBe(true);
    }
  });

  it("keeps the kind mark exactly where the name gives up", () => {
    // The handover is the whole design: the glyph is what is left when the
    // name goes, so the band that used to be empty is the band it covers.
    for (let pct = 1; pct <= 300; pct += 1) {
      const scale = pct / 100;
      if (!hasRoomForChrome(WIDTH, WIDTH, scale)) continue;
      const row = titleRow(WIDTH, scale);
      if (!row.name) expect(row.icon, `nothing at all at ${pct}%`).toBe(true);
    }
  });

  it("does not make the name disappear earlier than it did before the icon", () => {
    // The regression the glyph introduced, stated as the property rather than
    // as the number: the kind mark must never be the reason a name is gone.
    // Room for a name is decided against the star and the inset alone.
    for (const scale of [0.05, 0.1, 0.13, 0.154, 0.16, 0.2, 0.5, 1]) {
      for (const width of [80, 200, 480, 1200]) {
        const withoutGlyph = width * scale - ROW_END_ROOM - CHROME_INSET * 2;
        if (withoutGlyph >= MIN_NAME_ROOM) {
          expect(
            titleRow(width, scale).name,
            `${width} @ ${scale}: room for a name, but the icon took it`,
          ).toBe(true);
        }
      }
    }
  });

  it("shows all three the moment there is room for all three", () => {
    const scale = (MIN_NAME_ROOM + ROW_END_ROOM + ICON_ROOM + CHROME_INSET * 2) / WIDTH;
    const row = titleRow(WIDTH, scale);
    expect(row).toMatchObject({ icon: true, name: true });
    expect(row.nameRoom).toBeCloseTo(MIN_NAME_ROOM, 6);
  });
});

/**
 * A control inside an inert strip has to take its events back.
 *
 * `.item-hint` is `pointer-events: none` on purpose: it hangs under an item,
 * over the canvas, and a hint must never eat a click meant for the thing
 * behind it. The Full screen button lives in that strip and is the one part of
 * it that IS a control, so it has to opt back in.
 *
 * It shipped without doing so. The button rendered, looked pressable, and was
 * not: `elementFromPoint` over its middle returned the canvas viewport. It got
 * through because the check that was supposed to catch it called
 * `button.click()` — which invokes the handler directly and never consults hit
 * testing, so it passes on an element buried under a wall. lessons.md #20.
 */
describe("the strip under an item lets its one control be clicked", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../src/styles.css", import.meta.url)),
    "utf8",
  );

  function block(selector: string): string {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selectors = (rule[1] ?? "").split(",").map((one) => one.trim());
      if (selectors.includes(selector)) return rule[2] ?? "";
    }
    return "";
  }

  it("keeps the row itself inert — the half that is deliberate", () => {
    // Stated so the pair is held together: if this ever stops being none, the
    // opt-outs below are dead weight and somebody should know.
    //
    // It moved from `.item-hint` to `.item-under` when the chrome below an
    // item became ONE row instead of two. The invariant did not change — the
    // container a stray click lands in is inert, and the controls inside it
    // claim their events back — but the container did, and a guard naming the
    // old element would have gone quietly vacuous.
    expect(block(".item-under")).toMatch(/pointer-events:\s*none/);
  });

  it("gives the button its events back", () => {
    expect(
      block(".fullscreen-btn"),
      "inside a pointer-events:none row a button is decoration — it needs pointer-events: auto",
    ).toMatch(/pointer-events:\s*auto/);
  });

  it("gives the marks theirs back too — they share that row now", () => {
    // Same rule, second control. The reaction chips and the `+` sit in the
    // same inert wrapper as the button and would be equally decorative.
    expect(block(".item-reactions")).toMatch(/pointer-events:\s*auto/);
  });
});

/**
 * **The full-screen control always has an icon, and spells itself out when roomy.**
 *
 * The button always carries the `[ ]` icon (`EXPAND`). When there is plenty of
 * room (`>= 210px`), it also spells out "Full screen" beside the icon. When
 * space is tight, it collapses to just the icon so the whole row still fits
 * without crowding marks or size chips.
 *
 * It keeps its name on hover via `data-tip` and for screen readers via
 * `aria-label`.
 */
describe("the full-screen control has an icon and adapts its label to room", () => {
  const itemView = readFileSync(
    fileURLToPath(new URL("../src/components/ItemView.tsx", import.meta.url)),
    "utf8",
  );
  const css = readFileSync(
    fileURLToPath(new URL("../src/styles.css", import.meta.url)),
    "utf8",
  );

  it("always carries the icon and conditionally spells the label", () => {
    const button = itemView.match(/<button\s+className=\{`fullscreen-btn\$\{spellItOut \? "" : " compact"\}`\}[\s\S]*?<\/button>/);
    expect(button, "no fullscreen button").toBeTruthy();
    expect(button![0]).toContain("{EXPAND}");
    expect(button![0]).toContain('{spellItOut && <span>Full screen</span>}');
  });

  it("brackets the threshold, so it can be retuned but not lost or drifted", () => {
    // Measured: 211px for the whole line with the labeled button (22 + 6 +
    // 91 + 6 + 86). Below that the label overlaps its neighbours; far above
    // it a roomy item goes to the glyph for no reason. The first version of
    // this test froze point values instead, which said nothing when the
    // button grew 14px under an unchanged threshold (lesson #11: bracket a
    // tuning constant, never freeze it).
    expect(FULL_LABEL_ROOM).toBeGreaterThanOrEqual(211);
    expect(FULL_LABEL_ROOM).toBeLessThan(320);
  });

  it("charges the room for every worn mark", () => {
    // The row also carries the marks. Two chips on a 215px item ran the size
    // chip 84 measured pixels past the item's edge under a threshold that
    // only looked at the item's width.
    const roomy = FULL_LABEL_ROOM + 2 * MARK_ROOM;
    expect(underRowSpellsItOut(roomy, 1, 2)).toBe(true);
    expect(underRowSpellsItOut(roomy - 1, 1, 2)).toBe(false);
    // The same width that spells it out bare does not with marks on.
    expect(underRowSpellsItOut(FULL_LABEL_ROOM, 1, 0)).toBe(true);
    expect(underRowSpellsItOut(FULL_LABEL_ROOM, 1, 1)).toBe(false);
    // And a chip's charge is a real chip's width, not a token.
    expect(MARK_ROOM).toBeGreaterThanOrEqual(46);
    expect(MARK_ROOM).toBeLessThan(60);
  });

  it("measures SCREEN pixels, not world units", () => {
    const wide = FULL_LABEL_ROOM * 2;
    expect(underRowSpellsItOut(wide, 1, 0)).toBe(true);
    expect(underRowSpellsItOut(wide, 0.4, 0)).toBe(false);
  });

  it("keeps the name for a screen reader", () => {
    expect(itemView).toMatch(/aria-label="Full screen"/);
  });

  it("keeps the name for a pointer, and draws it rather than using `title`", () => {
    // `title` waits about a second and lands at the pointer, not the control.
    // Conditional on purpose: the labeled form's tip carries only the keys
    // (its ink already says the name); the compact form's tip carries both.
    expect(itemView).toMatch(/data-tip=\{spellItOut \? "Enter/);
    expect(itemView).toMatch(/"Full screen — Enter, Esc comes back"/);
    expect(css).toMatch(/\.fullscreen-btn::after\s*\{[^}]*content:\s*attr\(data-tip\)/);
  });

  it("shows that tooltip on focus too, not only on hover", () => {
    expect(css).toMatch(/\.fullscreen-btn:focus-visible::after/);
  });

  it("keeps the tooltip out of the pointer's way", () => {
    // If it caught events it would become the thing under the pointer on the
    // way to the control it describes.
    const tip = css.match(/\.fullscreen-btn::after\s*\{([^}]*)\}/);
    expect(tip![1]).toMatch(/pointer-events:\s*none/);
  });

  it("opens the tooltip DOWNWARD, away from the item it describes", () => {
    // This strip hangs under the item, so upward is into the artifact — and
    // `.item` is its own stacking context, so a tip that opens up cannot even
    // be lifted clear of what it covers. Down is the empty canvas.
    const tip = css.match(/\.fullscreen-btn::after\s*\{([^}]*)\}/)![1];
    expect(tip).toMatch(/top:\s*calc\(100% \+/);
    expect(tip, "upward puts the tip over the item").not.toMatch(/bottom:\s*calc\(100% \+/);
  });

  it("wears the same chip as the readout beside it, not a foreign pill", () => {
    // One row, one voice: a solid dark capsule next to the pale size chip
    // read as something that had landed on the row rather than as the row
    // speaking. Same three tokens the neighbouring chip uses.
    const tip = css.match(/\.fullscreen-btn::after\s*\{([^}]*)\}/)![1];
    expect(tip).toMatch(/background:\s*var\(--chip\)/);
    expect(tip).toMatch(/color:\s*var\(--ink-muted\)/);
    expect(tip).toMatch(/border:\s*1px solid var\(--line-soft\)/);
  });

  it("keeps the button face one solid color without an inner chip", () => {
    // The chip styling that once wrapped the label in a nested grey capsule
    // is kept off by SCOPE, not by a counter-rule: `.item-hint > span` styles
    // only the strip's own direct children, so the button's inner span is
    // simply never a chip. One home for the rule — the un-styling reset that
    // used to sit beside it reset nothing and invited the two to disagree.
    expect(css).toMatch(/\.item-hint > span\s*\{/);
    expect(css).not.toMatch(/\.item-hint span\s*\{/);
    expect(css, "a dead reset is a second home for the scoping rule").not.toMatch(
      /\.fullscreen-btn span\s*\{/,
    );
  });
});

/**
 * **The reaction add button carries the smiley-plus icon.**
 */
describe("the reaction add button", () => {
  const reactionsView = readFileSync(
    fileURLToPath(new URL("../src/components/Reactions.tsx", import.meta.url)),
    "utf8",
  );
  const css = readFileSync(
    fileURLToPath(new URL("../src/styles.css", import.meta.url)),
    "utf8",
  );

  it("renders the SMILE_PLUS icon in the add reaction button", () => {
    expect(reactionsView).toMatch(/className="react-add"[\s\S]*?\{SMILE_PLUS\}/);
    expect(reactionsView).toContain('viewBox="0 0 24 24"');
  });

  it("styles the add button for the icon it holds, not the text it lost", () => {
    const btn = css.match(/\.react-add\s*\{([^}]*)\}/);
    expect(btn, "no .react-add rule").toBeTruthy();
    // A fixed box, centred both ways — an svg does not size a flex row the
    // way a glyph did.
    expect(btn![1]).toMatch(/justify-content:\s*center/);
    expect(btn![1]).toMatch(/width:\s*22px/);
    expect(btn![1]).toMatch(/height:\s*21px/);
    // The text-sizing the ＋ needed goes with the ＋: font-size and
    // line-height on an svg-only button are dead weight that misleads the
    // next reader about what is inside.
    expect(btn![1]).not.toMatch(/font-size/);
    expect(btn![1]).not.toMatch(/line-height/);
    expect(css).toMatch(/\.react-add svg\s*\{[^}]*display:\s*block/);
  });
});



/**
 * The two ends of the top edge, shared without touching: the version count is
 * INSET along it, an anchored thread hangs OUTSIDE the corner past it.
 */
describe("where an item's chrome and its conversation sit", () => {
  it("anchors an item's threads at its top-right CORNER, both surfaces", () => {
    // The corner itself, so the spot is the same at every zoom: a nudge in
    // world units (the CLI's old `width + 12`) is a different number of
    // screen pixels at each one. How far clear of the corner the pin sits is
    // PIN_NUDGE's job, in screen pixels, where the handle's reach is measured.
    expect(anchorOffset(item(0, 0, 200, 150))).toEqual({ x: 200, y: 0 });
    expect(anchorOffset(item(900, 900, 480, 320))).toEqual({ x: 480, y: 0 });
  });

  it("steps the pin clear of the corner handle rather than onto it", () => {
    // The handle is 12 screen px centred on the corner, so it reaches 6px
    // outside the edge — and it is BELOW the pin in paint order, so an
    // overlap is a press the pin swallows. Stated as the inequality, so
    // moving either number is allowed and closing the gap is not.
    const handleReach = 6;
    expect(PIN_NUDGE).toBeGreaterThan(handleReach);
    // And not so far out that it stops reading as this item's thread.
    expect(PIN_NUDGE).toBeLessThanOrEqual(24);
  });

  it("keeps the marks row clear of the selection chrome it sits under", () => {
    // The outline is 2px and the corner handles reach 6px below the edge.
    expect(UNDER_ROW_PAD).toBeGreaterThan(6);
  });
});

/**
 * **Two kinds of conversation, two words.** The canvas has one Chat (docked,
 * everyone including agents, no @-mention) and any number of comments (pinned
 * to a thing, about that thing). The words used to be "Main" on the button and
 * "Main thread" in the panel it opened — two labels for one panel, both naming
 * the SLOT rather than the thing people do in it, and neither telling anybody
 * how it differs from the pins scattered over the canvas.
 */
describe("the Chat and the comments say which they are", () => {
  const read = (file: string) =>
    readFileSync(new URL(`../src/components/${file}`, import.meta.url), "utf8");

  it("gives the button and the panel it opens the SAME word", () => {
    expect(read("CreateActions.tsx")).toMatch(/shelf-glyph">✳<\/span> Chat/);
    expect(read("MainThreadPanel.tsx")).toContain("<b>Chat</b>");
    // The old pair, gone from both: a label naming the slot taught nobody
    // what the panel was for.
    expect(read("CreateActions.tsx")).not.toMatch(/<\/span> Main\b/);
    expect(read("MainThreadPanel.tsx")).not.toContain("<b>Main thread</b>");
  });

  it("says what the promotion does to the Chat that is already there", () => {
    // `thread.setMain` demotes the current one — a canvas has a single slot,
    // so promoting is also a demotion, and the button that hides that is
    // the button somebody loses a conversation to.
    const layer = read("CommentLayer.tsx");
    expect(layer).toContain("Make this the Chat");
    expect(layer).toMatch(/goes back to being a pin/);
    expect(layer).not.toContain("Make main");
  });

  it("tells you where the Chat went, and how to bring it back", () => {
    /**
     * The other half of the test above, which was written about the PROMOTE
     * side and said the quiet part out loud: "the button that hides that is
     * the button somebody loses a conversation to." The demote side is that
     * button, and it went unguarded.
     *
     * Pressed by mistake on a canvas with 36 messages in it. Nothing was lost
     * — `thread.setMain` has an inverse and `roundtrip.test.ts` proves the
     * demote case round-trips — but the panel emptied in silence, so it read
     * as the whole conversation being gone. Reversible and SEEN to be
     * reversible are different properties, and only the first had a test.
     *
     * Not a confirm dialog: that taxes every deliberate press to catch the
     * rare accident, and it still would not say the conversation survived.
     */
    const panel = read("MainThreadPanel.tsx");
    expect(panel, "the detach must say something, not empty the panel in silence").toMatch(
      /flashNotice\(/,
    );
    expect(panel, "and it must say the conversation is still there").toMatch(
      /pin on the canvas now/,
    );
    // The keystroke comes from `SHORTCUTS` via `keyFor`, never a literal: a
    // notice that promises a key the app does not listen for is worse than
    // one that promises nothing.
    expect(panel).toMatch(/keyFor\("Undo and redo"\)/);
    // The glyph itself, not a quoted-string pattern. The first version of
    // this looked for `"⌘Z` and passed while the literal sat mid-sentence in
    // a template string — the modifier key is banned from this handler
    // outright, so there is no spelling of it that slips through.
    const handler = panel.slice(panel.indexOf("main-detach"), panel.indexOf("main-close"));
    expect(handler, "spell the undo key once, in the registry").not.toContain("⌘");
  });

  it("names the thing a pin holds a comment, on the button that deletes one", () => {
    expect(read("CommentLayer.tsx")).toContain("Delete comment");
  });

  it("keeps the CLI and the guide on the same word as the app", () => {
    // The op stays `thread.setMain` — the wire is the machine's vocabulary
    // and renaming it would break every installed CLI. What must agree is
    // what a PERSON is told, on both surfaces.
    const guide = readFileSync(
      new URL("../../cli/src/agent-guide.md", import.meta.url),
      "utf8",
    );
    expect(guide).toContain("## The Chat");
    expect(guide, "an agent reading this must know both names for one thing").toMatch(
      /calls it the Chat.*thread flagged `main`/s,
    );
  });
});

/**
 * **The editor wears the app's clothes.** CodeMirror shipped stock — its own
 * greys, its own blue, its own gutter — and read as a component sitting in
 * the product rather than part of it.
 */
describe("the editor's theme", () => {
  const cm = readFileSync(new URL("../src/lib/cmtheme.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  it("colours syntax from tokens, never from literals", () => {
    // A hex here would be a colour that cannot follow the theme, in the one
    // file the stylesheet's own guards do not watch.
    expect(cm).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(cm).toMatch(/var\(--syn-/);
  });

  it("keeps syntax off the SEMANTIC tokens", () => {
    // `--good` for a string and `--danger` for a tag would read right and
    // mean wrong: those say "this went well" and "this is a problem"
    // everywhere else in the product, and a tag name is neither. `--danger`
    // appears exactly once, on `invalid`, which IS a problem.
    expect(cm).not.toContain("var(--good)");
    expect(cm).not.toContain("var(--running)");
    expect((cm.match(/var\(--danger\)/g) ?? []).length).toBe(1);
    expect(cm).toMatch(/t\.invalid\][^}]*var\(--danger\)/);
  });

  it("defines every syntax token in BOTH themes", () => {
    // A token defined once is a colour that is right on one ground and
    // whatever it happens to be on the other.
    const used = [...cm.matchAll(/var\((--syn-[a-z]+)\)/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(5);
    for (const token of new Set(used)) {
      const declared = (css.match(new RegExp(`${token}:`, "g")) ?? []).length;
      expect(declared, `${token} is not declared twice (light and dark)`).toBe(2);
    }
  });

  it("scopes the chrome to the stage's editor, not to every CodeMirror", () => {
    // A bare `.cm-editor` rule would reach into any other editor this app
    // mounts later.
    const bare = [...css.matchAll(/^\.cm-[\w-]+/gm)];
    expect(bare, "a .cm- rule outside .stage-editor-cm").toEqual([]);
    expect(css).toMatch(/\.stage-editor-cm \.cm-editor\s*\{/);
  });
});
