# Getting started

**For somebody who has just been handed this repository.** It is the first
hour, not the whole map: enough to run isocan, change it, and know which of
the three places you are pointing at before you type something you cannot
take back.

Two guides sit behind this one. [Develop isocan](development.md) is the full
setup, with a section per machine and a long troubleshooting list — go there
the moment anything here does not work. [Architecture](architecture.md) is
why the pieces are shaped the way they are; it is worth reading once, on the
second day, when the names mean something.

## What this is, in one paragraph

isocan is an infinite shared canvas driven from two surfaces: a web app and a
CLI. **They are equal clients of one daemon**, and that is the whole design
rather than a feature of it. Every shared fact is an Operation either surface
can send, applied by one reducer. So a rule that only the app enforces is not
a rule — this repository has a name for it, *a habit*, and the fix is always
to move the fact into `packages/core` where both sides read it.

The practical version, for your first change: **if you add something to one
surface, ask what the other one does about it.** Usually the answer is a
function in core and two thin callers.

## The first hour

```sh
git clone https://github.com/dglazkov/isocan && cd isocan
npm install
npm test
```

The suite is around 2,700 tests and takes about a minute and a half. It should
be green before you change anything, so that when it is not, you know why.

Then bring the app up:

```sh
npm run dev
```

That starts the daemon on **4441** and Vite on **5173**. Open
`http://localhost:5173` — and use `localhost`, not `127.0.0.1`, which does not
answer for the web server (the daemon answers on both, which is exactly what
makes this confusing once).

Throughout the docs, `isocan` means the CLI in your checkout. For a shell
session:

```sh
alias isocan="node $PWD/packages/cli/bin/isocan.js"
```

Name yourself, make a canvas, and put something on it:

```sh
isocan identity --name "Your Name"
isocan canvas create "Scratch"
isocan add README.md --title "A file"
```

Watch it appear in the browser while you type. That is the thing to internalise
before anything else: the terminal and the tab are the same canvas.

## The three places, and which one to point at

This is the part that costs people an afternoon, so it comes early.

A canvas has a **home** — the daemon that owns it. Your machine can be the home
of some canvases and a *replica* of others at the same time. Three homes matter
here:

| Home | What it is | Use it for |
| --- | --- | --- |
| **Your laptop** | The daemon `npm run dev` starts | Everything, by default. Fast, private, disposable. |
| **dev.isocan.io** | The shared development home, deployed from `green` | Anything that must survive a real network: Firestore, a load balancer, latency loopback cannot reproduce. Also how you show a teammate. |
| **isocan.io** | Production. Real people's real canvases. | Reading. Verifying a deploy. Almost never a test. |

Ask which one you are on before you write:

```sh
isocan home
```

It answers with this daemon's role, the birth default, and a table of every
canvas with its home. `isocan status` is the shorter version.

To make new canvases born at dev instead of here:

```sh
isocan home https://dev.isocan.io
```

That is a *birth default*: it decides where the NEXT canvas is created and
moves nothing that already exists. A canvas cannot be moved between homes
today — decide before you create it.

**Two things worth being careful about.**

*Your writes reach production more easily than you expect.* If your birth
default is `https://isocan.io`, a canvas you create "just to test something" is
created there, on the machine other people are using. Check `isocan home`
before you experiment, and delete scratch canvases when you are done
(`isocan canvas delete <ref> --force`).

*Deploying restarts the home.* A replica pushes an item's bytes to its home by
hand, so a restart in the wrong second used to leave the operation replicated
and the bytes behind — an item with "blob not found" where the screen should
be. The daemon now re-checks and re-sends on a timer, and `isocan blobs
--canvas <ref>` asks the question directly. Still: do not promote while
somebody is presenting.

## How work ships

Edit `main`. CI writes the other two branches; do not.

| Branch | Contents | Written by |
| --- | --- | --- |
| `main` | Source | You |
| `green` | The most recent commit that passed CI | CI |
| `release` | The published CLI | CI |

Every push to `main` runs the suite and the typechecker. If both pass, CI
fast-forwards `green`, and Cloud Build deploys **dev.isocan.io** from it. So
dev is "whatever last passed", automatically.

**Production moves only when a person says so:**

```sh
git tag -f prod origin/green && git push -f origin prod
curl -s https://isocan.io/healthz    # confirm the commit you expect is live
```

Check `healthz` afterwards, every time. It reports the commit actually running,
which is the only way to tell a finished deploy from a slow one.

## How the repository is laid out

```
packages/core        the shared vocabulary: Operations, the reducer, the rules
packages/server      the daemon — routes, storage, the desk, replication
packages/web         the React app
packages/cli         the terminal surface
packages/api         the isomorphic API seam, for programs that drive a canvas
packages/cloudstore  the Firestore/GCS backing used by the hosted homes
```

**`core` is where a rule belongs.** If you find yourself writing the same
decision twice — once in `web`, once in `cli` — that is the signal to move it
down. The repository is fairly strict about this and the tests will tell you.

## The house practices

A few things that are not obvious from the code and will save you a review.

**Tests are design records, not coverage.** A test here says what the system
must do and often why, in prose, including the failure that motivated it. When
you fix a bug, the test that goes with it should describe the bug in a sentence
somebody can read in a year.

**Check that your test fails without your fix.** Break the fix, watch the test
go red, put it back. A guard that never bites is worse than none, because it
looks like protection.

**There are ratchets, and they will stop you.** Spacing steps, radius tokens,
colour tokens, one-declaration-per-class in the stylesheet, the op vocabulary's
size. They fail with an explanation. They are usually right; when they are not,
moving one is a deliberate act with a reason written down.

**Look at the thing you changed.** If it is visual, open it. `getComputedStyle`
and a passing test have both been wrong here in ways a screenshot caught in
five seconds.

**Commit messages carry the reasoning.** Say what was wrong, what it cost, and
why the fix is shaped this way — not just what changed. `git log` is the
densest design documentation in this repository.

## Working with agents

isocan is built to be worked by people and agents on the same canvas, and
connecting one is two steps — one of which you have already done by cloning.

**In this checkout**, the skill is already here: `.agents/skills/isocan-collab`
and a `.claude/` copy of it ship in the repository. So an agent started in this
directory can see it, and the whole of it is:

```
use isocan
```

It reads the skill, makes sure the CLI and the daemon are up, and joins a
canvas as a named collaborator with a cursor of its own.

**Anywhere else** — a different project, a teammate trying it — the skill has
to be installed first, which is the version [`how-to.md`](how-to.md) covers:

```sh
npx skills add dglazkov/isocan
```

then `use isocan` as above. That command installs one file, the doorway; it
starts no daemon and creates no canvas. `npx github:dglazkov/isocan#release
setup` is the same thing done by hand, for a machine with no agent in it.

The CLI ships its own instructions for agents, and they describe the build you
are actually running rather than a copy that can fall behind:

```sh
isocan --agent-help    # the protocol: presence, the lap, parking on `wait`
isocan --help          # the command-by-command reference
```

Both are written for an agent to read. If you are pointing a coding agent at a
canvas, that is the whole onboarding — it ships inside the binary, so it
describes the build you are actually running.

## When something is wrong

* `isocan status` — is the daemon up, is it current, what is it a home of?
* `isocan home` — which home does each canvas belong to?
* `isocan blobs --canvas <ref>` — did this canvas's bytes reach its home?
* `curl -s https://isocan.io/healthz` — what commit is production running?
* `isocan restart` — the daemon is an older build than the CLI you just ran.

[Develop isocan](development.md) has a troubleshooting section covering the
failures that have actually happened, including several that look like your
machine is broken and are not.
