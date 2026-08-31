import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DOOR_ROUTE } from "@isocan/core";
import { homeAnswered, onReBadge, readBlob, readBlobText, sendOp } from "../src/lib/api.ts";
import { enterAs, reclaimIdentity } from "../src/lib/identity.ts";

/**
 * The tab's half of the recovery landmine.
 *
 * Delete a live browser's badge and act on the canvas: the door mints a fresh
 * badge whose claims are EMPTY, while the tab happily goes on asserting the
 * persona it has held all along. Harmless while nothing enforced; the moment
 * mechanism 5's membership check landed, the first action after any badge
 * recovery would be refused with `not-your-actor` — once, and for good, since
 * nothing would ever put the claim back.
 *
 * So the door's retry re-claims BEFORE it replays. What that has to be true
 * of is ORDER, which is what this asserts: the fake home records every
 * request, and the claim has to sit between the door and the replay.
 *
 * (The end-to-end version of this is driven in Chrome against a real daemon —
 * a browser's badge is a cookie, and node's `fetch` has no cookie jar.)
 */

/** Who this browser is, as far as localStorage is concerned. */
function stubStorage(persona?: { id: string; name: string; key: string }): void {
  const map = new Map<string, string>();
  if (persona) {
    map.set("isocan.identity", JSON.stringify(persona));
    map.set("isocan.identities", JSON.stringify([persona]));
  }
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const persona = { id: "usr_kenny", name: "Kenny", key: "web:tab-1" };
const realFetch = globalThis.fetch;

/** Every request the tab made, in order, as `METHOD url[ op]`. */
let seen: string[];
/** Flipped by the door: before it, the badge is dead. */
let badged: boolean;

/**
 * A home in a function. It refuses like the real one — 401 for a badge it
 * does not know, `not-your-actor` for an actor its badge does not claim —
 * which is all this test needs to see the order.
 */
function fakeHome(): void {
  const claims = new Set<string>();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as any) : null;
    seen.push(`${init?.method ?? "GET"} ${url}${body?.op ? ` ${body.op.type}` : ""}`);
    const reply = (status: number, payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url === DOOR_ROUTE) {
      badged = true;
      claims.clear(); // a fresh badge holds no claims — the whole landmine
      return reply(200, { badgeId: "bdg_new" });
    }
    if (!badged) return reply(401, { code: "no-badge", error: "a badge is required" });
    if (body?.op?.type === "actor.claim") {
      claims.add(body.op.as ?? persona.id);
      return reply(200, { seq: 1, envelope: { actor: { id: persona.id, name: persona.name } } });
    }
    if (body?.actor && !claims.has(body.actor.id)) {
      return reply(400, { code: "not-your-actor", error: "this badge does not speak for them" });
    }
    return reply(200, { seq: 2, envelope: {} });
  }) as typeof fetch;
}

beforeEach(() => {
  seen = [];
  badged = false;
  stubStorage(persona);
  onReBadge(reclaimIdentity);
  fakeHome();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("a tab whose badge was deleted", () => {
  it("goes to the door, claims, and only then replays", async () => {
    await sendOp("prj_1", { id: persona.id, name: persona.name }, {
      type: "item.move",
      itemId: "itm_1",
      x: 1,
      y: 1,
    });

    expect(seen).toEqual([
      "POST /api/ops item.move", // refused: no badge
      `POST ${DOOR_ROUTE}`, // a new badge, holding nothing
      "POST /api/ops actor.claim", // ← the fix: claim BEFORE replaying
      "POST /api/ops item.move", // and now it lands
    ]);
  });

  it("re-claims on `not-your-actor` too — a badge can outlive its claim", async () => {
    // The other half: the cookie is fine and the CLAIM is gone (a wiped
    // home, phase 9's kill-a-badge). There is nothing for the door to fix,
    // so the tab claims and comes straight back.
    badged = true;
    await sendOp("prj_1", { id: persona.id, name: persona.name }, {
      type: "item.move",
      itemId: "itm_1",
      x: 1,
      y: 1,
    });
    expect(seen).toEqual([
      "POST /api/ops item.move",
      "POST /api/ops actor.claim",
      "POST /api/ops item.move",
    ]);
  });

  it("recovers exactly once, and never loops", async () => {
    // The claim's own request can be refused too. One recovery per request
    // is the rule; a second refusal is the caller's to hear.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ code: "not-your-actor", error: "no" }), { status: 400 });
    }) as typeof fetch;
    await expect(
      sendOp("prj_1", { id: persona.id, name: persona.name }, {
        type: "item.move",
        itemId: "itm_1",
        x: 1,
        y: 1,
      }),
    ).rejects.toThrow(/no/);
    // The op, the claim that failed, and nothing else.
    expect(seen).toHaveLength(2);
  });

  it("has nothing to re-claim for a browser that never entered a name", async () => {
    stubStorage();
    await sendOp("prj_1", { id: persona.id, name: persona.name }, {
      type: "item.move",
      itemId: "itm_1",
      x: 1,
      y: 1,
    }).catch(() => {});
    // Door, replay, no claim: there is no persona to lose, and the identity
    // dialog is the next thing this browser sees.
    expect(seen.filter((r) => r.includes("actor.claim"))).toEqual([]);
  });

  it("enters under a name on a home that has never seen this browser", async () => {
    // The ordinary path is untouched by any of the above.
    stubStorage();
    badged = true;
    const me = await enterAs("Kenny");
    expect(me).toEqual({ id: persona.id, name: persona.name });
  });
});

