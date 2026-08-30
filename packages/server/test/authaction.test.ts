import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTH_ACTION_PATH } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";

/**
 * **`GET /__/auth/action`, served by isocan on isocan's own origin.**
 *
 * Sign-in mail was landing in spam — Identity Platform sends from
 * `noreply@<project>.firebaseapp.com`, with no SPF or DKIM alignment to
 * `isocan.io` — and the fix is a custom sender domain, which moves the From:
 * address and the action-link domain together. So the domain the mail claims
 * has to answer the provider's action path. Doing it on a second origin
 * (`auth.isocan.io`) would break the one-origin rule for the one link a
 * stranger sees first; doing it here keeps one origin.
 *
 * **The fixture below is a MEASUREMENT, and it is the point of this file.**
 * The link was generated on 2026-08-24 through `accounts:sendOobCode` with
 * `returnOobLink: true`, and its five parameters — with `continueUrl` arriving
 * unencoded — are what the provider actually sent. Nothing here was read from
 * documentation. This is a contract observed from outside: if Firebase changes
 * the shape, this breaks, and this file is the record of what was true, so the
 * next person diffs a fresh link against it instead of re-deriving it from a
 * failure.
 *
 * The identifiers are synthetic (AGENTS.md): `prj_TESTONLY01`, and an API key
 * and code of the right SHAPE that belong to nothing.
 */

/** The measured link, taken apart. Kept as its five parts rather than one
 * string so a case can vary one of them and leave the rest verbatim. */
const MEASURED = {
  apiKey: "AIzaSyTESTONLY0000000000000000000000000000",
  mode: "signIn",
  oobCode: "vPzzTESTONLY0000000000000000000000000000000AAAGgNYlqbA",
  continueUrl: "https://dev.isocan.io/p/prj_TESTONLY01",
  lang: "en",
};

/**
 * The origin a browser would be sitting on when it follows the `Location`.
 *
 * Every case resolves the answer against this, because **that is what a
 * browser does** and it is the only assertion that catches the sharp one: a
 * `Location` of `//evil.example/x` is a same-origin-looking string, starts with
 * a slash, and is protocol-relative — the browser leaves. `new URL(location,
 * HERE).origin` is the question "where does this person end up", asked exactly
 * once and reused by every trick below.
 */
const HERE = "https://dev.isocan.io";

/** Whether the web app has actually been built into `packages/web/dist`. The
 * regression case below needs a LIVE SPA fallback to be worth anything — see
 * its comment — so it names its own skip rather than passing quietly. */
const distBuilt = existsSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist/index.html"),
);

let home: string;
let daemon: Daemon;
let base: string;

/**
 * One daemon for the file. Nothing here writes to it — the route is open (it
 * is under no `/api/` prefix, so `isOpen` lets it through with no badge) and
 * every case is a GET that changes nothing, so a fresh home per test would buy
 * only seconds spent.
 *
 * `birthHome: null` makes it a pure home, which is the rig that SERVES PAGES.
 * A replica would refuse the page path for a reason that has nothing to do
 * with this route, and the swallowing regression would then pass for the wrong
 * reason — the very shape lessons.md #14 is about.
 */
beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-authaction-"));
  daemon = await startDaemon({ port: 0, home, birthHome: null });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

/** The handler's answer, unfollowed. `redirect: "manual"` is load-bearing:
 * fetch follows a 302 by default, and a followed redirect is a test of the SPA
 * rather than of this route. */
async function action(query: string): Promise<{
  status: number;
  location: string | null;
  type: string | null;
  nosniff: string | null;
  cache: string | null;
  body: string;
}> {
  const res = await fetch(`${base}${AUTH_ACTION_PATH}${query}`, { redirect: "manual" });
  return {
    status: res.status,
    location: res.headers.get("location"),
    type: res.headers.get("content-type"),
    nosniff: res.headers.get("x-content-type-options"),
    cache: res.headers.get("cache-control"),
    body: await res.text(),
  };
}

/** The measured link with one part replaced, or with a part removed when the
 * replacement is null — so "no `mode` at all" is expressible. */
