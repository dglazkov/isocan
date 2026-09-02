import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Actor, AttestOffer } from "@isocan/core";
import { ATTEST_ROUTE } from "@isocan/core";
import { IdentityDialog, withResumable } from "../src/components/IdentityDialog.tsx";
import { attesterOffer, beginSignIn, onOfferInvalidated } from "../src/lib/signin.ts";

/**
 * **The offer reaches the door** (multi-identity phase 1).
 *
 * `GET /api/attest` has answered `resumable` — the actors this badge may
 * become because another badge that proved the same address holds them —
 * since the identity desk's phase 9, and until this phase no door rendered
 * it. Three things have to hold now that one does:
 *
 * 1. The door renders a resumable actor as a row, in the same list and the
 *    same style as the names this browser has worn, and an actor in both
 *    lists renders once. On a home with no attester the door is today's door.
 * 2. `signin.ts` tells its subscribers when it throws the cached offer away
 *    after a proof lands, and a subscriber that left is not told.
 * 3. While the door is showing (`actor === null`), the sign-in notice carries
 *    no "Be <name>" buttons — the rows are the door's. With an actor, the
 *    notice still offers the switch.
 *
 * Rendered with `renderToStaticMarkup`, like `frontdoor.test.ts`: effects do
 * not run there, so the door's first render is what is asserted — and the
 * hook answers that render from the offer that already resolved, which is the
 * same property that keeps a door mounted after the offer arrived from
 * painting an empty list first.
 */

const dimitri: Actor = { id: "usr_dimitri", name: "Dimitri" };
const kenny: Actor = { id: "usr_kenny", name: "Kenny" };

const AUTH = { project: "acme-home", apiKey: "browser-key" };
const PROVIDER = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink";

let storage: Map<string, string>;

/**
 * The globals `App.tsx`'s module graph reads at import time (see
 * `frontdoor.test.ts`), plus the roster the door reads on mount. The static
 * imports above are hoisted and load the canvas store while `window` is still
 * undefined, which is the state its module-load listeners check for; `App.tsx`
 * is imported after this stub, as `frontdoor.test.ts` does.
 */
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
const { SignInNotice } = await import("../src/App.tsx");

const realFetch = globalThis.fetch;
/** Every request the tab made, as `METHOD url`. */
let seen: string[];

/**
 * A home and a provider in one function. The home answers the offer it is
 * given and writes one attestation; the provider exchanges any code for a
 * token. Nothing here is a real network.
 */
function fakeHome(offer: AttestOffer, resumable: Actor[] = offer.resumable): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    seen.push(`${method} ${url.startsWith(PROVIDER) ? "provider" : url}`);
    const reply = (payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url === ATTEST_ROUTE && method === "GET") return reply(offer);
    if (url.startsWith(PROVIDER)) return reply({ idToken: "a-token" });
    if (url === ATTEST_ROUTE && method === "POST") {
      return reply({
        attestation: { attribute: "email:kenny@example.com", verifiedVia: "email", at: "2026-09-01" },
        resumable,
      });
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  }) as typeof fetch;
}

const offerWith = (resumable: Actor[], auth: AttestOffer["auth"] = AUTH): AttestOffer => ({
  attesters: auth ? ["email"] : [],
  auth,
  attestations: [],
  resumable,
});

/** Rows the door drew, by the name each one carries. */
function rowsIn(html: string): string[] {
  return [...html.matchAll(/class="identity-known-row"[^>]*>.*?<\/span>([^<]*)<\/button>/g)].map(
    (m) => m[1]!,
  );
}

beforeEach(() => {
  seen = [];
  stubBrowserGlobals();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as { location?: unknown }).location;
  delete (globalThis as { history?: unknown }).history;
});

