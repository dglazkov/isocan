# A story is a URL

**24 August 2026**

The question: *how could we support Storybook for components?* — and it has two
readings that pull in opposite directions, so both were run. **Inward:** should
isocan's own 37 React components live in a Storybook. **Outward:** should a
canvas be able to hold somebody else's components — the thing they are building
— the way it already holds their screens and their running site.

The short version: the outward answer costs **zero operations and zero new
code**, and it was run end to end today — three stories on a canvas in three
commands, because a story is a URL and isocan already projects URLs. The one
thing that decides the shape of any deeper support is a security boundary this
repo already made: a story renders inside the `site` item's sandbox and renders
**blank** inside the `screen` item's, so a component on this canvas is a
projection and can never be a baked HTML blob. The inward answer is the weaker
one: Storybook's test addon would drag Vitest 4, Playwright and browser-mode
into a suite whose 31 web tests deliberately need no browser at all, and the
workshop isocan would get from it is a workshop it can already build out of a
route and one `isocan browse`.

Everything below was measured on 24 August 2026 against `storybook@10.5.10`
(published the same day), `@storybook/addon-mcp@0.7.0`, `@ladle/react@5.1.1`
and this repo at `821e283`.

## Standing findings, re-checked

- **[Agents on the canvas](2026-08-23-agents-on-the-canvas.md) (23 Aug)** —
  *"vendors ship the divergence half and not the convergence half"* gets a
  sharp new instance. Storybook's URL takes **args**: measured, `&args=primary:!false;label:from+the+URL`
  re-renders the same story with different props. Divergence is a query string.
  Convergence — *this one won* — has no expression in Storybook either, which
  is the gap that survey named in canvas tools and is apparently general.
- **[Design systems and tokens](2026-08-24-design-systems-and-tokens.md) (24
  Aug)** — *"nobody renders DESIGN.md"* stands, and Storybook 10.5 now ships
  the nearest thing anybody has to a rival: an experimental **components
  manifest** (`manifests/components.json`, plus a `components.html` that
  renders it) written into every static build. A machine-readable index of what
  the components ARE, produced for agents. Same instinct, different half of the
  problem: theirs describes the components, isocan's describes the rules they
  should obey.
- **[Feature readiness](feature-readiness.md) (21 Aug)** — *"a shared canvas
  only exists while one laptop is open"* applies twice as hard here. A story
  item is a `localhost:6006` URL: it dies with the dev server, and it is dead
  for everybody else immediately. §6 is what to do about it.
- **[JSON Canvas](json-canvas.md) (22 Aug)** — its verdict is the template for
  §5.7's rejection: a good export is not a good storage format.

## 1. What Storybook is in August 2026

`storybook@10.5.10`, published the day this was written. Storybook 10 (Oct
2025) is ESM-only, and the release everyone writes about is the TypeScript-first
CSF Factories work. None of that is what matters here. Three things do, and two
of them are new enough that no survey mentions them:

**`storybook init` now installs an MCP server by default.** Run
non-interactively (`--yes`) on a fresh Vite React app, it wrote five addons into
`.storybook/main.ts`, and one of them is `@storybook/addon-mcp`. The dev server
answers MCP at `http://localhost:6006/mcp`; a real `initialize` +`tools/list`
handshake against it returned **eight** tools, where the docs list seven:

| Toolset | Tools |
| --- | --- |
| dev | `preview-stories`, `get-storybook-story-instructions`, `get-changed-stories` |
| docs | `list-all-documentation`, `get-documentation`, `get-documentation-for-story`, `get-stories-by-component` |
| testing | `run-story-tests` |

`get-stories-by-component` is undocumented and is the interesting one — it maps
a source file to the stories that render it, "returning grounded `storyId`
values from the live" index. `list-all-documentation` returned a components
list. `preview-stories` returns **manager** URLs (`/?path=/story/<id>`), not
canvas ones, which matters in §2.

