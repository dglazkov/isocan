import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { CANVAS_ROUTE, ITEM_ROUTE } from "@isocan/core";
import { readIdentity } from "./lib/identity.ts";
import type { Arrival, ArrivalRefused } from "./lib/arrival.ts";
import type { SignIn, SignInLanding } from "./lib/signin.ts";
import { adoptIdentity } from "./lib/identity.ts";
import { IdentityDialog } from "./components/IdentityDialog.tsx";
import { ProjectListPage } from "./pages/ProjectListPage.tsx";
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

  if (!actor) {
    return (
      <>
        <IdentityDialog onDone={setActor} />
        {/* After the door in the DOM, so it wins the tie at the same layer:
            "the pass did not work" is the reason the door is being shown at
            all, and a person must not have to guess that. */}
        {refused && <ArrivalNotice refusal={refused} onDismiss={() => setRefused(null)} />}
        {proved && (
          <SignInNotice
            landing={proved}
            onIdentity={setActor}
            onDismiss={() => setProved(null)}
          />
        )}
      </>
    );
  }

  return (
    <BrowserRouter>
      {/* Above the routes, because a refused pass is about how you got here
          rather than about where you landed — and because the tab that meets
          one may end up anywhere: on the canvas (its link grant let you in
          anyway), at the door, or on the "will not have you" page. */}
      {refused && <ArrivalNotice refusal={refused} onDismiss={() => setRefused(null)} />}
      {proved && (
        <SignInNotice landing={proved} onIdentity={setActor} onDismiss={() => setProved(null)} />
      )}
      <Routes>
        <Route path="/" element={<ProjectListPage actor={actor} onIdentity={setActor} />} />
        {/* The canvas's address, built from core's one spelling of it — see
            `address.ts` for why that is worth a module. */}
        <Route path={CANVAS_ROUTE} element={<CanvasPage actor={actor} onIdentity={setActor} />} />
        {/* One item, full screen. The SAME element as the canvas, deliberately:
            the canvas stays mounted underneath, so its socket, its presence
            session and its viewport all survive, and coming back lands where
            you left rather than at the top. A sibling route element would tear
            all of that down and rebuild it. */}
        <Route path={ITEM_ROUTE} element={<CanvasPage actor={actor} onIdentity={setActor} />} />
        {/* The catch-all, and it is required rather than tidy. The daemon's
            SPA fallback answers every path with the app shell and a 200, so
            without a route here a mistyped or doc-shaped share link renders a
            blank page: no error, no 404, no redirect, nothing to read. */}
        <Route path="*" element={<NotHerePage />} />
      </Routes>
    </BrowserRouter>
  );
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
