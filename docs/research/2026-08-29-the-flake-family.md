---
status: partial
since: 2026-08-29
note: 4 of 5 witnesses diagnosed
---
# The flake family, and the first one caught in the act

**29 August 2026**

**Status, 30 Aug 2026: four of five witnesses diagnosed. The fifth has now
outlived TWO hypotheses — and the second attempt at a fix was REVERTED after
CI showed it made things worse, which is its own lesson** — a
blocked event loop, and a port collision. It recurred on a private port with
the loop idle, which is the finding, and the next instrument is in place to
separate the two readings that are left. The split
UTF-8 chunk, a grader that waited two seconds instead of waiting for the page,
and a "slow machine" that was a dead process missing `tsx` in a git worktree
are all fixed at the cause. Nothing this suite listens on sits in the kernel's
ephemeral range any more. The blocked-event-loop hypothesis was killed by its
own first measurement, which is what the instrument was built to be able to
do. This note exists because the family had
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

## A fifth witness, of a different species, and it points the wrong way

```
FAIL test/graders.test.ts > every reading comes with the check it decides
AssertionError: expected 1 to be greater than 4
```

The grader ran against `deliberately-bad.html` — a page built to break seven
checks — inside a full 14-worker suite run, and reported **one** failure. Alone
it reports seven, every time.

Not a socket flake, and worth separating from the family above: nothing timed
out and nothing was refused. **Under load, an instrument reported healthier than
the truth.** Whatever slowed it — a headless Chrome starved of CPU, a page
whose paint had not settled when the probe read it — the direction is the
dangerous one, and it is the fourth appearance this week of the same shape.

The check that caught it is the one that exists for exactly this: `--selftest`
asserts every check FIRES on a page built to break them. It did its job. But it
also means the grader's readings are load-sensitive, which nothing else has
established, and a nightly running beside other work could report a clean page
that is not. Unchased; recorded so the next occurrence is a second data point
rather than a first.

---

## The prediction, half-confirmed the same afternoon

This note ended by predicting the fix: **bind test daemons below 49152**,
because `port: 0` asks the kernel for a free port out of exactly the range it
is also handing to outgoing connections.

`test/ports.ts` — written independently, from the `EADDRINUSE` side — does
precisely that: a private range at 20000–32000, sliced per worker, *"below
every ephemeral floor we run on"*. Two people reached the same range from two
symptoms.

**It does not cover the failures still being seen, and the boundary is exact.**
`ports.ts` is for tests that must tell ANOTHER PROCESS the number before
anything is listening. The `packages/server` tests do not: they call
`startDaemon({ port: 0 })` and read `server.address()`, so they never guess and
`ports.ts` correctly leaves them alone.

But `port: 0` is the OS's ephemeral range, and that is where every remaining
`ETIMEDOUT` lives:

```
POST http://127.0.0.1:59866/api/door, connect/ETIMEDOUT,
  gave up after 7813ms and 1 attempt, loop stalled 17ms during this test
```

**17ms.** The second measurement, in a different file, confirming the first:
the loop is idle while a loopback connect times out for nearly eight seconds.

And `59866` is the same port as the earlier `blobs.test.ts` failure, in a
separate run. Nothing is listening on it now and nothing was listening in that
band; the repeat is the kernel's rotating counter landing in the same place,
which is what makes a listening socket in that range a standing hazard rather
than a rare one.

**So the next step is narrow and testable:** give the in-process daemons a port
from the private range too, rather than `port: 0`. If the hypothesis holds, the
`ETIMEDOUT` family stops. If it does not, the cause is below even this, and the
next place to look is the loopback stack rather than anything isocan wrote.

---

## The fix, applied

**Nothing this suite listens on may sit in the range the OS is handing to
outgoing connections.** That is the whole rule, and it is now true:

