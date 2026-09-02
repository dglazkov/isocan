import { useEffect, useState } from "react";
import type { Actor, AttestOffer, AuthOffer } from "@isocan/core";
import { attest, attestOffer } from "./api.ts";

/**
 * **Signing in, which is not signing in to isocan** (identity desk, mechanism
 * 3: "borrow, never mint").
 *
 * The gesture a person makes here is *prove you read that inbox*. What it
 * produces is one row on the badge this browser already carries — no account,
 * no password, no user record, nothing to reset. isocan holds none of those
 * and this file does not create the first one. A person who never does this
 * keeps using isocan exactly as they did: the address still admits, a badge is
 * still free, and the link is still how sharing works.
 *
 * ## Why there is no Firebase SDK here
 *
 * Two REST calls do the whole of email-link sign-in — `sendOobCode` and
 * `signInWithEmailLink` — and the SDK that wraps them is ~150 KB of JavaScript
 * carrying an auth-state machine, a token refresher and a persistence layer
 * this app wants none of. **It would be storing a second identity beside the
 * badge**, which is the one thing the desk design is emphatic about not doing:
 * the badge is the only account-shaped thing isocan issues, and an SDK holding
 * a refresh token in `indexedDB` would be a second credential with its own
 * lifetime, its own revocation story and its own opinion about who you are.
 *
 * So the ID token is used ONCE, handed to the home, and dropped. It is never
 * stored, never refreshed, and nothing in this app ever reads it again. What
 * survives is the attestation, on the badge, where the door can see it.
 *
 * ## The two hops, and where each one goes
 *
 * ```
 *   [1] page  ──sendOobCode(email)──▶  Identity Platform   (a link is emailed)
 *   [2] inbox ──the link──▶ this page with ?oobCode=…
 *   [3] page  ──signInWithEmailLink──▶ Identity Platform   (an ID token)
 *   [4] page  ──POST /api/attest──▶ the home               (the row is written)
 * ```
 *
 * Only hop 4 touches isocan. Hops 1 and 3 are the browser talking to the
 * provider with a browser API key that the home served it a moment ago — not a
 * secret, and defended by the provider's authorized-domain list rather than by
 * being hidden.
 *
 * **Google and GitHub are provisioned and deliberately have no button yet.**
 * Both are enabled on the dev project, and the daemon's verification is
 * provider-agnostic: it checks a signature, an issuer and an audience, so a
 * Google token would attest exactly as an emailed one does. What they need
 * that this does not is the provider's redirect handler — a popup or a
 * round trip through `…firebaseapp.com/__/auth/handler` — which is the part
 * the SDK exists for. The floor is what the phase's Outcome names ("a phone
 * resumes its person by attestation"), the floor borrows only an inbox, and it
 * is the one that works for somebody who has neither account.
 */

/** Where the email-link flow leaves its `oobCode`. The provider appends its
 * own parameters to whatever `continueUrl` we gave it. */
const OOB_PARAM = "oobCode";
const MODE_PARAM = "mode";

/**
 * The address this browser said it was signing in for.
 *
 * `signInWithEmailLink` needs the email as well as the code, and that is not
 * belt-and-braces: it is what stops a stolen link being usable by whoever
 * stole it. The provider requires the two together, so a link forwarded to
 * somebody else fails unless they also know the address it was sent to.
 *
 * In `localStorage` and not `sessionStorage` because the link is very often
 * opened in a DIFFERENT TAB — mail clients open new windows — and a session
 * store would be empty there. The cost is that a person who signs in on one
 * device and opens the link on another is asked for their address again, which
 * is exactly what should happen.
 */
const PENDING_KEY = "isocan.signin.email";

/** What this home has borrowed, fetched once per page. Cached because three
 * dialogs ask and the answer cannot change while the process is up. */
let offer: Promise<AttestOffer> | null = null;
/** The most recent answer, once it has arrived. `useAttestOffer` reads this
 * on its first render so a door mounted after the offer resolved does not
 * paint an empty list and then fill it. Cleared with `offer`, and cleared when
 * an ask fails: a home that could not be reached has no last answer, and a
 * door must not draw a proof control from one it gave earlier. */
let lastOffer: AttestOffer | null = null;

export function attesterOffer(refresh = false): Promise<AttestOffer> {
  if (refresh || !offer) {
    const asked = attestOffer();
    offer = asked;
    asked.then(
      (answer) => {
        // A refresh may have replaced this request while it was in flight; only
        // the request the cache still holds gets to say what the answer is.
        if (offer === asked) lastOffer = answer;
      },
      () => {
        if (offer === asked) lastOffer = null;
      },
    );
  }
  return offer;
}

