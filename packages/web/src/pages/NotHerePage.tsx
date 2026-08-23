import { Link, useLocation } from "react-router-dom";
import { CANVAS_PATH_PREFIX } from "@isocan/core";

/**
 * **Nothing is served here** — the app's answer to a path it does not have.
 *
 * It exists because of a measured failure, not a hypothetical one. The web app
 * had exactly two routes, and the SPA fallback answers EVERY path with the app
 * shell and a 200 — so `/c/7f3a…`, the address every design doc wrote and
 * nothing ever served, returned 200, loaded the app, matched no route, and
 * rendered a blank page. Same shape as phase 6's `/healthz/` finding: a wrong
 * URL was indistinguishable from a working one.
 *
 * A share link is the one address in this product that strangers paste to each
 * other, which makes it the one whose failure has to be legible. So: a page
 * that says what happened, and names the shape a canvas address actually has,
 * because the person reading it is usually holding a URL somebody else typed.
 *
 * It does NOT guess. The address was settled as `/p/` and there is deliberately
 * no `/c/` route, no redirect and no alias — a second URL shape for one canvas
 * is a cost that lasts forever, and a page that silently rewrote one shape into
 * the other would be that alias wearing a disguise.
 */
export function NotHerePage() {
  const { pathname } = useLocation();
  return (
    <div className="notfound-page">
      <h1>Nothing here</h1>
      <p className="notfound-path">{pathname}</p>
      <p>
        There is no canvas at this address. A canvas lives at{" "}
        <code>
          {CANVAS_PATH_PREFIX}/&lt;id&gt;
        </code>{" "}
        — which is what the Share dialog's copy button hands you, so a link that
        came from it will look like that.
      </p>
      <p>
        If somebody sent you this link and it does not work, ask them to copy it
        again from Share — and if it still refuses you, the canvas's link may
        simply be switched off.
      </p>
      <Link className="btn" to="/">
        All canvases
      </Link>
    </div>
  );
}
