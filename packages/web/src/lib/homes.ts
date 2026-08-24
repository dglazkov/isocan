import { useEffect, useState } from "react";
import type { HomesResponse } from "@isocan/core";
import { fetchHomes } from "./api.ts";

/**
 * **Does the canvas in front of this tab live at the origin that served it?**
 *
 * Phase 10.3 made the one-origin rule per CANVAS rather than per daemon. A
 * daemon is the home of some canvases and a replica for others; it serves the
 * app for the ones it is the home of, and answers `GET /p/<id>` with a
 * signpost for the ones it is not. That guard is on the server, and the server
 * is not in the loop for a client-side navigation: `<Link to={canvasPath(id)}>`
 * changes the URL and mounts a route without a single request. So the guard
 * needs a second half here, in the app, and this is it.
 *
 * The failure it closes is not cosmetic. A canvas rendered at the wrong origin
 * gets a second door: a second badge cookie, a second service worker
 * registration, and a second phase-10 IndexedDB replica — the local one stale
 * by construction, because the writes are landing at the real home. That is
 * `local-bridge.md`'s worst case in as many words: *"two surfaces agreeing
 * with each other and both wrong."*
 */

/**
 * Where a canvas lives, according to the daemon that served this page. `null`
 * is "here", and it is the answer for an id with no row at all — absent has
 * always meant "wherever the machine reading this lives", which is the same
 * sentence the directory marker carries and the same one `registerPages` acts
 * on. Keeping the two readings identical is the point: **a person who reloads
 * the page must not get a different story than the one the app just told
 * them.**
 */
export function homeOfCanvas(homes: HomesResponse, projectId: string): string | null {
  return homes.canvases[projectId] ?? null;
}

/**
 * What this tab knows about where its canvas lives.
 *
 * `asking` is a real state rather than an optimistic "here", because the whole
 * value of the check is that it happens BEFORE the canvas connects. A tab that
 * rendered first and corrected itself afterwards would have already opened a
 * socket, written a replica to IndexedDB and taken a badge cookie for a canvas
 * it is not entitled to hold a copy of — the damage is done at mount, not at
 * paint.
 */
export type CanvasHome =
  | { state: "asking" }
  | { state: "here" }
  | { state: "elsewhere"; home: string };

/**
 * Ask once per canvas, and hold the first render until the answer lands.
 *
 * **Holding the render is deliberate**, and it is the same trade `App` already
 * makes for a pass redemption: *"waiting is one request, and it is the
 * difference between coming up as yourself and coming up as a stranger who is
 * then silently replaced."* Here it is the difference between opening a canvas
 * and quietly minting a second copy of one. The request is same-origin and
 * usually to a daemon on this machine.
 *
 * **A daemon that does not answer means `here`, not `elsewhere`** — and so
 * does one that answers badly (a pre-10.3 daemon has no `/api/homes` at all,
 * and its 404 arrives here as the same rejection). That looks
 * like the wrong default until you name the case: this tab is offline, the
 * service worker served the shell out of its cache, and the canvas being
 * opened is the one in this browser's own replica. Refusing it would break
 * phase 10's whole promise — a tab that loses the network keeps working — in
 * exchange for a guard that has nothing to guard: a canvas whose home is
 * elsewhere never got a local replica in the first place, because this check
 * (and the server's, on the page load) stopped it while the network was up.
 * Everything the app does from here is still refused by the daemon when it
 * comes back, and refused by the home's door beyond it.
 */
export function useCanvasHome(projectId: string | null): CanvasHome {
  const [answer, setAnswer] = useState<CanvasHome>({ state: "asking" });
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    setAnswer({ state: "asking" });
    void fetchHomes().then(
      (homes) => {
        if (!live) return;
        const home = homeOfCanvas(homes, projectId);
        setAnswer(home === null ? { state: "here" } : { state: "elsewhere", home });
      },
      () => live && setAnswer({ state: "here" }),
    );
    return () => {
      live = false;
    };
  }, [projectId]);
  return answer;
}
