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

/**
 * **A connection that was never made is a blip, not a verdict.**
 *
 * Measured across nine full runs on a 14-core machine: two failures, in two
 * unrelated files, and both the same thing —
 *
 *     TypeError: fetch failed
 *     Caused by: Error: connect ETIMEDOUT 127.0.0.1:59864
 *
 * — raised inside `beforeEach`, connecting to a daemon this very worker had
 * just started IN-PROCESS. Not an assertion, and not a vitest timeout: the
 * limit here is 30 seconds and these failed in eight. It is the accept never
 * happening, because vitest runs one worker per core (fourteen), every worker
 * stands daemons up, and the CLI files spawn real binaries on top — so a
 * worker's event loop stalls for seconds and a TCP connect to its own
 * listener times out.
 *
 * Capping parallelism was measured and REJECTED as the fix. Six workers ran
 * clean four times but cost ~14% wall (48.7s → 55.4s), and seven workers
 * failed anyway on the third run — so a cap reduces the frequency without
 * removing the failure mode, which is the worst of both: slower, and still
 * flaky.
 *
 * So the harness does what the PRODUCT already does. `isocan wait` retries a
 * severed long-poll rather than exiting, and a home link reconnects with
 * backoff; a test client that cannot survive what the daemon's own clients
 * survive is holding the suite to a standard the code does not have to meet.
 *
 * **The rule is narrow on purpose: only when the request never left.**
 * `syscall === "connect"` means no bytes reached the server, so a retry
 * cannot repeat a write — which a blanket retry on "fetch failed" absolutely
 * could, because a socket dying mid-response looks the same at the call site
 * and may well have been applied. An HTTP response of any status is an
 * ANSWER and is returned untouched: a 404 or a 500 is the server speaking,
 * and swallowing those would hide exactly the failures this suite is for.
 */
const realFetch = globalThis.fetch;
/**
 * Bounded by the CLOCK, not by a number of attempts — and that distinction was
 * paid for. The first version retried four times, which is fine against
 * `ECONNREFUSED` (instant) and catastrophic against `ETIMEDOUT`: a connect
 * timeout can sit for ten seconds on its own, so four of them turned one 8s
 * failure into a `beforeEach` that blew the 30s hook limit. The retry made
 * the symptom worse while fixing the cause.
 *
 * A budget cannot do that. However slow one attempt turns out to be, the
 * whole thing gives up at three seconds and the original error is what the
 * test sees.
 */
const CONNECT_BUDGET_MS = 3000;
globalThis.fetch = async function retryingFetch(input, init) {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await realFetch(input, init);
    } catch (err) {
      const cause = (err as { cause?: { syscall?: string; code?: string } }).cause;
      const neverLeft =
        cause?.syscall === "connect" &&
        (cause.code === "ETIMEDOUT" || cause.code === "ECONNREFUSED" || cause.code === "ECONNRESET");
      if (!neverLeft || Date.now() - started >= CONNECT_BUDGET_MS) throw err;
      // Give the stalled loop a moment, and lengthen it — a machine that is
      // busy now is likely to be busy in a millisecond.
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
} as typeof fetch;