describe("the door's rows", () => {
  it("renders a resumable actor as a row, in the known-identity style", async () => {
    fakeHome(offerWith([dimitri]));
    await attesterOffer(true);
    const html = renderToStaticMarkup(h(IdentityDialog, { onDone: () => {} }));
    expect(rowsIn(html)).toEqual(["Dimitri"]);
    // The header and the placeholder key on the merged list, not on the
    // roster alone: a browser that may be somebody is asked who is writing.
    expect(html).toContain("<h2>Who&#x27;s writing?</h2>");
    expect(html).toContain('placeholder="Or a different name"');
  });

  it("renders an actor that is both known and resumable once", async () => {
    stubBrowserGlobals([dimitri]);
    fakeHome(offerWith([dimitri, kenny]));
    await attesterOffer(true);
    const html = renderToStaticMarkup(h(IdentityDialog, { onDone: () => {} }));
    expect(rowsIn(html)).toEqual(["Dimitri", "Kenny"]);
  });

  it("puts the names this browser has worn first", () => {
    expect(withResumable([kenny], [dimitri, kenny])).toEqual([kenny, dimitri]);
    expect(withResumable([], [])).toEqual([]);
  });

  it("is today's door on a home with no attester", async () => {
    // A home that has borrowed nothing shows none of this, whatever the
    // answer carries (journey 4). `resumable` is non-empty here on purpose.
    fakeHome(offerWith([dimitri], null));
    await attesterOffer(true);
    const html = renderToStaticMarkup(h(IdentityDialog, { onDone: () => {} }));
    expect(rowsIn(html)).toEqual([]);
    expect(html).toContain("Welcome to isocan");
    expect(html).toContain('placeholder="Your name"');
  });
});

describe("the offer cache", () => {
  /** A tab that came back from the inbox with a code in its address bar. */
  function arriveWithCode(): void {
    storage.set("isocan.signin.email", "kenny@example.com");
    (globalThis as { location?: unknown }).location = {
      search: "?mode=signIn&oobCode=code-1",
      pathname: "/",
      href: "http://home.test/?mode=signIn&oobCode=code-1",
    };
    (globalThis as { history?: unknown }).history = { replaceState() {} };
  }

  it("tells its subscribers when a proof invalidates it, and re-asks on the next read", async () => {
    fakeHome(offerWith([]), [dimitri]);
    await attesterOffer(true);
    let told = 0;
    const stop = onOfferInvalidated(() => told++);

    arriveWithCode();
    const landing = await beginSignIn();
    expect(landing).toEqual({ proved: "email:kenny@example.com", via: "email", resumable: [dimitri] });
    expect(told).toBe(1);

    // The cache was dropped: the next reader goes back to the home.
    const asks = () => seen.filter((r) => r === `GET ${ATTEST_ROUTE}`).length;
    const before = asks();
    await attesterOffer();
    expect(asks()).toBe(before + 1);
    stop();
  });

  it("stops telling a subscriber that left", async () => {
    fakeHome(offerWith([]), [dimitri]);
    let told = 0;
    const stop = onOfferInvalidated(() => told++);
    stop();

    arriveWithCode();
    await beginSignIn();
    expect(told).toBe(0);
  });

  it("holds more than one subscriber at a time", async () => {
    // The door is mounted from three places; a second mount must not knock
    // the first off the list, which is why this is not `onReBadge`'s shape.
    fakeHome(offerWith([]), [dimitri]);
    const told: string[] = [];
    const stopA = onOfferInvalidated(() => told.push("a"));
    const stopB = onOfferInvalidated(() => told.push("b"));

    arriveWithCode();
    await beginSignIn();
    expect(told.sort()).toEqual(["a", "b"]);
    stopA();
    stopB();
  });
});

describe("the sign-in notice", () => {
  const landing = { proved: "email:kenny@example.com", via: "email", resumable: [dimitri] };
  const drawn = (actor: Actor | null) =>
    renderToStaticMarkup(
      h(SignInNotice, { landing, actor, onIdentity: () => {}, onDismiss: () => {} }),
    );

  it("carries no buttons while the door is showing — the rows are the door's", () => {
    const html = drawn(null);
    expect(html).toContain("kenny@example.com is proved on this browser");
    expect(html).not.toContain("Be Dimitri");
    // The one button left is the dismiss.
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Dismiss"');
  });

  it("still offers the switch to somebody who is already someone", () => {
    const html = drawn(kenny);
    expect(html).toContain("Be Dimitri");
    expect(html).toContain("Another surface that proved the same address answers to:");
  });

  it("never offers the person you already are", () => {
    // The door's claim can land while the notice is still up (multi-identity
    // phase 2 walk): a "Be Dimitri" button over Dimitri's own canvas does
    // nothing, so the current actor is left out of the offer.
    const html = drawn(dimitri);
    expect(html).not.toContain("Be Dimitri");
    expect(html.match(/<button/g)).toHaveLength(1);
  });
});