function link(overrides: Partial<Record<keyof typeof MEASURED, string | null>> = {}): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries({ ...MEASURED, ...overrides })) {
    if (value === null) continue;
    // `continueUrl` is appended UNENCODED, because that is how the provider
    // sends it (measured). Encoding it here would test a link nobody receives.
    parts.push(key === "continueUrl" ? `${key}=${value}` : `${key}=${encodeURIComponent(value)}`);
  }
  return `?${parts.join("&")}`;
}

/** Where a browser at {@link HERE} would end up, and with what. */
function lands(location: string | null): URL {
  expect(location).not.toBeNull();
  return new URL(location!, HERE);
}

describe("the measured link", () => {
  it("302s to the canvas it named, as a same-origin path, carrying the code", async () => {
    const res = await action(link());
    expect(res.status).toBe(302);
    // The exact `Location`, spelled out. `mode` before `oobCode` because that
    // is the order they are set in; the assertion is on the whole string so a
    // change to either is a change to this line.
    expect(res.location).toBe(`/p/prj_TESTONLY01?mode=signIn&oobCode=${MEASURED.oobCode}`);
    const at = lands(res.location);
    expect(at.origin).toBe(HERE);
    // The two the landing page reads (`readCode` in web/src/lib/signin.ts).
    expect(at.searchParams.get("mode")).toBe("signIn");
    expect(at.searchParams.get("oobCode")).toBe(MEASURED.oobCode);
    // And the two it does not. `apiKey` comes from `GET /api/attest` — the
    // "one image, many homes" argument — and `lang` has no reader at all, so
    // forwarding either would put a provider key in a bar and a bookmark for
    // nobody's benefit.
    expect(at.searchParams.get("apiKey")).toBeNull();
    expect(at.searchParams.get("lang")).toBeNull();
    // A URL carrying a single-use credential is nothing anyone should keep.
    expect(res.cache).toBe("no-store");
    expect(res.body).toBe("");
  });

  it("keeps a query the app itself put in continueUrl", async () => {
    // `continueUrl()` in signin.ts is THIS PAGE minus the provider's own
    // parameters, so anything else in the bar is the app's and comes back.
    const res = await action(link({ continueUrl: `${HERE}/p/prj_TESTONLY01?tab=notes` }));
    const at = lands(res.location);
    expect(at.pathname).toBe("/p/prj_TESTONLY01");
    expect(at.searchParams.get("tab")).toBe("notes");
    expect(at.searchParams.get("oobCode")).toBe(MEASURED.oobCode);
  });
});

/**
 * **The host in `continueUrl` is thrown away, never checked.**
 *
 * `continueUrl` is chosen by whoever called `sendOobCode`, and that is anybody
 * with the browser API key — which is not a secret and is served to every
 * page. Honouring it would be an open redirect on isocan.io carrying a live
 * credential in the query string.
 *
 * So there is no allowlist here to compare against, and these cases are not
 * "the bad hosts are refused": they are **every shape of address lands on this
 * origin**, because the path is extracted and the rest discarded. Stated once
 * and run over every trick (lessons.md #10) — the invariant has no host in it,
 * so neither does the assertion.
 */
