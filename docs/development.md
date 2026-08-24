# Working on isocan

How to get a checkout of this repo into a state where you can change it, run
it, and see the change — on a machine that has never had isocan, or on one that
has had it since before any of the multi-user work landed.

This is **how to work ON isocan**. [`new-project.md`](new-project.md) is the
other thing: how to start a project **on a canvas**, with agents parked on it.
Neither repeats the other, and the two are easy to confuse because both begin
with an empty directory. The test is what you are editing: this repo, or your
own.

There are two doors below because there are two developers. **Dion** has been
landing changes here for weeks from a rig built before any of the home work
existed, so his door is an upgrade — what current `main` does to what he
already has. **Paul** has a clean machine, so his door is a first entry. Take
one, then read *What both doors share*, which is where the discipline and the
hazards live.

Throughout, `isocan` means **the CLI in this checkout**:

```sh
node packages/cli/bin/isocan.js …
```

Not a globally installed `isocan`, which may be a different build than the tree
you are editing — and when they differ the symptom is that your change appears
not to have taken. `alias isocan="node $PWD/packages/cli/bin/isocan.js"` for a
session is fine; an alias in your shell profile is a way to be lied to in six
weeks.

---

## Dion's door — the upgrade

You are not new here. What follows is only what changed under you.

### Your canvases keep working, and nothing is asked of you

The rig you have is: a daemon on `:4441` with `~/.isocan` behind it, canvases
that were born on that machine, and `.isocan/project.json` markers that carry a
canvas id and a title and **no address**. Under phase 10.3's model that shape
is not legacy — it is a first-class state with a name. **A marker naming no
home means "this daemon is that canvas's home."** There is no row for those
canvases in `~/.isocan/homes.json` and there does not need to be; absent means
local.

So on upgrade day, with nothing done:

```
$ isocan home
role           home — this daemon holds the canvases and serves the app at http://127.0.0.1:4441
birth default  here — a canvas born here stays here
```

No canvases table, because nothing is recorded, and nothing recorded is the
same sentence as "everything here is mine". Your canvases open in a browser at
`http://127.0.0.1:4441/p/<id>`, `isocan add` still writes to them, `isocan
open` still opens them.

**That last part is worth saying explicitly, because phase 6 took it away.**
Phase 6 closed the localhost web door: a daemon with a home configured served
ops to CLIs and never pages to persons, which was correct then and would have
broken every locally-born canvas now. Phase 10.3 reopened exactly the part you
need and no more: **a daemon serves the app for the canvases whose home it is,
and signposts the rest.** A canvas that lives at `dev.isocan.io` requested from
your daemon gets a 404 with an `X-Isocan-Home` header and one sentence saying
where to go — because a canvas has exactly one door, and two doors means two
cookies, two service workers and two browser replicas, the local one stale by
construction.

### `isocan home` is a different verb than the one you learned

It no longer re-points your machine. It sets the **birth default** — where the
*next* canvas born here is born — and it reports, per canvas, who answers
where:

```
$ isocan home
role           home of 2 canvases; replica of https://dev.isocan.io (1); new canvases → https://dev.isocan.io
birth default  https://dev.isocan.io — a canvas born here is born there; nothing already here moved
answering      yes — https://dev.isocan.io is up

canvases
CANVAS           ID              HOME
Acme Sprint      prj_Le8Xz…      here — this daemon is its home
Widget Redesign  prj_mj246…      https://dev.isocan.io
```

One note on reading it: `isocan home` does not start a daemon. Run it against a
stopped one and it says `role unknown — no daemon is running`, which is
deliberate, because it is the verb you reach for when nothing works.

If your `config.json` already carried a `home` from the phase 6–7.5 window,
upgrade day pinned those canvases there: a boot migration writes one row per
canvas naming that home, once, and then `homes.json` exists and is never
rewritten wholesale again. That is the promise in the other direction — what
`config.json`'s `home` means for *new* canvases changed, and what it meant for
*existing* ones is frozen so it does not.

### Pointing this rig at a home moves nothing, and that was a bug first

`isocan home https://dev.isocan.io` sets the **birth default** — where the
*next* canvas is born — and leaves every canvas already here exactly where it
is. The command says so in those words, and as of phase 10.5 the words are
true.

They were not, briefly, and the shape is worth knowing because it is the shape
this codebase keeps producing. The boot migration has one branch: *if there is
no `homes.json` and a home is configured, record every canvas as living at that
home* — written for a phase 6–7.5 replica, whose canvases really did live
there. Your rig has no `homes.json`, and `isocan home` writes `config.json` and
then restarts the daemon. The restart walked straight into that branch and
froze every locally-born canvas at a home it had never been to. The pages
404'd, `isocan add` answered `project not found`, and the verb that did it
printed *nothing already here moved*.

