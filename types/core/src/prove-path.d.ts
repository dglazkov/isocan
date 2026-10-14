/**
 * **Where the browser makes the proof**, and the handoff rides in the PATH.
 *
 * Not in the query, and the reason is measured rather than stylistic. The
 * magic-link path returns through `/__/auth/action`, which resolves the
 * provider's `continueUrl` and keeps the path (`authaction.ts`); the provider
 * appends `continueUrl` to its link **unencoded**, so a second `&`-separated
 * parameter inside it is parsed as a parameter of the outer link and never
 * reaches the landing page. One opaque segment survives that round trip; a
 * query string does not survive it whole.
 */
export declare const PROVE_PATH_PREFIX = "/operator/prove";
/** The handoff segment in a path this page was loaded at, or null. */
export declare function proveSegmentIn(pathname: string): string | null;
