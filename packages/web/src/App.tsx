import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { CANVAS_ROUTE, ITEM_ROUTE } from "@isocan/core";
import { readIdentity } from "./lib/identity.ts";
import type { Arrival, ArrivalRefused } from "./lib/arrival.ts";
import type { SignIn, SignInLanding } from "./lib/signin.ts";
import { adoptIdentity } from "./lib/identity.ts";
import { faceFor } from "./lib/faces.ts";
import { IdentityDialog } from "./components/IdentityDialog.tsx";
import { FrontPage } from "./pages/FrontPage.tsx";
import { TermsPage } from "./pages/TermsPage.tsx";
import { CanvasListPage } from "./pages/CanvasListPage.tsx";
import { CanvasPage } from "./pages/CanvasPage.tsx";
import { NotHerePage } from "./pages/NotHerePage.tsx";

export function App({ arrival, signIn }: { arrival: Arrival; signIn: SignIn }) {
  // A tab holding a pass is not anybody yet, whatever localStorage says: the
  // pass is about to decide. Waiting is one request, and it is the difference
  // between coming up as yourself and coming up as a stranger who is then
  // silently replaced.
  const [redeeming, setRedeeming] = useState(arrival !== null);
  const [refused, setRefused] = useState<ArrivalRefused | null>(null);
  const [actor, setActor] = useState<Actor | null>(readIdentity);
  /**
   * What a tab that came back from an inbox proved — and who it may now be.
   *
   * It does NOT hold the first render, unlike a pass. A pass decides who this
   * tab is, so rendering before it lands would flash the wrong person;
   * proving an address decorates the badge and OFFERS a resume, taking
   * nothing. That asymmetry is the whole of "attestation adds a way and
   * removes none", arriving as a rendering decision.
   */
  const [proved, setProved] = useState<SignInLanding | null>(null);

  useEffect(() => {
    if (!arrival) return;
    let live = true;
    // `then` on a promise started in `main.tsx`: StrictMode runs this twice,
    // and twice on one settled promise is the same answer, not a second
    // redemption.
    void arrival.then((answer) => {
      if (!live) return;
      setRefused(answer);
      setActor(readIdentity()); // the pass may have just made this browser somebody
      setRedeeming(false);
    });
    return () => {
      live = false;
    };
  }, [arrival]);

  useEffect(() => {
    if (!signIn) return;
    let live = true;
    void signIn.then((answer) => live && setProved(answer));
    return () => {
      live = false;
    };
  }, [signIn]);

  // Not a spinner and not a blank page: a sentence, in the door's own
  // language, for the fraction of a second a redemption takes.
  if (redeeming) return <div className="page-note">Letting you in…</div>;

  return (
    <BrowserRouter>
      <Doorway actor={actor} onIdentity={setActor}>
        {(who) => (
          <Routes>
            <Route path="/" element={<CanvasListPage actor={who} onIdentity={setActor} />} />
            {/* The canvas's address, built from core's one spelling of it — see
                `address.ts` for why that is worth a module. */}
            <Route path={CANVAS_ROUTE} element={<CanvasPage actor={who} onIdentity={setActor} />} />
            {/* One item, full screen. The SAME element as the canvas,
                deliberately: the canvas stays mounted underneath, so its
                socket, its presence session and its viewport all survive, and
                coming back lands where you left rather than at the top. A
                sibling route element would tear all of that down and rebuild
                it. */}
            <Route path={ITEM_ROUTE} element={<CanvasPage actor={who} onIdentity={setActor} />} />
            {/* The catch-all, and it is required rather than tidy. The daemon's
                SPA fallback answers every path with the app shell and a 200, so
                without a route here a mistyped or doc-shaped share link renders
                a blank page: no error, no 404, no redirect, nothing to read. */}
            <Route path="*" element={<NotHerePage />} />
          </Routes>
        )}
      </Doorway>
      {/* Over whatever face you landed on, because a refused pass is about how
          you got here rather than about where you landed — and the tab that
          meets one may end up anywhere: on the canvas (its link grant let you
          in anyway), at the door, on the front page, or on the "will not have
          you" page.
          LAST in the DOM, and that is load-bearing rather than tidy: this and
          `.identity-backdrop` both sit at `--z-dialog`, the layer nothing else
          outranks, so between those two the tie is broken by document order.
          "The pass did not work" is the reason the door is being shown at all,
          and a person must not have to guess that — which is why the old
          no-actor branch repeated these BELOW the dialog, and why one copy
          after `Doorway` is now the same guarantee for all three faces. */}
      {refused && <ArrivalNotice refusal={refused} onDismiss={() => setRefused(null)} />}
      {proved && (
        <SignInNotice landing={proved} onIdentity={setActor} onDismiss={() => setProved(null)} />
      )}
    </BrowserRouter>
  );
}

