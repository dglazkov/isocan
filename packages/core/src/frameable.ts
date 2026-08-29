/**
 * **Whether a site will let itself be shown inside a frame.**
 *
 * "Add site" projects a live site into an item, and an item is an iframe. Most
 * of the public web refuses that: `X-Frame-Options` and CSP `frame-ancestors`
 * exist precisely to stop a page being embedded by somebody else, and a bank
 * or a mail provider is right to send them.
 *
 * The failure was silent, which is the part worth fixing. Typing `yahoo.com`
 * created the item, the browser refused to render it, and the canvas showed a
 * blank rectangle with no explanation — so the honest report is "it didn't
 * work", and the honest answer is that it worked exactly as built and nobody
 * said what happened.
 *
 * This CANNOT be asked from the page: a cross-origin frame that has been
 * blocked looks, from JavaScript, much like one that loaded. The headers are
 * the fact, and only something that can make the request server-side can read
 * them — which is why this is a pure function over headers and the daemon is
 * what fetches them.
 */
export interface FrameVerdict {
  /** The site permits framing by this app, as far as its headers say. */
  ok: boolean;
  /** The header that refused, verbatim, so the reason is the site's own words. */
  refusedBy?: string;
  /** What a person should be told. Empty when `ok`. */
  why?: string;
}

/**
 * `SAMEORIGIN` and `DENY` both refuse us — we are never the same origin as
 * the site being projected. `ALLOWALL` and anything unrecognised are treated
 * as permission: the header is old, loosely specified, and browsers ignore
 * values they do not know, so guessing stricter than the browser would refuse
 * sites that actually work.
 */
function readXFrameOptions(value: string | null): FrameVerdict | null {
  if (value === null) return null;
  const directive = value.trim().toLowerCase().split(/[\s,;]+/)[0] ?? "";
  if (directive === "deny" || directive === "sameorigin") {
    return {
      ok: false,
      refusedBy: `x-frame-options: ${value.trim()}`,
      why:
        directive === "deny"
          ? "refuses to be shown in a frame anywhere"
          : "only allows itself to be framed by its own site",
    };
  }
  return null;
}

/**
 * `frame-ancestors` is the modern spelling and OUTRANKS `X-Frame-Options`
 * where both are present, which is why it is read second and wins.
 *
 * `'none'` refuses everyone. A list refuses us unless it names this origin —
 * and since a canvas is served from somewhere the site has almost certainly
 * never heard of, a list is a refusal in practice. It is reported as one
 * rather than guessed at: the message names the list so somebody who DOES
 * control that site can see what to add.
 */
function readFrameAncestors(csp: string | null, self: string | null): FrameVerdict | null {
  if (csp === null) return null;
  const directive = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("frame-ancestors"));
  if (directive === undefined) return null;
  const sources = directive.split(/\s+/).slice(1);
  if (sources.length === 0) return null;
  if (sources.some((s) => s.toLowerCase() === "'none'")) {
    return {
      ok: false,
      refusedBy: `content-security-policy: ${directive}`,
      why: "refuses to be shown in a frame anywhere",
    };
  }
  /**
   * Present and permissive still DECIDES. Returning "no opinion" here let the
   * older header have the last word, so `frame-ancestors *` alongside
   * `X-Frame-Options: DENY` came out as a refusal — CSP outranking XFO in the
   * strict direction only, which is not what outranking means. Caught by the
   * test written to say so in both directions.
   */
  if (sources.some((s) => s === "*")) return { ok: true };
  const allowed = self !== null && sources.some((s) => s === self || s === `${self}/`);
  if (allowed) return { ok: true };
  /**
   * Named, but not ALL of them. Yahoo's list is twenty domains and reading it
   * out is not telling somebody anything — it fills the error with noise and
   * buries the one fact that matters, which is that this canvas is not on it.
   * Two, then a count. The full header stays in `refusedBy` for anybody who
   * needs it.
   */
  const shown = sources.slice(0, 2).join(", ");
  const rest = sources.length - 2;
  return {
    ok: false,
    refusedBy: `content-security-policy: ${directive}`,
    why:
      rest > 0
        ? `only allows itself to be framed by ${shown} and ${rest} other${rest === 1 ? "" : "s"}`
        : `only allows itself to be framed by ${shown}`,
  };
}

/** The verdict for one site, from the headers it answered with. */
export function frameVerdict(
  headers: { get(name: string): string | null },
  self: string | null = null,
): FrameVerdict {
  const csp = readFrameAncestors(headers.get("content-security-policy"), self);
  if (csp) return csp;
  const xfo = readXFrameOptions(headers.get("x-frame-options"));
  if (xfo) return xfo;
  return { ok: true };
}
