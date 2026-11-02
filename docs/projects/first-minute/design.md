# The first minute — the design

**18 September 2026.** The debt this discharges is
[#332](https://github.com/dglazkov/isocan/issues/332): an agent in a small
hosted sandbox pays for isocan at every step of a turn, and a laptop hides all
of it. [journey.md](journey.md) has the three journeys and their targets. This
doc says where the time goes, what to change, and which decisions are open.

## What was measured

On a laptop, 18 Sep 2026, at 61f7616a, `isocan --version`:

| | real | user CPU |
| --- | --- | --- |
| today, tsx cache warm | 0.29 s | 0.43 s |
| today, tsx cache cold (`TMPDIR` empty) | 0.38 s | 1.16 s |
| esbuild bundle of `main.ts`, dependencies external | 0.17 s | 0.22 s |
| `node` alone | about 0.04 s | |

The same command in the #332 sandbox takes 3.3 s.

**And in a sandbox on the laptop.** `node scripts/first-minute.mjs` (phase 0)
installs today's `release` into a container with four cores, Node 22, a cold
disk and no tsx cache, and takes three numbers. Run 18 Sep 2026 against
`release` built from 61f7616a:

| | before (61f7616a) | phase 1 | phase 2 | phase 3 |
| --- | --- | --- | --- | --- |
| `npm install -g …#release` | 14.2 s, 227 packages, 115 MB | 10.3 s, 227 pkgs | **3.9 s, 3 pkgs, 22 MB** | 4.1 s |
| `isocan --version` | 1.12 s cold, 1.07 s warm | 0.14 s | 0.12 s | **0.10 s cold, 0.09 s warm** |
| `node -e ''` in the same container | 0.04 s | 0.05 s | 0.03 s | 0.03 s |
| files `--version` opens | 4397 `openat`, 1396 found | 474 | **49 `openat`, 44 found** | 49 |
| JavaScript `--version` reads | 4.7 MB of `.ts` through tsx | — | 5.8 MB | **4.5 MB** |

A plain container reproduces seconds-per-command — 1.1 s against the laptop's
0.29 s — so the script did not need gVisor, which is as well: `runsc` is not
installed on this machine and `docker info` lists `runc` alone. It does not
reach #332's 3.3 s, and it was never going to: Docker on a laptop is not a
hosted sandbox. **The file count is the number to hold the later phases to.**
3001 of the 4397 opens found nothing — a resolver walking directories that do
not exist — and every one of them is a syscall a sandbox that intercepts the
file system charges full price for. That is the most likely reason 0.3 s
becomes 3.3 s there, and it is measured here rather than argued: the same 456
module loads, 4397 opens, on any disk.

The install is 14.2 s here against #332's 35 s, for the same 227 packages; the
difference is a laptop's network and CPU. 115 MB is what those packages plus
the 40 MB tree cost once unpacked.

**The "after" columns are measured the same way** (`--local`, which
installs this machine's `release` through a temporary bare clone). A command
went from 1.12 s to 0.14 s in the sandbox and from 4397 file opens to 474 —
past the journeys' 0.5 s target for `--version` before phase 3 has begun. The
install did not move until phase 2, which took it to 3.9 s and three
packages: `@types/node`, the one thing it declares, plus its own dependency
and isocan itself. The three packages are not code — every dependency is
inside the bundle — and the 22 MB is `packages/web/dist` and
`packages/cli/dist` in about equal halves.

**Every command loads everything.** Counted with a `load` hook,
`isocan --version` loads 456 modules:

- 297 are our own `.ts` files, 4.7 MB of source: core 137, server 50, api 40,
  cli 35, and the rest module CLIs. `bin/isocan.js` registers tsx, so each of
  them is transpiled, or hashed and looked up in tsx's cache, on every
  command. A sandbox with a fresh disk has no cache.
- 134 are from `node_modules`: zod 95, tsx 22, ws 9.
- All of `@isocan/server` is imported, fastify included, by a command that
  prints a version.
- Every module's `cli.ts` reads its `agent-guide.md` from disk at import time
  (`guide: readFileSync(...)`), whatever the command.

This is the same cost `scripts/roadmap.mjs` measured on 6 Sep 2026 (571 ms a
spawn, 35 s for `roadmap.test.ts`) and the reason the deep lane of the suite
is four minutes: thirty-seven files that spawn the CLI per case.

Why the sandbox turns 0.3 s into 3.3 s was not measured here. The likely cause
is that hosted sandboxes intercept file system calls, so 456 opens and reads
cost far more than on a laptop's disk. Phase 0 measures it.

**What installs.** The `release` branch is HEAD's whole tree plus the built
app, the types and the browser bundles (`scripts/release.mjs`). About 40 MB:

| | MB | an install runs it |
| --- | --- | --- |
| `packages/web` (src and `dist`) | 13.7 | `dist` only, when a daemon serves the app |
| `docs/research` | 9.6 | no (two tarballs are 3.7 and 3.3 MB) |
| `docs/projects`, `changelog`, `reviews`, one 0.8 MB jpg | 4.2 | no |
| `packages/core`, `server`, `cli`, `api` sources | 8.6 | yes, as source, through tsx |
| `test/fixtures` | 0.6 | no |

The 227 packages come from 19 declared dependencies: fastify, the remark
stack, css-tree, parse5, zod, the MCP SDK, and tsx (which brings esbuild and
its platform binary) only because the CLI ships as source.

**The guide** is 189 KB in one file, with each loaded module's guide appended.
There is no way to ask for part of it.

## What to change

### 1. The release CLI is a bundle

`release.mjs` already runs esbuild for the browser bundles. It gains a node
bundle of `packages/cli/src/main.ts` (ESM, `platform: node`), and the release
manifest's `bin` names it. tsx, `workspace-loader.mjs` and 297 file reads are
gone from every command. Source mode is unchanged on `main`: a checkout still
runs `bin/isocan.js` through tsx.

What the bundle breaks is every read relative to `import.meta.url`, because
the file is no longer where its source was. They are:

- `cli/src/agent-guide.ts` and eight module `cli.ts` files: `agent-guide.md`.
- `cli/src/main.ts`: the skill directory, `.git`, the package root
  (`myRoot`), `scripts/canvas-shot.mjs`, `scripts/deck-export.mjs`.
- `server/src/build.ts` and `http.ts`: the package root, for the build stamp,
  `WHATSNEW.md` and `packages/web/dist`.
- `api/src/client.ts`: one path beside itself.
- `modules/design-competition/src/cli.ts`: files beside the module.

Two fixes cover them. Text the CLI prints (the guides) is inlined at build
time with esbuild's text loader. Paths into the package (root, `dist`,
scripts) go through one `packageRoot()` helper that answers correctly from
both a source file and the bundle. Runtime modules under `~/.isocan/modules/`
are already built JavaScript reaching core through `globalThis.isocan`, so
they need nothing.

**Built, phase 1, and three things the list above had wrong.**
`@isocan/core/packageroot` walks up to the `package.json` named `isocan`
rather than counting directories, which is the only form that answers the same
from a checkout, the bundle, `npm i -g`'s tree and
`~/.isocan/current/node_modules/isocan`. It is a subpath and not part of
core's index because the index is bundled for browsers, where a `node:fs`
import fails the build. `import guide from "./agent-guide.md"` is the guide's
text, one rule with four adapters — `bin/workspace-loader.mjs` for source
mode, `release.mjs` and `module-build.mjs` for the two bundles,
`vitest.config.ts` for the suite — declared once in `md.d.ts`. And
`daemonBin()` was not on the list: it spawns `packages/cli/bin/isocan.js`,
which a bundled install does not have, so `packageBin()` reads the target
tree's own manifest.

The bundle is split into 35 chunks rather than one file, because one file was
slower — see phases.md, phase 1's trajectory, for the measurement.

### 2. The install resolves nothing

Inline the dependencies into the bundle and the release manifest declares
none for the CLI. `@types/node` stays, for `connect()`'s consumers. Whether
fastify and the MCP SDK bundle cleanly is phase 2's first question; anything
that does not stays a declared dependency, and the count is still far under
227.

**Built, phase 2.** They all bundled, so `@types/node` is the only survivor
and an install is three packages. Two things the paragraph above did not
know. Half the tree is CommonJS and esbuild's `require` shim needs a real
`require` to fall back to, so every chunk carries a `createRequire` banner —
without it the first command died on *Dynamic require of "node:events" is not
supported*. And `index.mjs` / `rc.mjs`, the package's own module entries,
registered tsx and imported the API from source; they are built beside the
CLI now, sharing its chunks, and the release commits one re-export line for
each.

The release tree drops what an install never runs: `docs/`, `test/`, and,
once the bundle exists, the `.ts` sources of the bundled packages.
`release.mjs` already removes `.github/` from the tree, so this is more of
the same filter. `WHATSNEW.md` and `packages/web/dist` stay.

`RELEASE_DROPS` is that filter, and it names more than three things: the web
app's build inputs, this repository's own workings (the personas, the eval
corpus, the deploy files — the image is built from `green`, never from here),
the tool configuration, and `package-lock.json`, which listed 227 packages the
manifest no longer asks for. Of `scripts/`, three files survive: the two a CLI
verb can spawn and the browser helper they share. 40 MB became 17.

### 3. Lazy loading inside the bundle

After 1, about 0.13 s of the 0.17 s is evaluating modules a command does not
use. `@isocan/server`, `@isocan/mcp`, the design stack and module CLIs move
behind `import()` in the actions that need them; module guides are read only
by `--agent-help`. This matters less than 1 and 2 and comes after them.

**Built, phase 3, and smaller than this paragraph expected.** Splitting the
bundle already deferred most of it: each dynamic import is its own chunk, and
a chunk is read only when something reaches it. What splitting could not fix
was a barrel — `@isocan/server`'s index re-exported `startDaemon`, so the
sixteen files that import it for `paths` were importing fastify, and
`--version` read 2.1 MB of it. `@isocan/server/daemon` is now its own entry.
The guides need no laziness at all: they are build-time constants since phase
1. The rest of the list was left where it is, with a startup-bytes budget in
the suite to re-open the question if it ever matters again — see phases.md.

### 4. The guide in tiers, the summons with its context

`isocan --agent-help` prints the core protocol and an index of topics.
`isocan --agent-help <topic>` prints one topic; module guides are topics.
`surface.test.ts` keeps its rule, restated: every registered command appears
in the core or in a topic the index names.

The rc's summons (`packages/rc/src/helpers.ts`) carries the thread the
comment is in and the id, kind and title of the item it is on, so the first
command of a turn can be the edit.

### 5. An agent that holds no secret

The CLI accepts an identity from the environment: the home, the actor's
public ids, and a statement that authorization is added upstream. It writes
and reads no `identity.json` in that mode and sends no `Authorization` of its
own. Separately, the CLI installs undici's `EnvHttpProxyAgent` as the global
dispatcher when a proxy variable is set, so `HTTPS_PROXY` works without
`NODE_USE_ENV_PROXY`. undici is already a dependency.

### 6. The guard

Two budgets in the suite, because the laptop will never show the regression:

- the number of modules `isocan --version` loads from the bundle, and the
  bundle's size;
- the token count of the core guide.

## Open doors

These are Dimitri's, and the walk stops at each.

1. **A thin artifact.** A direct-mode agent never runs a daemon, so a bundle
   with no server and no web app would be one small file, fetchable with
   `curl`; its size was not measured. It is also a second thing to ship, test and explain. The design
   above does not need it to meet the targets; decide after phase 2's
   numbers.
2. **How the guide is cut.** What is core and what is a topic is a judgement
   about what an agent must know before her first act. Phase 4 proposes a
   cut and stops.
3. **The shape of the no-secret identity.** Environment variables, a flag on
   `isocan direct`, or a config file isocan writes. It changes when the CLI
   refuses for want of an identity, so it is a design call and not plumbing.

## What this does not change

The op vocabulary, the reducer, the daemon, and anything on `main`'s source
mode. Every change here is in how the CLI is packaged, how it starts, and what
it prints.
