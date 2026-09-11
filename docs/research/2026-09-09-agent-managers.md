---
status: open
since: 2026-09-09
see: harnesses, context, memory, iso-api, on-demand
issue: 220
note: measured 9 Sep — isocan.io sends no frame-ancestors and no X-Frame-Options, so any manager may already frame it, and one does. The gate is not framing, it is ADMISSION: the badge cookie is SameSite=Lax with no Partitioned and the web app has no bearer path at all (0 hits for Authorization in packages/web/src), so in a partitioning browser an embedded canvas is anonymous, cannot persist a badge, mints a fresh one per load, and walks into the per-address mint meter. Four doors weighed; the recommendation is MCP for the vocabulary, MCP Apps (SEP-1865, stable since 26 Jan) for the surface, the plain iframe as the fallback that already works, and no per-vendor extension — the harnesses constraint, inverted
---

# Into somebody else's window

**9 September 2026** · [full write-up](https://claude.ai/code/artifact/6e1bd1c5-2446-436b-b423-18bdee77db3a)

Asked by Dion: *what is the best way to integrate isocan
into Jetski, Antigravity, or any other agent manager or IDE?* Measured on this
machine and against the live home, on the day dated. External facts were read
the same day and are dated where they matter.

The prompt came with a screenshot, and the screenshot is the finding that
reorders everything below: **isocan was already running inside an agent
manager.** A Jetski pane, a canvas at `prj_wLkE8WbRYK`, Hiro parked on it and
saying so in the Chat, a human typing in the pane beside their conversation
with the agent that built it. Nobody wrote an integration. Somebody pasted a
URL into a browser tab.

So the question is not *can this be embedded*. It is **what does the embed not
get**, and which of the four doors is worth building to give it that.

## The four doors

| | Door | What the host gets | What it costs | Works today |
| --- | --- | --- | --- | --- |
| **A** | **A URL in a pane** | The whole app, live, pixel for pixel | Nothing | **Yes** — with a caveat that is the rest of this note |
| **B** | **An MCP server** | The canvas as tools an agent calls: read the recap, place an item, answer a comment | One server over `@isocan/api` | No — isocan has no MCP surface |
| **C** | **MCP Apps** (SEP-1865) | The canvas *rendered* by the host, beside the tool call that opened it | B, plus a `ui://` resource and a postMessage bridge | No |
| **D** | **A native extension** per IDE | A first-class panel, IDE commands, the local daemon | Per-vendor code, forever | No |

They are not alternatives so much as a ladder — B is inside C, and A is what C
falls back to on a host that does not speak it.

## What was measured: the embed is admitted as nobody

Framing was the guess and framing is not the problem. Against the live home
today:

```
$ curl -sS -D - -o /dev/null https://isocan.io/
HTTP/2 200
set-cookie: isocan_badge=bdg_…; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000; Secure
```

**No `X-Frame-Options`. No CSP `frame-ancestors`.** Any page anywhere may put
isocan in an iframe, which is why the Jetski pane worked with no arrangement.
Note in passing that this is the opposite posture from the one isocan takes
about *other* people's sites: `/api/frameable` exists because most of the web
refuses exactly this, and refuses it silently.

The gate is one layer down, and it is **admission**:

1. **The badge cookie carries no `Partitioned`** (`badges.ts`, `badgeCookie`).
   `SameSite=Lax; Secure; HttpOnly` and nothing else, deliberately — the
   comment there is about Scene 3 and a link clicked from Slack, which is a
   top-level navigation. An iframe is not.
2. **The web app has no bearer path.** `grep -rn "Authorization\|[Bb]earer"
   packages/web/src` returns **zero hits**. `badges.ts` knows two carriers,
   `"cookie" | "bearer"`; the app knows one. Every CLI and daemon path uses
   the other, which is why this has never bitten.
3. Therefore, in a browser that partitions or blocks third-party cookies, a
   framed canvas **cannot read the badge it has and cannot keep the one it is
   given.** It is a stranger on every load, with no second carrier to fall
   back to.

And a stranger on every load is a **mint** on every load. `meter.ts` caps mints
at 20 a minute keyed on the client address — and its own comment names the
failure mode this walks into: *"sharing an address — CGNAT, a school, an
office — shares a bucket."* An office where several engineers keep a canvas
pane open in their agent manager is one bucket. The symptom is the one already
recorded on this machine: a silent 401 and a door that just stays shut.

**Which browsers partition** (read 9 Sep, and this is the inference-heavy
part): Google reversed the third-party-cookie deprecation in April 2025 and
Chrome still sends them by default, so *the Jetski pane works today because it
is Chrome*. Safari and Brave block them; Firefox partitions all of them in
ETP-Strict. CHIPS (`Partitioned`) and the Storage Access API are the two
sanctioned ways to hold a cookie in a cross-site frame. So door A is not
broken — it is **load-bearing on a default that one vendor already reversed
once**, in an app whose only credential carrier is the one that default
governs.

What was **not** measured: the framed app was not driven through a full
session in a partitioning browser, and the Jetski pane's own proxy was not
tested — it is internal, and its behaviour is not mine to assert. The three
facts above are read from the code and the wire; the consequence is reasoned
from them.

### The fix is small and it is not a door

Whichever door wins, the same repair is underneath A, C and D:

- `Partitioned` on the badge cookie when the request is framed, which gives the
  embed its own per-top-level-site jar — a badge that **persists** and is
  isolated from the person's own tab; and
- a **pass into the frame**, which already exists. `isocan pass` mints a
  short-lived single-use credential and `isocan open` already appends one to a
  URL fragment for the browser it spawns. An embedder that mints a pass and
  frames `isocan.io/p/<canvas>#<pass>` hands the pane a real identity on its
  first load; the partitioned badge is what makes the second load free.

That pairing — one pass, then a jar that keeps what it bought — is the whole
of the embed problem, and neither half is new mechanism.

## Doors B and C: what an embed cannot do, and MCP can

A pane is a surface for a *person*. It gives the manager's **agent** nothing:
an agent in Jetski or Antigravity looking at a canvas in the next tab cannot
read it, and today the only way it can is to have `isocan` on its PATH and the
skill in its context — which is the harness case, already solved, and requires
the agent to be running somewhere isocan installed itself.

**isocan has no MCP surface, and two designs have already asked for one.** The
context project's walk names it as stage 3 (*"an MCP surface that exposes the
canvas for reading… point Hindsight at the canvas and let it index the record
it does not own"*), and the memory design's phase 4 is the same piece over its
three layers. Both wanted it for external memory. The agent-manager question
wants it for a different reason and asks for the same thing, which is the
strongest argument in this note: **a surface two unrelated projects ask for is
not a feature, it is a missing edge of the isomorphism.**

The cost is now low in a way it was not when those designs were written.
`@isocan/api` shipped — `connect()`, the typed client, identity and canvas
resolution, all of it a library rather than a process per action. An MCP server
is a translation of that surface into tool definitions and a stdio transport.
It is the thinnest of the four doors and it is the one that has been asked for
twice.

**Door C is that server plus a picture.** MCP Apps (SEP-1865) went stable on
26 January 2026 and folded into the extensions framework in the 2026-07-28
spec: a server declares a UI resource under `ui://` with the media type
`text/html;profile=mcp-app`, attaches it to a tool via `_meta.ui.resourceUri`,
and the host renders it in a sandboxed iframe that talks back over JSON-RPC on
postMessage (`ui/message`, `ui/request-display-mode`,
`ui/update-model-context`; the host notifies with `ui/notifications/tool-result`
and friends). Claude on web and desktop, VS Code Insiders, Goose and Postman
support it. Nested iframes are allowed where the resource declares
`frameDomains`, which is the mechanism by which the app itself — not a
reimplementation of it — can be what the host shows.

That last clause is why C is interesting rather than merely fashionable. isocan
has spent its whole life refusing to grow a second implementation of anything:
the daemon owns the state and the web app and the CLI are equal clients over
one op vocabulary. **MCP Apps is that same shape offered a third client**, and
`ui/update-model-context` is the piece nothing else on this list has — the pane
can tell the host's agent what is on the canvas, so the human and the agent are
finally looking at the same thing rather than at two tabs.

## Door D, and the precedent that decides it

Antigravity 2.0 now ships extensions for VS Code, Visual Studio, JetBrains and
Zed, so "integrate with Antigravity" has become ambiguous — the IDE, the
desktop manager, the CLI, and now a panel inside four other editors, with a
separate login history behind them (this repo measured three separate logins in
the [4 September note](2026-09-04-antigravity-acp.md), which is what stopped it
building a harness row there the first time). A VS Code-shaped extension would
have to be published to **OpenVSX** as well as the Marketplace, because the
forks — Antigravity, Cursor, Windsurf — each keep their own registry. And a VS
Code webview's default CSP is `frame-src 'self'`, so even the trivial version
of door A inside an extension needs the CSP written by hand, plus
`asExternalUri` for a local daemon, plus whatever Chrome 142's local-network
access rules do to a webview reaching `127.0.0.1:4441`.

This project has already made this decision once, from the other side. The
harnesses constraint in `harness.ts` is that **isocan must not own an adapter
per harness** — a command per vendor grows with the vendor count and breaks on
flag changes — and the answer was to write one client against a settled spec
and gain harnesses nobody had heard of. Door D is that same bill, inverted:
one panel per IDE, maintained forever, against a market that added a fourth
Antigravity entry point in a single release.

**So: not D, and the reasoning is on file rather than new.** The exception
worth naming is that a *thin* extension — one that contributes a command and a
webview holding door A, and nothing else — is cheap enough that it could be
someone's afternoon. It should be built only after B, and only for one IDE, as
evidence about whether anybody opens it.

## Recommendation

1. **Make door A honest.** `Partitioned` on the badge cookie for framed
   requests, and an embed address that carries a pass. Two small changes; they
   turn "works in Chrome today" into "works". Nothing else on this list is
   worth doing while the pane can be silently metered out.
2. **Build the MCP server** over `@isocan/api` — read first, exactly the
   reading surface the context project's stage 3 specified, then the write
   verbs the skill already teaches an agent to use. This is the door that lets
   an agent in a manager isocan did not install see the canvas at all.
3. **Then MCP Apps**, as the same server's second face: the canvas rendered in
   the host, with `ui/update-model-context` carrying what is on it back to the
   host's agent. This is the one that makes the screenshot's arrangement — a
   human in a pane, an agent in the next tab — into one conversation instead
   of two.
4. **No per-IDE extension** until 2 and 3 have shipped and a host has proved it
   cannot be reached by any of them.

One thing to settle before step 2 rather than during it, because it is the
question every door shares and none of them answers: **who is an agent that
arrives over MCP?** A harness agent has a name, a claim on this machine, and a
face on the canvas. An MCP client has a badge and no story. The identity desk
has answered harder versions of this — the pass, the enrolment key, first-claim
— but it has not been asked this one, and an MCP surface that writes to a canvas
as an anonymous badge would put unattributed items on a canvas whose whole
premise is that everything on it has a face.

## Sources

Measured here: `packages/server/src/badges.ts`, `meter.ts`, `http.ts`,
`packages/web/src`, `packages/api/src`, and `curl` against `https://isocan.io/`,
all 9 September 2026. Read the same day:
[MCP Apps (SEP-1865)](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
and the [extension specification](https://github.com/modelcontextprotocol/ext-apps),
[the MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/),
[Antigravity IDE extensions](https://antigravity.google/docs/ide/extensions/),
[ACP on JetBrains](https://zed.dev/blog/jetbrains-on-acp) and
[the ACP registry](https://www.jetbrains.com/acp/),
[CHIPS](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies/Partitioned_cookies),
and the VS Code webview
[`frame-src` behaviour](https://github.com/microsoft/vscode/issues/209543).