Two things fixed it, and both are worth knowing because they describe what your
rig relies on:

- **The migration writes its record even when it is empty.** An absent file is
  what left it armed; `{}` disarms it. Its own comment had said so since it was
  written.
- **A configured home is not evidence that a machine was ever a replica.** The
  evidence is a **badge** at that address, in `identity.json`'s `auth` block —
  a replica knocked on that door and was recognised; a machine that was merely
  *told* an address a moment ago has not. That is what separates your rig from
  the one the migration is for, and it holds even when `isocan home` is the
  very first command you run on new code, which is the case no ordering could
  have saved.

If you are reading this on a rig that already walked into the old bug, the
symptom is unmistakable — `isocan home` shows your local canvases living at an
address you just typed — and no data was lost, only the routing record was
wrong. Ask for the repair rather than hand-editing: the rows are the daemon's
to write.

### What is not free: moving a canvas to a home

Everything above is about canvases **staying** where they are. Taking a canvas
that lives on your laptop and making it live at `dev.isocan.io` is **adoption**,
it is phase 13's, and **it does not exist**. There is no verb, no flag and no
supported hand-edit: changing a canvas's row to an address where that id has
never been seen is how you get a 404 for every page and a refusal for every
write, which is what the section above measures.

What you can do today is birth new work at a home (`isocan home <url>`, then
`isocan project create`), and hand an existing home-borne canvas to another
machine of yours with `isocan pass`. Old local work stays local until phase 13.
Stated plainly rather than cheerfully: if you have a canvas on your laptop that
you want at dev, copy the *content* over onto a new canvas born there, or wait.

### `npm run dev:replica` is a scratch machine now, not self-defence

Two of the three reasons that script used to give are gone. Pointing your real
`~/.isocan` at a home no longer demotes your daemon, and one daemon can serve a
local-home canvas and a dev replica side by side — phase 7.5 called the
replica/home duality inherent, and 10.3 softened it to "not usually your
problem". Read the script's own header; it is one paragraph and it agrees with
this one.

What survives is the reason that was never about self-defence: **an isolated,
disposable state directory that starts from a known-empty machine.** Its own
`ISOCAN_HOME` (`.dev-replica/`, gitignored), a fresh badge with no admissions,
and therefore the join-by-pass flow exercised from zero instead of from
whatever your laptop has accumulated. That is the thing worth having when you
are working on the home, on grants, or on anything a badge's history could make
look like it works.

```sh
npm run dev:replica                                 # a scratch replica of dev, on :4442
npm run dev:replica -- ls                           # any CLI command against it
npm run dev:replica -- setup <home>/p/<id>#<pass>   # give it a canvas, by name
```

It starts empty and that is not a bug — since phase 8 a replica carries the
canvases it was let into. Two traps, both measured: the `setup` line **must not
be run from a directory already bound to a canvas** (the repo root is, the
moment anybody runs `isocan identity` there) — and the refusal comes *after*
the pass has been redeemed, so the pass is burned and you need a fresh one. Run
it from an empty directory with `npm --prefix <checkout> run dev:replica -- setup …`.

---

## Paul's door — from `git clone` to a canvas at dev

Clean machine, nothing installed. Node 24 and git are the only prerequisites.
Every command below was run, in this order, on a fresh clone.

### 1. The checkout

```sh
git clone https://github.com/dglazkov/isocan.git
cd isocan
npm install
npm run build          # build the web app once; the daemon serves it from packages/web/dist
```

`npm install` will leave `package-lock.json` a few lines dirty. That is npm, not
you; `git checkout package-lock.json` if it bothers you.

### 2. Be somebody

```sh
node packages/cli/bin/isocan.js identity --home --name "Paul"
```

`--home` names **the person who owns this machine**. Without it, `identity`
tries to name *the agent running the command* and refuses when nothing in the
environment says which agent that is — which is the right refusal and a
confusing first impression. (Inside a Claude Code or Codex session the harness
variable is there, `--session` is implied, and `isocan identity` in an unbound
directory will also **create and bind a canvas named after the directory** — in
this checkout, one called `isocan`. Useful; just know it happened.)

### 3. A canvas of your own, here

```sh
node packages/cli/bin/isocan.js project create "Acme Scratch"
```

Born locally, because nothing has told this machine otherwise. This is the
canvas you develop the **web UI** against, and you want it before you want
anything at dev — see step 5 for why.

