import { monitorEventLoopDelay } from "node:perf_hooks";
import { Agent, fetch as undiciFetch } from "undici";
import { afterAll, afterEach, beforeEach } from "vitest";

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
/**
 * **The event loop, watched.**
 *
 * The flake family's third witness was `connect ETIMEDOUT 127.0.0.1` on a POST
 * to a daemon this very worker had started in-process
 * (`docs/research/2026-08-29-the-flake-family.md`). On loopback a connect
 * either completes at once or is refused; a TIMEOUT means the SYN sat in a
 * listen backlog nothing accepted — **the loop was blocked long enough that
 * the kernel gave up on the handshake.**
 *
 * That is a claim about this process, and this process can be asked. The tests
 * start their daemons IN-PROCESS, so the worker's loop IS the daemon's loop:
 * a stall measured here is the stall that did not accept the connection.
 *
 * `resolution: 10` samples every 10ms — fine enough to see a multi-second
 * stall, coarse enough to cost nothing. The histogram is reset per test so a
 * number can be attributed to a NAME rather than to a file.
 */
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
/** Milliseconds, because nanoseconds are unreadable at a glance. */
const stallMs = () => Math.round(loop.max / 1e6);
/**
 * A stall this long is not scheduling noise. The suite runs one worker per
 * core and is deliberately oversubscribed, so hundreds of milliseconds are
 * ordinary; a full second is something else, and the witness that prompted
 * this was seven.
 */
const STALL_MS = 1000;
let worstStall = { ms: 0, test: "" };

beforeEach(async () => {
  loop.reset();
  /**
   * **And a turn of the loop before the test starts, for the same reason the
   * read needs one.** Measured: with `reset()` and the test body in the same
   * turn, a test that blocked for 1500ms on purpose reported **0ms** — the
   * histogram cannot observe a stall it was not re-armed before. Yield here
   * and the identical test reports 1205ms.
   *
   * That first version looked exactly like a working instrument: no error, no
   * warning, a tidy zero. It is the same silent-zero shape as the CI selftest
   * that never ran and the nightly that reported "0 failing checks" — which is
   * why this one was mutation-tested against a loop blocked on purpose before
   * it was believed.
   */
  await new Promise((resolve) => setTimeout(resolve, 0));
});

afterEach(async (ctx) => {
  /**
   * **One turn of the loop before reading, or the number is always zero.**
   *
   * The histogram does not learn about a stall until its own overdue timer
   * fires, and that cannot happen until the loop turns again — so reading
   * synchronously at the end of a test reports the delay that had accrued
   * BEFORE the test blocked, which is nothing. The first version of this did
   * exactly that: a test that blocked the loop for 1500ms on purpose was
   * reported at 0ms, and it looked like a working instrument.
   *
   * A zero-delay timer is the cheapest way to reach the timers phase, where
   * the overdue callback is already waiting. Sub-millisecond, once per test.
   */
  await new Promise((resolve) => setTimeout(resolve, 0));
  const ms = stallMs();
  // Tracked for EVERY test, not only the loud ones: the ceiling on a quiet
  // run is what says whether stalls of seconds are even in this suite's
  // ordinary range, and that is the number the flake hypothesis needs.
  if (ms > worstStall.ms) worstStall = { ms, test: ctx.task?.name ?? "(unnamed)" };
  if (ms < STALL_MS) return;
  const name = ctx.task?.name ?? "(unnamed)";
  /**
   * Printed whether the test passed or failed, and that is the point: a stall
   * under a test that PASSED is the same evidence as one under a test that did
   * not, and the passing ones are how a rare fault gets characterised before it
   * next bites. Four flakes were witnessed in one afternoon and each was a
   * separate archaeology; this is meant to make the fifth arrive with its
   * cause attached.
   */
  process.stderr.write(`stall: the event loop blocked ${ms}ms during "${name}"\n`);
});

/**
 * **Always, not only when something was wrong.** A run that reports nothing is
 * indistinguishable from an instrument that measures nothing — this week has
 * three examples — so every FILE says its ceiling, and a silent run becomes a
 * claim somebody can check rather than an absence.
 *
 * `afterAll` from a setup file runs once per test file, which is also the
 * attribution the flake hypothesis wants: the family clusters by file, and
 * "which files stall" is the question. (`process.on("exit")` was the first
 * attempt and printed nothing — a worker's exit writes do not reach the
 * reporter.)
 */
