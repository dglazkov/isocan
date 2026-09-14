import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withoutComments } from "../../../test/source.ts";

/**
 * **Two panels about the same person, one on top of the other.**
 *
 * The facepile peeks: hover a face and a card shows who they are and what they
 * have just done. Your own face does something else — it toggles the identity
 * menu, which opens in the same corner. Clicking it left the pointer on the
 * face that opened it, so the peek card kept drawing UNDER the menu, and the
 * menu's own rename field sat over somebody's "Recently" list.
 *
 * The fix is one condition, and the two behaviours a reader would ask about
 * both fall out of it rather than being rules of their own:
 *
 *   - close the menu by clicking the same face again and the card comes
 *     straight back, because `peek` was suppressed, never cleared, and the
 *     pointer never left;
 *   - close it by clicking anywhere else and nothing comes back, because the
 *     pointer left the pile on the way out and `onPointerLeave` cleared
 *     `peek` already.
 *
 * Read from the source because there is no DOM here. `withoutComments` rather
 * than the span regex, or the paragraph above would be the thing this file
 * asserts on — lessons #66.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string => withoutComments(readFileSync(path.join(here, rel), "utf8"));

describe("the peek card and the identity menu do not stack", () => {
  const presence = read("../src/components/Presence.tsx");

  it("reads the menu's open state at all", () => {
    expect(presence).toMatch(/useUiStore\(\(s\) => s\.identityOpen\)/);
  });

  it("gates the card on it, so only one of the two ever draws", () => {
    expect(presence).toMatch(/\{peeked && !identityOpen &&/);
  });

  it("suppresses rather than clears, so a second click puts the card back", () => {
    // `setPeek(null)` belongs to pointer-leave and nothing else. If opening
    // the menu ever starts clearing it, closing the menu would leave a blank
    // corner until the pointer moved, which is the bug wearing a hat.
    const clears = [...presence.matchAll(/setPeek\(null\)/g)].length;
    expect(clears, "setPeek(null) should only be pointer-leave's job").toBe(1);
    expect(presence).toMatch(/onPointerLeave=\{\(\) => setPeek\(null\)\}/);
  });
});

describe("the name field is not offered to a password manager", () => {
  const menu = read("../src/components/IdentityMenu.tsx");

  it("carries every vendor's opt-out, because each reads only its own", () => {
    // One focused text input beside a submit button is the shape they all
    // look for; 1Password parked its inline button over the name being typed.
    for (const attribute of ["data-1p-ignore", 'data-lpignore="true"', 'data-bwignore="true"']) {
      expect(menu, `the name field lost ${attribute}`).toContain(attribute);
    }
  });

  it("still says what the field is to everything that is not a filler", () => {
    // The opt-outs must not cost the accessible name.
    expect(menu).toContain('aria-label="Your name"');
  });
});
