import { Suspense, lazy } from "react";
import type { GateGrantProps } from "./GateGrant.tsx";
import type { GatePanelProps } from "./GatePanel.tsx";

/**
 * **The gate's two controls, behind the boundary rare surfaces use.**
 *
 * Both are owner-only and both are occasional: the grant appears under a
 * message an agent's gate turned away, for the one person who can answer it,
 * and the panel appears when that person opens a tray row's gate. Their three
 * hosts — the comment popover, the Chat and the agent tray — are all in the
 * bytes a first visit downloads, so without this the controls were too.
 *
 * That is the shape the architecture review's step 1 took seventy-nine
 * kilobytes out with, and the shape the command palette, the scrubber and
 * (this evening) the Help panel already wear. What leaves the entry chunk is
 * not only the two components: `withListener`, `listenUntil`, `listenGrants`
 * and `readsAsTurnedAway` have no eager reader, so they follow the controls
 * into the chunk that is fetched when somebody actually grants something.
 *
 * One module for both, rather than a `lazy()` in each of the three hosts: a
 * boundary copied three times is three places for it to stop being one.
 *
 * The fallback is `null` because these render nothing most of the time
 * anyway — there is no layout to hold open and nothing to flash.
 */
const Grant = lazy(() => import("./GateGrant.tsx").then((m) => ({ default: m.GateGrant })));
const Panel = lazy(() => import("./GatePanel.tsx").then((m) => ({ default: m.GatePanel })));

export function GateGrant(props: GateGrantProps) {
  return (
    <Suspense fallback={null}>
      <Grant {...props} />
    </Suspense>
  );
}

export function GatePanel(props: GatePanelProps) {
  return (
    <Suspense fallback={null}>
      <Panel {...props} />
    </Suspense>
  );
}
