---
status: blocked
since: 2026-08-30
see: launch, on-demand
blockedBy: guess 3 — whether actions:write without actions:read can dispatch. Needs a fine-grained token on dglazkov/isocan, so it is Dimitri's to make. The other four are measured.
note: spike run 30 Aug; 4 of 5 guesses answered
---
# Agent-on-demand: what happens when the hook fires

**29 August 2026.** [innkeeper.md](../multiuser/innkeeper.md)'s mechanism 11
answers *may the home mint this?* — frozen delegation, a registration bounded
by what its creating session could have minted, dying with its creator's
grant. Nothing answered **what happens when it fires**, and
[phases.md](../multiuser/phases.md) names this doc in two places as the gate
on phase 12.

This is the operational half. It is written before the spike on purpose, so
the spike has something to disagree with: *a design that reasons about a
vendor is a hypothesis*, and the last section says exactly which parts of this
one are guesses.

## The hook contract, written down

A registration holds a `hook`. Until now that has been a slogan. It is:

```
POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/{file}/dispatches
Authorization: Bearer <scopedToken>
{ "ref": "<branch>", "inputs": { "summons": "<opaque>" } }
```

Three things follow from that shape and they are the whole design.

**204, and no run id.** `workflow_dispatch` answers `204 No Content`. It does
not say which run started, and there is no field that could carry one. The
home therefore learns *the request was accepted*, which is not the same as
*something is running*, and it cannot learn the second by asking.

**The token is write-only by choice.** `actions:write` on one repo, which is
the least that can fire a workflow. It deliberately does NOT carry `actions:read`
— a token that could poll runs could also read every other run in the repo,
and a home that holds one is a home that has taken custody of somebody's CI
history. The 204 is not a limitation we suffer; it is the price of a token
that cannot read.

**Inputs are strings, capped, and visible.** Dispatch inputs are limited to
ten and are readable by anybody with repo read. See "the payload is not
private".

## How the home observes the failure it promises to report

The innkeeper's diagram ends with "or *Sonia couldn't start*", said in the
thread where everyone can see it. Making that true is this section, and it is
the hardest part of the design because **the home cannot watch**.

The signal is **pass redemption within a deadline**, and it works because the
pass already exists for another reason:

1. The home mints a per-summons pass and puts it in the dispatch payload.
2. It fires, gets its 204, and records `dispatched-at`.
3. The agent boots, redeems the pass, and the desk records the redemption —
   this is the existing single-use redemption, not a new mechanism.
4. If the pass is unredeemed at `dispatched-at + BOOT_DEADLINE`, the home says
   so in the thread.

**What that signal can and cannot tell you**, stated plainly because the
thread will be trusted:

- **It cannot distinguish** a workflow that never started from one that
  started and died before redeeming — a missing secret, a bad clone, a
  disabled workflow, a runner shortage. All arrive as silence.
- So the message must not name a cause. "Sonia couldn't start" is the honest
  ceiling; "the workflow is disabled" would be a guess with a plausible face.
- **A late redemption is not a failure.** If the pass is redeemed after the
  deadline, the agent is alive and the deadline was wrong. The thread must be
  able to take that back: the "couldn't start" note is amended rather than
  left standing, because a false report of failure that nobody corrects is
  worse than a slow one.

**BOOT_DEADLINE is a guess and is flagged as one.** A cold GitHub-hosted
runner is commonly 20–60s to first line; a queue under load is minutes. The
spike measures it. Until then the number is a variable with a comment, not a
constant with confidence, and the pass's TTL must exceed it or the deadline
fires on a pass that has already expired — a failure the home caused.

## The payload is not private

**Dispatch inputs are readable by anyone with repo read**, and they persist in
the run's metadata. Whatever the home puts there is disclosed to every
collaborator on that repo for as long as the run record lives.

The pass is single-use and short-lived, which bounds the damage, and does not
remove it: within the TTL, a repo reader can redeem a pass minted for somebody
else and arrive as the registered actor. The mitigations, in order of how much
they actually buy:

1. **The TTL is the control.** It should be the boot deadline plus a small
   margin, not the desk's default fifteen minutes. A pass that outlives the
   boot it was minted for is a credential lying in a public field.
2. **Nothing else goes in the payload.** No canvas title, no message body, no
   actor name — the summons is an opaque handle the agent exchanges at the
   home for what it needs. A payload that carries context is a payload that
   leaks context.
3. **Redemption is bound to first use, not to the caller.** Anyone can redeem
   it; that is inherent to a string in a readable field, and pretending
   otherwise with an IP or user-agent check would be a comfort rather than a
   control.