### 4. Run it

```sh
npm run dev            # daemon on :4441, Vite on :5173 with hot reload
```

Open **`http://localhost:5173`**. Not `http://127.0.0.1:5173` — Vite binds the
name, which resolves to `::1`, and the numeric address does not answer.
(The daemon answers on both, which is exactly why the mistake is easy.) The
canvas is at `http://localhost:5173/p/<id>`; `node packages/cli/bin/isocan.js
open` prints and opens the right address for whichever canvas you mean.

`npm run dev` takes the port from any daemon already there, so you are never
quietly served by a stale one. Its Vite half proxies `/api` to a hardcoded
`127.0.0.1:4441`, so a second checkout cannot simply be given another port —
that is an edit to `packages/web/vite.config.ts`, and usually the wrong move
next to just having one checkout.

### 5. A canvas of your own, at dev

`dev.isocan.io` is the dogfood home. Point the **birth default** at it and make
a canvas there:

```sh
node packages/cli/bin/isocan.js home https://dev.isocan.io
node packages/cli/bin/isocan.js project create "Widget Redesign"
node packages/cli/bin/isocan.js --project "Widget Redesign" share
```

```
address  https://dev.isocan.io/p/prj_mj246fKBrV
link     on — anyone with the address can enter (granted 2026-08-24)
```

Open that address in a browser and it is yours. Write to it from the terminal
and the write goes through your daemon to dev:

```sh
node packages/cli/bin/isocan.js --project "Widget Redesign" add notes.md --title "Acme spec"
```

**Order matters, for one non-obvious reason.** A daemon with a birth default set
and not one canvas of its own is a *pure replica* — it serves no pages at all,
so `http://localhost:4441/` and every `/p/<id>` under it go dark, and the web UI
you are trying to develop has nowhere to live. Make the local canvas first and
the question never comes up.

### 6. What you now have, and why it is two things

```
$ node packages/cli/bin/isocan.js home
role           home of 1 canvas; replica of https://dev.isocan.io (1); new canvases → https://dev.isocan.io
birth default  https://dev.isocan.io — a canvas born here is born there; nothing already here moved
answering      yes — https://dev.isocan.io is up

canvases
CANVAS           ID              HOME
Acme Scratch     prj_lGBWI…      here — this daemon is its home
Widget Redesign  prj_mj246…      https://dev.isocan.io
```