/**
 * **One address, two faces** (phase 13.5) — the switch, and nothing else.
 *
 * This used to be an early return above the router: no actor meant the
 * identity dialog INSTEAD OF the routes, whatever address the tab was at. That
 * was right for a share link and wrong for the origin, where it met a stranger
 * with "pick your name" before they had learned what isocan is. Now the router
 * always mounts and the rule lives in `lib/faces.ts`, where a test can hold it
 * still; everything this component does is switch on the answer.
 *
 * The rule is applied INSIDE the router on purpose. Reading
 * `location.pathname` above it would answer once, at mount, and a client-side
 * navigation would never re-ask — a page whose face was decided by whichever
 * address the tab happened to open at.
 *
 * `children` is a function rather than an element because "here" is the only
 * face that has somebody: the routes need an `Actor`, not an `Actor | null`,
 * and this hands them the one the rule just proved exists.
 */
export function Doorway({
  actor,
  onIdentity,
  children,
}: {
  actor: Actor | null;
  onIdentity: (actor: Actor) => void;
  children: (actor: Actor) => ReactNode;
}) {
  const { pathname } = useLocation();
  const face = faceFor(pathname, actor);
  // Before the actor branch, exactly as the rule orders them: the terms are the
  // same document for a stranger, for somebody with a badge, and for an agent
  // (phase 13.7).
  if (face === "terms") return <TermsPage />;
  if (face === "here" && actor) return <>{children(actor)}</>;
  if (face === "front-page") return <FrontPage onIdentity={onIdentity} />;
  return <IdentityDialog onDone={onIdentity} />;
}

/**
 * **The pass did not work, said out loud.**
 *
 * Phase 7's finding — "this system's default answer to a wrong address is a
 * cheerful one" — met at the gesture where it would hurt most: somebody
 * clicked a link that was supposed to make them themselves, and quietly
 * becoming a stranger instead is exactly the failure the three refusal codes
 * were spent on avoiding. Each code carries its own sentence and its own
 * remedy (`lib/arrival.ts`).
 *
 * Dismissible, and it does not block the page: an expired pass on a canvas
 * whose link is open still leaves a person somewhere they can work, and
 * standing in front of that with a modal would turn a small disappointment
 * into a wall.
 */
function ArrivalNotice({
  refusal,
  onDismiss,
}: {
  refusal: ArrivalRefused;
  onDismiss: () => void;
}) {
  return (
    <div className="arrival-notice" role="status">
      <div className="arrival-note">{refusal.note}</div>
      <div className="arrival-hint">{refusal.hint}</div>
      <button className="btn arrival-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

/**
 * **You proved it — and here is who that lets you be.**
 *
 * The far end of `lib/signin.ts`, and the moment mechanism 6 becomes something
 * a person can actually do: the tab comes back from an inbox, the row is on
 * the badge, and if another surface that proved the same address answers to a
 * name, this offers to BE them. One click, and it is a resume — the same
 * `actor.claim` with `as` that switching personas already sends, accepted now
 * because the home will vouch for it.
 *
 * It is a notice rather than a modal for `ArrivalNotice`'s reason: nothing
 * here blocks anybody. A person who proved an address and does not want to
 * resume anyone dismisses it and carries on as whoever they were, with the
 * attestation quietly doing its other job at the door.
 */
function SignInNotice({
  landing,
  onIdentity,
  onDismiss,
}: {
  landing: SignInLanding;
  onIdentity: (actor: Actor) => void;
  onDismiss: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  if ("error" in landing) {
    return (
      <div className="arrival-notice" role="status">
        <div className="arrival-note">That sign-in link did not go through.</div>
        <div className="arrival-hint">{landing.error}</div>
        <button className="btn arrival-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    );
  }
  const address = landing.proved.replace(/^email:/, "");
  return (
    <div className="arrival-notice" role="status">
      <div className="arrival-note">
        {address} is proved on this browser (via {landing.via}).
      </div>
      <div className="arrival-hint">
        {landing.resumable.length === 0
          ? "Anybody can now invite you here by that address instead of handing out the link."
          : "Another surface that proved the same address answers to:"}
        {landing.resumable.map((who) => (
          <button
            key={who.id}
            className="btn"
            style={{ marginLeft: "0.5rem" }}
            onClick={() => {
              setError(null);
              adoptIdentity(who)
                .then((became) => {
                  onIdentity(became);
                  onDismiss();
                })
                .catch((err: Error) => setError(err.message));
            }}
          >
            Be {who.name || who.id}
          </button>
        ))}
      </div>
      {error && <div className="identity-warning">{error}</div>}
      <button className="btn arrival-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
