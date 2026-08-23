# Eighteen roads out: readiness of the proposed features

**21 August 2026** · [full write-up](https://claude.ai/code/artifact/2754aec1-01e6-4543-bcda-657ff925ed5a)

Eighteen features, graded by what stands between the idea and a working version
— not by value. Four are assembly, six are a week each, four are blocked on one
decision, three need foundations that do not exist, one needs explaining to me.

## The finding that reorders the list

Items 1–4 (auth, cloud, multiple users, remote agents) are not greenfield. The
repo contains a **multiuser era that was built and then wound back**:
`ae3d227..b2b9f6e` shipped lazy Firestore provisioning, the host daemon as sole
mirror writer, remote projects, a share marker and capability links, and
`cba0a78` reverted all of it — *"the designated-host + Firestore-mirror approach
is off the table."*

That work was not naive: the mirror hung off the engine's op event rather than
its write chain, so an outage could never sit between a person and their canvas;
the schema carried full log entries so a guest's undo worked identically; Google
was hand-rolled REST so no SDK landed in installs of a canvas nobody shares.

The property it could not escape is that **a shared canvas only exists while one
particular laptop is open**. Cloud running is therefore not a sibling of
multi-user and remote agents — it is the thing that design was avoiding.

## Grades

- **Assemble** — pieces are in the tree; days.
- **Build** — design clear, nothing unknown; ~a week.
- **Decide** — one named question blocks it.
- **Foundations** — needs auth, or a daemon that is not your laptop.
- **Define** — the shape is not known; a prototype would be learning.

| Feature | Grade | Note |
| --- | --- | --- |
| Self-hosting (isocan on isocan) | Assemble | binding exists; 2–3 days |
| Trigger agents on events | Assemble | `wait --item/--op` exists; needs a runner + durable triggers |
| Design systems | Assemble | shipped since: DESIGN.md, tokens, CSS, linter |
| Share/compare skills | Assemble | `--from` shipped; `command diff` is the missing half |
| Personas | Build | an actor + skills + instructions, as a canvas item |
| Point a canvas at a repo | Build | read model, not sync; the smart part is a skill |
| Chat surfaces (Slack/Discord/Chat) | Build | outbound-only bridge needs no auth — cheapest path to "from my phone" |
| GitHub commit/push | Build | never auto-push, never to a default branch |
| Design taste (impeccable) | Build | first slice shipped; next is the checkable half (axe, contrast, visual diffs) |
| Multiple users / remote agents | Build* | almost no canvas work; entirely the keystone |
| Authentication | Decide | device keys vs identity provider vs both; recommend both, keys as primitive |
| Components | Decide | is an instance a copy or a reference? recommend copies with drift detection |
| Stitch loop skill | Decide | depends what the loop exchanges — HTML is small and good, screenshots are weak |
| agents-ctl mesh runner | Decide | unread; send a link |
| Cloud running | Foundations | the daemon *is* a server already; the work is auth, storage, operations |
| Mobile access | Foundations | try the chat bridge first — a phone is a bad infinite canvas |
| Self-improving loops | Define | make outcomes legible first, then see what wants to close |

## What holds up what

Ten of the eighteen need nothing from the keystone. Auth blocks exactly three
(multi-user, remote agents, mobile), and today every op carries its actor in the
request body unchecked — deliberate, stated in the code, and fine for a daemon
bound to 127.0.0.1.

## Recommended order

1. **Self-host** — turns every remaining gap into something felt rather than planned.
2. **Personas** — multiplies the others: skills and voice travel with the project.
3. **Durable triggers** — agents that are already watching.
4. **Decide the auth model** — not build; decide. The reverted branch says guessing wrong costs a month.

## Open questions

- What actually killed the mirror approach? The commit says off the table, not
  why. (Upstream's newer `docs/multiuser-journey.md` and `docs/phases.md` may
  now answer this.)
- What is agents-ctl?
