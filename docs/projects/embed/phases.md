---
status: partial
since: 2026-09-09
issue: 220
see: harnesses, context, memory, iso-api
note: phases 1 and 2 built. The framed pane keeps its own badge over HTTPS. MCP now has fifteen tools, current canvas and layered Context resources, explicit durable agent sessions, attributed item/comment writes and cancellable feedback waits; the machine's ambient identity remains the default. Real stdio overlap, restart, frozen content and admission proofs passed 13 Sep. Phase 3 MCP Apps remains unbuilt and outside this continuation; phase 4 retains the decision against per-IDE extensions
---

# Embed: isocan in somebody else's window

The research is [`docs/research/2026-09-09-agent-managers.md`](../../research/2026-09-09-agent-managers.md)
and the argument is not repeated here. The short version: **isocan was already
running inside an agent manager** before anybody wrote an integration, because
the hosted home sends no `X-Frame-Options` and no `frame-ancestors` and
somebody pasted a URL. What the pane did not get was an **identity**.

Four doors, and they are a ladder rather than alternatives: a URL in a pane
(A), an MCP server (B), MCP Apps (C), a native extension per IDE (D). B sits
inside C, and A is what C falls back to on a host that does not speak it.

## Where we are

**Where we are:** phases 1 and 2 are closed. Embed phase 3, MCP Apps, is next
and outside the 13 September continuation. The server now exposes fifteen tools and two
resource templates. [context-and-sessions.md](context-and-sessions.md) is the
contract; existing `read_context` and `read_context_content` keep their
request-manifest meanings. No external memory index was installed.

---

## Phase 1 — make door A honest · **built 9 Sep 2026**

**Status: CLOSED.** 2026-09-09 — the isolated-daemon framed and top-level cookie walk below held.

The pane worked, and it worked by luck: Chrome still sends third-party cookies
after Google's April 2025 reversal, and the whole of isocan's browser
credential is one `SameSite=Lax` cookie. Safari and Brave refuse that jar;
Firefox partitions it in ETP-Strict. Where it is refused, a framed canvas can
neither read the badge it has nor keep the one it is handed — and
`packages/web/src` has no bearer path, so there is no second carrier. A
stranger on every load is a **mint** on every load, and the door meters mints
at 20 a minute per address, on a bucket an office shares.

Three lines that had never met, ending in a silent 401.

**What was built.**

- **`badgeCookie(token, secure, framed)`** — a framed request over TLS gets
  `SameSite=None; Secure; Partitioned` (CHIPS) instead of `Lax`. What that
  buys is better than merely working: the pane gets its **own** badge, per
  top-level site, isolated from the embedder's other frames and from the
  person's own tab. Isolation is the honest posture for a credential handed to
  a window somebody else owns.
- **Two ways of knowing it is framed, because there are two mint paths and
  only one of them can be asked.** The page load is sniffed (`framedRequest`,
  off `Sec-Fetch-Dest: iframe|frame` **and** `Sec-Fetch-Site: cross-site`);
  `POST /api/door` is **stated** (`DoorRequest.framed`, sent by the app as
  `window.self !== window.top`), because that route is reached by `fetch` and
  a fetch reports `Sec-Fetch-Dest: empty` framed or not. Stating it is the
  route's own established idiom — `carrier` is stated for exactly this reason.
- **`isocan embed`** — the address to paste into a pane, which is a third act
  beside the two that existed. `share` hands a PERSON an address and the door
  decides; `pass` hands a MACHINE a credential and prints a terminal line;
  `embed` hands a WINDOW a URL. Same pass underneath `pass`, different output,
  because a `npx` line pasted into an address bar does nothing and a URL
  pasted into a terminal does worse.

**Walked for real**, against an isolated daemon on 4479, 9 Sep: `isocan embed`
printed the pass-bearing address; a framed load behind `x-forwarded-proto:
https` answered `SameSite=None; Secure; Partitioned`; the plain top-level load
on the same daemon answered `SameSite=Lax; Secure`, byte for byte what it
answered before.

**What phase 1 does NOT fix, stated so nobody rediscovers it as a bug.**
`Partitioned` requires `Secure`, and so does `SameSite=None` — a browser handed
`None` without `Secure` drops the cookie entirely, which is worse than `Lax`.
So **a local daemon over plain HTTP framed in an IDE webview keeps exactly the
behaviour it has today**: admitted for the visit the pass bought, starting over
on a reload. That is a real limit of `http://127.0.0.1:4441` rather than an
oversight. The way out is a hosted address, and `isocan embed`'s own output
says so.

## The doctrine this project moved · **9 Sep 2026**

Not a phase — a correction the first screenshot forced, and worth its own
heading because it changes what every agent is told rather than what any code
does.

The guide's central rule read *"the canvas is the only channel — the human is
watching the web app, not your terminal, so anything you say outside a comment
is said to nobody."* That was written for a harness terminal nobody reads. In
an agent manager the terminal is a first-class window the person is actively
using, so the premise is false — and the corollary it implied, *put everything
in the shared room*, fills that room with DM-shaped content.

