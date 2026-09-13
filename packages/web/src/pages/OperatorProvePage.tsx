import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { decodeHandoff, loopbackRefusal, proveSegmentIn, type OperatorHandoff } from "@isocan/core";
import {
  attesterOffer,
  canVerifyEmail,
  exchangeSignInCode,
  sendSignInLink,
  takeSignInCode,
  useAttestOffer,
} from "../lib/signin.ts";

/**
 * **`/operator/prove/<handoff>` — the whole web surface of the operator**
 * (`docs/projects/operator/design.md`, "Both surfaces").
 *
 * One page, and possibly ever: the CLI is the operator's surface, and the
 * words the affected people read land on surfaces that already exist. There is
 * no dashboard here because a dashboard is a roster with styling.
 *
 * ## What this page is for
 *
 * A terminal wants to act as this home's operator. It listens on a loopback
 * port, opens this address, and waits. This page does three things in this
 * order, and the order is the design:
 *
 * 1. **It says what the terminal asked for, before anything else** — *a
 *    terminal on this machine asks to act as this home's operator: show
 *    prj_….* Journey 1 step 2. A page that asked for a sign-in and THEN said
 *    what it was for would be asking somebody to authorise a blank cheque, and
 *    it is exactly the shape every consent-phishing flow has.
 * 2. **It runs the sign-in `signin.ts` already runs.** The same two REST calls,
 *    the same provider, the same address in `localStorage`. No second
 *    mechanism, no SDK, nothing stored.
 * 3. **Instead of hop 4 (`POST /api/attest`) it hands the token to the
 *    loopback address** with the terminal's `state`. Nothing is written on the
 *    badge: an operator proof is never stored, which is what makes journey 10
 *    true — there is no standing on any badge for an agent to borrow.
 *
 * ## Why a form POST and not a `fetch`
 *
 * The destination is `http://127.0.0.1:<port>`, and this page is served over
 * HTTPS on a public domain. A `fetch` from here to there is a cross-origin
 * request into the local network: it needs CORS on the terminal's little
 * server, and under Private Network Access it needs a preflight the terminal
 * would also have to answer. Every one of those is a thing that can be
 * configured wrongly on somebody's laptop and fail with a console message
 * nobody sees.
 *
 * A **top-level form POST is a navigation**. No CORS, no preflight, no opaque
 * failure: the browser leaves this page and lands on whatever the terminal
 * answers, which is the terminal saying *go back to your shell*. The token
 * rides in a request body rather than in a query string, so it is not in an
 * address bar, a history entry or a screenshot — which is the same care
 * `stripCode` takes one file over.
 *
 * ## What it refuses
 *
 * Any destination that is not loopback, unread and before anything else. The
 * rule is `loopbackRefusal` in core, shared with the CLI that builds the
 * address, because a page that held its own opinion about what "local" means
 * would be a second copy of the one check that matters here.
 */
export function OperatorProvePage() {
  /**
   * The segment off the location rather than off a route parameter, because
   * this page is rendered by `Doorway` and not from inside `<Routes>` — for
   * the terms page's reason: who this browser is must not decide whether the
   * page is shown. A person who is nobody here yet still has to be able to
   * read what a terminal asked for and sign in for it.
   */
  const segment = proveSegmentIn(useLocation().pathname);
  const handoff = segment ? decodeHandoff(segment) : null;
  const refusal = handoff ? loopbackRefusal(handoff.to) : null;

  if (!handoff) {
    return (
      <Sheet title="That is not an operator link">
        <p>
          This address carries nothing a terminal asked for. `isocan operator …` opens the link
          it needs; a link copied by hand, or one that lost characters on the way, cannot be
          repaired here.
        </p>
      </Sheet>
    );
  }
  if (refusal) {
    return (
      <Sheet title="This page will not hand a sign-in to that">
        <p>{refusal}</p>
        <p>
          Nothing was signed in and nothing was sent. If you were handed this link by somebody
          else, that is what it was for.
        </p>
      </Sheet>
    );
  }
  return <Prove handoff={handoff} />;
}

/**
 * The act, then the sign-in, then the handoff.
 *
 * The summary is rendered by the parent of every state below it, so there is
 * no path through this component on which a person is asked for anything
 * before they have read what it is for.
 */
function Prove({ handoff }: { handoff: OperatorHandoff }) {
  const offer = useAttestOffer();
  /**
   * **The code, taken in a ref and outside render.**
   *
   * Same shape and same reason as `beginSignIn` in `main.tsx`: a sign-in code
   * is single-use and StrictMode runs an effect body twice in development, so
   * a naive effect would spend the code and then tell the person their link
   * had already been used. `useRef` initialised once is the smallest thing
   * that makes a second run impossible rather than guarded against.
   */
  const landed = useRef<string | null | undefined>(undefined);
  if (landed.current === undefined) landed.current = takeSignInCode();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // The exchange, once, for a tab that came back from an inbox.
  useEffect(() => {
    const code = landed.current;
    if (!code) return;
    let live = true;
    setBusy(true);
    void exchangeSignInCode(code).then((answer) => {
      if (!live) return;
      setBusy(false);
      if ("error" in answer) setError(answer.error);
      else setToken(answer.idToken);
    });
    return () => {
      live = false;
    };
  }, []);

  /**
   * And the hand-over, the moment there is something to hand over.
   *
   * Automatic because the person has already read the act and chosen to sign
   * in for it; making them press a second button would be asking the same
   * question twice. The button below is still rendered and still works — it is
   * what happens when this submit is blocked, and it is the only control on
   * the page if scripting is off.
   */
  useEffect(() => {
    if (token) form.current?.submit();
  }, [token]);

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const o = await attesterOffer();
      if (!o.auth) throw new Error("This home has borrowed nothing that can verify a sign-in.");
      await sendSignInLink(email, o.auth);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="A terminal on this machine asks to act as this home's operator">
      {/* FIRST, always: what was asked for. */}
      <p className="operator-act">{handoff.act}</p>
      <p className="operator-where">
        It is waiting at <code>{handoff.to}</code>, on this machine. Nothing is sent anywhere
        else, and nothing is written on this browser's badge — an operator proof is for one act
        and is stored nowhere.
      </p>

      {offer !== null && !canVerifyEmail(offer) && (
        <p className="operator-error">
          This home has borrowed no attester, so it has no way to check that anybody is its
          operator. There is nothing to prove here.
        </p>
      )}

      {error && <p className="operator-error">{error}</p>}

      {token ? (
        <>
          <p>Signed in. Handing the proof to your terminal…</p>
          <form ref={form} method="post" action={handoff.to}>
            <input type="hidden" name="idToken" value={token} />
            <input type="hidden" name="state" value={handoff.state} />
            <button type="submit">Hand it over</button>
          </form>
        </>
      ) : sent ? (
        <p>
          A sign-in link is on its way to <strong>{email}</strong>. Open it in this browser: it
          comes back here, and the act above is what it comes back for.
        </p>
      ) : (
        offer !== null &&
        canVerifyEmail(offer) && (
          <form onSubmit={ask} className="operator-signin">
            <label htmlFor="operator-email">Your address, to sign in with</label>
            <input
              id="operator-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )
      )}
    </Sheet>
  );
}

/** One column, centred, in the app's own tokens — the terms page's shape. */
function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="operator-prove">
      <h1>{title}</h1>
      {children}
    </main>
  );
}