afterAll(() => {
  if (worstStall.test === "") return;
  process.stderr.write(
    `loop: worst stall ${worstStall.ms}ms — "${worstStall.test}"\n`,
  );
  worstStall = { ms: 0, test: "" };
});

/**
 * Is anything listening there NOW? Asked only when a loopback connect has
 * timed out, because it is the one question that separates "the daemon was
 * gone" from "the daemon was there and never accepted".
 */
/**
 * **How many finished connections to this port are still in TIME_WAIT.**
 *
 * The second demonstrated way to get this symptom, and the one the 31 Aug
 * `door.test.ts` witness actually fits. That failure came from `flood`, which
 * knocks on the door N times **sequentially** — not a burst — and its accept
 * queue read `1/1/128`, nowhere near full. So overflow, reproduced though it
 * is, does not explain that one.
 *
 * What sequential-and-rapid does produce is a pile of 4-tuples:
 *
 * ```
 * 300 sequential connects to one port → 517 TIME_WAIT entries for it
 * ```
 *
 * A SYN arriving for a 4-tuple still in TIME_WAIT is **dropped rather than
 * refused** — the same signature as a full queue, from the opposite cause.
 * Both are "the listener is there and the SYN went nowhere", which is why the
 * bind probe alone could never have separated them.
 *
 * So the sentence now carries both readings, and the next witness discriminates:
 * a high queue depth points at the burst, a large TIME_WAIT count at the churn.
 */
async function timeWaits(port: number): Promise<string> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)("netstat", ["-an"], { timeout: 5000 });
    const n = stdout
      .split("\n")
      .filter((l) => new RegExp(`\\.${port}\\b`).test(l) && /TIME_WAIT/.test(l)).length;
    return n > 0 ? `; ${n} TIME_WAIT on ${port}` : "";
  } catch {
    return "";
  }
}

/**
 * **How full the listener's accept queue is** — the reading that decides it.
 *
 * On 31 Aug the symptom was reproduced deterministically, which no earlier
 * round of this investigation managed. A loopback listener that EXISTS and
 * does not accept, with its queue overflowed:
 *
 * ```
 * connects: 400, failed: 305 — all ETIMEDOUT at 7823ms
 * slow successes: 1085, 2047, 2048, 3968, 5890, 5892ms
 * ```
 *
 * 7823ms against witnesses at 7791, 7803, 7808, 7813, 7819 and 7848, and the
 * slow successes tracing a SYN retransmit ladder. A full queue makes the
 * kernel DROP the SYN, which is precisely a connect that times out instead of
 * being refused.
 *
 * The control matters as much: a listener whose loop is blocked for nine
 * seconds but whose queue has room answers `CONNECTED after 9002ms`. The
 * kernel completes the handshake itself and accept merely happens late. **So
 * a busy server is not enough — the queue has to actually fill**, and
 * `kern.ipc.somaxconn` is 128 here while `daemon.test.ts`'s hundred-item move
 * — one of the two witnesses that day — issues 100 concurrent POSTs.
 *
 * What is still missing is the depth at a real failure, which is this.
 * `netstat -L` prints `qlen/incqlen/maxqlen`.
 *
 * **Read it with the same caution the bind probe carries.** This samples
 * AFTER the connect gave up, by which point the queue has had eight seconds
 * to drain — measured on a deliberately overflowed listener, it printed
 * `0/0/1`, having already emptied. So `qlen` is a snapshot and its being low
 * proves nothing; `maxqlen` is the solid half, and a `maxqlen` the burst
 * could plausibly exceed is what makes the case. A HIGH `qlen` here would be
 * strong evidence; a low one is simply no evidence either way.
 */
async function queueDepth(port: number): Promise<string> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)("netstat", ["-L", "-a", "-n"], { timeout: 4000 });
    const row = stdout.split("\n").find((l) => new RegExp(`\\.${port}\\b`).test(l));
    const depth = row?.trim().split(/\s+/)[0];
    return `${depth ? `; accept queue ${depth} (qlen/incqlen/maxqlen)` : ""}${await timeWaits(port)}`;
  } catch {
    return "";
  }
}

/**
 * **Which process holds a port, at the moment we ask.**
 *
 * The bind probe below says whether ANYTHING is there; two rounds of this
 * investigation ended needing the next word — *what*. The readings it
 * separates are the ones actually on the table: another vitest worker's
 * daemon means a cross-worker collision; this same process means a listener
 * that exists and never accepted; a stranger means the port was reused by
 * something outside the run.
 *
 * `lsof` costs ~100ms and runs only on the failure path, after a connect has
 * already spent nearly eight seconds. It is best-effort by construction —
 * absent on a stripped machine, and racing the same teardown the probe races
 * — so every failure here is silent and simply adds nothing to the sentence.
 */
