import { Link } from "react-router-dom";
import { canvasUrl } from "@isocan/core";

/**
 * **This canvas lives somewhere else** — the app's half of the per-canvas
 * one-origin rule (phase 10.3).
 *
 * The daemon serving this page is the home of some canvases and a replica for
 * others, and it serves the app only for the ones it is the home of:
 * `GET /p/<id>` for a canvas that lives at dev.isocan.io answers a signpost
 * instead of the shell. But a `<Link>` from the project list is a client-side
 * navigation that never touches the server, and the phase-10 replica means the
 * app can also be woken from a cache with no daemon behind it at all. So the
 * same refusal has to exist here, in the app, where the router is the only
 * thing in the loop.
 *
 * **It says what the server says.** The two sentences below are the same two
 * `signpost` in `packages/server/src/http.ts` answers for exactly this
 * situation, because a person who reloads the page must not be told a
 * different story than the one the app just told them — and reloading a
 * refusal is the first thing anybody does. They are two copies rather than one
 * shared string only because there is nowhere honest to share it from: this is
 * markup on one side and a Fastify reply on the other, and neither package may
 * import the other. `test/homes.test.ts` reads both files and fails when they
 * drift, which is the guard that makes the duplication survivable.
 *
 * It offers the canvas at its home as a link and does not go there by itself.
 * The daemon's signpost makes the same choice, and for the same reason a
 * `Location` was refused there: sending a browser somewhere it did not ask to
 * go, on the strength of an address this machine holds in a config file, is
 * how a person ends up on a stranger's 404 wondering what they did.
 */
export function ElsewherePage({ projectId, home }: { projectId: string; home: string }) {
  return (
    <div className="notfound-page">
      <h1>
        This canvas lives at{" "}
        <a href={home} rel="noreferrer">
          {home}
        </a>
      </h1>
      <p>
        Open it there. This is a local isocan daemon: it serves ops to the{" "}
        <code>isocan</code> CLI and to agents on this machine, and serves pages
        only for the canvases it is the home of — every canvas has one door.
      </p>
      <p>
        Nothing is wrong with your link. This machine keeps a copy of this
        canvas in step with that home, and the <code>isocan</code> CLI works
        against the copy right here — it simply has no door of its own, because
        a second door would mean a second badge, a second cached app and a
        second replica in this browser, stale the moment somebody else drew
        anything.
      </p>
      <div className="row">
        {/* Built from core's one spelling of a canvas address (`address.ts`),
            never assembled here: the `/c/` bug was a second spelling of this
            exact string, and this is a link a person clicks when they are
            already confused about where they are. */}
        <a className="btn primary" href={canvasUrl(home, projectId)} rel="noreferrer">
          Open it at its home
        </a>
        <Link className="btn" to="/">
          All canvases
        </Link>
      </div>
    </div>
  );
}
