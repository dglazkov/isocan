import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Actor, Attestation, AttestOffer } from "@isocan/core";
// Loaded here, hoisted, while `window` is still undefined: the canvas store
// registers its window listeners at module load only when there is a window,
// and the stub below has none to offer. `resumable.test.ts` gets the same
// ordering from its static import of the door.
import "../src/stores/canvasStore.ts";
import { VerifyPanel } from "../src/components/VerifyDialog.tsx";

/**
 * **The words on the first machine** (multi-identity phase 4).
 *
 * Resumption on a second machine only works if the first machine proved the
 * address at some earlier time, and nothing ever asks it to. The phase pays
 * that precondition in copy, not mechanism, and these are the words:
 *
 * 1. The "Prove your address" panel leads with resumption — proving here is
 *    what lets your other machines be you — and mentions invitations second.
 *    "isocan has no accounts, so this is not a login" stays, and the words
 *    "sign in" stay off the panel (the panel's header says why).
 * 2. The identity menu's entry carries its reason as visible words, not only
 *    in the hover title a person hunting for it is not guaranteed to meet.
 * 3. A badge that proved an address nobody else on this home proved reads the
 *    door's D′ words in the panel — nobody to pick up; prove the same address
 *    on the other machine, identity menu → "Prove your address…"; come back —
 *    so the two places tell one story (journey 3 step 2, journey 6's last
 *    criterion).
 *
 * `VerifyDialog` asks the desk in an effect, which `renderToStaticMarkup`
 * never runs, so the panel body is `VerifyPanel`, drawn from the offer it is
 * handed; one assertion here holds that `VerifyDialog` renders it. The
 * identity menu's module graph reads `window.matchMedia` at import time (the
 * theme store), so the menu is imported after the globals are stubbed, as
 * `resumable.test.ts` does for `App.tsx`.
 */

const kenny: Actor = { id: "usr_kenny", name: "Kenny" };
const morgan: Actor = { id: "usr_morgan", name: "Morgan" };
const AUTH = { project: "acme-home", apiKey: "browser-key" };
const PROVED: Attestation = {
  attribute: "email:kenny@example.com",
  verifiedVia: "email",
  at: "2026-09-01T00:00:00.000Z",
};

function stubBrowserGlobals(): void {
  const storage = new Map<string, string>();
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

stubBrowserGlobals();
const { IdentityMenu } = await import("../src/components/IdentityMenu.tsx");

const offerWith = (parts: Partial<Pick<AttestOffer, "attestations" | "resumable">> = {}): AttestOffer => ({
  attesters: ["email"],
  auth: AUTH,
  attestations: parts.attestations ?? [],
  resumable: parts.resumable ?? [],
});

/** The panel, drawn once from an offer the desk already answered. */
const panel = (offer: AttestOffer) =>
  renderToStaticMarkup(
    h(VerifyPanel, { offer, askError: null, actor: kenny, onIdentity: () => {}, onClose: () => {} }),
  );

const source = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const RESUMPTION = "Proving an address here is what lets your other machines be you";
const INVITATION = "It also lets somebody invite <b>you</b> by email";
const NO_ACCOUNTS = "isocan has no accounts, so this is not a login";
const NOBODY = "and it lets you pick up nobody new here.";
const GESTURE =
  "If you are already somebody on another machine, prove the same address there too — " +
  "identity menu → “Prove your address…” — then come back here.";

describe("the panel leads with resumption", () => {
  it("says proving here lets your other machines be you, before it mentions invitations", () => {
    const html = panel(offerWith());
    expect(html).toContain(RESUMPTION);
    expect(html).toContain(INVITATION);
    expect(html.indexOf(RESUMPTION)).toBeLessThan(html.indexOf(INVITATION));
    expect(html).toContain(NO_ACCOUNTS);
  });

  it("never says sign in, in any state", () => {
    for (const offer of [
      offerWith(),
      offerWith({ attestations: [PROVED] }),
      offerWith({ attestations: [PROVED], resumable: [morgan] }),
    ]) {
      expect(panel(offer)).not.toMatch(/sign[ -]?in/i);
    }
  });

  it("is what VerifyDialog draws", () => {
    const dialog = source("../src/components/VerifyDialog.tsx");
    expect(dialog).toMatch(/export function VerifyDialog[\s\S]*<VerifyPanel/);
    // The desk is still asked afresh each time the panel opens.
    expect(dialog).toContain("attesterOffer(true)");
  });
});

describe("the panel's empty case", () => {
  it("reads the door's D′ words when proved and nobody is there to pick up", () => {
    const html = panel(offerWith({ attestations: [PROVED] }));
    expect(html).toContain("<b>kenny@example.com</b> is proved on this browser, " + NOBODY);
    expect(html).toContain(GESTURE);
    expect(html).not.toContain("You are also");
    // The same sentences the door renders in D′, so the two tell one story.
    const door = source("../src/components/IdentityDialog.tsx");
    expect(door).toContain("is proved on this browser, and it lets you pick up nobody new here.");
    expect(door).toContain("identity menu → “Prove your address…” — then come back here.");
  });

  it("gives way to the rows when somebody is there to pick up", () => {
    const html = panel(offerWith({ attestations: [PROVED], resumable: [morgan] }));
    expect(html).toContain("You are also");
    expect(html).toContain("<b>Morgan</b>");
    expect(html).not.toContain(NOBODY);
    expect(html).not.toContain(GESTURE);
  });

  it("says nothing about picking up before anything is proved", () => {
    const html = panel(offerWith());
    expect(html).not.toContain(NOBODY);
    expect(html).not.toContain("You are also");
  });
});

describe("the identity menu's entry", () => {
  it("carries its reason as words on the menu, not only in the tooltip", () => {
    const html = renderToStaticMarkup(
      h(IdentityMenu, { actor: kenny, canvasId: null, onIdentity: () => {}, onClose: () => {} }),
    );
    expect(html).toContain("Prove your address…");
    const REASON = "So your other machines can be you, and so somebody can invite you by email.";
    // With every title attribute removed, the reason is still on the page.
    const visible = html.replace(/ title="[^"]*"/g, "");
    expect(visible).toContain(`>${REASON}<`);
    // And it sits under the entry it explains.
    expect(visible.indexOf("Prove your address…")).toBeLessThan(visible.indexOf(REASON));
    expect(html).toMatch(
      /<div class="identity-prove-entry"><button [^>]*>Prove your address…<\/button><div class="share-link-note">/,
    );
  });
});