/**
 * **The same landmine, on the reads that carry BYTES.**
 *
 * `request` grew the recovery above and seven calls never got it, because
 * they wanted a file rather than json and so wrote the fetch by hand:
 * `fetch(blobUrl(...))`. The route was still spelled once in the api lib, so
 * the door guard passed — and every one of those calls read a 401 as the
 * file. An empty composer over words that still exist. An editor opened on
 * `{"error":"..."}`, one ⌘S from saving that over the file. A cross-canvas
 * paste that pasted nothing and said nothing.
 *
 * A cleared cookie is the ordinary way in: nothing about it says the file is
 * gone, and the recovery costs one knock. What this pins is that the bytes
 * that come back are the FILE's — and that when the home is still refusing
 * after the knock, the caller is told so rather than handed emptiness.
 */
describe("a blob read whose badge was deleted", () => {
  const BLOB = "/api/projects/prj_1/blobs/blb_abc";

  /** A home that hands over bytes, and only to a badge it knows. */
  function fakeBlobHome(bytes = "the file's own words"): void {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      seen.push(`${init?.method ?? "GET"} ${url}`);
      if (url === DOOR_ROUTE) {
        badged = true;
        return new Response(JSON.stringify({ badgeId: "bdg_new" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (!badged) {
        return new Response(JSON.stringify({ code: "no-badge", error: "a badge is required" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      });
    }) as typeof fetch;
  }

  it("knocks on the door and comes back with the file, not the refusal", async () => {
    fakeBlobHome();
    await expect(readBlobText("prj_1", "blb_abc")).resolves.toBe("the file's own words");
    // The same order the ops path keeps, for the same reason: the door hands
    // out a badge holding no claims, so the persona is re-claimed before the
    // read is replayed.
    expect(seen).toEqual([
      `GET ${BLOB}`, // refused: no badge
      `POST ${DOOR_ROUTE}`,
      "POST /api/ops", // the re-claim
      `GET ${BLOB}`, // and now the bytes
    ]);
  });

  it("hands over bytes the same way", async () => {
    fakeBlobHome("bytes");
    const blob = await readBlob("prj_1", "blb_abc");
    expect(await blob.text()).toBe("bytes");
  });

  it("refuses out loud when the knock did not help — never with the file's bytes", async () => {
    /* The half that made every caller wrong. A read that cannot recover has
       to REFUSE: an empty string here is what an editor opens on, what a copy
       copies, and what a text item renders as blank. And the refusal has to
       be the home's own, so `homeAnswered` can tell "it said no" from "it
       never answered". */
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ code: "no-blob", error: "blob not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const err = await readBlobText("prj_1", "blb_gone").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(homeAnswered(err)).toBe(true);
    expect((err as Error).message).toBe("blob not found");
  });

  it("knocks exactly once, and never loops", async () => {
    // A door that mints a badge the home still will not take is the shape a
    // retry loop is made of — one knock per read, then the refusal is the
    // caller's to hear.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      seen.push(`${init?.method ?? "GET"} ${url}`);
      if (url === DOOR_ROUTE) {
        return new Response(JSON.stringify({ badgeId: "bdg_new" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ code: "no-badge", error: "a badge is required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    await expect(readBlobText("prj_1", "blb_abc")).rejects.toThrow(/a badge is required/);
    // Twice: the read, and the one replay. A third would be a loop.
    expect(seen.filter((r) => r === `GET ${BLOB}`)).toHaveLength(2);
  });
});