The evidence was in the ask itself: a canvas Chat holding **seven** of one
agent's own "🎨 Hiro is online on this canvas and ready to design!" while the
real conversation went on in the pane beside it. Nothing in isocan emits those;
an agent wrote them, following a rule whose precondition had quietly expired —
and step 3 of the same protocol already says *presence narrates itself*.

So the rule keeps the half that was always load-bearing — **the canvas is the
channel that KEEPS**, because it is the record and it is shared — and a new
section, *Who is at your terminal*, carries the branch. The test is mechanical
rather than a judgement call: `adapterEnv` scrubs every harness variable and
sets `ISOCAN_HARNESS=agent`, so that value means the rc summoned you and
nobody is there; anything else means a person opened the conversation. Then
there are two channels, and they are **a team room and a DM** rather than two
chats to keep in sync — the canvas takes the record, the conversation takes
the steering, presence takes neither, and a DM answer gets written down once
it becomes a decision.

What does not change is the loop. You still park; being talked to directly is
not being sent home.

## Phase 2 — the MCP server · **completed 13 Sep 2026**

**Status: CLOSED.** 2026-09-13 — real stdio reads, resources, concurrent agent sessions, writes, feedback and restart preserve admission and attribution.

### The completed feedback loop · 13 Sep 2026

`read_context_summary` shares the API's layered assembly with `isocan context`:
local and inherited pieces keep exclusion, override, stale and unavailable
reasons. `isocan://canvas/{id}` and `isocan://canvas/{id}/context` expose JSON
resources. Listing uses discovery; reading a known address still goes through
admission. Resource reads use the ambient identity.

`claim_agent` takes a stable caller-supplied session key and a name. Calls that
select that key use its durable `mcp:` claim; a missing claim refuses. No call
changes a process-wide actor. `create_item`, `edit_item`, `post_comment`,
`reply_comment` and `wait_for_feedback` use the existing API and operations.
The feedback wait shares CLI addressing, returns a resumable cursor, and
bounds work to 1–60,000 ms. Neither reads nor waits write seen-marks or presence.

**Proof:** `packages/mcp/test/stdio-sessions.test.ts` runs a real SDK host
against a source CLI process and daemon. Two overlapping waits receive their
own mentions and participating replies; distinct writes retain their authors;
concurrent reclaim and process restart keep identities. Edits leave saved
request bytes frozen. Cancellation releases the daemon subscription to zero.
Context/resource tests use a separate badge's closed canvas to prove refusal
without leaking its title or pins. The conductor independently ran these tests.
An additional spawned stdio proof holds identity and known-ID admission HTTP:
timeouts and cancellations close all four held requests, start no watch and
leave presence and seen-marks untouched. Shared client lifetime tests cover
health probes and door recovery too. An excluded inheritance edge is checked
before fetching its source, including exclusion inherited from a parent group.

**Trajectory**

- **2026-09-13** — A cancelled stdio call exposed an existing daemon watch leak: request-close watched an already consumed request. Response-close and an already-destroyed check now release the subscription; the original protocol probe failed before that correction.
- **2026-09-13** — Discovery is not the known-address door. Tightening canvas lists exposed API resolution that only searched those lists. Exact IDs now ask the snapshot/admission route, including saved defaults and project markers; names still use discovery and conflicting homes still refuse.
- **2026-09-13** — Independent review held connection setup open and found that the feedback timer began only after it. One deadline now covers resolution, admission and the wait; cancellation reaches the held HTTP rather than merely returning early. The before-fix stdio probe exceeded its identity deadline.
- **2026-09-13** — An inherited Context link inside an excluded group still fetched its source. The shared memory-edge selector now applies ancestor exclusion before any source read; the failing-first summary proof checks both the absent read and the absent pin name. Explicitly saved request bytes keep their separate meaning.

### The first read slice · historical record, 9 Sep 2026

**What shipped.** `@isocan/mcp` — six read tools over `@isocan/api`, and
`isocan mcp` as the command an agent manager spawns. Paste this into a
manager's MCP config and an agent in it can read the canvas:

```json
{
  "mcpServers": {
    "isocan": { "command": "isocan", "args": ["mcp"] }
  }
}
```

Started in a project directory, it answers about that directory's canvas with
no argument at all — the marker walk, the home default and the only-one rule,
exactly as every CLI command resolves a canvas. `list_canvases`,
`read_canvas`, `read_item`, `read_threads`, `read_activity`, `who`.

**Identity: whoever this machine already is** — which is the decision below,
reversed from where this doc first landed, and the walk confirms it: a live
server answered `"you": "Dion"`. A harness session in the environment makes it
that agent; with none, it is the machine's PERSON, exactly as the CLI behaves
with no session. `connect()`'s ambient walk already did this, so it cost
nothing.

**Two things the shape is deliberate about.** The connection is made *per tool
call* rather than at startup, so a daemon that is not up yet is a refusal the
caller can fix and retry rather than a server that is up and permanently
broken. And every tool returns its refusal as an `isError` result carrying the
API's own typed sentence — a tool that throws hands the model a stack trace; a
tool that answers hands it something to act on.

