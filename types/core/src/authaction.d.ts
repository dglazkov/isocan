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
export declare const AUTH_ACTION_PATH = "/__/auth/action";
/**
 * What the handler should do: hop to a path on this origin, or say no.
 *
 * A discriminated union rather than a nullable string, because "redirect to
 * `/`" and "refuse" are different answers and a null would collapse them into
 * the cheerful one.
 */
type AuthActionOutcome = {
    redirect: string;
} | {
    refusal: string;
};
/** A query as Fastify hands it over (repeated keys arrive as arrays), or as
 * `URLSearchParams`, which is what a test and a browser both have. */
type AuthActionQuery = URLSearchParams | Record<string, unknown>;
/**
 * **The whole decision**, so the route can be four lines and a test can import
 * the rule rather than restate it (lessons.md #5).
 */
export declare function authActionOutcome(query: AuthActionQuery): AuthActionOutcome;
export {};
