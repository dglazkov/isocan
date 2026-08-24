import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { CANVAS_ROUTE } from "@isocan/core";
import { readIdentity } from "./lib/identity.ts";
import type { Arrival, ArrivalRefused } from "./lib/arrival.ts";
import { IdentityDialog } from "./components/IdentityDialog.tsx";
import { ProjectListPage } from "./pages/ProjectListPage.tsx";
import { CanvasPage } from "./pages/CanvasPage.tsx";
import { NotHerePage } from "./pages/NotHerePage.tsx";

export function App({ arrival }: { arrival: Arrival }) {
  // A tab holding a pass is not anybody yet, whatever localStorage says: the
  // pass is about to decide. Waiting is one request, and it is the difference
  // between coming up as yourself and coming up as a stranger who is then
  // silently replaced.
  const [redeeming, setRedeeming] = useState(arrival !== null);
  const [refused, setRefused] = useState<ArrivalRefused | null>(null);
  const [actor, setActor] = useState<Actor | null>(readIdentity);

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
      <Routes>
        <Route path="/" element={<ProjectListPage actor={actor} onIdentity={setActor} />} />
        {/* The canvas's address, built from core's one spelling of it — see
            `address.ts` for why that is worth a module. */}
        <Route path={CANVAS_ROUTE} element={<CanvasPage actor={actor} onIdentity={setActor} />} />
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
