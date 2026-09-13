# Agents in a cell

How to set up Cloudflare, sheep, and isocan so an agent on your canvas runs
somewhere that is not your laptop.

Normally an isocan agent's session is a process on your machine: you start
`isocan rc`, somebody mentions the agent, and a harness runs the turn beside
you. With the **sheep** harness the turn runs in a *cell* instead — a Durable
Object on your own Cloudflare account, with its own container, its own
workspace and its own transcript. Your laptop still parks the `rc` that hears
the canvas and summons the agent; it just stops being the machine that works.

You need three things, in this order:

1. **A sheep home** — one Worker and its container application, on your
   Cloudflare account. Deployed for you by `sheep setup`.
2. **isocan** — the CLI, the daemon, and a canvas.
3. **An agent enrolled with `--harness sheep`**, and an `rc` parked.

The first two are one sitting each and never asked for again.

## Before you start

- **Node 24.**
- **A Cloudflare account on the Workers Paid plan** — 5 USD a month. Container
  minutes are billed on top, and only while a sheep is actually working; an
  idle cell costs nothing. Pricing: <https://developers.cloudflare.com/containers/pricing/>
- **An Anthropic API key**, made at <https://console.anthropic.com/settings/keys>.
  Your sheep call the model with it, at Anthropic's rates. Sheep adds nothing.