async function whoHolds(port: number): Promise<string> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    // -nP: no DNS, no port-name lookup — both can block for seconds, which is
    // the last thing a diagnostic for a timeout should do.
    // NOT filtered to LISTEN: the listener is half the picture and the
    // connecting sockets are the other half. `queueDepth` below adds the
    // reading that actually decides it.
    const { stdout } = await promisify(execFile)("lsof", ["-nP", `-iTCP:${port}`], {
      timeout: 4000,
    });
    const rows = stdout
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(/\s+/))
      .filter((cols) => cols.length > 8)
      // command[pid] name (state) — `name` carries src->dst, which is the tuple.
      .map((cols) => `${cols[0]}[${cols[1]}] ${cols[8]}${cols[9] ? ` ${cols[9]}` : ""}`);
    const depth = await queueDepth(port);
    if (rows.length === 0) return depth;
    const mine = rows.some((r) => r.includes(`[${process.pid}]`));
    return (
      ` (on ${port} now: ${[...new Set(rows)].join("; ")}` +
      `${mine ? " — THIS process is among them" : ""})${depth}`
    );
  } catch {
    return "";
  }
}

async function describeListener(url: string): Promise<string> {
  const port = Number(new URL(url).port);
  if (!Number.isFinite(port) || port === 0) return "";
  const { createServer } = await import("node:net");
  return new Promise<string>((resolve) => {
    const probe = createServer();
    const done = (verdict: string) => {
      probe.removeAllListeners();
      probe.close(() => resolve(verdict));
    };
    probe.once("error", async (err: NodeJS.ErrnoException) =>
      // EADDRINUSE: somebody IS on it, and did not accept. Which somebody is
      // the question the 30 Aug evidence is circling, so ask.
      resolve(
        err.code === "EADDRINUSE"
          ? `; something IS listening on ${port} and did not accept` +
            (await whoHolds(port))
          : `; the port could not be probed (${err.code})`,
      ),
    );
    probe.listen(port, "127.0.0.1", () => done(`; NOTHING was listening on ${port}`));
    /**
     * **What this cannot tell you**, recorded where the next reader will be
     * tempted to trust it: the probe runs AFTER the timeout, by which point
     * the test has given up, `afterEach` may have closed the daemon, and the
     * kernel may have handed the port to something else. "Something IS
     * listening" is true of the probe's moment, not proof it was the same
     * socket that dropped the SYN.
     *
     * `whoHolds` below answers the question this note asked for next — WHICH
     * process — and inherits the same caveat, which is why it is reported as
     * "held now by", not "the socket that dropped it".
     */
  });
}

/**
 * Bounded by the CLOCK, not by a number of attempts — and that distinction was
 * paid for. The first version retried four times, which is fine against
 * `ECONNREFUSED` (instant) and catastrophic against `ETIMEDOUT`: a connect
 * timeout can sit for ten seconds on its own, so four of them turned one 8s
 * failure into a `beforeEach` that blew the 30s hook limit. The retry made
 * the symptom worse while fixing the cause.
 *
 * **The budget used to be checked only BETWEEN attempts, so one slow attempt
 * could and did exceed it.** Witnessed 29 Aug: `connect ETIMEDOUT 127.0.0.1`
 * on a POST to the door, "gave up after 7803ms and 1 attempt (budget
 * 3000ms)". The kernel's SYN retransmit ladder is what set that 7.8 seconds,
 * and nothing in the budget could shorten a single attempt.
 *
 * **Why it was not fixed by aborting each attempt, and what fixes it
 * instead.** An `AbortSignal.timeout` would have broken the rule directly
 * below it: a retry is safe here ONLY when nothing reached the server, and an
 * `AbortError` carries no syscall — it cannot tell a connect that never
 * completed from a request already on the wire. Retrying on that would let a
 * POST that mints a badge mint two.
 *
 * A CONNECT deadline can. undici's `Agent({ connect: { timeout } })` bounds
 * the TCP connect alone and fails it with `UND_ERR_CONNECT_TIMEOUT` — an
 * error that, by construction, means no request was ever written — so an
 * attempt whose SYN went nowhere costs `CONNECT_ATTEMPT_MS` instead of the
 * kernel's eight seconds, and the next attempt's SYN, sent into a queue that
 * has by then drained, lands. The budget is now real: three attempts fit
 * inside it. Node's global fetch takes no dispatcher we can construct from
 * outside its bundled undici, so the suite's fetch is the npm undici's, the
 * same code at the same major.
 *
 * The message still says the truth — how long it really took, how many
 * attempts it really made, and what was listening. See
 * `docs/research/2026-08-29-the-flake-family.md`: a loopback connect that
 * takes 7.8 seconds is not an application bug at all, and this is the fix
 * that does not need to know which of the two ways the SYN was lost.
 */
