import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { grantRoute, grantsRoute, LINK } from "@isocan/core";
import { ApiError, createGrant, listGrants, revokeGrant } from "../src/lib/api.ts";

/**
 * **The Share dialog's three calls, as they go out on the wire.**
 *
 * The dialog itself is a browser thing — the toggle, the copy button, the
 * roster — and the conductor drives it in Chrome. What is worth asserting
 * without one is the part that would fail silently: that the button and the
 * `isocan share` verb really do hit the SAME three routes, built by the same
 * core helpers, with the same subject spelling. A dialog that hand-rolled
 * `/api/projects/x/grant` (singular) would look perfect and 404 forever.
 *
 * And one pinned regression: **the revoke sends no body and no content-type.**
 * A `DELETE` that declares `application/json` with nothing in it is a Fastify
 * parse error — it used to surface as a 500 `internal error`, which is a lie
 * debugged from the wrong end. `http.ts` now answers it with the 400 it always
 * was, but the request with nothing to say should not announce a content type
 * in the first place, and that is what this holds still.
 */

const realFetch = globalThis.fetch;

interface Seen {
  method: string;
  url: string;
  headers: HeadersInit | undefined;
  body: string | undefined;
}

let seen: Seen[];
/** What the next call gets back: [status, json]. */
let answer: [number, unknown];

beforeEach(() => {
  seen = [];
  answer = [200, { grants: [] }];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      method: init?.method ?? "GET",
      url: String(input),
      headers: init?.headers,
      body: init?.body === undefined ? undefined : String(init.body),
    });
    const [status, json] = answer;
    return new Response(JSON.stringify(json), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("the Share dialog's endpoint", () => {
  it("reads the roster of grants from core's route, not a hand-rolled one", async () => {
    answer = [200, { grants: [{ id: "gnt_1", subject: LINK }] }];
    const { grants } = await listGrants("prj_acme");

    expect(seen).toEqual([
      { method: "GET", url: grantsRoute("prj_acme"), headers: undefined, body: undefined },
    ]);
    expect(grants[0]!.subject).toBe(LINK);
  });

  it("grants the link with the subject spelling the daemon checks", async () => {
    answer = [200, { grant: { id: "gnt_2", subject: LINK } }];
    await createGrant("prj_acme", LINK);

    expect(seen[0]!.method).toBe("POST");
    expect(seen[0]!.url).toBe(grantsRoute("prj_acme"));
    // `"link"`, from core's constant — never a literal the dialog invented.
    expect(JSON.parse(seen[0]!.body!)).toEqual({ subject: "link" });
  });

  it("revokes with NO body and NO content-type (pinned)", async () => {
    answer = [200, { grant: { id: "gnt_1", subject: LINK, revokedAt: "now" } }];
    await revokeGrant("prj_acme", "gnt_1");

    expect(seen[0]!.method).toBe("DELETE");
    expect(seen[0]!.url).toBe(grantRoute("prj_acme", "gnt_1"));
    expect(seen[0]!.body).toBeUndefined();
    expect(seen[0]!.headers).toBeUndefined();
  });

  it("surfaces the home's refusal of a phase-9 subject, code and all", async () => {
    // The honest half of the deferral: the dialog has no "who" field, and the
    // API's refusal is what a caller sees if anything reaches for one anyway.
    answer = [400, { error: "email:jordan@example.com needs an attester…", code: "bad-grant" }];
    const refused = await createGrant("prj_acme", "email:jordan@example.com").catch(
      (err: unknown) => err,
    );

    expect(refused).toBeInstanceOf(ApiError);
    expect((refused as ApiError).status).toBe(400);
    expect((refused as ApiError).code).toBe("bad-grant");
  });

  it("surfaces `not-admitted` as itself, so a dialog can say 'ask for the link'", async () => {
    answer = [403, { error: "this badge is not admitted to prj_acme", code: "not-admitted" }];
    const refused = (await listGrants("prj_acme").catch((err: unknown) => err)) as ApiError;

    expect(refused).toBeInstanceOf(ApiError);
    expect(refused.status).toBe(403);
    expect(refused.code).toBe("not-admitted");
    // And it did NOT go back to the door: a 403 is a good badge in the wrong
    // room, and re-badging would mint credentials forever to be refused the
    // same way. Exactly one request went out.
    expect(seen).toHaveLength(1);
  });
});

/**
 * **The roster in this dialog had its own fold, and the fold invented an
 * occupant.**
 *
 * It walked `sessions` and pushed every one as live, spelling the kind
 * `session.kind === "cli" ? "terminal" : "here"` — so a parked `rc`, a process
 * fact that renders nowhere else in the app (no cursor, no face, no roster
 * row), arrived in the one dialog you open to see who you are sharing with,
 * labelled as a person who is here.
 *
 * Source-scanned rather than rendered, because the failure is structural: it
 * is not that the words came out wrong, it is that a fourth derivation of "who
 * is on this canvas" existed at all.
 */
describe("the share roster reads the same fold as everything else", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../src/components/ShareDialog.tsx", import.meta.url)),
    "utf8",
  );

  it("asks core, and asks who is answering", () => {
    expect(src).toMatch(/roster\(sessions, canvas, Date\.now\(\), answerable\)/);
    expect(src).toContain("useAnswerable(");
  });

  it("does not decide for itself what a session's kind means", () => {
    /* The exact expression that mislabelled the rc, pinned so it cannot come
       back wearing a different variable name. */
    expect(src).not.toMatch(/kind:\s*\w+\.kind === "cli" \? "terminal" : "here"/);
    expect(src).not.toMatch(/live:\s*true/);
  });

  it("has a word for every state core can hand it", () => {
    /* A `Record<RowState, string>` fails to compile when core grows a state,
       which is the point: a missing case would render `undefined` beside
       somebody's name. */
    expect(src).toMatch(/const KIND_WORD: Record<RowState, string>/);
    for (const state of ["answerable", "enrolled", "blocked", "working", "parked", "quiet"]) {
      expect(src, `no word for ${state}`).toContain(`${state}:`);
    }
  });
});
