# The flake family, and the first one caught in the act

**29 August 2026**

**Status: one member fixed with proof; five more witnessed in a single
afternoon; and — after instrumenting the event loop — the leading hypothesis
KILLED by its first measurement. The evidence now points below the
application, at test daemons listening on ports inside the kernel's ephemeral
range.** This note exists because the family had
been chased twice by reasoning and never by observation, and the second kind
of attempt just produced something the first kind could not.

---

## What was already known

**The one that is fixed.** `stdout += chunk` destroys a UTF-8 character split
across a chunk boundary, because a `Buffer` coerced to a string is decoded
independently of its neighbours. Nine files did it. The fix is proven and the
guard bites.

**What was ruled out for the rest**, and how:

| Hypothesis | Killed by |
| --- | --- |
| Load / CPU starvation | Four full green runs, one under 20 spinners on 14 cores |
| A shared home directory | Every suite takes its own `mkdtemp` |
| Port collision | Per-worker port slices |

**The lead that survived:** failures cluster in tests that start **two
daemons** and have one talk to the other.

---

## The witness, 29 Aug 2026

A full-suite run failed one test, and the failure is the most specific
evidence this investigation has had:

```
FAIL packages/server/test/door.test.ts
     > the door is metered
     > gives two X-Forwarded-For values behind one socket two buckets
AssertionError: expected 404 to be 200
  at packages/server/test/door.test.ts:994
```

It did not reproduce: three consecutive runs of that file, 39 tests each, all
green.

### Why the status code is the whole finding

The test starts a **second daemon** (`wide`, bound `0.0.0.0`, the hosted
posture) and knocks on the door route. The sequence it got:

1. `MINT_BURST` knocks as `203.0.113.7` → **200** each
2. one more → **429**, correctly metered
3. a knock as `198.51.100.9`, a different visitor on the same socket → **404**

**`app.post(DOOR_ROUTE, …)` contains no 404 path.** Every branch in that
handler returns 200, 429, or a `Set-Cookie` 200. `isOpen()` explicitly
allow-lists `POST` to this route, so the badge gate is not it either. The
route answered correctly a dozen times in the preceding milliseconds and then
answered with a status its own handler cannot produce.

That eliminates the explanations reached for first:

- **Not addressing.** A wrong port cannot answer 200 twelve times and then
  404 on the thirteenth request to the same URL.
- **Not metering.** Metering's refusal is a 429, which the test had just seen
  work.
- **Not the badge gate.** It would be 401 or 403, and the route is open.
- **Not readiness.** The daemon had been serving this exact route throughout.

So a 404 here means the request was answered **by something other than that
route** — a not-found handler, or a different listener — while the same client
had been reaching the route successfully moments before.

### What to instrument next

The cheapest experiment that would settle it: on this failure, capture the
response BODY and headers, not only the status. Fastify's default not-found
handler and a foreign listener answer differently, and one line of body text
would say which. The test currently reads `.status` and discards the rest,
which is why a witnessed failure still leaves two candidates standing.

Second: log `wide.app.server.address()` alongside the port actually dialled.
If a second listener is in play, that is where it shows.

**No fix is proposed here.** A guess that lands on a green suite is
indistinguishable from a fix, and this family has already absorbed two rounds
of reasoning that felt conclusive and changed nothing.

---

## A second witness, twenty minutes later

The next full run failed a **different** test, and the two together say more
than either alone:

```
FAIL packages/cli/test/pass.test.ts
     > isocan setup <address>#<pass> — one command, three steps collapsed
     > points at the home, redeems, writes the marker, and becomes her
error: this badge does not speak for usr_priya — claim that actor first …
  at packages/cli/test/pass.test.ts:267
```

Same signature: **two daemons**, and a credential that had just been
established failing on the very next use. The away CLI redeems a pass against
the home, the home writes the badge→actor link, and the away CLI's next
command is told the badge does not speak for that actor.

### The hypothesis both witnesses fit

Not load, not ports, not homes — **an acknowledged write that the next read
does not see.** In the pass case the link is written and immediately not
found. In the door case a route that had answered a dozen times answers with a
status it cannot produce, which is what a request landing somewhere other than
the route it addressed looks like.

Two properties of the family follow from that and are worth stating, because
they explain why two rounds of load-testing found nothing:

- **Load does not reproduce it.** Contention changes timing in both
  directions; a visibility race is as likely to be hidden by a slow machine as
  exposed by one. Four green runs under twenty spinners is consistent with the
  hypothesis rather than evidence against it.
- **Retrying hides it.** Anything that re-asks a moment later succeeds, which
  is why these read as "flaky" rather than "broken".