- **75 call sites** across 45 files moved from `startDaemon({ port: 0 })` to
  `startDaemon({ port: await reservePort() })`. `ports.ts` already answered
  from a private per-worker slice at 20000–32000; it had simply never been
  pointed at the in-process daemons, because they never had to TELL anybody
  the number and so never looked like they were guessing.
- **`test/emulator.ts` stopped being an exception.** It could not use
  `ports.ts` — it runs in globalSetup, before any worker exists, so there is
  no `VITEST_POOL_ID` to slice by — but it was still doing `listen(0) → read →
  close → hand it over`, which is the same guess out of the same range. It
  now scans its own band at 19000, below the workers'.
- **A guard**, because `port: 0` is an ordinary thing to write that reads as
  "you pick" and is wrong here for a reason nothing in the call site suggests.
  Seventy-five were converted at once; one written tomorrow would put the
  family back and look completely reasonable doing it.

### Two bugs in the fixing, both of the week's shape

The guard **passed on a file that had `port: 0` in it.** Its pathspec was
`packages/*/test`, which matches nothing in git — a search over no files always
succeeds. Found by mutation-testing the guard rather than by reading it.

And it **failed on success**: `git grep` exits 1 when it finds nothing, which
here is the pass, so the bare call threw. That would have been the fifth
instrument this week to report the opposite of the truth.

### FALSIFIED, the next morning — and that is the instrument working

**30 Aug.** An `ETIMEDOUT` on loopback, on port **20807** — inside the private
range this fix moved everything into, not the kernel's ephemeral band — with
the loop measured at **13ms**.

```
POST http://127.0.0.1:20807/api/ops, connect/ETIMEDOUT,
  gave up after 7808ms and 1 attempt, loop stalled 13ms during this test
```

So the port-range hypothesis is **dead**, exactly as the section below said it
would be if this happened. That is the outcome the change was designed to make
possible: the collision surface was removed first, so the next occurrence
means something instead of being another sighting.

**Two hypotheses have now been killed by measurement rather than argument** — a
blocked event loop, and a port collision — and both were the best available
reading of the evidence at the time. What is left is narrower and stranger than
either: on loopback, a connect to a port with no listener is REFUSED, not timed
out. A timeout means the SYN was **dropped**. Two readings survive:

- **Nothing was listening.** The daemon had already gone, and the SYN went to a
  port nobody held.
- **Something was listening and never accepted.** The listener existed and the
  accept did not happen, despite an idle loop.

**The error cannot tell them apart, which is why two rounds of this ended in a
guess.** So `retryingFetch` now answers it with one bit: on a connect timeout
it tries to BIND the port. A successful bind means nothing was there; an
`EADDRINUSE` means something was there and did not accept. The next occurrence
arrives with that sentence attached.

### What is claimed, and what is not

Four full runs green unloaded, and two under 16 spinners on 14 cores.
**Zero `EADDRINUSE`, zero `ETIMEDOUT`, across all six** — under exactly the
load that used to produce them.

**That is consistent with the fix and is not proof.** The family was rare
enough that four clean runs was never evidence, which is exactly why two
earlier rounds of "it seems fine now" were wrong. What makes this different
from those rounds is not the count of green runs; it is that the mechanism was
identified first and removed, so the next occurrence means something.

**The loaded runs did fail three tests, and they are a different species** —
worth separating rather than counting as the same thing. All three were the
browser-driven graders timing out, with no socket error anywhere. One sat for
**nineteen minutes**: waiting for the page rather than for two seconds was the
right fix, and it had no deadline, so a starved runner waited all day and then
failed on vitest's limit with nothing said about what it was waiting for.
`lessons.md` names that shape — *a hang that never fails is the thing to avoid,
not a slow test that eventually does* — and `devtoolsEndpoint` in the same file
already had the discipline. The page load has it now: 60 seconds on the
condition, and a sentence naming the condition.

