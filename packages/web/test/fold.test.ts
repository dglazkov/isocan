import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Actor } from "@isocan/core";
// Loaded here, hoisted, while `window` is still undefined — see
// `firstmachine.test.ts` for why the store must be imported first.
import "../src/stores/canvasStore.ts";

/**
 * **Fold into <name>** on the identity menu's roster (multi-identity phase 5,
 * journey 6 step 5).
 *
 * The control is drawn only for a persona THIS BADGE also claims, because the
 * home refuses `actor.join` otherwise, and a control that offers an act it
 * will not perform is the Rename button's lesson over again. The answer comes
 * from the desk (`GET /api/badges`, the row marked `self`), which a static
 * render cannot ask, so the cache is primed the way `resumable.test.ts` primes
 * the offer. Clicking, arming and sending are walked in the phase's proof.
 */

const kenny: Actor = { id: "usr_kenny", name: "Kenny" };
const morgan: Actor = { id: "usr_morgan", name: "Morgan" };
const robin: Actor = { id: "usr_robin", name: "Robin" };

function stubBrowserGlobals(roster: Actor[]): void {
  const storage = new Map<string, string>();
  storage.set("isocan.identities", JSON.stringify(roster));
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
    clear: () => storage.clear(),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size;
    },
  };
  (globalThis as { window?: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
}

stubBrowserGlobals([kenny, morgan, robin]);
const { IdentityMenu } = await import("../src/components/IdentityMenu.tsx");
const { primeOwnActors, invalidateOwnActors } = await import("../src/lib/ownactors.ts");

const menu = () =>
  renderToStaticMarkup(
    h(IdentityMenu, { actor: kenny, canvasId: null, onIdentity: () => {}, onClose: () => {} }),
  );

describe("the roster's fold control", () => {
  it("is offered only for a persona this badge also claims", () => {
    primeOwnActors([kenny.id, morgan.id]);
    const html = menu();
    // Morgan: claimed by this badge, so the row offers the fold.
    expect(html).toContain("Fold into Kenny");
    expect(html.match(/Fold into Kenny/g)).toHaveLength(1);
    // Robin: remembered by this browser, not claimed by this badge — the row
    // is still there to switch to, and offers nothing else.
    expect(html).toContain("Robin");
    const robinRow = html.slice(html.indexOf("Robin"));
    expect(robinRow).not.toContain("Fold into");
    // The offer is one click, and the sentence that says it cannot be undone
    // waits for that click.
    expect(html).not.toContain("cannot be undone");
  });

  it("is offered for nobody while the desk has not answered", () => {
    invalidateOwnActors();
    const html = menu();
    expect(html).not.toContain("Fold into");
    expect(html).toContain("Morgan"); // switching is unaffected
  });

  it("is offered for nobody when the badge claims only the active persona", () => {
    primeOwnActors([kenny.id]);
    expect(menu()).not.toContain("Fold into");
  });
});