describe("wherever continueUrl points, the browser stays here", () => {
  const tricks: { name: string; continueUrl: string | null; at?: string }[] = [
    { name: "an absolute host", continueUrl: "https://evil.example/x" },
    { name: "protocol-relative", continueUrl: "//evil.example/x" },
    { name: "a backslash authority", continueUrl: "/\\evil.example/x" },
    { name: "two backslashes", continueUrl: "\\\\evil.example/x" },
    /**
     * The two backslash cases above are handled by the PARSER, not by us: for a
     * special scheme (which the `http:` base makes them) WHATWG converts `\` to
     * `/`, so both resolve to a host that is then discarded like any other.
     *
     * These two are the ones that reach `samePath`'s own backslash clause, and
     * without it they are a live open redirect. An UNKNOWN scheme is not
     * special, so its backslashes survive into `URL.pathname` — and a
     * `Location` of `\\evil.example/x` or `/\evil.example/x` is resolved by the
     * browser against an `https:` page, where `\` becomes `/` again and the
     * person leaves. Measured in node, 2026-08-24: both
     * `new URL("\\\\evil.example/x", "https://dev.isocan.io")` and its
     * `/\` sibling are `https://evil.example/x`.
     */
    { name: "backslashes behind an unknown scheme", continueUrl: "foo:\\\\evil.example/x" },
    { name: "a slash-backslash behind an unknown scheme", continueUrl: "foo:/\\evil.example/x" },
    /**
     * The sharp one, and the reason `samePath` exists. A perfectly ordinary
     * absolute URL whose PATH begins with two slashes: the host is discarded
     * correctly and `URL.pathname` is `//evil.example/x`, which as a `Location`
     * is protocol-relative and leaves the origin. Taking the pathname is most
     * of the rule and is not all of it.
     */
    { name: "a doubled slash in the path", continueUrl: `${HERE}//evil.example/x` },
    { name: "credentials in the authority", continueUrl: "https://user:pw@evil.example/x" },
    { name: "an encoded scheme", continueUrl: "https:%2F%2Fevil.example", at: "/" },
    { name: "encoded slashes", continueUrl: "%2F%2Fevil.example" },
    { name: "a scheme that is not http", continueUrl: "javascript:alert(1)" },
    { name: "no leading slash", continueUrl: "p/prj_TESTONLY01", at: "/p/prj_TESTONLY01" },
    { name: "an unparseable address", continueUrl: "http://[", at: "/" },
    { name: "an empty value", continueUrl: "", at: "/" },
    { name: "no value at all", continueUrl: null, at: "/" },
  ];

  for (const trick of tricks) {
    it(`stays on this origin for ${trick.name}`, async () => {
      const res = await action(link({ continueUrl: trick.continueUrl }));
      expect(res.status).toBe(302);
      // Never an absolute URL. There is no host in the answer to be wrong.
      expect(res.location!.startsWith("/")).toBe(true);
      const at = lands(res.location);
      expect(at.origin).toBe(HERE);
      expect(at.host).not.toContain("evil.example");
      // The code still rides: this is a redirect that WORKS and is safe, not a
      // refusal that happens to be safe because it goes nowhere.
      expect(at.searchParams.get("oobCode")).toBe(MEASURED.oobCode);
      if (trick.at) expect(at.pathname).toBe(trick.at);
    });
  }

  it("throws away the provider's own parameter names smuggled into continueUrl", async () => {
    /**
     * The separators are `%26` and not `&`, and that is not tidiness: the
     * provider sends `continueUrl` UNENCODED, so a bare `&` inside it breaks
     * out into the OUTER query and the smuggling never happens. Encoded, the
     * whole thing is one value and the inner query is real — which is the only
     * shape in which this rule has anything to do.
     *
     * `oobCode` is deliberately not the case: the real one is `set` afterwards
     * and would overwrite a smuggled one anyway, so it proves nothing. `apiKey`
     * and `lang` are the ones nothing else removes.
     */
    const res = await action(
      link({ continueUrl: "/p/prj_TESTONLY01?apiKey=SMUGGLED%26lang=zz%26continueUrl=x%26keep=me" }),
    );
    const at = lands(res.location);
    expect(at.pathname).toBe("/p/prj_TESTONLY01");
    expect(at.searchParams.get("apiKey")).toBeNull();
    expect(at.searchParams.get("lang")).toBeNull();
    expect(at.searchParams.get("continueUrl")).toBeNull();
    expect(at.searchParams.get("oobCode")).toBe(MEASURED.oobCode);
    // The app's own parameters are not collateral damage.
    expect(at.searchParams.get("keep")).toBe("me");
  });

  it("takes one continueUrl when the link repeats it", async () => {
    // Fastify hands a repeated key over as an ARRAY; a rule that stringified it
    // would redirect to `"/p/good,https://evil.example"`, and one that read the
    // last would take the attacker's. Either way the host is discarded, which
    // is why this case asserts the origin as well as the path.
    const res = await action(`${link({ continueUrl: "/p/prj_TESTONLY01" })}&continueUrl=https://evil.example/x`);
    const at = lands(res.location);
    expect(at.origin).toBe(HERE);
    expect(at.pathname).toBe("/p/prj_TESTONLY01");
  });

  it("cannot split the response header", async () => {
    // The WHATWG parser strips CR and LF outright and percent-encodes every
    // remaining control character in a path, so a parsed pathname is printable
    // ASCII. Asserted rather than assumed: a `Location` with a newline in it is
    // a second response.
    const res = await action(link({ continueUrl: "/p/prj_TESTONLY01%0D%0AX-Evil:%20yes" }));
    expect(res.location).not.toMatch(/[\r\n]/);
    expect(res.status).toBe(302);
  });
});