**This is still a hypothesis.** It has not been demonstrated, and the honest
next step is the same as before: make the failures carry more, then read them.

### What now records more

`door.test.ts` no longer throws away the response. On any status the door
handler cannot produce, the failure carries the body and the `server` header —
which distinguishes a not-found handler from a foreign listener, the two
candidates the first witness left standing. The ordinary path is unchanged.

---

## A third witness, and this one names its own cause

```
FAIL packages/web/test/pass.test.ts
     > a tab that arrives carrying one
     > admits without endowing when the pass carries no actor
TypeError: fetch failed — POST http://127.0.0.1:59863/api/door,
  connect/ETIMEDOUT, gave up after 7803ms and 1 attempt (budget 3000ms)
Caused by: Error: connect ETIMEDOUT 127.0.0.1:59863
```

**A connect timeout on loopback.** That is the whole finding, and it is not an
application-level fact at all. On 127.0.0.1 a connect either completes
immediately or is refused; ETIMEDOUT means the SYN sat in a listen backlog
that was never accepted — **the daemon's event loop was blocked long enough
that the kernel gave up on the handshake.**

Everything about the family follows from that better than from anything
proposed so far:

- It looks like "the second daemon is unreachable" because a blocked loop
  cannot accept, and a suite running two daemons has twice as many chances.
- It does not reproduce, because whatever blocks the loop is occasional.
- Load does not surface it — a starved machine changes *when* the block
  happens, not whether it can.

**This supersedes the visibility-race hypothesis from the second witness.**
That one fitted two observations; this one is measured rather than fitted, and
a blocked event loop would produce the second witness's symptom too — a
redemption that appears not to have landed because the request that carried it
timed out.

### And the retry could not help, for a reason worth knowing

`retryingFetch` gives up "after 3000ms", and the failure above took **7803ms
in a single attempt**. The budget is checked *between* attempts, so one slow
attempt sails past it: the guard that exists to turn a connect failure into a
retry never got a second chance to run.

It is deliberately still not fixed by aborting each attempt at the budget. A
retry is safe there only because `syscall === "connect"` proves no bytes
reached the server; an `AbortError` carries no syscall and cannot make that
promise, so retrying on one would let a POST that mints a badge mint two. The
comment in `test/setup.ts` now says what the budget does instead of what it
was assumed to do.

### The experiment that would settle it

Sample the daemon's event-loop delay (`perf_hooks.monitorEventLoopDelay`)
across a suite run and report the maximum per test file. If a blocked loop is
the cause, the failing files are the ones with a multi-second stall, and the
question becomes the much smaller one of *what* blocks it — a synchronous
`readFileSync` over an oplog, a hash over a large blob, a snapshot rebuild.

---

## A fourth witness, which contradicts the table above

```
FAIL packages/cli/test/upgrade-notice.test.ts
     > is silent about a word arriving where a sha belongs
Error: listen EADDRINUSE: address already in use 127.0.0.1:62903
```

**Port collision is listed as killed in the table at the top of this note, by
"per-worker port slices".** It is not killed. Whatever the slicing does, two
things asked for 62903 in the same run.

Recorded rather than explained, and the table is left standing with this
underneath it deliberately: the entry was written in good faith from a real
mitigation, and striking it out would hide that a mitigation which looked
sufficient was not. A cost that was PAID rather than avoided is worth being
able to see.

It also sits oddly beside the third witness. A connect that times out on
loopback and a port that is already in use are both about *sockets*, in a
suite whose members were assumed to be about state. Whether that is one cause
or two is exactly what the event-loop experiment above would start to separate.

---

## The experiment, run

`test/setup.ts` now watches the event loop. The tests start their daemons
**in-process**, so the worker's loop IS the daemon's loop: a stall measured
here is the stall that did not accept the connection. The histogram is reset
per test, so a number attaches to a NAME; every file reports its ceiling
whether or not anything went wrong, and any stall over a second says so loudly.
When `retryingFetch` gives up it now names the stall in the same sentence as
the timeout, so the two halves of the hypothesis arrive together instead of
being correlated by hand an afternoon later.

**It was mutation-tested before it was believed**, and the first version failed
that test: a test that blocked the loop for 1500ms on purpose was reported at
**0ms**. Twice, for two different reasons — the histogram cannot observe a
stall until its own overdue timer fires (so the read needs a turn of the loop),
and it cannot observe one it was not re-armed before (so `reset()` needs one
too). Both versions looked exactly like a working instrument: no error, no
warning, a tidy zero. That is the third silent zero this week, and the only
reason it is not the fourth is that it was pointed at a loop blocked on
purpose.