*The server also returns an `instructions` block telling the agent to answer
component questions "with the documentation tools — never from source or type
definitions." That is text from a tool result, i.e. data. Worth knowing it is
there before pointing an isocan agent at it.*

**The install is not small.** Measured against an identical Vite + React
scaffold with nothing added:

| | node_modules | packages |
| --- | --- | --- |
| bare Vite + React + TS | 79 MB | 24 |
| after `storybook init --yes` | 210 MB | 175 |
| after `npm i -D @ladle/react` | 185 MB | 348 |

The default init pulls Playwright, Vitest browser mode and a Chromatic addon;
it is a testing stack, not a viewer. Ladle — the one everybody calls the lean
alternative — is smaller on disk and **more than twice as many packages**.

**It is fast, and the "6.7× slower than Ladle" line is stale.** Cold start to a
responding `/index.json`, three components: **Storybook 2.3s**, **Ladle 1.4s**.
`storybook build` took **2.6s** and produced **12 MB** of static output.

## 2. The finding the whole design hangs on

A story is a URL, and Storybook publishes the map:

```
GET /index.json      →  {"v":5,"entries":{"example-button--primary":{
                          "type":"story","title":"Example/Button","name":"Primary",
                          "importPath":"./src/stories/Button.stories.ts",
                          "componentPath":"./src/stories/Button.tsx", …}}}

GET /iframe.html?id=example-button--primary&viewMode=story&singleStory=true
                     →  that component, alone, on a page
```