One machine, one daemon, two homes. The local canvas is what you point a
browser at while you change the app. The dev canvas is what proves the change
survives a real home — Firestore, a load balancer, a WebSocket that has to
cross the internet, and the class of race that only shows up when the round
trip is longer than a loopback (*"local timing wins races the internet
loses"*).

Asking your own daemon for the dev-homed canvas gets you the signpost rather
than a second door:

```
$ curl -i http://127.0.0.1:4441/p/prj_mj246fKBrV
HTTP/1.1 404 Not Found
x-isocan-home: https://dev.isocan.io

this canvas lives at https://dev.isocan.io — open it there
```

That is correct, and it is the shape to expect: the web app's route makes the
same check client-side before it mounts anything, so a `<Link>` to a canvas
that lives elsewhere renders a signpost page rather than opening a socket and
an IndexedDB replica for a canvas whose real copy is somewhere else.

### 7. Prove it round-tripped

The strongest single check that a home is really involved is a second machine
that has only ever talked to the home:

```sh
node packages/cli/bin/isocan.js --project "Widget Redesign" pass    # mint a single-use pass
cd /some/empty/dir
npm --prefix ~/src/isocan run dev:replica -- setup 'https://dev.isocan.io/p/<id>#<pass>'
npm --prefix ~/src/isocan run dev:replica -- --project "Widget" ls
```

The item you added from your own terminal comes back on a scratch machine with
its own `ISOCAN_HOME`, its own badge, and no knowledge of your disk. That is
the round trip.

---

## What both doors share

### Clean-shell discipline

**Use `isocan home`. Never export an `ISOCAN_*` variable into your shell.**

The dance phase 7.5's proof had to perform — three exported variables, a
scratch `ISOCAN_HOME`, a hand-started daemon — was **self-defence against a
configuration model that no longer exists**. Back then `config.json` had one
`home` key, a daemon had one connection, and setting that key demoted the whole
machine and stopped it serving pages, so a temp directory was the only way to
look at a home without losing your own. Phase 10.3 deleted the premise: the
home is a property of the canvas, one daemon holds several, and the birth
default moves nothing that already exists. There is nothing left to defend
against, and an exported variable now buys you only the ways it can lie.

Specifically, `ISOCAN_HOME_URL` in your environment **wins over `config.json`**
and is inherited by any daemon the CLI starts — so a shell that has it set will
disagree with the file, silently, for as long as that shell lives. `isocan home
<url>` refuses to write the file while it is set rather than pretending to
work:

```
error: ISOCAN_HOME_URL=… is set in this shell and wins over the config file —
unset it first (`unset ISOCAN_HOME_URL`), then run this again
```

The two legitimate exceptions are both scoped to one process and neither is an
export: `scripts/dev-replica.mjs` sets `ISOCAN_HOME`, `ISOCAN_PORT` and
`ISOCAN_HOME_URL` for the child it spawns and writes them to no file, and the
test suite points `ISOCAN_HOME` at scratch directories. If you catch yourself
typing `export ISOCAN_`, the verb you want is `isocan home`, `--port`, or
`npm run dev:replica`.

### How the work runs — the conductor model, as a human runs it

[`phases.md`](phases.md) is the walk. Its **"where we are"** line says which
phase is next, and a clean session starts by believing it.

A working session is a **conductor**: it does not write the phase's code
itself. It reads the status line, spawns a subagent on the next phase — handing
it that phase's section, the docs the section cites, and `AGENTS.md` — and then
**verifies the named proof itself**: runs the suite, replays the scene, drives
the browser. Never taking the subagent's word for it is the whole point; the
proofs are named up front precisely so review is mechanical. Work that fails
review goes back down — adjust the instructions, respawn, re-review. When the
proof holds, the conductor writes the Findings, moves the status line, edits
[`architecture.md`](architecture.md) if a finding redrew the map, and commits
the phase whole.

Two rules that are easy to break by accident. **Phases run in order** — each
stands on the last; parallel subagents belong *inside* a phase, never across
phases. And every step marked **⚑ provision** is **asked of Dimitri out loud
before it runs** (see below): a conductor spawns workers freely and never a
cloud resource without permission.

For you as a human this means the same thing it means for a session: read the
status line, do the next phase, prove the named proof yourself, write down what
surprised you. A finding is worth more than the code that produced it, and
`phases.md` is where it goes — one dated line, the claim and nothing else, with
the argument in the commit message.

### The deploy gate — dev deploys from `green`, not from `main`

Since phase 10.5 there are **three refs and three jobs**: `main` is the source,
`green` is the *tested* source, and `release` is the shipped CLI. You work on
`main`; the other two are generated and neither is ever edited by hand.

CI ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) runs on
every push to `main`. It runs `npm test` with **`ISOCAN_REQUIRE_EMULATOR=1`** —
locally the Firestore-backed suites skip loudly and say what they did not
check; on CI a skip is a failure, because a green run that did not test
Firestore launders an unknown into a checkmark — and then `npm run typecheck`.
Only after both pass does it fast-forward `green` to that commit, and Cloud
Build's trigger watches `green`. So a commit that compiles on your laptop and
does not boot never reaches the dogfood home, and neither developer can take
down the other's dev environment with a red commit.

The fast-forward is a plain `git push` with no force: a refusal means `green`
already points at something your commit is not an ancestor of (an out-of-order
or re-run build), and the deployed home stays where it is rather than moving
backwards. It logs a warning and the release still publishes, because the two
pipelines are independent by design.

**Honest status: the trigger in GCP has not been repointed yet.** The workflow
advances `green`, `infra/95-build-trigger.sh` is written to watch `^green$`, and
`AGENTS.md` says so — but until somebody runs `infra/provision.sh d` against
`isocan-io-dev`, the live Cloud Build trigger is still whatever it was
configured with, which was push-to-`main`. That is a **⚑ provision** step and it
has not been run. Until it is, assume dev deploys on push to `main` and that the
gate is a property of the repo rather than of the cloud.

### Who holds provisioning, and whom a ⚑ asks

**Dimitri holds GCP on `isocan-io-dev`** — the project lives under the
`glazkov.com` org and bills to his account — and **a conductor's ⚑ step asks
Dimitri out loud before it runs.** That is the whole answer; there is no second
operator, which is also why `infra/` is small idempotent shell scripts rather
than Terraform. [`infra/README.md`](../infra/README.md) is the decision,
`infra/provision.sh` is the button, and its "what needs a human" table is the
list of things no script can do at all (billing, DNS, the GitHub OAuth consent,
waiting for a managed certificate).

### The hazard list

Things that have actually gone wrong, or are one keystroke from going wrong.