### What it found

**A quiet, green run**, 185 files:

| | worst stall |
| --- | --- |
| `lint.test.ts` "reports no violation anywhere in src" | 375 ms |
| everything else | 40–82 ms |

**Under 16 spinners on 14 cores**, green again:

| | worst stall |
| --- | --- |
| `lint.test.ts` "reports no violation anywhere in src" | 1242 ms |
| everything else | 150–250 ms |

**The witness needed 7803 ms.** Nothing in either run is within a factor of six
of that, and the one outlier is a synchronous source scan in a file that starts
no daemon. So a stall of that size is **not** in this suite's ordinary
distribution, oversubscribed or not.

### What that means, stated carefully

It does not confirm the hypothesis and it does not kill it. Neither run
reproduced a flake, so there is still no paired observation — the thing this
was built to produce. What has changed is that the **next** one arrives with a
number attached, and the number is decisive either way:

- a stall of seconds under the failing test → the blocked-loop hypothesis is
  confirmed, and the question shrinks to *what blocks it*
- a stall of 50 ms under the failing test → **the hypothesis is dead**, and the
  cause is below the application: the socket layer, the kernel's backlog, or
  the harness itself

The second outcome is the more valuable one to have made possible, because it
is the one no amount of reading the application code could ever reach.

### A limit of the instrument, measured

**78 of 185 files reported a ceiling.** Every file should. The cause is not
deduplication — all 78 lines are distinct — and it is not yet understood, so
the baselines above are a claim about those 78 (which do include the
daemon-heavy files the family clusters in) rather than about the suite. Worth
fixing before the numbers are leaned on harder.

---

## The verdict, on the very next run: the hypothesis is DEAD

The instrument caught a flake the first time one occurred after it landed, and
the sentence it produced is the whole answer:

```
FAIL packages/server/test/blobs.test.ts
     > the blob route honors Range > refuses a zero-length suffix
TypeError: fetch failed — POST http://127.0.0.1:59866/api/door,
  connect/ETIMEDOUT, gave up after 7848ms and 1 attempt (budget 3000ms),
  loop stalled 30ms during this test
```

**The loop stalled 30 milliseconds.** A connect to loopback timed out after
7.8 seconds while the process was, by measurement, entirely responsive.

So the blocked-loop hypothesis — the one this instrument was built to test, and
the one this document argued for two sections ago — **is wrong**. It was the
best reading of the evidence available and it does not survive its first
measurement, which is the outcome the experiment was designed to be able to
produce. Nothing in the application was busy. The fault is below it.

### Where it actually is, and the evidence is now converging

Every socket-flavoured witness names a port, and every one of them is in the
**ephemeral range**:

| Witness | Port | macOS ephemeral range |
| --- | --- | --- |
| ETIMEDOUT (pass.test.ts) | 59863 | 49152–65535 |
| ETIMEDOUT (blobs.test.ts) | 59866 | 49152–65535 |
| EADDRINUSE (upgrade-notice.test.ts) | 62903 | 49152–65535 |
| EADDRINUSE, same run | 64787, 49177 | 49152–65535 |

`sysctl net.inet.ip.portrange.first` is 49152 on this machine. **Test daemons
are listening on ports the kernel is simultaneously handing out to outgoing
connections**, which is the same collision Dimitri's fix names from the other
side: it removed three tests that probed for a free port and then raced to bind
it. `EADDRINUSE` is that race lost at bind time. `ETIMEDOUT` on loopback with
an idle loop is consistent with losing it at connect time — a SYN arriving at a
socket in a state that drops it rather than refusing it.

Two people, two symptoms, one range. That is the strongest thing this
investigation has, and neither half would have been conclusive alone: the
`EADDRINUSE` evidence has no loop measurement, and the loop measurement without
the port numbers would have said only "not the application".

### The next step, and it is small

Bind test daemons **below 49152**. `port: 0` asks the kernel for a free port
and the kernel answers from exactly the range it is also allocating outgoing
connections from — which is correct behaviour for a client and the wrong ask
for a server that something else must then connect to. A per-worker slice in
the registered range takes the collision off the table for both symptoms at
once, and it is testable: if it is right, both families stop.

Recorded, not yet done. The prediction is written down first on purpose.

---

## The shape worth keeping

Both times this family gave anything up, it was to **observation rather than
argument** — the split-UTF-8 member to instrumentation that named the request,
and this one to a status code that the code says is impossible. The
instrumentation added on 28 Aug (naming the request, syscall, duration and
attempt count on give-up) is what made the failure readable at all.

The next round should add to what a failure RECORDS, not to what we believe
about it.