**The consequence to accept, out loud:** a summons to a repo with untrusted
read access is a summons whose actor may be impersonated for the TTL. That is
a property of `workflow_dispatch`, not of isocan, and the design's answer is
to say it in the registration flow rather than to pretend the payload is a
secure channel.

## The harness credential

The design has never mentioned it because it lives outside the walls, and that
is exactly why it belongs here.

For the summoned agent to do anything, the workflow needs a model API key. It
is a **standing repository secret**, owned by whoever set up the repo, not by
isocan and not by the home. Three things follow:

- **isocan never sees it, never rotates it, and cannot revoke it.** Frozen
  delegation binds what the HOME may mint. It says nothing about what CI can
  spend, and it must not be read as bounding that.
- **The blast radius of a summons is therefore the repo's, not the canvas's.**
  Somebody who can fire the hook can spend the repo's model budget. The rate
  limit that matters is the one on summons concurrency, below.
- **It is a second death.** A registration whose harness credential has been
  revoked or exhausted looks exactly like a boot failure: the pass goes
  unredeemed and the thread says "couldn't start". Nothing in the home can
  tell the difference, and the doc says so rather than promising a diagnosis.

## The second death: a spark that lies

A registration's first death is designed and clean — its creating grant is
revoked, the sweep re-runs the door test, the registration dies with it.

The second is the **vendor token expiring**. A GitHub fine-grained token has a
maximum life; an org can revoke one; a repo can be archived. The registration
is still valid by every rule the home checks, so the spark in the facepile
says an agent is available, and the summons 401s.

**A spark that lies is worse than no spark**, because the whole point of the
pile is that it is true. The design:

- **A failed dispatch is recorded on the registration, not just in the
  thread.** A `lastDispatch: { at, status }` on the private ledger row.
- **A 401 or 404 marks the registration `unreachable`** — not deleted, because
  deleting on a vendor's answer hands the vendor a revoke button on somebody
  else's data, and a token rotated back in should not have cost a
  registration.
- **An unreachable registration does not spark.** It shows as needing
  attention to the person who created it, wherever registrations are managed.
- **Nothing re-tests it on a timer.** A poll is a token being spent to ask a
  question nobody asked; the next summons is the test, and it is cheap because
  it was going to happen anyway.

## Concurrency, and the re-run button that can never work

**One summons at a time** is already frozen delegation's rule. The operational
half is what "at a time" means:

- A registration holds `inFlight: passId | null`, set when a summons is
  dispatched and cleared on redemption, on failure, or at the deadline.
- A second summons while `inFlight` is set is **refused in the thread**, not
  queued. A queue would let ten mentions become ten runs at a stranger's
  expense, and the honest answer to "it is already coming" is to say so.

**The re-run button can never work, and this must be designed for rather than
documented around.** GitHub's UI offers "re-run this workflow" on any run. A
re-run replays the original inputs — including the spent, single-use pass. It
will 401 at redemption, every time, and the person who pressed it will see a
failed run with a credential error and reasonably conclude isocan is broken.

Three options, and the recommendation:

- **(a) Do nothing.** The re-run fails with a redemption error. Cheapest, and
  it teaches the wrong lesson to the person most likely to be debugging.
- **(b) Make the failure legible.** The harness detects a spent pass and exits
  with a message naming the cause: "this pass was already used — re-running a
  summons cannot work; mention the agent again." Costs one branch in the
  harness and turns a confusing failure into an instruction.
- **(c) Make re-run work** by having the harness ask the home for a fresh pass
  using something durable in the payload. **Rejected**: that something would
  be a long-lived credential in a readable field, which is precisely what the
  per-summons pass exists to avoid. Making the button work would undo the
  design.

**Recommendation: (b).** The button cannot be removed and should not be made
to work. What it can be is honest.

## The spike, run 30 Aug 2026 — four of five measured

Against this repository's own Actions API rather than a scratch repo, because
every question below is about GitHub's behaviour and not about which repo asks.
**Measured, not read from the docs:**

| # | Guess | What it actually does |
| --- | --- | --- |
| 1 | Boot latency | `workflow_dispatch` → job running: **4s, 21s, 34s** (n=3). A `push` on the same repo: **3–4s** (n=7). |
| 2 | 204 with no run id | **Confirmed.** `HTTP 204 No Content`, no body, and no `Location` or any other header carrying a run id. |
| 3 | `actions:write` without `actions:read` | **NOT MEASURED.** Needs a fine-grained token, which is a credential to create; see below. |
| 4 | 404 vs 422 | **Both, and they mean different things.** A workflow that does not exist → `404 {"message":"Not Found"}`. A workflow that exists, addressed with a ref that does not → `422 {"message":"No ref found for: …"}`. |
| 5 | Inputs in public metadata | **Absent from the API, present in the log.** The run object has no `inputs` key at all, even when inputs were supplied, and `display_title` is the workflow name. But the run's LOG carries them: `ONE: spike-check` appears in the step's environment block. |