/**
 * **Every other mode is refused in words.**
 *
 * isocan has no password to reset and no address of its own to verify: signing
 * in borrows an inbox once and writes one row on the badge the browser already
 * carries. A redirect for `resetPassword` would hand the app a code it cannot
 * exchange and render a canvas — a cheerful 200 for a link that cannot work,
 * which is the failure this whole route exists to stop.
 */
describe("a mode this home has nothing to do with", () => {
  for (const mode of ["resetPassword", "verifyEmail", "recoverEmail", "banana", null]) {
    it(`refuses ${mode ?? "a link with no mode"} in a sentence`, async () => {
      const res = await action(link({ mode }));
      expect(res.status).toBe(400);
      expect(res.location).toBeNull();
      expect(res.type).toContain("text/plain");
      expect(res.body).toContain("signIn");
      // Legible, not a code. The caller is a person who clicked a link in a
      // mail client, and the body is what they read.
      expect(res.body).toContain("ask for a fresh link");
      // Never echo the address back: it is attacker-chosen and this is the one
      // place it could be reflected onto isocan.io.
      expect(res.body).not.toContain("isocan.io");
    });
  }

  it("will not repeat a mode that is not one, and will not let it be sniffed", async () => {
    const res = await action(link({ mode: "<script>alert(1)</script>" }));
    expect(res.status).toBe(400);
    expect(res.body).not.toContain("<script>");
    expect(res.type).toContain("text/plain");
    // The body repeats a fragment of an attacker-chosen query string, so a
    // browser that guessed `text/html` would be a way in.
    expect(res.nosniff).toBe("nosniff");
  });

  it("refuses a signIn link with no code rather than landing on a blank sign-in", async () => {
    const res = await action(link({ oobCode: null }));
    expect(res.status).toBe(400);
    expect(res.location).toBeNull();
    expect(res.body).toContain("no code");
  });
});

/**
 * **The bug this change fixes, kept fixed.**
 *
 * On 2026-08-24 `https://dev.isocan.io/__/auth/action` answered **200 and the
 * app shell**: the daemon's `/*` handler answers every non-`/api/` path with
 * `index.html`, so the provider's action path was swallowed by the SPA
 * fallback. That is this codebase's oldest recurring failure — the default
 * answer to a wrong address is a cheerful one — and it is what would silently
 * come back if somebody removed this route or reordered registration.
 *
 * The positive control is in the SAME test on purpose. A neighbouring path
 * under `/__/` must still be swallowed, so the case cannot pass because the
 * fallback is dead, missing, or serving a daemon with no build — which is the
 * shape of a check whose answer cannot be "no" (lessons.md #14). It skips by
 * name where there is no `packages/web/dist`, rather than returning quietly.
 */
describe("the SPA fallback does not swallow the action path", () => {
  it.skipIf(!distBuilt)("swallows its neighbour and not this one", async () => {
    // The control: the fallback is alive on this daemon and would have taken
    // the path below if nothing had claimed it first.
    const neighbour = await fetch(`${base}/__/auth/nonsense`, {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    expect(neighbour.status).toBe(200);
    expect(neighbour.headers.get("content-type")).toContain("text/html");

    // And the route, which is not the app shell under any Accept header a mail
    // client's browser might send.
    const res = await fetch(`${base}${AUTH_ACTION_PATH}${link()}`, {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("content-type") ?? "").not.toContain("text/html");
    expect(res.headers.get("location")).toBe(
      `/p/prj_TESTONLY01?mode=signIn&oobCode=${MEASURED.oobCode}`,
    );
  });
});