- **A canvas at isocan.io**, which is what isocan's setup picks for you. (If
  you deliberately keep canvases on your own laptop's daemon, read
  [canvases on your own machine](#canvases-on-your-own-machine) first.)

## 1. Set up sheep and Cloudflare

At your own terminal, in any directory:

```sh
npx github:dglazkov/sheep#release setup
```

It prints a checklist of seven steps that fill in as you go. Press `?` on any
step to open a few lines saying what it is for, where to get what it asks for,
what it costs, and what sheep does with it; `?` again closes them.

| Step | What it wants |
| --- | --- |
| **command** | nothing — it puts `sheep` on your PATH |
| **where** | whether this machine's settings go everywhere (`~/.sheep`, the default — press Enter) or in this directory alone |
| **account** | a Cloudflare API token, typed at a hidden prompt |
| **plan** | nothing — it checks the account is on Workers Paid, and waits on the dashboard's plans page if it is not |
| **station** | Enter deploys your home: one Worker and its container application, named for where you are |
| **key** | your Anthropic key, typed at a hidden prompt |
| **next** | nothing — it prints the address and where the two values are kept |

**The Cloudflare token** is made at
<https://dash.cloudflare.com/?to=/:account/api-tokens> with seven permissions:

> Workers Scripts (edit), Durable Objects (edit), Containers (edit), Workers
> Subdomain (edit), Workers KV Storage (edit), Account Settings (read),
> Billing (read).

Both values land in `~/.sheep/credentials`, mode 600, and nowhere else. They
are never printed, never in a process's arguments, and the Anthropic key is
put on the home as its own secret.

Check it worked:

```sh
sheep home     # the address, the build stamps, eyes, and the container
sheep ls       # an empty herd, which is the right answer on day one
```

## 2. Set up isocan

From any directory:

```sh
npx github:dglazkov/isocan#release setup
```

That puts `isocan` on your PATH, installs the collab skill where agents look
for it, starts the daemon, and opens the app. Pick your name there and make a
canvas — one click.

On a machine that has never held a canvas, setup also writes **isocan.io** down
as the birth default, so the canvas you make next is born there rather than on
your laptop's daemon. Leave that as it is: it is exactly what the sheep path
needs.

## 3. Enrol an agent whose sessions are sheep

```sh
isocan harness          # `sheep` should be listed, with the home it found
isocan rc add Percy --harness sheep
isocan rc               # park; --all to answer on every canvas you have enrolments on
```

`isocan harness` calls the sheep harness *runnable* when two things are true:
`sheep` is on your PATH, and the kennel for this directory (`.sheep/` at or
above it, else `~/.sheep`) names a home. Its row says which home.

Now go to the canvas and say something to Percy — a comment mentioning it, or a
reply in a thread it is in. The `rc` narrates what happens.

**An agent answers you alone** until you say otherwise. That is the default,
because the turn spends your money. To widen it:

```sh
isocan rc listen Percy --to everyone     # or --to maya,usama, or --to me to put it back
```

## What the first summons does, and why it is slow

The first time you summon a sheep-harnessed agent, quite a lot happens, and
the `rc` says each step as it goes:

1. A **pasture** is made for the agent — a small tree every sheep of that name
   is born into, holding a brief that names the agent and the canvas, and the
   isocan collab skill.
2. A **pass** is minted: short-lived, single-use, and good for exactly this
   agent's identity on exactly this canvas. It rides into the cell as that
   sheep's own secret, so it never appears in a prompt or a transcript and the
   model's own shell cannot read it.
3. A **sheep is minted idle** — no model turn is spent being born.
4. The summons arrives, the cell starts a **container**, and the container runs
   the pasture's setup: install the isocan CLI, redeem the pass once, and keep
   the resulting sign-in in a home directory the cell keeps across containers.
5. The turn runs, and its tool calls reach the agent's face on the thread as
   they land.

Expect roughly:

| Turn | How long |
| --- | --- |
| first, cold container | ~2 minutes, almost all of it installing the CLI |
| warm | 15–45 seconds |
| first one after an idle spell | 3–4 minutes, in a fresh container |

The two minutes is a known cost, not a fault: a fresh container installs the
isocan CLI from scratch every time. Tell people the first turn after a quiet
night is slow.

## Canvases on your own machine

A sheep home deployed on Cloudflare is on the internet; your laptop's daemon is
not. So a station cannot reach a canvas that lives on your own machine, and the
`rc` refuses at the summons rather than mint a pass nobody can redeem — it
names the canvas, the daemon it is on, and both ways out.

Canvases born at isocan.io are unaffected, which is the usual case and the one
setup arranges. If you do want an agent on a canvas that lives on your laptop,
run a **local sheep home** instead of a station: `sheep home local`, in the
directory whose kennel you are using. That one reaches your daemon through
Docker.

## What it costs

- **Workers Paid**, 5 USD a month, on your own Cloudflare account.
- **Container minutes**, only while a sheep is working. An idle cell costs
  nothing, which is the whole point of a cell — but every cold container spends
  about two minutes installing before it does anything useful.
- **Model usage**, billed to your Anthropic key at Anthropic's rates.

Your home reports its container minutes at `GET /home`, so the bill is
readable rather than guessed at.

## When something goes wrong

| What you see | What it means |
| --- | --- |
| `Percy names sheep, and this machine has no sheep on its PATH` | install it: `npm install -g github:dglazkov/sheep#release`, then `sheep setup` for a home (the refusal's own wording still names `sheep home join`, which is withdrawn — `sheep setup` is the verb now) |
| `Percy's sheep have no home: the kennel at … names none` | the directory found a kennel with no home in it. `sheep setup` (a station), or `sheep home local` (Docker, on this machine) |
| `Percy's sheep live at X, and the kennel at … now names Y` | the kennel was re-pointed after the sheep was born. Point it back, or withdraw and re-enrol Percy to start over at the new home |
| `… a station, which cannot reach "…" on this machine's daemon` | the canvas lives on your laptop and the sheep home is a station — see [canvases on your own machine](#canvases-on-your-own-machine) |
| the agent simply never replies | a cell that cannot rent a container can end its turn silently. Check `sheep status <id>` and `sheep log <id>`; the next summons usually works |
| a line on stderr about the home's build and the command's differing | `npm install -g github:dglazkov/sheep#release` to update the command, `sheep home deploy` to bring the home up to it (every session and pasture is kept) |

Useful while you are watching:

```sh
sheep ls                 # the herd, with what each is doing
sheep status <id>        # one sheep
sheep log <id>           # its transcript — what it actually ran
sheep attach <id>        # pi's own terminal on the same cell, from your machine
isocan who               # who stands on the canvas, and whose word they take
```

## A second laptop

Run `sheep setup` at its own terminal. The **account** step asks for the token,
since that machine has never held one; **station** lists the homes your account
already has, and choosing yours joins it — the home hands over its own token,
and nothing is copied between laptops by hand. **key** asks nothing, because
the home holds its own. `sheep ls` there lists the sheep your first laptop made.

## Ending things

```sh
isocan rc remove Percy   # withdraw: ends the sheep and the sign-in its cell held
sheep rm <id>            # end one sheep yourself
sheep home delete        # remove the home entirely — it lists what goes, and
                         # waits for the station's name typed at your terminal
```

Withdrawing keeps the pasture `isocan-Percy`: it is yours, and re-enrolling
Percy births a new sheep into it, which does not remember the old one.

## Where this is written down

- [`sheep`](https://github.com/dglazkov/sheep) — the command, its README, and
  the `sheep --agent-help` your agent reads.
- [`docs/projects/sheep-harness/design.md`](projects/sheep-harness/design.md)
  — why the isocan half is shaped the way it is, with the timings above
  measured on the day.
- [`docs/research/2026-09-13-a-sheep-on-every-canvas.md`](research/2026-09-13-a-sheep-on-every-canvas.md)
  — what it would take for one of these to stand on every canvas you can reach,
  without your laptop in the loop. Not built.
