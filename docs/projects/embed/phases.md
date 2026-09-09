---
status: partial
since: 2026-09-09
issue: 220
see: harnesses, context, memory, iso-api
note: isocan inside an agent manager or IDE. Phase 1 built 9 Sep, and the guide doctrine corrected the same day — "the canvas is the only channel" had a precondition that expires inside a manager, where the terminal is a watched window — the framed badge is partitioned (SameSite=None; Secure; Partitioned) so a pane can keep the badge it is handed, and `isocan embed` prints the pass-bearing address to paste into one. Phases 2 (an MCP server over @isocan/api) and 3 (MCP Apps) are designed in the research note and unbuilt; phase 4 is a decision, not work — no per-IDE extension, which is the harnesses constraint inverted
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

**Phase 1 is closed. Phase 2 is next.**

---

## Phase 1 — make door A honest · **built 9 Sep 2026**

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

## Phase 2 — the MCP server · next

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

Not work; a decision, recorded so it is not re-made quarterly. "Integrate with
Antigravity" now means four things (the IDE, the desktop manager, the CLI, and
extensions for VS Code, Visual Studio, JetBrains and Zed), and a VS Code-shaped
extension needs OpenVSX as well as the Marketplace because every fork keeps its
own registry. `harness.ts`'s constraint is that **isocan must not own an
adapter per harness**; this is that bill inverted.

The exception worth naming: a *thin* extension — one command, one webview
holding door A, nothing else — is cheap enough to be an afternoon. After phase
2, for one IDE, as evidence about whether anybody opens it.