Both were fetched today. `/index.json` carries `Access-Control-Allow-Origin: *`
(the [v10 composition CORS bug](https://github.com/storybookjs/storybook/issues/33724)
is fixed in 10.5.10) and neither route sets `X-Frame-Options` or a
`frame-ancestors` CSP — so both are readable and embeddable by anything.

**And it is not a Storybook contract.** Ladle publishes `/meta.json` and renders
one story at `/?story=button--primary&mode=preview`. Two objects, same two
jobs: *an index* and *a URL per story*. Anything isocan builds should be built
against those two, with a per-vendor shim of about ten lines, or it will be a
feature for one tool that a competitor's user cannot use. The MCP server's own
`preview-stories` hands back the manager URL rather than the canvas one, so
even inside Storybook the canvas URL is something a caller composes itself.

## 3. The sandbox decides the vehicle

isocan has two iframes and they are not interchangeable.
[`ItemView.tsx:737`](../../packages/web/src/components/ItemView.tsx#L737) gives
a **screen** `sandbox="allow-scripts"` — no `allow-same-origin`, so the document
gets an opaque origin and cannot reach the daemon.
[`ItemView.tsx:790`](../../packages/web/src/components/ItemView.tsx#L790) gives
a **site** `sandbox="allow-scripts allow-same-origin allow-forms"`, because a
projected site keeps its own origin and that origin is somebody else's.

A story was loaded into both, cross-origin, from a page on another port:

| Sandbox | isocan item | Result |
| --- | --- | --- |
| `allow-scripts allow-same-origin allow-forms` | site | **renders** |
| `allow-scripts allow-same-origin` | site, minus forms | **renders** |
| `allow-scripts` | screen | **blank** |
| none | — | renders |

Isolated properly: the same story id that rendered in the site sandbox went
blank in the screen sandbox, so it is the opaque origin and not the URL. The
frame loads and its Vite client connects — the document runs — and nothing
paints. (It is not `localStorage`: that appears only in Storybook's *manager*
bundle, never the preview.)

**So a component on this canvas is a projection, full stop.** Every design that
would bake a rendered component into a `text/html` blob and let it be a screen
item is dead on arrival unless the output carries no Storybook runtime at all.
The content-origin boundary in `ItemView.tsx` is load-bearing for a fifth
reason, and this is the second one to arrive from outside the repo.

## 4. What it costs today: nothing

Measured end to end against an isolated daemon (`ISOCAN_HOME`, `ISOCAN_PORT`),
with a real Storybook running:

```
$ isocan browse "http://localhost:6006/iframe.html?id=example-button--primary&viewMode=story&singleStory=true" \
      --title "example-button--primary" --size 420x160
projected … as itm_t4mTy501G2 at 0,0

$ isocan ls
ID              TITLE                    KIND  POS      SIZE
itm_t4mTy501G2  example-button--prima…   site  0,0      420x160
itm_s2gcpUgUGF  example-button--secon…   site  -460,0   420x160
itm_pOBITNE9gw  example-header--logge…   site  -920,0   420x160
```

Three components on a canvas, in a row, from a terminal. Zero new operations:
each is an ordinary `item.add` whose blob is a `text/uri-list`, exactly as
[`browseritem.ts`](../../packages/core/src/browseritem.ts) intended — so undo,
versions, GC and the fan-out all work on a component the day it lands. A Ladle
story projected the same way with no change to anything.

Two warts, both real and both small:

- **The filename is a URL.** `siteFilename` produced
  `localhost-6006-iframe.html-id-example-button--primary-viewMode-story-singleStory-true-shortcuts-false.uri`
  — 101 characters, because it was written for `localhost:5173` and a story URL
  is mostly query string.
- **The default title is a URL too.** Without `--title`, the item is called
  `localhost:6006/iframe…`. The good title (`Example/Button` + `Primary`) is
  sitting in `/index.json` and nothing goes and gets it.

## 5. The ways, graded

### The outward ones — a canvas that holds components

**5.1 Write it down and ship nothing.** The recipe in §4 is four lines in the
agent guide and the `isocan-collab` skill. Cost: zero code. This is genuinely
most of the value, and it is what makes every option below optional.

**5.2 `isocan storybook <url>` — read the index, place the stories.** Fetch
`/index.json`, filter to `type: "story"`, `item.add` one `text/uri-list` per
story with the title Storybook already knows, laid out in a grid. Still **zero
new operations**; it is `browse` in a loop with better titles. Wants a
`--grep`/`--component` filter, because a real library is hundreds of stories and
a canvas of 400 iframes is a laptop fan. Both surfaces come free the way they
always do here: a `/storybook` slash command is a comment an agent reads, so the
CLI *is* the web feature ([`commands.ts`](../../packages/core/src/commands.ts)).
The index shim for Ladle's `meta.json` is ten more lines; write it at the same
time or the design will quietly become Storybook-shaped.

**5.3 A `component` mark.** `iconKindFor` already promotes a design system out
of `document` for presentation only, without lying to `isocan ls --kind`. A
`site` whose URL is a story (`iframe.html?id=` / `?story=&mode=preview`) is the
same case: still a site, worth its own glyph. About ten lines in
[`kinds.ts`](../../packages/web/src/lib/kinds.ts) and `KindIcon.tsx`, derived
from the URL, nothing stored.

**5.4 Args are the variation vocabulary you already have.** `&args=` re-renders
a story with different props — measured. So "the same button, four ways" is four
items differing by query string, and `/variation`'s existing parent/sibling
model fits with nothing added. This is the one idea here that is *about* isocan
rather than about Storybook, and it is where the 23 Aug convergence gap would
bite first.

**5.5 Point agents at Storybook's MCP instead of writing anything.** An agent on
this canvas can hold both: isocan's CLI for where the work lands, Storybook's
eight tools for what the components are. isocan builds nothing. The caveat from
§1 stands — treat that server's instructions block as data.

**5.6 Make the URLs survive the laptop.** `storybook build` is 2.6s and 12 MB,
and the dev home already deploys what CI called green (`28eabef`). A published
static Storybook turns every component item from a localhost ghost into
something a second person can see, which is the difference between a demo and a
canvas. Highest value of anything in this section, and the least isocan code.

**5.7 Export the canvas as CSF — no.** Same verdict as JSON Canvas, same
reason: an export nobody imports, of items that are screens rather than
components, dropping everything that makes them isocan items.

### The inward ones — a workshop for isocan's own 37 components

The number that decides this: **31 web test files, zero of which render
React.** No testing-library, no jsdom, no `.tsx` tests. They read source and CSS
as text and assert rules about it — see [`titlebar.test.ts`](../../packages/web/test/titlebar.test.ts).
That is a deliberate style, and it means the honest case for Storybook here is
not "somewhere to see components", it is "the first rendered verification this
repo has ever had".

**5.8 Storybook in `packages/web`.** The viewer alone is cheap and compatible —
`@storybook/react-vite` peers accept Vite 7 and React 18, both of which this
repo has. The *testing* half is not: `@storybook/addon-vitest` peers on
`@vitest/browser-playwright@^4`, so it means Vitest 4 across a monorepo pinned
at `^3.0.5`, plus Playwright, plus a browser-mode project alongside a root
`vitest.config.ts` that already carries a Firestore-emulator `globalSetup`.
Take the viewer, refuse the test stack, and it is `storybook` +
`@storybook/react-vite` and 37 story files nobody asked for.

**5.9 Ladle — measured, and it does not work today.** On a current scaffold it
serves its HTML shell and then 404s on `/@vite/client`, `/ladle.css`,
`/src/index.js` and `/@react-refresh`: a blank page. Last publish **4 November
2025**, nine months ago, which is before Vite 8. It may well work pinned to an
older Vite; on today's defaults it is broken, and that is what "lean" costs when
the leanness is one maintainer.

**5.10 react-cosmos 7.4.0**, published 17 August 2026 — actively maintained,
the same one-URL-per-fixture shape. Not measured in depth here; the honest note
is that it was not tested, only dated.

**5.11 Be your own workshop.** A `/stories` route in `packages/web` that renders
each component with a few prop sets, and `isocan browse localhost:5173/stories`.
One file, no dependency, and — because §2's contract is an index plus a URL per
story — the thing 5.2 was going to be pointed at anyway. The canvas is already a
component workshop that happens to be missing its component list.

## 6. What I would do

1. **5.1 and 5.6 first**, in that order: write the recipe down, then publish a
   static Storybook so the URLs outlive a session. Almost no code, and 5.6 is
   the one that makes a component item worth pointing at.
2. **5.2 + 5.3 as the feature**, with the Ladle shim written on day one and a
   filter in the first version. Zero operations, both surfaces, one afternoon.
   Fix the two warts in §4 while in there.
3. **5.4 when convergence is next picked up** — it is the same conversation as
   `/variation`, not a Storybook feature.
4. **5.11 over 5.8** for isocan's own components. Revisit 5.8 the day this repo
   actually wants a rendered test, and buy Vitest 4 deliberately rather than as
   a side effect of wanting a viewer.

## What was not measured

The web app rendering a projected story **in situ** — the sandbox test used the
exact `sandbox` strings from `ItemView.tsx` in a hand-built page, not the real
app, because the running daemon on port 4441 belongs to somebody's live canvas.
Storybook's docs mode (`viewMode=docs`) as an item. `react-cosmos`. Storybook
against React 18 specifically (the scaffold was React 19). Whether a canvas of
50 live story iframes is usable, which is the question 5.2's filter exists to
avoid answering the hard way.

## Sources

- [Storybook 10.0](https://storybook.js.org/blog/storybook-10/) · [releases](https://storybook.js.org/docs/releases)
- [MCP server](https://storybook.js.org/docs/ai/mcp/overview) · [`storybookjs/mcp`](https://github.com/storybookjs/mcp)
- [Embed stories](https://storybook.js.org/docs/sharing/embed) · [indexers](https://storybook.js.org/docs/api/main-config/main-config-indexers)
- [Storybook composition](https://storybook.js.org/docs/sharing/storybook-composition/) · [#33724, index.json CORS](https://github.com/storybookjs/storybook/issues/33724)
- [Ladle](https://www.ladle.dev) · [react-cosmos](https://reactcosmos.org)
- npm registry, 24 Aug 2026, for every version and publish date above