const CONNECT_BUDGET_MS = 3000;
const CONNECT_ATTEMPT_MS = 1200;
const connectBounded = new Agent({ connect: { timeout: CONNECT_ATTEMPT_MS } });
const realFetch: typeof fetch = (input, init) =>
  undiciFetch(input as Parameters<typeof undiciFetch>[0], { ...(init as Parameters<typeof undiciFetch>[1]), dispatcher: connectBounded }) as unknown as Promise<Response>;
globalThis.fetch = async function retryingFetch(input, init) {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await realFetch(input, init);
    } catch (err) {
      const cause = (err as { cause?: { syscall?: string; code?: string } }).cause;
      const neverLeft =
        // The connect deadline fired: undici's own word that no request was
        // written. The same guarantee `syscall === "connect"` gives below.
        cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        (cause?.syscall === "connect" &&
          (cause.code === "ETIMEDOUT" || cause.code === "ECONNREFUSED" || cause.code === "ECONNRESET"));
      /**
       * **When it gives up, it says what it gave up ON.**
       *
       * `TypeError: fetch failed` is what Node throws, and it is the single
       * least useful sentence this suite can produce: it names no address, no
       * syscall, no duration. Seven failures were recorded across a week on
       * that message alone, in seven different files, and none of them could
       * be told apart afterwards — which is why "the flake family" stayed one
       * undifferentiated thing for so long.
       *
       * A run that fails now carries its own diagnosis: which host, which
       * error code, how long it tried, how many attempts it made. That does
       * not fix anything by itself. It makes the NEXT occurrence evidence
       * instead of another sighting.
       */
      if (!neverLeft || Date.now() - started >= CONNECT_BUDGET_MS) {
        const where = typeof input === "string" ? input : String((input as Request).url ?? input);
        const took = Date.now() - started;
        (err as Error).message =
          `${(err as Error).message} — ${init?.method ?? "GET"} ${where}` +
          `, ${cause?.syscall ?? "?"}/${cause?.code ?? "?"}` +
          `, gave up after ${took}ms and ${attempt + 1} attempt${attempt === 0 ? "" : "s"}` +
          (neverLeft ? ` (budget ${CONNECT_BUDGET_MS}ms)` : " (not a connect failure — not retried)") +
          /**
           * **The two facts, in one sentence.** A connect that timed out on
           * loopback and a loop that stalled for seconds are the same event
           * seen from two sides, and reading them in two places — an assertion
           * message here, a `stall:` line somewhere up the log — is how an
           * afternoon gets spent proving they are related. Reported for THIS
           * test, since the histogram is reset before each one.
           */
          `, loop stalled ${stallMs()}ms during this test` +
          /**
           * **Everything known about a dropped SYN, in one sentence.**
           *
           * A loopback connect that TIMES OUT rather than being refused means
           * the SYN was dropped. The bind probe first separated the two
           * readings — nothing there, or something there that never accepted
           * — and on 31 Aug it answered: something IS listening, and it is
           * this very process.
           *
           * The mechanism was then reproduced deliberately. A listener with an
           * overflowed accept queue fails 305 of 400 connects, every one at
           * 7823ms, against witnesses at 7791-7848ms. The control rules out
           * the weaker story: a listener whose LOOP is blocked for nine
           * seconds but whose queue has room answers `CONNECTED after 9002ms`,
           * because the kernel completes the handshake itself.
           *
           * So the sentence carries three things now — is anything there, WHO
           * (the holder's pid), and how deep the queue is. What is still
           * unmeasured is the depth at the instant of a real failure; see
           * `queueDepth` for why a low reading is not evidence against.
           */
          ((cause?.syscall === "connect" && cause.code === "ETIMEDOUT") || cause?.code === "UND_ERR_CONNECT_TIMEOUT"
            ? await describeListener(where)
            : "");
        throw err;
      }
      // Give the stalled loop a moment, and lengthen it — a machine that is
      // busy now is likely to be busy in a millisecond.
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
} as typeof fetch;