/**
 * Who is told when the cached offer is thrown away.
 *
 * A Set with an unsubscribe, not the one-slot setter `onReBadge` and
 * `onOfflineWrite` use: the door is mounted from `Doorway`, `FrontPage` and
 * `ViewerGate`, and a second mount must not knock the first one off the list
 * (multi-identity phase 1).
 */
const offerListeners = new Set<() => void>();

/** Run `fn` each time the offer cache is invalidated. Returns the unsubscribe. */
export function onOfferInvalidated(fn: () => void): () => void {
  offerListeners.add(fn);
  return () => {
    offerListeners.delete(fn);
  };
}

/** Drop the cached offer so the next reader re-asks, and say so. */
function invalidateOffer(): void {
  offer = null;
  lastOffer = null;
  for (const fn of offerListeners) fn();
}

/**
 * The home's current offer, kept current — what it can verify, what this
 * badge has proved, and who that lets it be.
 *
 * The door reads it through this hook wherever it is mounted, so nothing is
 * threaded through props. It reads the same cached offer the other dialogs
 * read, re-reads when `settle()` invalidates that cache after a proof lands,
 * and leaves the listener list on unmount. `null` while the answer is on its
 * way and when the home could not be asked; on a home with no attester the
 * answer arrives with `auth === null`, and every reader of this hook renders
 * nothing for it, so the door is the door it was before the hook existed
 * (multi-identity phases 1 and 2).
 */
export function useAttestOffer(): AttestOffer | null {
  const [answer, setAnswer] = useState<AttestOffer | null>(lastOffer);
  useEffect(() => {
    let live = true;
    const read = (): void => {
      attesterOffer()
        .then((got) => live && setAnswer(got))
        .catch(() => live && setAnswer(null));
    };
    read();
    const stop = onOfferInvalidated(read);
    return () => {
      live = false;
      stop();
    };
  }, []);
  return answer;
}

/** The actors this badge may become — `AttestOffer.resumable`, kept current.
 * `[]` until the answer is in, and on a home with no attester. */
export function useResumable(): Actor[] {
  return resumableIn(useAttestOffer());
}

/**
 * Who the offer says this badge may be. The server answers `resumable` from
 * the badge's attestations whether or not the home still has an attester, so
 * this reads `[]` on a home without one — an attester-less door is today's
 * door, whatever the badge once proved (multi-identity phase 1 finding).
 */
export function resumableIn(answer: AttestOffer | null): Actor[] {
  return answer && answer.auth !== null ? answer.resumable : [];
}

/** Can this home verify an email at all? The Share dialog's "who" field and
 * the identity menu's sign-in entry are both drawn from this, so a home that
 * has borrowed nothing shows neither — rather than showing a control whose
 * only outcome is a refusal. */
export function canVerifyEmail(o: AttestOffer): boolean {
  return o.auth !== null && o.attesters.includes("email");
}

/**
 * **Hop 1: ask the provider to email a sign-in link.**
 *
 * `continueUrl` is where the person lands when they click it, and it is THIS
 * page — the canvas they were looking at, minus any code already in the bar.
 * Coming back somewhere else would be a person losing their place to prove
 * their address, which is a bad trade for a mechanism whose whole promise is
 * that it adds something.
 *
 * The address is remembered locally before the call, not after: a person who
 * closes the tab between sending and clicking must still be able to complete,
 * and a write that happened only on success would lose exactly the case where
 * the network was slow.
 */
export async function sendSignInLink(email: string, auth: AuthOffer): Promise<void> {
  const address = email.trim();
  remember(address);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(auth.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "EMAIL_SIGNIN",
        email: address,
        continueUrl: continueUrl(),
        canHandleCodeInApp: true,
      }),
    },
  );
  if (!res.ok) throw new Error(providerError(await res.json().catch(() => null)));
}

/**
 * What a tab that came back from an inbox has to show for it — the row that
 * was written and who it now lets this browser be, or the sentence to render
 * instead.
 */
export type SignInLanding =
  | { proved: string; via: string; resumable: Actor[] }
  | { error: string };

/** A sign-in in flight. Null when this tab arrived carrying nothing, which is
 * almost every tab. */
export type SignIn = Promise<SignInLanding> | null;

