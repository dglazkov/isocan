import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Actor, Attestation, AttestOffer } from "@isocan/core";
import { ATTEST_ROUTE } from "@isocan/core";
import { IdentityDialog } from "../src/components/IdentityDialog.tsx";
import { attesterOffer } from "../src/lib/signin.ts";

/**
 * **The door starts the proof** (multi-identity phase 2).
 *
 * The door reads the home's offer and renders one of five states beneath the
 * name form, keyed on `canVerifyEmail(offer)` and on whether this badge holds
 * an attestation — never on the sign-in landing and never on message text:
 *
 * - A: the quiet line, when the home can verify an email and nothing is proved.
 * - B and C are reached by clicking and sending, which `renderToStaticMarkup`
 *   cannot do; their copy is asserted where it is reachable (the door's source
 *   is the record) and they are walked in the phase's proof.
 * - D: proved and somebody to be — rows, and no line.
 * - D′: proved and nobody to be — the words, with the address, and the gesture
 *   on the other machine.
 *
 * And the gate (journey 4): on a home with no attester the markup is
 * byte-for-byte the door before this phase.
 *
 * Rendered with `renderToStaticMarkup`, like `resumable.test.ts`: effects do
 * not run there, so the door's first render is what is asserted, and the hook
 * answers that render from the offer that already resolved.
 */

const dimitri: Actor = { id: "usr_dimitri", name: "Dimitri" };
const AUTH = { project: "acme-home", apiKey: "browser-key" };
const PROVED: Attestation = {
  attribute: "email:dimitri@example.com",
  verifiedVia: "email",
  at: "2026-09-01T00:00:00.000Z",
};

let storage: Map<string, string>;

/** The globals the door's module graph reads — see `resumable.test.ts`. */
function stubBrowserGlobals(known: Actor[] = []): void {
  storage = new Map<string, string>();
  if (known.length > 0) storage.set("isocan.identities", JSON.stringify(known));
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

const realFetch = globalThis.fetch;

/** A home that answers `GET /api/attest` with exactly this offer. */
function homeOffering(offer: AttestOffer): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === ATTEST_ROUTE && method === "GET") {
      return new Response(JSON.stringify(offer), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  }) as typeof fetch;
}

/** A home that cannot be reached at all. */
function homeUnreachable(): void {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
}

const offerWith = (
  parts: Partial<Pick<AttestOffer, "auth" | "attestations" | "resumable" | "attesters">> = {},
): AttestOffer => ({
  attesters: parts.attesters ?? (parts.auth === null ? [] : ["email"]),
  auth: parts.auth === undefined ? AUTH : parts.auth,
  attestations: parts.attestations ?? [],
  resumable: parts.resumable ?? [],
});

/** The door, drawn once. */
const door = () => renderToStaticMarkup(h(IdentityDialog, { onDone: () => {} }));

/** Rows the door drew, by the name each one carries. */
function rowsIn(html: string): string[] {
  return [...html.matchAll(/class="identity-known-row"[^>]*>.*?<\/span>([^<]*)<\/button>/g)].map(
    (m) => m[1]!,
  );
}

const LINE = "Already isocan on another machine?";
const NOBODY = "Nobody else here has proved it, so there is nobody to pick up.";

beforeEach(() => {
  stubBrowserGlobals();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("the gate", () => {
  it("is byte-for-byte today's door wherever the home cannot verify an email", async () => {
    // First in the file on purpose: nothing has asked the home yet, so this
    // render is the door with no offer at all — the door before this phase.
    const before = door();
    expect(before).not.toContain(LINE);
    expect(before).not.toContain("identity-prove");

    // A home with an attester draws the line, which is the control this test
    // is about to show every other home leaves out.
    homeOffering(offerWith());
    await attesterOffer(true);
    expect(door()).toContain(LINE);

    // No attester — every local daemon — even when the badge proved something
    // and the server still vouches (multi-identity phase 1's finding).
    homeOffering(offerWith({ auth: null, attestations: [PROVED], resumable: [dimitri] }));
    await attesterOffer(true);
    expect(door()).toBe(before);

    // An attester that is not an inbox: `canVerifyEmail` is the gate, not
    // `auth` alone.
    homeOffering(offerWith({ attesters: ["repo"] }));
    await attesterOffer(true);
    expect(door()).toBe(before);

    // A home that could not be asked, after one that could: the cache does
    // not keep an answer the home is no longer giving.
    homeUnreachable();
    await attesterOffer(true).catch(() => {});
    expect(door()).toBe(before);
  });
});

describe("the door's proof states", () => {
  it("A — draws the quiet line when the home can verify an email and nothing is proved", async () => {
    homeOffering(offerWith());
    await attesterOffer(true);
    const html = door();
    expect(html).toContain(LINE);
    expect(html).toMatch(/<button type="button" class="identity-prove-open">Prove your address<\/button>/);
    // The line sits beneath the name form, and the form is untouched.
    expect(html.indexOf('placeholder="Your name"')).toBeLessThan(html.indexOf(LINE));
    expect(html).toContain("<h2>Welcome to isocan</h2>");
    expect(html).not.toContain("is proved on this browser");
  });

  it("D′ — names the address and the gesture when proved and nobody is there to pick up", async () => {
    homeOffering(offerWith({ attestations: [PROVED], resumable: [] }));
    await attesterOffer(true);
    const html = door();
    expect(html).toContain(
      "<b>dimitri@example.com</b> is proved on this browser. " + NOBODY,
    );
    expect(html).toContain(
      "If you are already somebody on another machine, prove the same address there too — " +
        "identity menu → “Prove your address…” — then come back here.",
    );
    // The `email:` namespace is the badge's, not the person's.
    expect(html).not.toContain("email:dimitri");
    expect(html).not.toContain(LINE);
    expect(rowsIn(html)).toEqual([]);
    // Still a way in: the name form is live beneath the words.
    expect(html).toContain('placeholder="Your name"');
  });

  it("never draws the quiet line once the badge holds an attestation", async () => {
    for (const resumable of [[], [dimitri]]) {
      homeOffering(offerWith({ attestations: [PROVED], resumable }));
      await attesterOffer(true);
      expect(door()).not.toContain(LINE);
    }
  });

  it("D — rows and nothing else when proved and somebody is there to pick up", async () => {
    homeOffering(offerWith({ attestations: [PROVED], resumable: [dimitri] }));
    await attesterOffer(true);
    const html = door();
    expect(rowsIn(html)).toEqual(["Dimitri"]);
    expect(html).toContain("<h2>Who&#x27;s writing?</h2>");
    expect(html).not.toContain(LINE);
    expect(html).not.toContain(NOBODY);
    expect(html).not.toContain("identity-prove");
  });

  it("D′ — keys on resumable alone, so a name this browser once wore does not silence it", async () => {
    // The person has been somebody in this browser before, proved an address
    // here, and nobody else proved it. The row is a name, not a proved person,
    // so the words stay true beside it and the instructions still apply.
    stubBrowserGlobals([dimitri]);
    homeOffering(offerWith({ attestations: [PROVED], resumable: [] }));
    await attesterOffer(true);
    const html = door();
    expect(rowsIn(html)).toEqual(["Dimitri"]);
    expect(html).toContain(NOBODY);
  });
});
