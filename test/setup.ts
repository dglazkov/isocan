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
 * And no test daemon is pointed at the DEFAULT home either (phase 14).
 * `isocan setup` on a machine that has never held a canvas now writes
 * `https://isocan.io` as the birth default — which is right for a stranger and
 * catastrophic in a suite: a test would reach out to the real production home
 * over the real internet, and a green run would depend on somebody else's
 * uptime. Empty means "this build points fresh machines nowhere". A test that
 * wants to prove the flip sets it to a daemon it started itself, which is
 * exactly what `packages/cli/test/setup-npx.test.ts` does.
 *
 * Belt as well as braces: the CLI also suppresses the shipped default when it
 * is running from a checkout, and the suite always is. This line is what makes
 * the suite safe even for a test that deliberately runs a copy from somewhere
 * else — which that file also does.
 */
process.env.ISOCAN_DEFAULT_HOME = "";

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