/**
 * **Hops 3 and 4: the tab that came back from the inbox.**
 *
 * It exchanges the code for an ID token, hands the token to the home, and
 * answers with what the home wrote.
 *
 * **Called from `main.tsx`, outside React, exactly once** — the same shape and
 * the same reason as `beginArrival`: a sign-in code is single-use, StrictMode
 * runs an effect body twice in development, and the second run would tell a
 * person their link had already been used moments after they used it. Starting
 * the promise at the entry point makes that unrepresentable rather than
 * guarded against.
 *
 * **The code is taken out of the address bar before the answer comes back**,
 * for `arrival.ts`'s reason: a credential in a bar is a credential in a
 * screenshot, a bookmark and a reload. The cost is the same cheap one — an
 * exchange lost to a dead network takes the code with it, and a fresh link is
 * one click away.
 *
 * Nothing here throws. A refusal is copy to render, not an error to swallow.
 */
export function beginSignIn(): SignIn {
  const code = readCode();
  if (!code) return null;
  stripCode();
  return settle(code);
}

async function settle(code: string): Promise<SignInLanding> {
  const email = recalled();
  if (!email) {
    return {
      error:
        "This browser does not remember which address that link was for — the provider needs " +
        "both, so a forwarded link cannot be used by whoever it was forwarded to. Open it in " +
        "the browser you started from, or start again here.",
    };
  }
  try {
    const o = await attesterOffer();
    if (!o.auth) return { error: "This home has borrowed nothing that can verify a sign-in." };
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${encodeURIComponent(o.auth.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, oobCode: code }),
      },
    );
    const body = (await res.json().catch(() => null)) as { idToken?: string } | null;
    if (!res.ok || !body?.idToken) return { error: providerError(body) };
    forget();
    /**
     * The ID token is used HERE and dropped. It is not stored, not refreshed,
     * and nothing in this app ever reads it again — see this file's header for
     * why that is the point rather than an omission.
     */
    const written = await attest(body.idToken);
    // The offer is stale the moment the row lands — it carried the old
    // attestations and the old resumable list — so the next reader re-asks,
    // and any door already on screen is told to.
    invalidateOffer();
    return {
      proved: written.attestation.attribute,
      via: written.attestation.verifiedVia,
      resumable: written.resumable,
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}


function readCode(): string | null {
  try {
    const params = new URLSearchParams(location.search);
    // The provider sends `mode=signIn` beside the code. Checked so that a
    // password-reset or verify-email link — same parameter name, different
    // meaning — is not fed to the wrong exchange.
    if (params.get(MODE_PARAM) !== "signIn") return null;
    return params.get(OOB_PARAM);
  } catch {
    return null; // no document: a test, a worker. Nothing arrived anywhere.
  }
}

function stripCode(): void {
  try {
    const params = new URLSearchParams(location.search);
    for (const key of [OOB_PARAM, MODE_PARAM, "apiKey", "lang", "continueUrl"]) params.delete(key);
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}`);
  } catch {
    // No history API to speak of. The exchange still happens; the worst case
    // is a reload that meets a spent code, which says so in words.
  }
}

/** This page, without whatever the provider appended last time. */
function continueUrl(): string {
  const url = new URL(location.href);
  for (const key of [OOB_PARAM, MODE_PARAM, "apiKey", "lang", "continueUrl"]) {
    url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString();
}

/**
 * The provider's own refusal, in its own words where they are usable.
 *
 * Identity Toolkit answers with SCREAMING_SNAKE codes — `INVALID_EMAIL`,
 * `EXPIRED_OOB_CODE`, `UNAUTHORIZED_DOMAIN` — which are precise and unreadable.
 * The three that a person can actually act on are translated and everything
 * else passes through, because a code we have never seen is more useful in the
 * page than "something went wrong".
 */
function providerError(body: unknown): string {
  const message =
    body && typeof body === "object"
      ? ((body as { error?: { message?: string } }).error?.message ?? "")
      : "";
  if (message.startsWith("INVALID_EMAIL")) return "That does not look like an email address.";
  if (message.startsWith("EXPIRED_OOB_CODE")) {
    return "That sign-in link has expired — ask for a new one.";
  }
  if (message.startsWith("INVALID_OOB_CODE")) {
    return "That sign-in link has already been used, or was not copied whole. Ask for a new one.";
  }
  if (message.startsWith("UNAUTHORIZED_DOMAIN")) {
    return (
      "The sign-in provider does not recognise this address as one of isocan's — this home's " +
      "domain is not on its authorized list, which is a configuration fix and not yours."
    );
  }
  return message ? `The sign-in provider said: ${message}` : "The sign-in provider refused.";
}

function remember(email: string): void {
  try {
    localStorage.setItem(PENDING_KEY, email);
  } catch {
    // Private mode: the link will ask for the address again when it lands.
  }
}

function recalled(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function forget(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to forget.
  }
}