**That first slice was read-only.** Its write continuation is recorded above;
the addressability question below explains why it needed an explicit claim.

### Who is an agent that arrives over MCP — settled

The first draft of this doc made enrolment mandatory before an MCP client
could write. **That was wrong, and the CLI says so.** `~/.isocan/identity.json`
is the person's, an agent identity is opt-in and deliberate, and
`resolveExplicitIdentity` puts it in writing: *"a script that names who it is
must never quietly run as the machine's person because the name was not
claimed yet."* The default has always been the person. Requiring enrolment for
MCP would have been a stricter rule than the CLI has ever had, invented for
one surface.

So: **the person by default**, and Dion's reading is the right one — an MCP
client is somebody driving a tool.

What the write half needed was not permission but **addressability**, and
it is narrower than a gate. `isocan wait` routes on identity: a comment wakes
an agent that is @-mentioned or that wrote in the thread. An agent writing as
the person cannot be addressed, cannot be woken, and its `/ask` reads as the
person asking themselves. That is the same on the CLI, and the CLI's answer is
the one to copy: an agent that means to stay and take feedback claims a name.
So the write half wants a tool that is the MCP spelling of `isocan identity
--session` — and the open question is only whether MCP hands the server
anything per-conversation to hang it on automatically (`clientInfo` on
`initialize` is per-application, not per-thread).

### What the original read half owed — completed 13 Sep

The reading surface the [context](../context/design.md) project's stage 3
specified is the layered summary shown by `isocan context`. Canvas-groups
subsequently added `read_context` and `read_context_content` for current item
manifests and frozen request content. Those names are no longer missing, and
must not be reused for a different response. The continuation adds the
summary separately as `read_context_summary`, as
[context-and-sessions.md](context-and-sessions.md) specifies.

MCP **resources** now expose current canvas and Context JSON. Tools came
first; a canvas exposed as a resource is what lets a host attach it
without a model deciding to call anything, and it is the piece an external
memory index would actually read.

## The original phase 2 plan, kept for the reasoning

A pane is a surface for a **person**. It gives the manager's **agent**
nothing: an agent in Jetski or Antigravity looking at a canvas in the next tab
cannot read it, and the only way it can today is to have `isocan` on its PATH
and the skill in its context — which is the harness case, and requires isocan
to have installed itself there.

isocan has no MCP surface, and **two unrelated designs have already asked for
one**: [context](../context/design.md)'s stage 3 and
[memory](../memory/design.md)'s phase 4, both for external memory. The
agent-manager question arrives at the same thing from a different direction,
which is the argument — a surface two projects ask for independently is not a
feature, it is a missing edge of the isomorphism.

Read first, exactly the reading surface context stage 3 specified; then the
write verbs the agent guide already teaches. Thin, because
[`@isocan/api`](../iso-api/design.md) shipped: `connect()` is the middle layer,
and the server is its translation into tool definitions over a stdio
transport.

**The door this phase must not walk through without deciding.** *Who is an
agent that arrives over MCP?* A harness agent has a name, a claim on its
machine, and a face on the canvas. An MCP client has a badge and no story. The
identity desk has answered harder versions — the pass, the enrolment key,
first-claim — but not this one, and an MCP surface that writes as an anonymous
badge would put unattributed items on a canvas whose whole premise is that
everything on it has a face. Settle it before the write verbs, not during.

## Phase 3 — MCP Apps

**Status: NOT STARTED.** 2026-09-13 — deferred beyond the authorized context and session continuation.

The same server's second face. MCP Apps (SEP-1865) went stable 26 January 2026
and folded into the extensions framework in the 2026-07-28 spec: a `ui://`
resource typed `text/html;profile=mcp-app`, attached to a tool through
`_meta.ui.resourceUri`, rendered by the host in a sandboxed iframe that answers
over JSON-RPC on postMessage. Nested frames are permitted where the resource
declares `frameDomains` — so **the app itself can be what the host shows**,
rather than a second implementation of it, which is the only version of this
worth building here.

`ui/update-model-context` is the piece nothing else on the ladder has: the pane
can tell the host's agent what is on the canvas. That is what turns the
screenshot's arrangement — a human in a pane, an agent in the next tab — into
one conversation rather than two transcripts.

## Phase 4 — no per-IDE extension

**Status: RETIRED.** 2026-09-09 — this is the retained decision against owning an adapter per IDE.

Not work; a decision, recorded so it is not re-made quarterly. "Integrate with
Antigravity" now means four things (the IDE, the desktop manager, the CLI, and
extensions for VS Code, Visual Studio, JetBrains and Zed), and a VS Code-shaped
extension needs OpenVSX as well as the Marketplace because every fork keeps its
own registry. `harness.ts`'s constraint is that **isocan must not own an
adapter per harness**; this is that bill inverted.

The exception worth naming: a *thin* extension — one command, one webview
holding door A, nothing else — is cheap enough to be an afternoon. After phase
2, for one IDE, as evidence about whether anybody opens it.
