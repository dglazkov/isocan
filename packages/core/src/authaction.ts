/**
 * **The provider's action handler, decided here and served on isocan's own
 * origin** — the pure half of `GET /__/auth/action`.
 *
 * ## Why isocan serves a Firebase-shaped path at all
 *
 * Magic-link sign-in mail was landing in spam, because Identity Platform sends
 * it from `noreply@<project>.firebaseapp.com`: no SPF or DKIM alignment to
 * `isocan.io`, so every receiver that checks alignment is right to be
 * suspicious. The fix is a custom sender domain at the provider — and the
 * provider changes the **From: address and the action-link domain together**.
 * Whatever domain the mail claims to come from is the domain the link points
 * at, and that domain must answer `/__/auth/action`.
 *
 * The alternative was a second origin (`auth.isocan.io`) backed by Firebase
 * Hosting. It is rejected for the **one-origin rule** this project already
 * holds per canvas (`registerPages` in the server): a sign-in link that lands
 * on a different hostname than the product is a seam this codebase does not
 * accept anywhere else, and it would put the badge cookie, the service worker
 * and the browser replica behind two doors. Serving the route ourselves keeps
 * one origin and takes Firebase Hosting out of the dependency chain entirely.
 *
 * ## This is a provider contract observed from OUTSIDE, and it was MEASURED
 *
 * Nothing here was read from documentation. On **2026-08-24** a real link was
 * generated through `accounts:sendOobCode` with `returnOobLink: true`, and this
 * is verbatim what came back:
 *
 * ```
 * https://isocan-io-dev.firebaseapp.com/__/auth/action
 *   ?apiKey=…&mode=signIn&oobCode=…
 *   &continueUrl=https://dev.isocan.io/p/prj_TESTONLY01&lang=en
 * ```
 *
 * Five parameters, and `continueUrl`'s value arrives **unencoded**. Firebase's
 * own handler is an HTML page that does the hop in JavaScript; ours does it as
 * a real 302, which is strictly better — no script, no shell to paint, nothing
 * to cache, and one fewer moving part between an inbox and a canvas.
 *
 * **If Firebase changes those parameters, this breaks.** There is no contract
 * to hold them to it. The fixture in `packages/server/test/authaction.test.ts`
 * is the record of what was true on the day, so the next person can diff a
 * fresh link against it rather than re-deriving the shape from a failure.
 *
 * ## Why the redirect throws the host away instead of checking it
 *
 * `continueUrl` is chosen by whoever called `sendOobCode`, and that is anybody
 * with the browser API key — which is not a secret and is served to every page.
 * A handler that honoured it would be an **open redirect on isocan.io carrying
 * a live credential in the query string**: an attacker asks the provider for a
 * link with `continueUrl=https://evil.example`, and the `oobCode` walks out of
 * the origin in a `Location` header.
 *
 * So this is not validation-and-allow. There is no allowlist and no host
 * comparison, because a comparison is a thing to get wrong. **The path is
 * extracted and everything else is discarded** — scheme, host, port,
 * credentials, fragment — and what comes back is a same-origin absolute path.
 * There is no host in the answer to be wrong about.
 *
 * The rule lives in core rather than in the daemon for house rule 4: the web
 * app strips exactly {@link AUTH_ACTION_PARAMS} off its own address when a
 * sign-in lands (`packages/web/src/lib/signin.ts`, `continueUrl()` and
 * `stripCode()`), which is the same list spelled a second time. Pointing that
 * file at this one is a follow-up the conductor owns; nothing here depends on
 * it happening.
 */

/**
 * The path the provider's action handler lives at, and therefore the path a
 * custom sender domain has to serve. Spelled once, for `CANVAS_PATH_PREFIX`'s
 * reason: the route, the tests and any future infra check should not each hold
 * their own copy of a string the provider chose.
 */
export const AUTH_ACTION_PATH = "/__/auth/action";

/**
 * The five parameters the provider appends, measured (see this file's header).
 *
 * Used twice: to scrub any of them a caller smuggled into `continueUrl` before
 * the real ones are set, and — by the web app, once it is pointed here — to
 * strip them off the address bar when the landing page is done with them.
 */
export const AUTH_ACTION_PARAMS = ["mode", "oobCode", "apiKey", "continueUrl", "lang"] as const;

/**
 * The one mode this handler answers.
 *
 * `resetPassword`, `verifyEmail` and `recoverEmail` are the provider's other
 * three, and isocan has no password to reset and no address of its own to
 * verify — it borrows an inbox and writes one row on a badge. A cheerful
 * redirect for those would be this codebase's oldest recurring failure (the
 * default answer to a wrong address is a cheerful one), so they are refused in
 * words instead.
 */
export const AUTH_ACTION_MODE = "signIn";

/**
 * What the handler should do: hop to a path on this origin, or say no.
 *
 * A discriminated union rather than a nullable string, because "redirect to
 * `/`" and "refuse" are different answers and a null would collapse them into
 * the cheerful one.
 */
export type AuthActionOutcome = { redirect: string } | { refusal: string };

/** A query as Fastify hands it over (repeated keys arrive as arrays), or as
 * `URLSearchParams`, which is what a test and a browser both have. */
export type AuthActionQuery = URLSearchParams | Record<string, unknown>;

/**
 * **The whole decision**, so the route can be four lines and a test can import
 * the rule rather than restate it (lessons.md #5).
 */
export function authActionOutcome(query: AuthActionQuery): AuthActionOutcome {
  const mode = one(query, "mode");
  if (mode !== AUTH_ACTION_MODE) return { refusal: wrongMode(mode) };
  const code = one(query, "oobCode");
  if (!code) return { refusal: NO_CODE };
  return { redirect: landing(one(query, "continueUrl"), mode, code) };
}

