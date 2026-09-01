import { DaemonRoutes } from "./routes.js";
/**
 * **The Node-only half of the client** — how a daemon comes to exist on this
 * machine, layered over the typed route surface it then speaks to.
 *
 * The split is `routes.ts`'s to explain (and `boundary.test.ts`'s to hold):
 * everything here may spawn processes and read the managed-install layout,
 * and nothing in `DaemonRoutes` may.
 */
export declare class DaemonClient extends DaemonRoutes {
    /**
     * **Which copy a daemon started from here should run** (auto-upgrade phase
     * 4). Normally this one — the process asking for a daemon is the obvious
     * candidate to provide it. On a MANAGED install it is `current` instead,
     * and that difference is one of the phase's three idle points: starting a
     * daemon is a fresh process either way, so it is a free moment to land on
     * whatever build the machine has since flipped to. It is also what makes a
     * parked agent's reconnect land on the new build, because `isocan wait`
     * calls `ensureDaemon` when its daemon goes away.
     *
     * Gated on this copy being managed, and that gate is the whole of the care
     * here. A CHECKOUT must keep starting the daemon it built, whatever
     * `~/.isocan/current` happens to point at — a developer whose daemon quietly
     * came up on a release build instead of their own working tree would spend
     * an afternoon on it. Same for a global install nobody has adopted.
     *
     * The bin named is the CLI's, from this package's sibling — the daemon is
     * `isocan serve`, and the packages travel together (iso-api phase 1 moved
     * this file one workspace over; the relative reach to the bin is the same in
     * a checkout and in an install, which is the workspace-loader's own
     * argument).
     */
    private daemonBin;
    /** Start the daemon detached if it isn't answering, then wait for healthz. */
    ensureDaemon(): Promise<void>;
}
/** `realpath`, falling back to `resolve` for a path that does not exist yet.
 * Shared with the CLI's `upgrade.ts` and `managed.ts`, which compare the same
 * kind of pair. */
export declare function resolved(target: string): string;
/**
 * The build a path belongs to, or null when it is outside `builds/`.
 *
 * **Both sides are resolved through their symlinks first, and that is the
 * whole of the care here.** A daemon reports `buildStamp().root`, which node
 * has already realpath'd on its way to loading the module; `ISOCAN_HOME` is
 * whatever a person or a test typed. On macOS those two spellings differ for
 * every temporary directory in existence — `/tmp` is a symlink to
 * `/private/tmp`, `$TMPDIR` to `/private/var/folders/…` — so comparing them
 * literally answers "not one of ours" about a tree that plainly is, and the
 * consequence of that wrong answer is deleting a build out from under a
 * running daemon. Found by a test that started a real process and asked.
 *
 * It lives here rather than with the rest of the upgrade machinery in the
 * CLI's `managed.ts` because `daemonBin` above is a second reader — the one
 * piece of the managed layout the daemon-lifecycle half has to know.
 */
export declare function shaOfRoot(home: string, root: string): string | null;