### What each one changes

**1 sets `BOOT_DEADLINE`, and the spread is the finding.** A dispatch takes an
order of magnitude longer to start than a push — 4 to 34 seconds against 3 to 4
— and three samples is not a distribution. A pass TTL derived from the fast end
of that range would expire on an ordinary slow start. Whatever number is
chosen, it should be justified against the SLOW end and re-measured on a cold
queue, which this sample does not contain.

**4 is better news than the doc hoped for.** "Unreachable" can distinguish a
missing hook from a mis-addressed one: 404 means the workflow file is not
there, 422 means it is and the request was wrong. A dead TOKEN is neither —
401/403 — so three states are separable rather than two. **A disabled workflow
was not measured**: disabling one is a settings change, and the 404/422 split
above does not answer what it returns.

**5 is the load-bearing correction, and it sharpens the doc rather than
contradicting it.** This design already says the payload is not private. It is
more specific than that: **private in the API, public in the log.** Anyone who
can read the repository's Actions logs can read every dispatch input, because
the runner prints the step's environment. So the rule is not "assume the
payload might leak" — it is "the payload IS readable by every reader of this
repo's logs", which is a different sentence to design against.

### Guess 3 is still a guess, and it is the load-bearing one

It needs a fine-grained personal access token scoped to `actions:write` and
NOT `actions:read` — a credential, which is not mine to create. It is the one
that decides whether the whole observation design stands: if such a token
cannot dispatch, the read-only-token argument collapses and the section has to
be rewritten around a token that can poll.

**Whose it is:** the token has to be scoped to `dglazkov/isocan`, so it is
Dimitri's to create. The whole ask, self-contained:

> Make a fine-grained PAT on `dglazkov/isocan` with **Actions** permission.
> **Look at the dropdown first** — if the only choices are *Read-only* and
> *Read and write*, with no way to grant write without read, **that is the
> answer** and nothing needs to be sent: the premise is not expressible, and
> the read-only-token argument below has to be revisited on those grounds
> rather than on a 403. If write-without-read IS available, run the request
> below and report the status line only. A `204` and this design stands; a
> `403` and it does not.

**The experiment:**

```sh
curl -i -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/<owner>/<repo>/actions/workflows/<file>/dispatches \
  -d '{"ref":"main"}'
```

A `204` means the design stands. A `403` means it does not, and the rewrite is
the whole of "How the home learns anything".

## What was a guess, before the spike

Written before it, so these were hypotheses with names — kept as written so the
calls can be judged against what the table above found:

1. **Boot latency**, cold and queued, on a GitHub-hosted runner — sets
   `BOOT_DEADLINE` and therefore the pass TTL. *Currently a guess.*
2. **That `workflow_dispatch` really answers 204 with no run id**, and that no
   response header carries one. *Believed from the docs; unverified here.*
3. **That a fine-grained token with `actions:write` and no `actions:read` can
   dispatch.** If it cannot, the read-only-token argument above collapses and
   the whole observation section needs rewriting around a token that can poll.
   *This is the load-bearing guess.*
4. **What a disabled or missing workflow answers** — 404 versus 422 — which
   decides whether "unreachable" can distinguish a dead hook from a dead
   token.
5. **Whether dispatch inputs appear in the run's public metadata** as expected,
   and for how long.

The spike is: a scratch repo, a workflow file, a scoped token, and one real
dispatch — with the response, the headers, the timings and the visible
metadata written down. Any of 1–5 coming back different is a change to this
doc before phase 12 opens, not a note in a commit.

## What this doc does not own

- **Whether the default home operates registrations at all**, which is the
  open question at the end of innkeeper.md and is a business decision.
- **The registration UI.** Where a person creates and reviews one is phase
  12's build; this owns what happens after it fires.
- **Local-bridge dispatch**, which is phase 12.7's own design and a different
  trust story: a hook that fires something on somebody's laptop has no vendor
  in it and no readable payload. Written a day after this doc,
  [on-demand/design.md](../on-demand/design.md) now argues the local shape —
  the daemon summoning an agent on the same machine, no home involved — and
  compares the two hooks directly: a dispatch creates an agent per summons; an
  address wakes one that exists.