/**
 * The base a `continueUrl` is resolved against, and it is deliberately a name
 * that can never exist (RFC 2606 `.invalid`, the same trick `replica.test.ts`
 * plays with `home.invalid`).
 *
 * Its only job is to make a relative `continueUrl` parseable. Nothing in the
 * answer comes from it: the host is read and thrown away either way, so a base
 * that looked like a real origin would be a lie waiting to be copied into the
 * output by somebody tidying up.
 */
const NOWHERE = "http://this-origin.invalid";

/**
 * Where a landed sign-in belongs on THIS origin.
 *
 * Three things happen and the order matters. The address is parsed for its
 * PATH — anything unparseable is `/`, never a 500 and never echoed back.
 * Whatever query the app itself put in `continueUrl` is kept, minus any of the
 * provider's own parameter names a caller smuggled in there. Then `mode` and
 * `oobCode` are set from the real link.
 *
 * **Only those two ride along, and that is measured against the reader.**
 * `beginSignIn` in `packages/web/src/lib/signin.ts` reads exactly `mode` (to
 * be sure a reset link is not fed to the wrong exchange) and `oobCode` (to
 * exchange). It reads `apiKey` from nothing — the page asks its own home for
 * that on `GET /api/attest`, which is the whole "one image, many homes"
 * argument — and it reads `lang` from nothing at all. Both appear only in the
 * list of names the page DELETES on arrival. Forwarding a provider key nobody
 * reads would be a credential-shaped string in a bar, a bookmark and a
 * screenshot for no reader's benefit.
 *
 * The fragment is dropped: it never reaches a server anyway, and `signin.ts`
 * clears it when it builds `continueUrl`, so there has never been one to
 * carry.
 */
function landing(continueUrl: string | null, mode: string, code: string): string {
  let url: URL;
  try {
    // `new URL("", base)` is the base, whose path is `/` — so absent and empty
    // take this path rather than needing a branch of their own.
    url = new URL(continueUrl ?? "", NOWHERE);
  } catch {
    // Unparseable is not an error, it is a person who clicked a link. `/`.
    url = new URL("/", NOWHERE);
  }
  const params = url.searchParams;
  for (const key of AUTH_ACTION_PARAMS) params.delete(key);
  params.set("mode", mode);
  params.set("oobCode", code);
  const query = params.toString();
  return `${samePath(url.pathname)}${query ? `?${query}` : ""}`;
}

/**
 * A path that cannot leave this origin, from a path that may have been trying
 * to.
 *
 * Taking `URL.pathname` is most of it — the host is already gone by then — but
 * it is NOT all of it, and the gap is the sharp edge in this file. A pathname
 * may legitimately begin with two slashes (`https://dev.isocan.io//evil.example/x`
 * parses to a path of `//evil.example/x`), and a `Location` beginning with `//`
 * is **protocol-relative**: the browser reads it as a host and leaves. So the
 * leading run of slashes and backslashes collapses to exactly one, which also
 * catches `/\evil.example` — a form some parsers read as an authority — and
 * gives a leading slash to a scheme-only oddity like `javascript:alert(1)`,
 * whose pathname has none.
 *
 * Control characters need no handling here and it is worth saying why rather
 * than adding a regex that looks like it is doing something: the WHATWG parser
 * strips tab, CR and LF from its input outright and percent-encodes every
 * remaining C0 control and non-ASCII code point in a path. A parsed pathname is
 * printable ASCII, so there is no `\r\n` left to split a response header with.
 */
function samePath(pathname: string): string {
  return `/${pathname.replace(/^[/\\]+/, "")}`;
}

/**
 * One value for a key, from either shape of query.
 *
 * Fastify hands a repeated parameter over as an ARRAY, so `?mode=signIn&mode=x`
 * would otherwise reach a strict equality check as an object and be refused for
 * the wrong reason — or, worse in the other direction, a smuggled second
 * `continueUrl` would arrive as `[good, evil]` and stringify to
 * `"good,evil"`. The first wins, which is what `URLSearchParams.get` does, so
 * both shapes answer the same.
 */
function one(query: AuthActionQuery, key: string): string | null {
  const raw = query instanceof URLSearchParams ? query.get(key) : query[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : null;
}

/** A sign-in link with no code in it. Nothing to exchange, so nothing to do —
 * said rather than redirected, because a landing page handed no code renders a
 * canvas and a cheerful nothing. */
const NO_CODE =
  "That sign-in link carries no code, so there is nothing here to sign in with. " +
  "Ask for a fresh link.";

/**
 * The refusal for every other mode, in the second person and without echoing
 * anything unprintable back.
 *
 * The mode is named only when it looks like a mode. Reflecting arbitrary query
 * text into a body is a habit worth not having even where the content type
 * makes it inert.
 */
function wrongMode(mode: string | null): string {
  return (
    `This is isocan's sign-in handler, and it answers ${AUTH_ACTION_MODE} links only. ` +
    `That link asked for ${named(mode)}.\n\n` +
    "isocan has no password to reset and no address of its own to verify: signing in here " +
    "borrows your inbox once and writes one row on the badge this browser already carries. " +
    "There is no account behind it and nothing to recover.\n\n" +
    "If you were signing in, ask for a fresh link."
  );
}

function named(mode: string | null): string {
  if (mode === null) return "no mode at all";
  return /^[A-Za-z][A-Za-z0-9]{0,31}$/.test(mode) ? `\`${mode}\`` : "a mode this handler will not repeat";
}