- **A working daemon pointed at dev by accident.** The way in is an exported
  `ISOCAN_HOME_URL`, which outranks the config file and is inherited by the
  daemon — which is the whole reason for the clean-shell discipline above.
  `isocan home` with no argument is the check; the row that should say
  `here — this daemon is its home` is the thing to look at.

  The *second* way in was fixed in phase 10.5 and is described above: the first
  `isocan home <url>` on a machine with no `homes.json` used to record every
  canvas as living at that address. It no longer does, and there is a test
  named for the rig it broke. It is listed here because "the verb that says
  nothing moved, moving everything" is the kind of thing worth recognising the
  second time.

- **`/api/healthz`, never `/healthz`.** A hosted home is behind Google's
  frontend, which swallows the exact path `/healthz` on a `*.run.app` host and
  answers its own 404 — so a probe that has only ever run against `127.0.0.1`
  reads a live home as dead, and the container never sees the request.
  `/api/healthz` is the same handler and the same body on a prefix Google
  forwards, and it is what the uptime check and the Cloud Run smoke test use.
  *Measured 2026-08-24 and worth stating precisely:* through the load balancer
  at `https://dev.isocan.io`, `/healthz` **does** answer 200 from our daemon
  today, so the swallow is not visible at that address. The rule stands anyway,
  because a home's address is configuration — a bare Cloud Run URL is a valid
  one — and a health path that is only correct for some addresses is not a
  health path.

- **`scripts/new-project.sh` is missing from the repo.**
  [`new-project.md`](new-project.md) opens by pointing at it, and `README.md`
  and `AGENTS.md` both link to it, and it is not in the tree and not in the
  history. Everything the doc describes still works by hand — the doc is the
  step-by-step and it is correct — but the one-command form does not exist yet.
  **It is Dion's to push; do not write it here and do not edit his doc.**

- **Vite answers on `localhost:5173`, not `127.0.0.1:5173`.** It binds the name,
  which resolves to `::1`. The daemon answers on both, so the habit of typing
  the numeric address works everywhere except the one place you need it.

- **`npm run dev`'s proxy target is hardcoded** to `127.0.0.1:4441` in
  `packages/web/vite.config.ts`. `--port` moves the CLI and the daemon; it does
  not move the proxy. Two checkouts serving two dev UIs at once is a config edit,
  not a flag.

- **`npm run dev:replica -- setup <address>#<pass>` refuses inside a bound
  directory — after redeeming the pass.** The repo root is bound the moment
  anyone runs `isocan identity` there, so the natural place to type it is the
  one place it fails, and the pass is single-use and already spent. Run it from
  an empty directory via `npm --prefix <checkout> run dev:replica -- setup …`.

- **`isocan identity --name` without a harness session is an error**, not a
  fallback. A person names themselves with `--home`; an agent names itself with
  `--session` and a session id its harness exports.

- **`isocan home` does not start a daemon.** Against a stopped one it reports
  `role unknown — no daemon is running on …` and what `config.json` says. That
  is deliberate — it is the verb for when nothing works — but it means "I ran
  `isocan home` and it said unknown" is not evidence of a broken install.

- **A canvas made from the web front page on a mixed rig is born at the birth
  default**, so it does not appear in the list it was made from, and the button
  looks like it silently failed. Known, filed as an open finding in phase 10.3.

- **The web UI needs a canvas whose home is your own daemon.** A dev-homed
  canvas opened at `localhost:5173` renders the signpost page, by design and
  before anything mounts. Keep one local canvas for UI work; that is the whole
  of what remains of phase 7.5's replica/home duality.

### The rest of the map

- [`AGENTS.md`](../AGENTS.md) — house rules, and "done means done on both
  surfaces": the checklist that keeps the CLI and the web app from diverging.
- [`README.md`](../README.md) — what the product is and what it does.
- [`phases.md`](phases.md) — the walk, the status roster
  (`grep '^\*\*Status' docs/phases.md`), the standing lessons, and the open
  debts (`grep -n '— Open' docs/phases.md`).
- [`architecture.md`](architecture.md) — the physical map: what runs where.
- [`multiuser-journey.md`](multiuser-journey.md) — the ideal, held as scenes;
  the acceptance suite every phase is graded against.
- [`design/`](design/) — one bounded mechanism per file, each opening by naming
  the debt it discharges.
- [`reviews/lessons.md`](reviews/lessons.md) — the failure modes this codebase
  has actually produced, each with the guard that now catches it.
- [`new-project.md`](new-project.md) — the other doc: starting a project on a
  canvas, which is not this.
- `isocan --agent-help` — the collaboration protocol, shipped inside the CLI so
  an upgrade upgrades the instructions.