What HAS changed is that the hypothesis is now falsifiable in the useful
direction: **if an `ETIMEDOUT` on loopback appears again, the cause is not the
port range**, because there is no longer a listener in that range to collide
with. The next occurrence would move the search below the application — to the
socket layer or the harness — rather than around it.

---

## The fix was wrong twice, and CI said so

**30 Aug, later.** `release.yml` failed on two consecutive commits:

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:20200
```

**20200 is inside the private range this change moved everything into** — and
the old arrangement could not have produced it.

`port: 0` is ATOMIC: the kernel picks a free port and binds it in one call,
with no window and no wraparound. `reservePort` probes, closes the probe, and
hands the number over — a race — inside a 100-port slice per worker that
`offset % SLICE` wraps around. A worker running dozens of daemons across many
files blows past 100 reservations easily, and then reaches for a port something
is still holding.

So the change **replaced something safe with something racy, in order to fix
something it demonstrably did not fix** — the `ETIMEDOUT` had already recurred
on port 20807, inside the same private range, with the loop measured idle.

**Reverted: all 75 in-process daemons are back on `port: 0`.** What survives is
the narrow rule `ports.ts` was written for and which is still right — a test
that must tell ANOTHER PROCESS the number before anything is listening cannot
use `port: 0`, because it never learns the number. Seven files, and only those.

### What this costs the investigation

The port-range hypothesis is dead twice over now, and the second death is the
more useful one: it was not merely unhelpful, it was **actively worse**, and
only CI could tell — four local runs and two under load had all been green.
That is the whole argument for a gate that runs somewhere other than the
machine that wrote the change.

The `ETIMEDOUT` family is back to where the loop measurement left it: not the
application, not the port range. The instrument added for it — binding the port
on a connect timeout, to separate "nothing was listening" from "something was
and did not accept" — is untouched and is still the next real evidence.

---

## The instrument answered, 30 Aug: something WAS listening

The bit added on 29 Aug — bind the port on a connect timeout, to separate the
two surviving readings — fired for the first time:

```
POST http://127.0.0.1:59856/api/door, connect/ETIMEDOUT,
  gave up after 7789ms and 1 attempt, loop stalled 13ms during this test;
  something IS listening on 59856 and did not accept
```

**So it is the second reading.** A server socket existed on that port, the event
loop was idle at 13ms, and the SYN was dropped for nearly eight seconds. Not
"the daemon had gone" — something was there and did not accept.

Three facts, together, are strange in a way none of them is alone:

- **59856 is ephemeral.** This is after the revert, so the daemon took its port
  from `port: 0` — kernel-assigned and atomically bound.
- **The loop measured was idle**, so whatever holds the socket was not the
  process whose loop was measured — or the accept queue was not being drained
  by the thing that owns it.
- **No stale daemon was on this machine** when the run finished (`pgrep`: none),
  so nothing obviously outlived its test.

### The instrument's own limit, which this exposed

**It probes AFTER the failure.** By the time the bind is tried, the test has
given up, `afterEach` may have closed the daemon, and the kernel may have handed
the port to something else. So "something IS listening" is true at the moment of
the probe and is not proof it was the same socket that dropped the SYN.

That is a real weakness and it is worth naming rather than reading past: the
next version should capture the listener's identity, not merely its existence —
the pid holding the port, taken at the moment of the timeout rather than after
it. `lsof -nP -iTCP:<port>` is one line and would say whether the holder is this
worker, another worker, or something outside the run entirely, which is the
question all three facts above are circling.

**Still the most specific evidence this family has produced**, and the first
that rules a possibility OUT rather than adding one.

---

## The shape worth keeping

Both times this family gave anything up, it was to **observation rather than
argument** — the split-UTF-8 member to instrumentation that named the request,
and this one to a status code that the code says is impossible. The
instrumentation added on 28 Aug (naming the request, syscall, duration and
attempt count on give-up) is what made the failure readable at all.

The next round should add to what a failure RECORDS, not to what we believe
about it.
