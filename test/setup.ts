/**
 * Nothing this run starts may outlive it.
 *
 * These tests spawn real daemons on real ports, and a daemon is detached by
 * design. Finish a run and the `afterEach` hooks clean up; end one the way runs
 * actually end — closing the terminal, killing the session — and nothing does.
 * Both halves leak: the daemons keep answering out of temp homes that no longer
 * exist, and the workers that made them sit in their polling loops forever,
 * reparented to pid 1, burning a core between them until someone reads `ps` a
 * day later and wonders whose they are.
 *
 * So each half is told whose fate it shares.
 */

/**
 * Every daemon spawned from this worker dies when this worker does. It reaches
 * the daemon on its own: tests hand `{ ...process.env }` to the CLI, and
 * `ensureDaemon` passes that env on to the daemon it detaches. See `guardedBy`
 * in packages/server/src/daemon.ts.
 */
process.env.ISOCAN_DAEMON_GUARD_PID = String(process.pid);

/**
 * A daemon that knows a home is a REPLICA — it serves ops to CLIs and stops
 * serving pages to people (`resolveHomeUrl`, phase 6). That is read from the
 * environment, so a developer who has pointed their own machine at a home
 * would otherwise run the whole suite against replicas and watch the page
 * tests fail for a reason nothing on screen mentions. Every test daemon is a
 * home unless its own test says otherwise.
 */
delete process.env.ISOCAN_HOME_URL;

/**
 * And this worker dies when vitest does. Test files run in forked children, and
 * a fork whose parent was killed is simply reparented to init — no signal, no
 * closed channel to notice, nothing to say the run it belongs to is over. A
 * ppid of 1 is that news, and it is the only way it arrives.
 */
const orphaned = setInterval(() => {
  if (process.ppid !== 1) return;
  // Not `process.exit` — the pool replaces that in its children with a stub
  // that throws "process.exit unexpectedly called", and the throw lands in the
  // worker's own error handling and is merely reported. A signal to ourselves
  // is the one exit nothing here can catch, and an orphan has no results left
  // to report and nobody to report them to.
  process.kill(process.pid, "SIGKILL");
}, 1000);
// A worker that finishes early should still exit early.
orphaned.unref();
